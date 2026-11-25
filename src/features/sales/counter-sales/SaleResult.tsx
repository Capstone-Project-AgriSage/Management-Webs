import { useEffect, useState } from 'react'
import { CheckCircle2, ReceiptText } from 'lucide-react'
import { formatVnd } from '@/utils/money'
import type { OrderResponse, PaymentResponse } from '@/api/types'
import OrderInvoiceModal from '@/features/orders/OrderInvoiceModal'
import PermissionAction from '@/components/auth/PermissionAction'
import { usePermission } from '@/context/PermissionContext'
import { invoicesApi } from '@/api/invoicesApi'
import { describeError } from '@/api/client'

export type CounterResult = { kind: 'ORDER'; order: OrderResponse } | { kind: 'SALE'; order: OrderResponse; payment: PaymentResponse }

interface SaleResultProps {
  result: CounterResult
  printOnComplete: boolean
  onOpenOrder: (orderId: string) => void
  onNew: () => void
}

/** What was just created: a pending order (to collect, confirm and hand over from the order) or a finished quick sale. */
export default function SaleResult({ result, printOnComplete, onOpenOrder, onNew }: SaleResultProps) {
  const { order } = result
  const sale = result.kind === 'SALE'
  const { has } = usePermission()
  const [savedInvoice, setSavedInvoice] = useState('')
  const [invoiceError, setInvoiceError] = useState('')
  useEffect(() => {
    if (!sale || !has('INVOICES.READ') || !has('INVOICES.CREATE')) return
    let active = true
    invoicesApi.ensureForOrder(order.id, true).then(value => { if (active) setSavedInvoice(value.invoiceNumber) })
      .catch(error => { if (active) setInvoiceError(describeError(error, 'Chưa lưu được hóa đơn. Mở hóa đơn để thử lại.')) })
    return () => { active = false }
  }, [order.id, sale, has])
  const [invoice, setInvoice] = useState<{ autoPrint: boolean } | null>(() => sale && printOnComplete ? { autoPrint: true } : null)
  return (
    <>
      <div className="flex flex-col h-full z-10" role="status" aria-live="polite" aria-label="Kết quả bán hàng">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col items-center text-center gap-2 mb-6">
            <CheckCircle2 size={44} className="text-emerald-600" />
            <h2 className="text-lg font-bold text-on-surface">{sale ? 'Đã bán và thu tiền' : 'Đã tạo đơn hàng'}</h2>
            <p className="text-sm text-on-surface-variant">
              {sale
                ? 'Đơn đã hoàn thành, hàng đã xuất kho.'
                : order.settlementType === 'CREDIT'
                  ? 'Đơn mua chịu đang chờ xác nhận. Xác nhận đơn sẽ giữ hạn mức của khách.'
                  : 'Đơn đang chờ xác nhận. Thu đủ tiền rồi xác nhận để giữ hàng.'}
            </p>
          </div>
          <dl className="rounded-xl border border-outline-variant divide-y divide-outline-variant/60 text-sm">
            {[
              ['Mã đơn', order.orderNumber],
              ['Khách', order.customerName || 'Khách lẻ'],
              ['Thanh toán', order.settlementType === 'CREDIT' ? `Mua chịu${order.creditTermDays ? ` · ${order.creditTermDays} ngày` : ''}` : 'Trả đủ'],
              ['Nhận hàng', order.fulfillmentType === 'DELIVERY' ? 'Giao tận nơi' : 'Tại quầy'],
              ...(sale ? [['Mã thanh toán', result.payment.paymentNumber]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-4 py-2.5">
                <dt className="text-on-surface-variant">{k}</dt>
                <dd className="font-semibold text-on-surface text-right">{v}</dd>
              </div>
            ))}
            {order.items.map((i) => (
              <div key={i.id} className="flex justify-between gap-3 px-4 py-2">
                <span className="text-on-surface-variant">
                  {i.productName} · {i.packagingName ?? 'đơn vị'} × {i.quantity}
                  {i.priceOverridden && <span className="ml-1 text-[10px] text-amber-700 font-semibold">(đã sửa giá)</span>}
                </span>
                <span className="tabular-nums">{formatVnd(i.lineTotalAmount)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 px-4 py-3">
              <dt className="font-bold text-on-surface">{sale ? 'Đã thu' : 'Tổng đơn'}</dt>
              <dd className="font-bold text-emerald-700 text-lg tabular-nums">{formatVnd(sale ? result.payment.amount : order.totalAmount)}</dd>
            </div>
          </dl>
          {savedInvoice && <p className="mt-4 text-sm text-emerald-700">Đã lưu hóa đơn {savedInvoice}.</p>}
          {invoiceError && <p role="alert" className="mt-4 text-sm text-amber-800">Đơn đã bán thành công. {invoiceError} Bạn có thể mở hóa đơn để thử lại.</p>}
        </div>
        <div className="p-5 border-t border-outline-variant grid grid-cols-2 gap-3">
          {sale && <PermissionAction codes={['INVOICES.READ']}><button type="button" onClick={() => setInvoice({ autoPrint: false })} className="col-span-2 h-11 rounded-xl border border-primary text-primary font-semibold text-sm hover:bg-primary/5 flex items-center justify-center gap-2">
            <ReceiptText size={18} /> Xem / In hóa đơn
          </button></PermissionAction>}
          <button type="button" onClick={() => onOpenOrder(order.id)} className="h-11 rounded-xl border border-outline-variant font-semibold text-sm hover:bg-surface-container">
            {sale ? 'Xem đơn' : 'Mở đơn để xử lý'}
          </button>
          <button type="button" onClick={onNew} className="h-11 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:bg-primary/90">
            Soạn đơn mới
          </button>
        </div>
      </div>
      {invoice && result.kind === 'SALE' && <OrderInvoiceModal
        orderId={order.id}
        autoPrint={invoice.autoPrint}
        onClose={() => setInvoice(null)}
      />}
    </>
  )
}
