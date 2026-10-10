import PermissionAction from '@/components/auth/PermissionAction'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { describeError } from '@/api/client'
import { returnsApi, type CreateReturnItem, type OrderSearchItem, type Returnable, type ReturnReason, type ReturnableSource } from '@/api/returnsApi'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { formatVnd } from '@/utils/money'
import { formatDate, formatDateTime, formatQty, unitLabel } from '@/utils/units'
import { RETURN_REASONS } from './returnLabels'
import { loadOrderInfo, type OrderItemInfo } from './returnContext'
import { useReturnsBase } from './returnPaths'

const cellInput =
  'h-9 px-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50'

const sourceKey = (s: ReturnableSource) => s.deliveryItemLotAllocationId ?? s.originalStockMovementItemId ?? s.inventoryLotId

/** Value of returning `qty` base units of a line: price per packaging / base units per packaging, rounded to 2 decimals like the server. */
const returnValue = (qty: number, unitPrice: number, conversion: number) => Math.round(((qty * unitPrice) / conversion) * 100) / 100

export default function ReturnCreatePage() {
  usePageHeader({ title: 'Tạo yêu cầu trả hàng', subtitle: 'Chọn đơn đã giao, rồi chọn lô và số lượng khách trả lại' })
  const { showToast } = useToast()
  const navigate = useNavigate()
  const base = useReturnsBase()
  const [params] = useSearchParams()

  const [orderText, setOrderText] = useState('')
  const debouncedOrderText = useDebouncedValue(orderText)
  const [orders, setOrders] = useState<OrderSearchItem[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const searchRequest = useRef(0)

  const [orderId, setOrderId] = useState<string | null>(params.get('orderId'))
  const [returnable, setReturnable] = useState<Returnable | null>(null)
  const [infos, setInfos] = useState<Map<string, OrderItemInfo>>(new Map())
  const [orderLabel, setOrderLabel] = useState<{ number: string; customer: string; status: string; createdAt: string } | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(false)

  const [qty, setQty] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, ReturnReason | ''>>({})
  const [reasonSummary, setReasonSummary] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  // ---- step 1: find the order ----
  useEffect(() => {
    if (orderId) return
    const id = ++searchRequest.current
    setOrdersLoading(true)
    returnsApi
      .searchOrders({ search: debouncedOrderText.trim() || undefined, pageSize: 8 })
      .then((res) => {
        if (id === searchRequest.current) setOrders(res.items)
      })
      .catch(() => {
        if (id === searchRequest.current) setOrders([])
      })
      .finally(() => {
        if (id === searchRequest.current) setOrdersLoading(false)
      })
  }, [debouncedOrderText, orderId])

  // ---- step 2: what of that order can come back ----
  const loadOrder = useCallback(
    async (id: string) => {
      setLoadingOrder(true)
      try {
        const [info, ret] = await Promise.all([loadOrderInfo(id), returnsApi.getReturnable(id)])
        setInfos(info.items)
        setReturnable(ret)
        setOrderLabel({ number: info.order.orderNumber, customer: info.order.customerName, status: info.order.status, createdAt: info.order.createdAt })
        setQty({})
        setReasons({})
      } catch (err) {
        showToast(describeError(err, 'Đơn này chưa có hàng nào trả được'), 'error')
        setOrderId(null)
        setReturnable(null)
      } finally {
        setLoadingOrder(false)
      }
    },
    [showToast],
  )

  useEffect(() => {
    if (orderId) loadOrder(orderId)
  }, [orderId, loadOrder])

  const rows = useMemo(
    () =>
      (returnable?.items ?? []).flatMap((item) =>
        item.sources.map((source) => ({ item, source, key: sourceKey(source), info: infos.get(item.orderItemId) ?? null })),
      ),
    [returnable, infos],
  )

  const analysed = rows.map((r) => {
    const text = (qty[r.key] ?? '').trim()
    const n = Number(text)
    const entered = text !== ''
    let problem: string | null = null
    if (entered && (!Number.isInteger(n) || n < 1)) problem = 'Số lượng phải là số nguyên từ 1 trở lên'
    else if (entered && n > r.source.returnableBaseQuantity) problem = `Chỉ trả tối đa ${formatQty(r.source.returnableBaseQuantity)}`
    else if (entered && !reasons[r.key]) problem = 'Chọn lý do trả'
    return { ...r, entered, n, problem }
  })
  const selected = analysed.filter((r) => r.entered)
  const hasProblem = selected.some((r) => r.problem)
  const total = selected.reduce((sum, r) => sum + (r.problem && r.n > r.source.returnableBaseQuantity ? 0 : returnValue(r.n, r.source.unitPrice, r.source.conversionToBase)), 0)
  const canSubmit = !busy && selected.length > 0 && !hasProblem

  const submit = async () => {
    if (!canSubmit || !returnable) return
    setBusy(true)
    try {
      const items: CreateReturnItem[] = selected.map((r) => ({
        orderItemId: r.item.orderItemId,
        returnedBaseQuantity: r.n,
        reasonCode: reasons[r.key] as ReturnReason,
        deliveryItemLotAllocationId: r.source.deliveryItemLotAllocationId,
        originalStockMovementItemId: r.source.originalStockMovementItemId,
      }))
      const created = await returnsApi.create({ orderId: returnable.orderId, reasonSummary: reasonSummary.trim() || null, note: note.trim() || null, items })
      showToast(`Đã tạo yêu cầu ${created.returnNumber}, chờ Chủ cửa hàng duyệt`, 'success')
      navigate(`${base}/${created.id}`)
    } catch (err) {
      showToast(describeError(err, 'Không tạo được yêu cầu trả hàng'), 'error')
      setBusy(false)
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <Link to={base} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 w-fit">
        <ArrowLeft size={16} /> Danh sách trả hàng
      </Link>

      {!orderId ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-3">
          <h3 className="font-semibold text-on-surface">1. Chọn đơn hàng khách trả</h3>
          <div className="relative max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
              placeholder="Gõ mã đơn hoặc tên khách..."
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-x-auto rounded-lg border border-outline-variant">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Mã đơn</th>
                  <th className="py-2.5 px-3 font-medium">Khách hàng</th>
                  <th className="py-2.5 px-3 font-medium">Trạng thái đơn</th>
                  <th className="py-2.5 px-3 font-medium text-right">Tổng tiền</th>
                  <th className="py-2.5 px-3 font-medium">Tạo lúc</th>
                  <th className="py-2.5 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50 text-sm">
                {ordersLoading && orders.length === 0 ? (
                  <EmptyTableRow colSpan={6} message="Đang tìm..." className="text-slate-500 animate-pulse" />
                ) : orders.length === 0 ? (
                  <EmptyTableRow colSpan={6} message="Không tìm thấy đơn hàng." />
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-surface-container-low">
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold">{o.orderNumber}</td>
                      <td className="py-2.5 px-3">{o.customerName}</td>
                      <td className="py-2.5 px-3 text-xs">{o.status}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(o.totalAmount)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button type="button" className="text-sm font-medium text-emerald-700 hover:text-emerald-800" onClick={() => setOrderId(o.id)}>
                          Chọn đơn này
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Chỉ đơn đã giao hàng (hoàn tất hoặc giao một phần) mới có hàng để trả.</p>
        </div>
      ) : (
        <>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500">Đơn hàng</div>
              <div className="font-semibold text-on-surface">
                <span className="font-mono">{orderLabel?.number ?? '...'}</span>
                {orderLabel ? ` · ${orderLabel.customer} · tạo ${formatDateTime(orderLabel.createdAt)}` : ''}
              </div>
            </div>
            <button
              type="button"
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
              onClick={() => {
                setOrderId(null)
                setReturnable(null)
                setOrderLabel(null)
              }}
            >
              Chọn đơn khác
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant">
              <h3 className="font-semibold text-on-surface">2. Hàng khách trả (nhập số lượng ở lô nào khách trả)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="py-3 px-4 font-medium">Sản phẩm</th>
                    <th className="py-3 px-3 font-medium">Lô</th>
                    <th className="py-3 px-3 font-medium text-right">Đã giao</th>
                    <th className="py-3 px-3 font-medium text-right">Đã trả</th>
                    <th className="py-3 px-3 font-medium text-right">Còn trả được</th>
                    <th className="py-3 px-3 font-medium">Số lượng trả</th>
                    <th className="py-3 px-3 font-medium">Lý do</th>
                    <th className="py-3 px-4 font-medium text-right">Giá trị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50 text-sm">
                  {loadingOrder && rows.length === 0 ? (
                    <EmptyTableRow colSpan={8} message="Đang tải hàng của đơn..." className="text-slate-500 animate-pulse" />
                  ) : rows.length === 0 ? (
                    <EmptyTableRow colSpan={8} message="Đơn này chưa giao hàng nào nên chưa có gì để trả." />
                  ) : (
                    analysed.map((r) => {
                      const unit = unitLabel(r.info?.baseUnit)
                      const conversion = r.source.conversionToBase
                      const disabled = r.source.returnableBaseQuantity <= 0
                      return (
                        <tr key={r.key} className={r.problem ? 'bg-rose-50' : r.entered ? 'bg-emerald-50/40' : ''}>
                          <td className="py-2.5 px-4">
                            <div className="font-medium">{r.item.productName}</div>
                            <div className="font-mono text-xs text-slate-500">
                              {r.item.sku}
                              {r.info ? ` · mua theo ${r.info.packagingName}` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-mono text-xs">{r.source.lotNumber ?? 'Không có số lô'}</div>
                            {r.source.expiryDate ? <div className="text-xs text-slate-500">HSD {formatDate(r.source.expiryDate)}</div> : null}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{formatQty(r.source.fulfilledBaseQuantity)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">{formatQty(r.source.alreadyReturnedBaseQuantity)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                            {formatQty(r.source.returnableBaseQuantity)} {unit}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min={1}
                              max={r.source.returnableBaseQuantity}
                              className={`${cellInput} w-28 text-right tabular-nums`}
                              value={qty[r.key] ?? ''}
                              disabled={disabled}
                              placeholder={unit || 'SL'}
                              aria-label={`Số lượng trả ${r.item.productName} lô ${r.source.lotNumber ?? ''}`}
                              onChange={(e) => setQty((prev) => ({ ...prev, [r.key]: e.target.value }))}
                            />
                            {conversion > 1 && r.entered && !r.problem ? (
                              <div className="text-[11px] text-slate-500 mt-1">= {formatQty(Math.round((r.n / conversion) * 100) / 100)} {r.info?.packagingName ?? 'quy cách mua'}</div>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-3 min-w-[190px]">
                            <select
                              className={`${cellInput} w-full`}
                              value={reasons[r.key] ?? ''}
                              disabled={disabled}
                              aria-label="Lý do trả"
                              onChange={(e) => setReasons((prev) => ({ ...prev, [r.key]: e.target.value as ReturnReason | '' }))}
                            >
                              <option value="">{r.entered ? 'Chọn lý do...' : '-'}</option>
                              {RETURN_REASONS.map((x) => (
                                <option key={x.value} value={x.value}>
                                  {x.label}
                                </option>
                              ))}
                            </select>
                            {r.problem ? <div className="text-[11px] text-rose-600 mt-1">{r.problem}</div> : null}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">
                            {r.entered && !r.problem ? formatVnd(returnValue(r.n, r.source.unitPrice, conversion)) : <span className="text-slate-400">-</span>}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700" htmlFor="rt-summary">
                  Lý do chung
                </label>
                <input id="rt-summary" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" maxLength={500} value={reasonSummary} onChange={(e) => setReasonSummary(e.target.value)} placeholder="Ví dụ: Khách mua dư, trả lại 2 bao" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700" htmlFor="rt-note">
                  Ghi chú
                </label>
                <input id="rt-note" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="text-sm text-slate-700">
                {selected.length === 0 ? 'Chưa chọn hàng nào để trả.' : (
                  <>
                    Trả <strong>{selected.length} dòng</strong>, giá trị tạm tính <strong>{formatVnd(total)}</strong>
                  </>
                )}
              </div>
              <PermissionAction codes={["RETURNS.CREATE"]}><button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm disabled:opacity-50"
              >
                {busy ? 'Đang tạo...' : 'Gửi yêu cầu trả hàng'}
              </button></PermissionAction>
            </div>
            <p className="text-xs text-slate-500">Yêu cầu cần Chủ cửa hàng duyệt. Số tiền hoàn thực tế được tính khi kiểm tra hàng: trừ vào công nợ chưa trả của đơn trước, phần còn lại hoàn cho khách.</p>
          </div>
        </>
      )}
    </div>
  )
}
