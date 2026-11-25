import OrderInvoiceModal from '@/features/orders/OrderInvoiceModal'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, RefreshCw } from 'lucide-react'
import Select from '@/components/ui/Select'
import ExchangeDialog from './ExchangeDialog'
import { useExchangeBase } from './exchangePaths'
import { exchangeField as input, exchangePrimary, exchangeSecondary, exchangeDanger, exchangeSection } from './exchangeStyles'
import { vnDateTime } from '@/utils/date'
import { exchangesApi, exchangeStatus, type Exchange } from '@/api/exchangesApi'
import { stockApi, type StockLot } from '@/api/stockApi'
import { usePermission } from '@/context/PermissionContext'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { formatVnd } from '@/utils/money'
const conditions: Record<string, string> = { RESELLABLE: 'Còn bán được — nhập kho', DAMAGED: 'Hư hỏng — loại bỏ', EXPIRED: 'Hết hạn — loại bỏ', UNUSABLE: 'Không sử dụng được — loại bỏ' }
const actions: Record<string, string> = { approve: 'Duyệt yêu cầu', reject: 'Từ chối', cancel: 'Hủy yêu cầu', receive: 'Xác nhận đã thu hồi', 'complete-inspection': 'Chốt kiểm tra và nhập kho', complete: 'Quyết toán và giao hàng mới' }
const historyLabels: Record<string, string> = { EXCHANGE_REQUESTED: 'Tạo yêu cầu', EXCHANGE_APPROVE: 'Duyệt yêu cầu', EXCHANGE_REJECT: 'Từ chối', EXCHANGE_CANCEL: 'Hủy yêu cầu', EXCHANGE_RECEIVE: 'Nhận hàng thu hồi', EXCHANGE_INSPECT: 'Ghi nhận kiểm tra', EXCHANGE_COMPLETE_INSPECTION: 'Chốt kiểm tra', EXCHANGE_COMPLETE: 'Hoàn tất đổi hàng' }
export default function ExchangeDetailPage() {
 const { id = '' } = useParams()
 const { has } = usePermission()
 const navigate = useNavigate()
 const base = useExchangeBase()
 const close = () => navigate(base, { replace: true })
 const [showInvoice, setShowInvoice] = useState(false)
 const [data, setData] = useState<Exchange | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
 const [dialog, setDialog] = useState<string | null>(null); const [reason, setReason] = useState(''); const [reference, setReference] = useState('')
 const [inspections, setInspections] = useState<Record<string, { condition: string; note: string }>>({})
 const [lots, setLots] = useState<Record<string, StockLot[]>>({}); const [picks, setPicks] = useState<Record<string, number>>({})
 const load = useCallback(async () => { try { setData(await exchangesApi.get(id)); setError('') } catch(e) { setError(e instanceof Error ? e.message : 'Không tải được yêu cầu') } }, [id])
 useEffect(() => {
  let active = true
  exchangesApi.get(id).then(value => { if (active) { setData(value); setError('') } }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Không tải được yêu cầu') })
  return () => { active = false }
 }, [id])
 useEffect(() => {
  if (!data || data.status !== 'READY_TO_COMPLETE' || !has('EXCHANGES.COMPLETE')) return
  let active = true
  const products = [...new Set(data.replacements.map(i => i.storeProductId))]
  Promise.all(products.map(async productId => {
   const result: StockLot[] = []; let page = 1
   while (true) { const r = await stockApi.getLots({ storeProductId: productId, status: 'ACTIVE', hasStock: true, page, pageSize: 100 }); result.push(...r.items.filter(l => !l.isExpired && l.quantityAvailable > 0)); if (page >= r.totalPages) break; page++ }
   return [productId, result] as const
  })).then(rows => { if (active) setLots(Object.fromEntries(rows)) }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Không tải được lô thay thế') })
  return () => { active = false }
 }, [data, has])
 const run = async (call: () => Promise<Exchange>) => {
  setBusy(true); setError('')
  try { setData(await call()); setDialog(null); setReason('') } catch(e) { setError(e instanceof Error ? e.message : 'Không xử lý được đổi hàng') } finally { setBusy(false) }
 }
 if (!data) return <ExchangeDialog title="Chi tiết đổi hàng" subtitle="Thông tin yêu cầu và tiến trình xử lý" footer={<div className="flex justify-end gap-3"><button type="button" className={exchangeSecondary} onClick={close}>Đóng</button>{error && <button type="button" className={exchangePrimary} onClick={load}>Tải lại</button>}</div>}><p role={error ? 'alert' : 'status'} className={error ? 'text-sm text-rose-700' : 'py-8 text-center text-sm text-on-surface-variant'}>{error || 'Đang tải yêu cầu đổi hàng...'}</p></ExchangeDialog>
 const can = (action: string) => has(`EXCHANGES.${action.toUpperCase().replaceAll('-', '_')}`)
 const available = data.status === 'REQUESTED' ? ['approve', 'reject', 'cancel'] : data.status === 'APPROVED' ? ['receive', 'cancel'] : data.status === 'RECEIVED' ? ['complete-inspection'] : data.status === 'READY_TO_COMPLETE' ? ['complete'] : []
 const selection = data.replacements.flatMap(i => (lots[i.storeProductId] ?? []).map(l => ({ replacementItemId: i.id, inventoryLotId: l.id, baseQuantity: picks[`${i.id}:${l.id}`] ?? 0 }))).filter(p => p.baseQuantity > 0)
 const validLots = data.replacements.every(i => selection.filter(p => p.replacementItemId === i.id).reduce((sum, p) => sum + p.baseQuantity, 0) === i.baseQuantity)
 const reasonRequired = dialog === 'reject' || dialog === 'cancel'
 return <ExchangeDialog title={`Đổi hàng ${data.return.returnNumber}`} subtitle="Thu hồi và kiểm tra trước khi xuất sản phẩm thay thế" busy={busy}
  footer={<div className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex flex-wrap gap-2"><button type="button" className={exchangeSecondary} disabled={busy} onClick={close}>Đóng</button><button type="button" className={exchangeSecondary} disabled={busy} onClick={load}><RefreshCw size={15} aria-hidden="true" /> Làm mới</button></div>
   <div className="flex flex-wrap gap-2">{available.filter(can).map(action => <button type="button" key={action} disabled={busy || (action === 'complete-inspection' && data.return.items.some(item => item.conditionStatus === 'PENDING_INSPECTION'))} onClick={() => setDialog(action)} className={action === 'reject' || action === 'cancel' ? exchangeDanger : exchangePrimary}>{actions[action]}</button>)}</div>
  </div>}>
  {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  <section className={exchangeSection}>
   <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-on-surface">Thông tin yêu cầu</h3><StatusBadge label={exchangeStatus[data.status]} /></div>
   <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-on-surface-variant">Đơn hàng gốc</dt><dd className="mt-1 font-mono font-semibold text-on-surface">{data.orderNumber}</dd></div><div><dt className="text-on-surface-variant">Khách hàng</dt><dd className="mt-1 font-semibold text-on-surface">{data.return.customerName}</dd></div><div><dt className="text-on-surface-variant">Ngày yêu cầu</dt><dd className="mt-1 text-on-surface">{vnDateTime(data.createdAt)}</dd></div><div><dt className="text-on-surface-variant">Lý do đổi hàng</dt><dd className="mt-1 whitespace-pre-wrap text-on-surface">{data.reason}</dd></div></dl>
   <div className="grid gap-4 rounded-lg bg-surface-container-low p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
    <div><p className="text-on-surface-variant">Giá trị hàng trả</p><p className="mt-1 font-semibold tabular-nums">{formatVnd(data.return.totalReturnAmount)}</p></div>
    <div><p className="text-on-surface-variant">Giảm công nợ</p><p className="mt-1 font-semibold tabular-nums">{formatVnd(data.return.totalDebtAdjustment)}</p></div>
    <div><p className="text-on-surface-variant">Hàng thay thế</p><p className="mt-1 font-semibold tabular-nums">{formatVnd(data.replacementAmount)}</p></div>
    <div><p className="text-on-surface-variant">Chênh lệch</p><p className={`mt-1 font-semibold ${data.difference !== null && data.difference < 0 ? 'text-rose-700' : 'text-primary'}`}>{data.difference === null ? 'Chốt sau kiểm tra' : data.difference === 0 ? 'Đổi ngang giá' : `${data.difference > 0 ? 'Thu thêm' : 'Hoàn khách'} ${formatVnd(Math.abs(data.difference))}`}</p></div>
   </div>
  </section>
  <section className={exchangeSection}>
   <h2 className="font-semibold text-on-surface">Hàng thu hồi — {data.return.returnNumber}</h2>
   {data.return.items.map((item, index) => <div key={item.id} className="space-y-3 rounded-lg border border-outline-variant p-4">
    <div className="flex flex-wrap justify-between gap-2 text-sm"><p className="font-semibold">{data.originalItems.find(original => original.orderItemId === item.orderItemId)?.productName ?? `Dòng ${index + 1}`}</p><p className="tabular-nums">{item.returnedBaseQuantity} đơn vị cơ sở · {formatVnd(item.returnValue)}</p></div>
    <p className="text-sm text-on-surface-variant">{conditions[item.conditionStatus] ?? 'Chưa kiểm tra'}{item.inspectionNote && ` · ${item.inspectionNote}`}</p>
    {data.status === 'RECEIVED' && can('inspect') && <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
     <label className="space-y-1.5 text-sm font-medium">Tình trạng hàng<Select aria-label={`Tình trạng hàng thu hồi dòng ${index + 1}`} className={input} value={inspections[item.id]?.condition ?? ''} onChange={event => setInspections({ ...inspections, [item.id]: { condition: event.target.value, note: inspections[item.id]?.note ?? '' } })}><option value="">Chọn tình trạng</option>{Object.entries(conditions).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
     <label className="space-y-1.5 text-sm font-medium">Ghi chú kiểm tra<input aria-label={`Ghi chú kiểm tra dòng ${index + 1}`} className={input} placeholder="Ghi nhận tình trạng thực tế" maxLength={1000} value={inspections[item.id]?.note ?? ''} onChange={event => setInspections({ ...inspections, [item.id]: { condition: inspections[item.id]?.condition ?? '', note: event.target.value } })} /></label>
     <div className="flex justify-end sm:col-span-2"><button type="button" className={exchangeSecondary} disabled={!inspections[item.id]?.condition} onClick={() => run(() => exchangesApi.inspect(id, item.id, inspections[item.id].condition, inspections[item.id].note))}><Check size={16} aria-hidden="true" /> Lưu kiểm tra</button></div>
    </fieldset>}
   </div>)}
  </section>
  <section className={exchangeSection}>
   <h2 className="font-semibold text-on-surface">Hàng thay thế</h2>
   {data.replacements.map(item => <div key={item.id} className="space-y-3 rounded-lg border border-outline-variant p-4">
    <div className="flex flex-wrap justify-between gap-2 text-sm"><p className="font-semibold">{item.productName} · {item.packagingName} × {item.quantity}</p><p className="font-semibold tabular-nums">{formatVnd(item.lineTotal)}</p></div>
    <p className="text-sm text-on-surface-variant">Cần xuất {item.baseQuantity} đơn vị cơ sở</p>
    {data.status === 'READY_TO_COMPLETE' && can('complete') && <fieldset disabled={busy} className="space-y-3 border-t border-outline-variant pt-3">
     <legend className="text-sm font-medium">Xác nhận lô thực tế giao khách</legend>
     {lots[item.storeProductId] === undefined ? <p className="text-sm text-on-surface-variant">Đang tải lô khả dụng...</p> : !lots[item.storeProductId].length ? <p className="text-sm text-amber-800">Không có lô khả dụng. Kiểm tra tồn kho rồi làm mới.</p> : lots[item.storeProductId].map(lot => <label className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_140px]" key={lot.id}>
      <span>Lô {lot.lotNumber ?? 'không mã'}<span className="mt-0.5 block text-xs text-on-surface-variant">HSD {lot.expiryDate ?? 'không có'} · Khả dụng {lot.quantityAvailable}</span></span>
      <input aria-label={`Số lượng xuất ${item.productName}, lô ${lot.lotNumber ?? 'không mã'}`} className={`${input} text-right tabular-nums`} type="number" min="0" max={Math.min(lot.quantityAvailable, item.baseQuantity)} step="1" value={picks[`${item.id}:${lot.id}`] ?? 0} onChange={event => setPicks({ ...picks, [`${item.id}:${lot.id}`]: Math.max(0, Math.floor(Number(event.target.value))) })} />
     </label>)}
     <p className="text-sm text-on-surface-variant">Đã chọn: {selection.filter(pick => pick.replacementItemId === item.id).reduce((sum, pick) => sum + pick.baseQuantity, 0)} / {item.baseQuantity} đơn vị cơ sở</p>
    </fieldset>}
   </div>)}
  </section>
  {data.replacementOrderId && <section className={exchangeSection}>
   <h2 className="font-semibold text-on-surface">Chứng từ hoàn tất</h2><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-on-surface-variant">Đơn thay thế</dt><dd className="mt-1 font-mono font-semibold">{data.replacementOrderNumber}</dd></div><div><dt className="text-on-surface-variant">Tham chiếu quyết toán</dt><dd className="mt-1 break-words">{data.settlementReference}</dd></div></dl>
   {has('INVOICES.READ') && <button type="button" disabled={busy} className={exchangeSecondary} onClick={() => setShowInvoice(true)}>Xem / lập hóa đơn đơn thay thế</button>}
   {data.return.refunds.map(refund => <p key={refund.id} className="text-sm">{refund.refundNumber}: <strong>{formatVnd(refund.amount)}</strong> · {refund.refundMethod === 'EXCHANGE_CREDIT' ? 'Bù trừ đổi hàng' : 'Hoàn tiền mặt'}</p>)}
  </section>}
  <section className={exchangeSection}><h2 className="font-semibold text-on-surface">Lịch sử đổi hàng</h2><ol className="space-y-3">{data.history.map((history,index) => <li key={index} className="border-l-2 border-outline-variant pl-3 text-sm"><p className="font-medium text-on-surface">{historyLabels[history.action] ?? history.action}</p><p className="mt-1 text-xs text-on-surface-variant">{vnDateTime(history.occurredAt)}</p>{history.reason && <p className="mt-1 whitespace-pre-wrap text-on-surface-variant">{history.reason}</p>}</li>)}</ol></section>
  {showInvoice && data.replacementOrderId && <OrderInvoiceModal orderId={data.replacementOrderId} onClose={() => setShowInvoice(false)} />}
  <ConfirmModal open={dialog !== null} title={actions[dialog ?? ''] ?? ''} confirmLabel="Xác nhận" busy={busy} tone={reasonRequired ? 'danger' : 'primary'} onClose={() => { setDialog(null); setReason('') }} confirmDisabled={(reasonRequired && !reason.trim()) || (dialog === 'complete' && (!validLots || !reference.trim()))} onConfirm={() => run(() => dialog === 'complete' ? exchangesApi.complete(id, { confirmedDifference: data.difference!, settlementReference: reference, lots: selection }) : exchangesApi.action(id, dialog!, reason))}>
   {reasonRequired && <label className="block space-y-1.5 text-sm font-medium">Lý do<textarea className={input} maxLength={1000} rows={3} value={reason} onChange={event => setReason(event.target.value)} /></label>}
   {dialog === 'complete' && <div className="space-y-4 text-sm"><p>{data.difference === 0 ? 'Đổi ngang giá.' : `${data.difference! > 0 ? 'Xác nhận đã thu thêm' : 'Xác nhận đã hoàn khách'} ${formatVnd(Math.abs(data.difference!))} bằng tiền mặt.`}</p><p className="text-on-surface-variant">Hàng mới sẽ được xuất theo các lô đã chọn.</p><label className="block space-y-1.5 font-medium">Mã biên nhận / tham chiếu quyết toán<input className={input} maxLength={200} value={reference} onChange={event => setReference(event.target.value)} /></label>{!validLots && <p className="text-rose-700">Chọn đủ số lượng lô thực tế cho từng sản phẩm trước khi xác nhận.</p>}</div>}
   {dialog === 'complete-inspection' && <p className="text-sm text-on-surface-variant">Hàng còn bán được sẽ nhập kho theo giá vốn gốc; hàng hỏng sẽ được ghi nhận loại bỏ. Công nợ và tiền bù trừ được chốt trong bước này.</p>}
  </ConfirmModal>
 </ExchangeDialog>
}
