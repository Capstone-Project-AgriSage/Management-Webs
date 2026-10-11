import { useEffect, useState } from 'react'
import { paymentsApi } from '@/api/paymentsApi'
import type { PaymentResponse } from '@/api/types'
import { usePermission } from '@/context/PermissionContext'
import { describeApiError } from '@/utils/apiError'
import { formatVnd } from '@/utils/money'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { paymentLink } from './paymentLink'

const statusLabels: Record<string, string> = { PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', FAILED: 'Thất bại', CANCELLED: 'Đã hủy', PARTIALLY_REFUNDED: 'Đã hoàn một phần', REFUNDED: 'Đã hoàn tiền' }
export default function PaymentDetailModal({ paymentId, onClose, onChanged }: { paymentId: string; onClose: () => void; onChanged: () => void }) {
  const { has } = usePermission()
  const [payment, setPayment] = useState<PaymentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [review, setReview] = useState<'cancel' | 'confirm' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    paymentsApi.getPayment(paymentId, controller.signal).then(data => { if (!controller.signal.aborted) setPayment(data) })
      .catch(err => { if (!controller.signal.aborted) setError(describeApiError(err, 'Không tải được phiếu thanh toán')) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [paymentId])
  const run = async (kind: 'sync' | 'cancel' | 'confirm' | 'reject') => {
    if (!payment || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const updated = kind === 'sync' ? await paymentsApi.syncPayment(payment.id)
        : kind === 'confirm' ? await paymentsApi.confirmPayment(payment.id)
          : kind === 'reject' ? await paymentsApi.rejectPayment(payment.id, reason.trim())
            : await paymentsApi.cancelPayment(payment.id, reason)
      setPayment(updated)
      setMessage(kind === 'sync' ? `Trạng thái từ payOS: ${statusLabels[updated.status] ?? updated.status}.` : `Trạng thái phiếu: ${statusLabels[updated.status] ?? updated.status}.`)
      setReview(null)
      onChanged()
    } catch (err) { setError(describeApiError(err, kind === 'sync' ? 'Không đồng bộ được trạng thái payOS' : 'Không cập nhật được phiếu thanh toán')) }
    finally { setBusy(false) }
  }
  const checkoutUrl = paymentLink(payment?.checkoutUrl)
  return <>
    <DetailModal open onClose={onClose} busy={busy} widthClassName="max-w-3xl">
      <ModalLayout header={<h2 className="text-lg font-semibold text-slate-900">Phiếu thanh toán {payment?.paymentNumber ?? ''}</h2>} footer={<div className="flex flex-wrap justify-end gap-3">
        {payment?.status === 'PENDING' && payment.paymentMethod === 'PAYOS' && has('PAYMENTS.SYNC') && <button type="button" disabled={busy} onClick={() => void run('sync')} className="min-h-[42px] rounded-[10px] bg-primary-dark px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Đang đồng bộ...' : 'Đồng bộ payOS'}</button>}
        {payment?.status === 'PENDING' && payment.paymentMethod === 'BANK_TRANSFER' && payment.paymentContext === 'DEBT_REPAYMENT' && has('BANK_PAYMENTS.CONFIRM') && <button type="button" disabled={busy} onClick={() => { setReason(''); setError(''); setReview('confirm') }} className="min-h-[42px] rounded-[10px] bg-primary-dark px-4 text-sm font-semibold text-white disabled:opacity-50">Xác nhận chuyển khoản</button>}
        {payment?.status === 'PENDING' && payment.paymentMethod === 'BANK_TRANSFER' && payment.paymentContext === 'DEBT_REPAYMENT' && has('BANK_PAYMENTS.REJECT') && <button type="button" disabled={busy} onClick={() => { setReason(''); setError(''); setReview('reject') }} className="min-h-[42px] rounded-[10px] border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-50">Từ chối chuyển khoản</button>}
        {payment?.status === 'PENDING' && payment.paymentMethod !== 'PAYOS' && has('PAYMENTS.CANCEL') && <button type="button" disabled={busy} onClick={() => { setReason(''); setError(''); setReview('cancel') }} className="min-h-[42px] rounded-[10px] border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-50">Hủy phiếu thanh toán</button>}
        <button type="button" disabled={busy} onClick={onClose} className="min-h-[42px] rounded-[10px] border border-slate-200 px-4 text-sm disabled:opacity-50">Đóng</button>
      </div>} bodyClassName="space-y-4">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Đang tải phiếu thanh toán...</p> : payment && <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {[['Số tiền', formatVnd(payment.amount)], ['Trạng thái', statusLabels[payment.status] ?? payment.status], ['Phương thức', payment.paymentMethod], ['Mục đích', payment.paymentContext === 'DEBT_REPAYMENT' ? 'Trả công nợ' : 'Thanh toán đơn hàng'], ['Người thanh toán', payment.payerName ?? 'Khách lẻ'], ['Ngày khởi tạo', new Date(payment.initiatedAt).toLocaleString('vi-VN')], ['Ngày xác nhận', payment.confirmedAt ? new Date(payment.confirmedAt).toLocaleString('vi-VN') : '—']].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-semibold break-words">{value}</dd></div>)}
          </dl>
          {payment.paymentMethod === 'PAYOS' && payment.status === 'PENDING' && checkoutUrl && <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[42px] items-center rounded-[10px] border border-primary px-4 text-sm font-semibold text-primary">Mở liên kết thanh toán payOS</a>}
          {payment.paymentMethod === 'PAYOS' && payment.status === 'PENDING' && <p className="text-xs text-slate-500">Trạng thái chỉ được cập nhật khi payOS xác nhận. Liên kết payOS được hủy bởi khách hàng hoặc hết hạn.</p>}
          {payment.allocations.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Phân bổ</th><th className="p-3 text-right">Số tiền</th><th className="p-3">Trạng thái</th></tr></thead><tbody>{payment.allocations.map(item => <tr key={item.id} className="border-t border-slate-100"><td className="p-3">{item.orderNumber ?? item.entryNumber ?? '—'}</td><td className="p-3 text-right">{formatVnd(item.allocatedAmount)}</td><td className="p-3">{item.status === 'ACTIVE' ? 'Hiệu lực' : 'Đã đảo'}</td></tr>)}</tbody></table></div>}
        </>}
      </ModalLayout>
    </DetailModal>
    <ConfirmModal open={review !== null} title={review === 'confirm' ? 'Xác nhận chuyển khoản trả công nợ' : review === 'reject' ? 'Từ chối chuyển khoản trả công nợ' : 'Hủy phiếu thanh toán đang chờ'} message={payment && <p>{payment.paymentNumber} · {formatVnd(payment.amount)}. {review === 'confirm' ? 'Xác nhận sau khi kiểm tra tiền đã vào tài khoản ngân hàng. Công nợ được cập nhật khi xác nhận thành công.' : review === 'reject' ? 'Phiếu sẽ chuyển sang trạng thái thất bại.' : 'Phiếu đã thu tiền không thể hủy bằng thao tác này.'}</p>} confirmLabel={review === 'confirm' ? 'Xác nhận đã nhận tiền' : review === 'reject' ? 'Từ chối phiếu' : 'Hủy phiếu'} tone={review === 'confirm' ? 'primary' : 'danger'} busy={busy} confirmDisabled={review === 'reject' && !reason.trim()} onClose={() => setReview(null)} onConfirm={() => { if (review) void run(review) }}>
      {review !== 'confirm' && <label className="block text-sm text-slate-700">{review === 'reject' ? 'Lý do từ chối *' : 'Lý do hủy'}<textarea value={reason} maxLength={500} onChange={event => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-[10px] border border-slate-200 p-3" /></label>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </ConfirmModal>
  </>
}
