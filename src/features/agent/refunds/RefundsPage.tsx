import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import { ChevronDown, ChevronRight, Coins, Hourglass } from 'lucide-react';
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
  const orderRequest = useRef(0)
  const returnRequest = useRef(0)

  const [orders, setOrders] = useState<OrderEntry[] | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [returns, setReturns] = useState<ReturnListItem[] | null>(null)
  const [returnsLoading, setReturnsLoading] = useState(false)

  const [openOrder, setOpenOrder] = useState<string | null>(null)
  const [openReturn, setOpenReturn] = useState<string | null>(null)
  const [returnDetail, setReturnDetail] = useState<Record<string, SalesReturn>>({})

  const loadOrders = useCallback(async () => {
    const request = ++orderRequest.current
    setOrdersLoading(true)
    try {
      const result = await refundsApi.getCancelledOrders(page, debouncedSearch || undefined, tab === 'orders' ? sourceStatus as 'CANCELLED' | 'PARTIALLY_CANCELLED' || undefined : undefined)
      const entries = await Promise.all(
        result.items.map(async (order) => ({ order, refunds: await refundsApi.listForOrder(order.id).catch(() => [] as Refund[]) })),
      )
      if (request !== orderRequest.current) return
      if (tab === 'orders' && page !== result.page) { setPage(result.page); return }
      setOrders(entries)
      setOrderTotal(result.totalCount); setOrderPages(Math.max(1, result.totalPages))
    } catch (err) {
      if (request === orderRequest.current) { setOrders([]); showToast(describeError(err, 'Không tải được các đơn đã hủy'), 'error') }
    } finally {
      if (request === orderRequest.current) setOrdersLoading(false)
    }
  }, [page, debouncedSearch, sourceStatus, tab, showToast])

  const loadReturns = useCallback(async () => {
    const request = ++returnRequest.current
    setReturnsLoading(true)
    try {
      const allowed = onlyOpen ? (['INSPECTED', 'PARTIALLY_RESOLVED'] as const) : (['INSPECTED', 'PARTIALLY_RESOLVED', 'COMPLETED'] as const)
      const statuses = tab === 'returns' && sourceStatus ? allowed.filter(status => status === sourceStatus) : allowed
      const result = await mergePagedLists<ReturnListItem>(statuses.map(status => sourcePage => returnsApi.list({ status, search: debouncedSearch || undefined, page: sourcePage, pageSize: LIST_PAGE_SIZE })), page, (a, b) => b.requestedAt.localeCompare(a.requestedAt) || a.id.localeCompare(b.id))
      if (request !== returnRequest.current) return
      if (tab === 'returns' && page !== result.page) { setPage(result.page); return }
      setReturns(result.items); setReturnTotal(result.totalCount); setReturnPages(Math.max(1, result.totalPages))
    } catch (err) {
      if (request === returnRequest.current) { setReturns([]); showToast(describeError(err, 'Không tải được danh sách trả hàng'), 'error') }
    } finally {
      if (request === returnRequest.current) setReturnsLoading(false)
    }
  }, [onlyOpen, page, debouncedSearch, sourceStatus, tab, showToast])

  const loadReturnDetail = useCallback(
    async (id: string) => {
      try {
        const detail = await returnsApi.get(id)
        setReturnDetail((prev) => ({ ...prev, [id]: detail }))
      } catch (err) {
        showToast(describeError(err, 'Không tải được phiếu trả hàng'), 'error')
      }
    },
    [showToast],
  )

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    loadReturns()
  }, [loadReturns])

  const orderRows = useMemo(() => (orders ?? []).filter((e) => e.refunds.length > 0 && (!onlyOpen || orderState(e.refunds) !== 'done')), [orders, onlyOpen])
  const pendingOrders = useMemo(() => (orders ?? []).reduce((s, e) => s + sum(e.refunds, 'PENDING'), 0), [orders])
  const pendingOrderCount = useMemo(() => (orders ?? []).filter((e) => orderState(e.refunds) !== 'done').length, [orders])
  const returnsToPay = useMemo(() => (returns ?? []).filter((r) => r.status !== 'COMPLETED'), [returns])

  const toggleReturn = (item: ReturnListItem) => {
    if (openReturn === item.id) {
      setOpenReturn(null)
      return
    }
    setOpenReturn(item.id)
    loadReturnDetail(item.id)
  }

  const reloadAfterChange = (returnId?: string) => {
    loadOrders()
    loadReturns()
    if (returnId) loadReturnDetail(returnId)
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          icon={Hourglass}
          iconClassName="bg-amber-50 text-amber-600"
          title="Đơn cần hoàn tiền trên trang"
          layout="side"
          value={orders === null ? '...' : pendingOrderCount}
          valueSuffix={<span className="text-sm text-slate-500">đơn</span>}
          subtitle={orders === null ? undefined : `${formatVnd(pendingOrders)} đang chờ trả khách (gồm cả đơn cần tạo khoản hoàn mới)`}
        />
        <KpiCard
          icon={Coins}
          iconClassName="bg-violet-50 text-violet-600"
          title="Phiếu chờ hoàn tiền trên trang"
          layout="side"
          value={returns === null ? '...' : returnsToPay.length}
          valueSuffix={<span className="text-sm text-slate-500">phiếu</span>}
          subtitle={returns === null ? undefined : `Cần hoàn ${formatVnd(returnsToPay.reduce((s, r) => s + r.totalRefundAmount, 0))} (trước khi trừ các khoản đã hoàn)`}
        />
      </div>

      <BusinessReportCards kind="refunds" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm" role="tablist">
          {(
            [
              ['orders', 'Từ đơn đã hủy'],
              ['returns', 'Từ trả hàng'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => { setTab(value); setSourceStatus(''); setPage(1) }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === value ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>

      </div>

      <ListToolbar search={{ value: search, onChange: value => { setSearch(value); setPage(1) }, placeholder: tab === 'orders' ? 'Tìm mã đơn hoặc tên khách...' : 'Tìm mã trả hàng, mã đơn hoặc tên khách...' }} onClear={() => { setSearch(''); setSourceStatus(''); setOnlyOpen(true); setPage(1) }}>
        <FilterSelect label="Lọc trạng thái nguồn hoàn tiền" value={sourceStatus} onChange={value => { setSourceStatus(value); setPage(1) }} options={tab === 'orders' ? [{ value: '', label: 'Mọi trạng thái' }, { value: 'CANCELLED', label: 'Đã hủy' }, { value: 'PARTIALLY_CANCELLED', label: 'Hủy một phần' }] : [{ value: '', label: 'Mọi trạng thái' }, { value: 'INSPECTED', label: 'Đã kiểm tra' }, { value: 'PARTIALLY_RESOLVED', label: 'Đã xử lý một phần' }, ...(!onlyOpen ? [{ value: 'COMPLETED', label: 'Hoàn tất' }] : [])]} />
        <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={onlyOpen} onChange={event => { setOnlyOpen(event.target.checked); setSourceStatus(''); setPage(1) }} />Chỉ khoản đang chờ hoàn</label>
      </ListToolbar>

      {tab === 'orders' ? (
        <section aria-label="Hoàn tiền từ đơn đã hủy" className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
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
                {ordersLoading && orders === null ? (
                  <EmptyTableRow colSpan={7} message="Đang tải..." className="text-slate-500 animate-pulse" />
                ) : orderRows.length === 0 ? (
                  <EmptyTableRow colSpan={7} message={onlyOpen ? 'Không có đơn hủy nào đang chờ hoàn tiền.' : 'Chưa có đơn hủy nào có khoản hoàn.'} />
                ) : (
                  orderRows.map(({ order, refunds }) => {
                    const open = openOrder === order.id
                    return (
                      <Fragment key={order.id}>
                        <tr className={`hover:bg-surface-container-low transition-colors cursor-pointer ${open ? 'bg-surface-container-low' : ''}`} onClick={() => setOpenOrder(open ? null : order.id)}>
                          <td className="py-3 pl-4 pr-2 text-slate-400">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                          <td className="py-3 px-3 font-mono text-xs font-semibold">{order.orderNumber}</td>
                          <td className="py-3 px-3">{order.customerName}</td>
                          <td className="py-3 px-3 text-xs">{order.status === 'CANCELLED' ? 'Đã hủy' : 'Hủy một phần'}</td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold text-amber-700 whitespace-nowrap">
                            {sum(refunds, 'PENDING') > 0 ? formatVnd(sum(refunds, 'PENDING')) : orderState(refunds) === 'retry' ? <span className="text-xs font-medium text-rose-600">Cần tạo khoản hoàn mới</span> : <span className="text-slate-400">-</span>}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{sum(refunds, 'COMPLETED') > 0 ? formatVnd(sum(refunds, 'COMPLETED')) : <span className="text-slate-400">-</span>}</td>
                          <td className="py-3 px-4 whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
                        </tr>
                        {open ? (
                          <tr className="bg-surface-container-lowest">
                            <td />
                            <td colSpan={6} className="px-3 pb-4 pt-1">
                              <RefundsPanel scope={{ kind: 'order', orderId: order.id }} refunds={refunds} canManage onChanged={() => reloadAfterChange()} title={`Hoàn tiền của đơn ${order.orderNumber}`} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalCount={orderTotal} totalPages={orderPages} unitLabel="đơn đã hủy" onPageChange={setPage} />
        </section>
      ) : (
        <section aria-label="Hoàn tiền từ trả hàng" className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
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
                {returnsLoading && returns === null ? (
                  <EmptyTableRow colSpan={7} message="Đang tải..." className="text-slate-500 animate-pulse" />
                ) : (returns ?? []).length === 0 ? (
                  <EmptyTableRow colSpan={7} message={onlyOpen ? 'Không có phiếu trả hàng nào đang chờ hoàn tiền.' : 'Chưa có phiếu trả hàng đã kiểm tra.'} />
                ) : (
                  (returns ?? []).map((r) => {
                    const open = openReturn === r.id
                    const detail = returnDetail[r.id]
                    return (
                      <Fragment key={r.id}>
                        <tr className={`hover:bg-surface-container-low transition-colors cursor-pointer ${open ? 'bg-surface-container-low' : ''}`} onClick={() => toggleReturn(r)}>
                          <td className="py-3 pl-4 pr-2 text-slate-400">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                          <td className="py-3 px-3 font-mono text-xs font-semibold">{r.returnNumber}</td>
                          <td className="py-3 px-3 font-mono text-xs">{r.orderNumber}</td>
                          <td className="py-3 px-3">{r.customerName}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded tracking-wide whitespace-nowrap ${RETURN_STATUS_BADGE_CLASS[r.status]}`}>{returnStatusText(r.status, detail?.refunds)}</span>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold whitespace-nowrap">{formatVnd(r.totalRefundAmount)}</td>
                          <td className="py-3 px-4 whitespace-nowrap">{formatDateTime(r.requestedAt)}</td>
                        </tr>
                        {open ? (
                          <tr className="bg-surface-container-lowest">
                            <td />
                            <td colSpan={6} className="px-3 pb-4 pt-1">
                              {detail ? (
                                <RefundsPanel
                                  scope={{ kind: 'return', returnId: r.id, orderId: r.orderId }}
                                  refunds={detail.refunds}
                                  refundable={detail.totalRefundAmount}
                                  canManage
                                  onChanged={() => reloadAfterChange(r.id)}
                                  title={`Hoàn tiền của phiếu ${r.returnNumber}`}
                                />
                              ) : (
                                <p className="py-4 text-sm text-slate-500 animate-pulse">Đang tải phiếu...</p>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalCount={returnTotal} totalPages={returnPages} unitLabel="phiếu trả hàng" onPageChange={setPage} />
        </section>
      )}
    </div>
  )
}
