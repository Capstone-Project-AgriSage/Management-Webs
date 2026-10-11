import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import { Eye, Coins, Hourglass, RefreshCw } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { describeError } from '@/api/client';
import { refundsApi, type CancelledOrderRow, type Refund } from '@/api/refundsApi';
import { returnsApi, type ReturnListItem, type SalesReturn } from '@/api/returnsApi';
import KpiCard from '@/components/ui/KpiCard'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { formatVnd } from '@/utils/money';
import { formatDateTime } from '@/utils/units';
import RefundsPanel from './RefundsPanel'
import { RETURN_STATUS_BADGE_CLASS, returnStatusText } from '../returns/returnLabels';
import { LIST_PAGE_SIZE } from '@/utils/pagination';
import { mergePagedLists } from '@/utils/mergePagedLists';
import { RequestCache } from '@/utils/requestCache';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'

type Tab = 'orders' | 'returns'

interface OrderEntry {
  order: CancelledOrderRow
  refunds: Refund[]
}

const sum = (refunds: Refund[], status: Refund['status']) => refunds.filter((r) => r.status === status).reduce((s, r) => s + r.amount, 0)

/**
 * Where an order stands: 'pending' = a refund waits to be paid; 'retry' = a refund of some payment failed or was cancelled and
 * nothing replaced it yet, so a new one has to be created (it must stay in the list, or the owner could not do that);
 * 'done' = every payment has a completed refund.
 */
function orderState(refunds: Refund[]): 'pending' | 'retry' | 'done' {
  if (refunds.some((r) => r.status === 'PENDING')) return 'pending'
  const byPayment = new Map<string, Refund[]>()
  for (const r of refunds) byPayment.set(r.originalPaymentId ?? 'none', [...(byPayment.get(r.originalPaymentId ?? 'none') ?? []), r])
  const retry = [...byPayment.values()].some((g) => !g.some((r) => r.status === 'COMPLETED') && g.some((r) => r.status === 'FAILED' || r.status === 'CANCELLED'))
  return retry ? 'retry' : 'done'
}

/**
 * "Hoàn tiền": what is still to be paid back to customers, gathered from the two places refunds come from (the API has
 * no single refund list): orders that were cancelled after payment, and sales returns whose inspection is closed.
 */
export default function RefundsPage() {
  usePageHeader({ title: 'Hoàn tiền', subtitle: 'Các khoản cần trả lại khách từ đơn đã hủy và từ trả hàng; ghi nhận khi đã trả tiền' })
  const { showToast } = useToast()

  const [tab, setTab] = useState<Tab>('orders')
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sourceStatus, setSourceStatus] = useState('')
  const [orderTotal, setOrderTotal] = useState(0)
  const [orderPages, setOrderPages] = useState(1)
  const [returnTotal, setReturnTotal] = useState(0)
  const [returnPages, setReturnPages] = useState(1)
  const debouncedSearch = useDebouncedValue(search.trim())
  const orderCache = useRef(new RequestCache())
  const returnCache = useRef(new RequestCache())
  const [revision, setRevision] = useState(0)
  // The inactive tab's summary uses its first page, independent of active-table pagination/filters.
  const ordersPage = tab === 'orders' ? page : 1
  const ordersSearch = tab === 'orders' ? debouncedSearch : ''
  const ordersStatus = tab === 'orders' ? sourceStatus : ''
  const returnsPage = tab === 'returns' ? page : 1
  const returnsSearch = tab === 'returns' ? debouncedSearch : ''
  const returnsStatus = tab === 'returns' ? sourceStatus : ''

  const [orders, setOrders] = useState<OrderEntry[] | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [returns, setReturns] = useState<ReturnListItem[] | null>(null)
  const [returnsLoading, setReturnsLoading] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [returnsError, setReturnsError] = useState<string | null>(null)

  const [openOrder, setOpenOrder] = useState<string | null>(null)
  const [openReturn, setOpenReturn] = useState<string | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<ReturnListItem | null>(null)
  const [returnDetailErrors, setReturnDetailErrors] = useState<Record<string, string>>({})
  const [returnDetail, setReturnDetail] = useState<Record<string, SalesReturn>>({})

  const loadOrders = useCallback(async (signal: AbortSignal) => {
    setOrdersLoading(true)
    setOrderError(null)
    try {
      const result = await refundsApi.getCancelledOrders(ordersPage, ordersSearch || undefined, ordersStatus as 'CANCELLED' | 'PARTIALLY_CANCELLED' || undefined, { signal, cache: orderCache.current })
      signal.throwIfAborted()
      const entries = await Promise.all(
        result.items.map(async (order) => ({ order, refunds: await orderCache.current.get(`refunds:${order.id}`, () => refundsApi.listForOrder(order.id, signal), signal) })),
      )
      signal.throwIfAborted()
      if (ordersPage !== result.page) { setPage(result.page); return }
      setOrders(entries)
      setOrderTotal(result.totalCount); setOrderPages(Math.max(1, result.totalPages))
    } catch (err) {
      if (!signal.aborted) {
        const message = describeError(err, 'Không tải được các đơn đã hủy')
        setOrderError(message); showToast(message, 'error')
      }
    } finally {
      if (!signal.aborted) setOrdersLoading(false)
    }
  }, [ordersPage, ordersSearch, ordersStatus, showToast])

  const loadReturns = useCallback(async (signal: AbortSignal) => {
    setReturnsLoading(true)
    setReturnsError(null)
    try {
      const allowed = onlyOpen ? (['INSPECTED', 'PARTIALLY_RESOLVED'] as const) : (['INSPECTED', 'PARTIALLY_RESOLVED', 'COMPLETED'] as const)
      const statuses = returnsStatus ? allowed.filter(status => status === returnsStatus) : allowed
      const result = await mergePagedLists<ReturnListItem>(statuses.map(status => sourcePage => {
        const params = { status, search: returnsSearch || undefined, page: sourcePage, pageSize: LIST_PAGE_SIZE }
        return returnCache.current.get(JSON.stringify(params), () => returnsApi.list(params, signal), signal)
      }), returnsPage, (a, b) => b.requestedAt.localeCompare(a.requestedAt) || a.id.localeCompare(b.id))
      signal.throwIfAborted()
      if (returnsPage !== result.page) { setPage(result.page); return }
      setReturns(result.items); setReturnTotal(result.totalCount); setReturnPages(Math.max(1, result.totalPages))
    } catch (err) {
      if (!signal.aborted) {
        const message = describeError(err, 'Không tải được danh sách trả hàng')
        setReturnsError(message); showToast(message, 'error')
      }
    } finally {
      if (!signal.aborted) setReturnsLoading(false)
    }
  }, [onlyOpen, returnsPage, returnsSearch, returnsStatus, showToast])

  const loadReturnDetail = useCallback(
    async (id: string) => {
      try {
        setReturnDetailErrors(prev => ({ ...prev, [id]: '' }))
        const detail = await returnsApi.get(id)
        setReturnDetail((prev) => ({ ...prev, [id]: detail }))
      } catch (err) {
        const message = describeError(err, 'Không tải được phiếu trả hàng')
        setReturnDetailErrors(prev => ({ ...prev, [id]: message }))
        showToast(message, 'error')
      }
    },
    [showToast],
  )

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return loadOrders(controller.signal) })
    return () => controller.abort()
  }, [loadOrders, revision])

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return loadReturns(controller.signal) })
    return () => controller.abort()
  }, [loadReturns, revision])

  const refreshLists = useCallback(() => {
    orderCache.current.clear()
    returnCache.current.clear()
    setRevision(value => value + 1)
  }, [])

  useEffect(() => {
    window.addEventListener('agrisage-business-data-changed', refreshLists)
    return () => window.removeEventListener('agrisage-business-data-changed', refreshLists)
  }, [refreshLists])

  const orderRows = useMemo(() => (orders ?? []).filter((e) => e.refunds.length > 0 && (!onlyOpen || orderState(e.refunds) !== 'done')), [orders, onlyOpen])
  const pendingOrders = useMemo(() => (orders ?? []).reduce((s, e) => s + sum(e.refunds, 'PENDING'), 0), [orders])
  const pendingOrderCount = useMemo(() => (orders ?? []).filter((e) => orderState(e.refunds) !== 'done').length, [orders])
  const returnsToPay = useMemo(() => (returns ?? []).filter((r) => r.status !== 'COMPLETED'), [returns])

  const toggleReturn = (item: ReturnListItem) => {
    if (openReturn === item.id) {
      setOpenReturn(null)
      return
    }
    setSelectedReturn(item)
    setOpenReturn(item.id)
    loadReturnDetail(item.id)
  }

  const reloadAfterChange = (returnId?: string) => {
    // Successful API writes already invalidate the list caches through the business-data event.
    if (returnId) loadReturnDetail(returnId)
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <BusinessReportCards kind="refunds" leadingCards={<>
        <KpiCard
          icon={Hourglass}
          iconClassName="bg-amber-50 text-amber-600"
          title="Đơn cần hoàn tiền trên trang"
          className="border-slate-200 min-h-40"
          value={ordersLoading || orderError || orders === null ? '...' : pendingOrderCount}
          valueSuffix={<span className="text-sm text-slate-500">đơn</span>}
          subtitle={orderError || (ordersLoading || orders === null ? undefined : `${formatVnd(pendingOrders)} đang chờ trả khách (gồm cả đơn cần tạo khoản hoàn mới)`)}
        />
        <KpiCard
          icon={Coins}
          iconClassName="bg-violet-50 text-violet-600"
          title="Phiếu chờ hoàn tiền trên trang"
          className="border-slate-200 min-h-40"
          value={returnsLoading || returnsError || returns === null ? '...' : returnsToPay.length}
          valueSuffix={<span className="text-sm text-slate-500">phiếu</span>}
          subtitle={returnsError || (returnsLoading || returns === null ? undefined : `Cần hoàn ${formatVnd(returnsToPay.reduce((s, r) => s + r.totalRefundAmount, 0))} (trước khi trừ các khoản đã hoàn)`)}
        />
      </>} />
      <ListToolbar search={{ value: search, onChange: value => { setSearch(value); setPage(1) }, placeholder: tab === 'orders' ? 'Tìm mã đơn hoặc tên khách...' : 'Tìm mã trả hàng, mã đơn hoặc tên khách...' }} onClear={() => { setSearch(''); setSourceStatus(''); setOnlyOpen(true); setPage(1) }} actions={<button type="button" onClick={refreshLists} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"><RefreshCw size={16} aria-hidden="true" />Làm mới danh sách</button>}>
        <FilterSelect label="Nguồn hoàn tiền" value={tab} onChange={value => { setTab(value as Tab); setSourceStatus(''); setPage(1) }} options={[{ value: 'orders', label: 'Từ đơn đã hủy' }, { value: 'returns', label: 'Từ trả hàng' }]} />
        <FilterSelect label="Lọc trạng thái nguồn hoàn tiền" value={sourceStatus} onChange={value => { setSourceStatus(value); setPage(1) }} options={tab === 'orders' ? [{ value: '', label: 'Mọi trạng thái' }, { value: 'CANCELLED', label: 'Đã hủy' }, { value: 'PARTIALLY_CANCELLED', label: 'Hủy một phần' }] : [{ value: '', label: 'Mọi trạng thái' }, { value: 'INSPECTED', label: 'Đã kiểm tra' }, { value: 'PARTIALLY_RESOLVED', label: 'Đã xử lý một phần' }, ...(!onlyOpen ? [{ value: 'COMPLETED', label: 'Hoàn tất' }] : [])]} />
        <FilterSelect label="Phạm vi hoàn tiền" value={onlyOpen ? 'open' : 'all'} className="relative sm:col-span-2" onChange={value => { setOnlyOpen(value === 'open'); setSourceStatus(''); setPage(1) }} options={[{ value: 'open', label: 'Khoản còn cần hoàn' }, { value: 'all', label: 'Tất cả khoản hoàn' }]} />
      </ListToolbar>

      {tab === 'orders' ? (
        <section aria-label="Hoàn tiền từ đơn đã hủy" aria-busy={ordersLoading} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                <tr>
                  <th className="py-3 pl-4 pr-2 w-8" />
                  <th className="py-3 px-3 font-medium">Đơn hàng</th>
                  <th className="py-3 px-3 font-medium">Khách hàng</th>
                  <th className="py-3 px-3 font-medium">Trạng thái đơn</th>
                  <th className="py-3 px-3 font-medium text-right">Chờ hoàn</th>
                  <th className="py-3 px-3 font-medium text-right">Đã hoàn</th>
                  <th className="py-3 px-4 font-medium">Hủy lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50 text-sm">
                {ordersLoading ? (
                  <EmptyTableRow colSpan={7} message="Đang tải..." className="text-slate-500 animate-pulse" />
                ) : orderError ? (
                  <EmptyTableRow colSpan={7} message={orderError} className="text-rose-700" />
                ) : orderRows.length === 0 ? (
                  <EmptyTableRow colSpan={7} message={onlyOpen ? 'Không có đơn hủy nào đang chờ hoàn tiền.' : 'Chưa có đơn hủy nào có khoản hoàn.'} />
                ) : (
                  orderRows.map(({ order, refunds }) => {
                    return (

                        <tr key={order.id} className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => setOpenOrder(order.id)}>
                          <td className="py-3 pl-4 pr-2 text-slate-400"><button type="button" aria-label={`Xem hoàn tiền đơn ${order.orderNumber}`} className="p-1 rounded hover:bg-emerald-50 hover:text-emerald-700" onClick={event => { event.stopPropagation(); setOpenOrder(order.id) }}><Eye size={16} aria-hidden="true" /></button></td>
                          <td className="py-3 px-3 font-mono text-xs font-semibold">{order.orderNumber}</td>
                          <td className="py-3 px-3">{order.customerName}</td>
                          <td className="py-3 px-3 text-xs">{order.status === 'CANCELLED' ? 'Đã hủy' : 'Hủy một phần'}</td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold text-amber-700 whitespace-nowrap">
                            {sum(refunds, 'PENDING') > 0 ? formatVnd(sum(refunds, 'PENDING')) : orderState(refunds) === 'retry' ? <span className="text-xs font-medium text-rose-600">Cần tạo khoản hoàn mới</span> : <span className="text-slate-400">-</span>}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{sum(refunds, 'COMPLETED') > 0 ? formatVnd(sum(refunds, 'COMPLETED')) : <span className="text-slate-400">-</span>}</td>
                          <td className="py-3 px-4 whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
                        </tr>

                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalCount={orderTotal} totalPages={orderPages} unitLabel="đơn đã hủy" onPageChange={setPage} />
        </section>
      ) : (
        <section aria-label="Hoàn tiền từ trả hàng" aria-busy={returnsLoading} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                <tr>
                  <th className="py-3 pl-4 pr-2 w-8" />
                  <th className="py-3 px-3 font-medium">Mã trả hàng</th>
                  <th className="py-3 px-3 font-medium">Đơn hàng</th>
                  <th className="py-3 px-3 font-medium">Khách hàng</th>
                  <th className="py-3 px-3 font-medium text-center">Trạng thái</th>
                  <th className="py-3 px-3 font-medium text-right">Cần hoàn</th>
                  <th className="py-3 px-4 font-medium">Yêu cầu lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50 text-sm">
                {returnsLoading ? (
                  <EmptyTableRow colSpan={7} message="Đang tải..." className="text-slate-500 animate-pulse" />
                ) : returnsError ? (
                  <EmptyTableRow colSpan={7} message={returnsError} className="text-rose-700" />
                ) : (returns ?? []).length === 0 ? (
                  <EmptyTableRow colSpan={7} message={onlyOpen ? 'Không có phiếu trả hàng nào đang chờ hoàn tiền.' : 'Chưa có phiếu trả hàng đã kiểm tra.'} />
                ) : (
                  (returns ?? []).map((r) => {
                    const detail = returnDetail[r.id]
                    return (

                        <tr key={r.id} className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => toggleReturn(r)}>
                          <td className="py-3 pl-4 pr-2 text-slate-400"><button type="button" aria-label={`Xem hoàn tiền phiếu ${r.returnNumber}`} className="p-1 rounded hover:bg-emerald-50 hover:text-emerald-700" onClick={event => { event.stopPropagation(); toggleReturn(r) }}><Eye size={16} aria-hidden="true" /></button></td>
                          <td className="py-3 px-3 font-mono text-xs font-semibold">{r.returnNumber}</td>
                          <td className="py-3 px-3 font-mono text-xs">{r.orderNumber}</td>
                          <td className="py-3 px-3">{r.customerName}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded tracking-wide whitespace-nowrap ${RETURN_STATUS_BADGE_CLASS[r.status]}`}>{returnStatusText(r.status, detail?.refunds)}</span>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold whitespace-nowrap">{formatVnd(r.totalRefundAmount)}</td>
                          <td className="py-3 px-4 whitespace-nowrap">{formatDateTime(r.requestedAt)}</td>
                        </tr>

                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalCount={returnTotal} totalPages={returnPages} unitLabel="phiếu trả hàng" onPageChange={setPage} />
        </section>
      )}
      {openOrder && (() => {
        const entry = orders?.find(item => item.order.id === openOrder)
        if (!entry) return null
        const { order, refunds } = entry
        return <DetailModal open title={`Hoàn tiền đơn ${order.orderNumber}`} onClose={() => setOpenOrder(null)} widthClassName="max-w-4xl">
          <ModalLayout header={<div><h2>Hoàn tiền đơn {order.orderNumber}</h2><p className="mt-1 text-sm text-slate-500">{order.customerName}</p></div>}>
            <RefundsPanel scope={{ kind: 'order', orderId: order.id }} refunds={refunds} canManage onChanged={() => reloadAfterChange()} title={`Hoàn tiền của đơn ${order.orderNumber}`} />
          </ModalLayout>
        </DetailModal>
      })()}
      {openReturn && selectedReturn && (() => {
        const r = selectedReturn
        const detail = returnDetail[r.id]
        return <DetailModal open title={`Hoàn tiền phiếu ${r.returnNumber}`} onClose={() => setOpenReturn(null)} widthClassName="max-w-4xl">
          <ModalLayout header={<div><h2>Hoàn tiền phiếu {r.returnNumber}</h2><p className="mt-1 text-sm text-slate-500">{r.customerName} · Đơn {r.orderNumber}</p></div>}>
            {detail ? (
              <RefundsPanel
                scope={{ kind: 'return', returnId: r.id, orderId: r.orderId }}
                refunds={detail.refunds}
                refundable={detail.totalRefundAmount}
                canManage
                onChanged={() => reloadAfterChange(r.id)}
                title={`Hoàn tiền của phiếu ${r.returnNumber}`}
              />
            ) : returnDetailErrors[r.id] ? (
              <div role="alert" className="space-y-3 text-sm text-rose-700">
                <p>{returnDetailErrors[r.id]}</p>
                <button type="button" onClick={() => void loadReturnDetail(r.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700">Thử lại</button>
              </div>
            ) : (
              <p className="py-4 text-sm text-slate-500 animate-pulse">Đang tải phiếu...</p>
            )}
          </ModalLayout>
        </DetailModal>
      })()}
    </div>
  )
}
