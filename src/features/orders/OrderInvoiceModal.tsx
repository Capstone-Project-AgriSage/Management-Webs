import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import type { OrderResponse } from '@/api/types'
import type { OrderPaymentsSummary } from '@/api/paymentsApi'
import { vnDateTime } from '@/utils/date'
import { formatVnd } from '@/utils/money'
import './order-invoice.css'

export type InvoicePayments = Pick<OrderPaymentsSummary, 'paidAmount' | 'remainingToPay' | 'payments' | 'refunds'>

interface OrderInvoiceModalProps {
  order: OrderResponse
  payments: InvoicePayments
  autoPrint?: boolean
  onClose: () => void
}

const paymentMethods: Record<string, string> = { CASH: 'Tiền mặt', PAYOS: 'Chuyển khoản qua payOS', BANK_TRANSFER: 'Chuyển khoản' }

function InvoiceDocument({ order, payments }: Pick<OrderInvoiceModalProps, 'order' | 'payments'>) {
  const received = payments.payments.filter(payment => ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status))
  return (
    <article className="sales-invoice" aria-label={`Hóa đơn ${order.orderNumber}`}>
      <header className="sales-invoice-heading">
        <p className="sales-invoice-brand">AgriSage</p>
        <h2>HÓA ĐƠN BÁN HÀNG</h2>
        <p>Bán tại quầy · {order.orderNumber}</p>
      </header>
      <dl className="sales-invoice-info">
        <div><dt>Mã hóa đơn</dt><dd>{order.orderNumber}</dd></div>
        <div><dt>Ngày bán</dt><dd>{vnDateTime(order.completedAt ?? order.createdAt)}</dd></div>
        <div><dt>Khách hàng</dt><dd>{order.customerName || 'Khách lẻ'}</dd></div>
        {order.customerPhone && <div><dt>Điện thoại</dt><dd>{order.customerPhone}</dd></div>}
        <div><dt>Thanh toán</dt><dd>{order.settlementType === 'CREDIT' ? 'Mua chịu' : 'Trả đủ'}</dd></div>
      </dl>
      <table className="sales-invoice-lines">
        <caption className="sales-invoice-caption">Chi tiết hàng hóa</caption>
        <thead><tr><th scope="col">Sản phẩm / Quy cách</th><th scope="col">SL</th><th scope="col">Đơn giá</th><th scope="col">Thành tiền</th></tr></thead>
        <tbody>
          {order.items.map(item => (
            <tr key={item.id}>
              <td><strong>{item.productName}</strong><span>{item.sku} · {item.packagingName || 'Đơn vị'}</span></td>
              <td>{item.quantity.toLocaleString('vi-VN')}</td>
              <td>{formatVnd(item.unitPrice)}</td>
              <td>{formatVnd(item.lineTotalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="sales-invoice-totals">
        <div className="sales-invoice-grand-total"><dt>Tổng cộng</dt><dd>{formatVnd(order.totalAmount)}</dd></div>
        <div><dt>Đã thanh toán</dt><dd>{formatVnd(payments.paidAmount)}</dd></div>
        <div><dt>Còn phải thanh toán</dt><dd>{formatVnd(payments.remainingToPay)}</dd></div>
      </dl>
      {received.length > 0 && <section className="sales-invoice-payments" aria-label="Phiếu thu">
        <h3>Phiếu thu</h3>
        {received.map(payment => <p key={payment.id}>{payment.paymentNumber} · {paymentMethods[payment.paymentMethod] ?? payment.paymentMethod}</p>)}
      </section>}
      {payments.refunds.filter(refund => refund.status !== 'CANCELLED').map(refund => (
        <p className="sales-invoice-note" key={refund.id}>{refund.refundNumber} · {refund.status === 'COMPLETED' ? 'Đã hoàn' : 'Chờ hoàn'}: {formatVnd(refund.amount)}</p>
      ))}
      {order.note && <p className="sales-invoice-note">Ghi chú: {order.note}</p>}
      <footer className="sales-invoice-footer">Cảm ơn quý khách và hẹn gặp lại!</footer>
    </article>
  )
}

/** Uses the persisted order and receipts. Printing never creates another sale or payment. */
export default function OrderInvoiceModal({ order, payments, autoPrint = false, onClose }: OrderInvoiceModalProps) {
  const [printError, setPrintError] = useState('')
  const print = useCallback(() => {
    setPrintError('')
    try {
      window.print()
    } catch {
      setPrintError('Không mở được hộp thoại in. Đơn hàng đã được lưu, bạn có thể thử in lại.')
    }
  }, [])

  useEffect(() => {
    if (!autoPrint) return
    // Paint the saved invoice before opening the browser's print dialog.
    let nextFrame = 0
    const frame = requestAnimationFrame(() => { nextFrame = requestAnimationFrame(print) })
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(nextFrame) }
  }, [autoPrint, print])

  return <>
    <DetailModal open onClose={onClose} title={`Hóa đơn bán hàng ${order.orderNumber}`}>
      <ModalLayout
        header={<h3>Hóa đơn bán hàng</h3>}
        footer={<>
          <button type="button" onClick={onClose} className="px-4 border border-outline-variant font-semibold">Đóng</button>
          <button type="button" onClick={print} className="inline-flex items-center gap-2 px-4 bg-primary text-on-primary font-semibold"><Printer size={17} /> In hóa đơn</button>
        </>}
      >
        {printError && <p role="alert" className="mb-3 text-sm text-rose-700">{printError}</p>}
        <InvoiceDocument order={order} payments={payments} />
      </ModalLayout>
    </DetailModal>
    {createPortal(<div className="sales-invoice-print" aria-hidden="true"><InvoiceDocument order={order} payments={payments} /></div>, document.body)}
  </>
}
