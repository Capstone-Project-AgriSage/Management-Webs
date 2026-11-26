import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, Printer } from 'lucide-react'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import Button from '@/components/ui/Button'
import { invoicesApi, type InvoiceResponse } from '@/api/invoicesApi'
import { describeError } from '@/api/client'
import { usePermission } from '@/context/PermissionContext'
import InvoiceEmailPanel from './InvoiceEmailPanel'
import { vnDateTime } from '@/utils/date'
import { formatInvoiceMoney as formatVnd } from './invoiceFormat'
import './order-invoice.css'

interface OrderInvoiceModalProps {
  orderId?: string
  invoiceId?: string
  autoPrint?: boolean
  initialSection?: 'document' | 'email'
  onClose: () => void
}

const paymentMethods: Record<string, string> = { EXCHANGE_CREDIT: 'Bù trừ đổi hàng', CASH: 'Tiền mặt', PAYOS: 'Chuyển khoản qua payOS', BANK_TRANSFER: 'Chuyển khoản' }

function InvoiceDocument({ invoice }: { invoice: InvoiceResponse }) {
  const { order, payments, store, cashierName } = invoice.snapshot
  const received = payments.payments.filter(payment => ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status))
  return (
    <article className="sales-invoice" aria-label={`Hóa đơn ${invoice.invoiceNumber}`}>
      <header className="sales-invoice-heading">
        <p className="sales-invoice-brand">{store.name}</p>
        <p>{store.address}</p>
        {store.phone && <p>Điện thoại: {store.phone}</p>}
        {store.taxCode && <p>Mã số thuế: {store.taxCode}</p>}
        <h2>HÓA ĐƠN BÁN HÀNG</h2>
        <p>{invoice.invoiceNumber}</p>
      </header>
      <dl className="sales-invoice-info">
        <div><dt>Mã hóa đơn</dt><dd>{invoice.invoiceNumber}</dd></div>
        <div><dt>Mã đơn hàng</dt><dd>{order.orderNumber}</dd></div>
        <div><dt>Ngày lập</dt><dd>{vnDateTime(invoice.issuedAt)}</dd></div>
        <div><dt>Ngày bán</dt><dd>{vnDateTime(order.completedAt ?? order.createdAt)}</dd></div>
        <div><dt>Khách hàng</dt><dd>{order.customerName || 'Khách lẻ'}</dd></div>
        {order.customerPhone && <div><dt>Điện thoại</dt><dd>{order.customerPhone}</dd></div>}
        <div><dt>Thanh toán</dt><dd>{order.settlementType === 'CREDIT' ? 'Mua chịu' : 'Trả đủ'}</dd></div>
        <div><dt>Nhân viên lập</dt><dd>{cashierName}</dd></div>
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
        <div><dt>Đã thanh toán lúc lập hóa đơn</dt><dd>{formatVnd(payments.paidAmount)}</dd></div>
        <div><dt>Còn phải trả lúc lập hóa đơn</dt><dd>{formatVnd(payments.remainingToPay)}</dd></div>
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
export default function OrderInvoiceModal({ orderId, invoiceId, autoPrint = false, initialSection = 'document', onClose }: OrderInvoiceModalProps) {
  const { has } = usePermission()
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const busy = downloading || sendingEmail
  const pending = useRef<{ key: string; promise: Promise<InvoiceResponse> } | null>(null)
  const printed = useRef(false)
  const [printError, setPrintError] = useState('')
  useEffect(() => {
    let active = true
    const key = `${invoiceId ?? ''}:${orderId ?? ''}:${revision}`
    if (!pending.current || pending.current.key !== key) {
      const load = async () => {
        if (!has('INVOICES.READ')) throw new Error('Bạn chưa có quyền xem hóa đơn.')
        if (invoiceId) return invoicesApi.get(invoiceId)
        if (!orderId) throw new Error('Thiếu thông tin đơn hàng.')
        return invoicesApi.ensureForOrder(orderId, has('INVOICES.CREATE'))
      }
      pending.current = { key, promise: load() }
    }
    pending.current.promise.then(value => { if (active) { setInvoice(value); setLoadError('') } })
      .catch(error => { if (active) setLoadError(describeError(error, 'Không tạo hoặc tải được hóa đơn. Đơn hàng vẫn được lưu.')) })
    return () => { active = false }
  }, [orderId, invoiceId, revision, has])

  const print = useCallback(() => {
    setPrintError('')
    try {
      window.print()
    } catch {
      setPrintError('Không mở được hộp thoại in. Đơn hàng đã được lưu, bạn có thể thử in lại.')
    }
  }, [])

  useEffect(() => {
    if (!autoPrint || !invoice || printed.current) return
    // Paint the saved invoice before opening the browser's print dialog.
    let nextFrame = 0
    const frame = requestAnimationFrame(() => { nextFrame = requestAnimationFrame(() => { printed.current = true; print() }) })
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(nextFrame) }
  }, [autoPrint, invoice, print])

  const download = async () => {
    if (!invoice) return
    setDownloading(true); setPrintError('')
    try { await invoicesApi.download(invoice.id, invoice.invoiceNumber) }
    catch (error) { setPrintError(describeError(error, 'Không tải được PDF. Vui lòng thử lại.')) }
    finally { setDownloading(false) }
  }

  return <>
    <DetailModal open onClose={onClose} title={`Hóa đơn bán hàng ${invoice?.invoiceNumber ?? ''}`} busy={busy} widthClassName="max-w-4xl">
      <ModalLayout
        header={<div><h2>Hóa đơn bán hàng{invoice && <span className="ml-2 font-mono text-primary">{invoice.invoiceNumber}</span>}</h2><p className="mt-1 text-sm text-on-surface-variant">{invoice ? `Đơn hàng ${invoice.orderNumber} · Lập ngày ${vnDateTime(invoice.issuedAt)}` : 'Xem, in, tải PDF và gửi hóa đơn qua email'}</p></div>}
        footer={<>
          <Button variant="outlined" disabled={busy} onClick={onClose}>Đóng</Button>
          <Button variant="outlined" disabled={!invoice || busy} onClick={download}>{downloading ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Download size={17} aria-hidden="true" />} Tải PDF</Button>
          <Button disabled={!invoice || busy} onClick={print}><Printer size={17} aria-hidden="true" /> In hóa đơn</Button>
        </>}
        bodyClassName="space-y-5 bg-surface-container-low/50"
      >
        {printError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{printError}</p>}
        {loadError ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{loadError} <button type="button" onClick={() => { setLoadError(''); setRevision(value => value + 1) }} className="font-semibold underline">Thử lại</button></div>
          : !invoice ? <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-on-surface-variant"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Đang tạo hoặc tải hóa đơn đã lưu...</p>
          : <><div className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"><InvoiceDocument invoice={invoice} /></div><InvoiceEmailPanel key={invoice.id} invoice={invoice} autoFocusRecipient={initialSection === 'email'} onSendingChange={setSendingEmail} /></>}
      </ModalLayout>
    </DetailModal>
    {invoice && createPortal(<div className="sales-invoice-print" aria-hidden="true"><InvoiceDocument invoice={invoice} /></div>, document.body)}
  </>
}
