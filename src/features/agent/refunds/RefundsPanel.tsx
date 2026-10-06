import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Plus } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { describeError } from '@/api/client'
import { paymentsApi } from '@/api/paymentsApi'
import { refundsApi, type Refund, type RefundMethod } from '@/api/refundsApi'
import type { PaymentResponse } from '@/api/types'
import ConfirmModal from '@/components/ui/ConfirmModal'
import DetailModal from '@/components/ui/DetailModal'
import { formatVnd } from '@/utils/money'
import { formatDateTime } from '@/utils/units'
import { REFUND_METHOD_LABEL, REFUND_STATUS_BADGE_CLASS, REFUND_STATUS_LABEL } from '../returns/returnLabels'

export type RefundScope = { kind: 'return'; returnId: string; orderId: string } | { kind: 'order'; orderId: string }

interface RefundsPanelProps {
  scope: RefundScope
  refunds: Refund[]
  /** Return refunds: the amount that has to be paid back in total (the inspection fixes it). Cancelled orders have no single total. */
  refundable?: number
  /** Only the store owner pays refunds out; others see the list. */
  canManage: boolean
  /** Called after any change so the parent reloads (the return changes status when the last refund completes). */
  onChanged: () => void
  title?: string
}

const inputClassName =
  'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'

type Action = null | { kind: 'complete' | 'fail' | 'cancel'; refund: Refund } | { kind: 'request' }

const MAX_PROOF_BYTES = 3 * 1024 * 1024

/**
 * Refunds of a return or of a cancelled order. Staff pay the customer back outside the system (cash or bank
 * transfer) and record it here: a refund is PENDING until it is completed (with an optional bank reference and
 * proof image), failed (then a new one is created) or cancelled.
 */
export default function RefundsPanel({ scope, refunds, refundable, canManage, onChanged, title = 'Các khoản hoàn tiền' }: RefundsPanelProps) {
  const { showToast } = useToast()
  const [action, setAction] = useState<Action>(null)
  const [busy, setBusy] = useState(false)

  const open = refunds.filter((r) => r.status === 'PENDING' || r.status === 'COMPLETED')
  const committed = open.reduce((sum, r) => sum + r.amount, 0)
  const paid = refunds.filter((r) => r.status === 'COMPLETED').reduce((sum, r) => sum + r.amount, 0)
  const remaining = refundable === undefined ? null : Math.max(refundable - committed, 0)

  const finish = (message: string) => {
    showToast(message, 'success')
    setAction(null)
    onChanged()
  }

  const fail = async (refund: Refund, note: string) => {
    setBusy(true)
    try {
      if (scope.kind === 'return') await refundsApi.failForReturn(scope.returnId, refund.id, note)
      else await refundsApi.failForOrder(scope.orderId, refund.id, note)
      finish('Đã đánh dấu hoàn tiền thất bại, có thể tạo khoản hoàn mới')
    } catch (err) {
      showToast(describeError(err, 'Không cập nhật được khoản hoàn'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (refund: Refund, reason: string) => {
    setBusy(true)
    try {
      if (scope.kind === 'return') await refundsApi.cancelForReturn(scope.returnId, refund.id, reason)
      else await refundsApi.cancelForOrder(scope.orderId, refund.id, reason)
      finish('Đã hủy khoản hoàn tiền')
    } catch (err) {
      showToast(describeError(err, 'Không hủy được khoản hoàn'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant">
        <div>
          <h3 className="font-semibold text-on-surface">{title}</h3>
          <p className="text-xs text-slate-500">
            Đã hoàn <strong className="text-emerald-700">{formatVnd(paid)}</strong>
            {refundable !== undefined ? <> / cần hoàn <strong>{formatVnd(refundable)}</strong></> : null}
            {remaining !== null && remaining > 0 ? <> · còn thiếu {formatVnd(remaining)} chưa tạo khoản hoàn</> : null}
          </p>
        </div>
        {canManage && (remaining === null || remaining > 0) ? (
          <button type="button" onClick={() => setAction({ kind: 'request' })} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm">
            <Plus size={16} /> Tạo khoản hoàn tiền
          </button>
        ) : null}
      </div>

      {refunds.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500 text-center">
          {canManage ? 'Chưa có khoản hoàn nào. Bấm "Tạo khoản hoàn tiền" để ghi nhận số tiền sẽ trả lại khách.' : 'Chưa có khoản hoàn nào; Chủ cửa hàng sẽ tạo và xác nhận hoàn tiền.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 font-medium">Mã</th>
                <th className="py-3 px-3 font-medium">Hình thức</th>
                <th className="py-3 px-3 font-medium text-right">Số tiền</th>
                <th className="py-3 px-3 font-medium text-center">Trạng thái</th>
                <th className="py-3 px-3 font-medium">Chi tiết</th>
                {canManage ? <th className="py-3 px-4 font-medium text-right">Thao tác</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm">
              {refunds.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 px-4 font-mono text-xs">{r.refundNumber}</td>
                  <td className="py-2.5 px-3">{REFUND_METHOD_LABEL[r.refundMethod] ?? r.refundMethod}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{formatVnd(r.amount)}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded tracking-wide whitespace-nowrap ${REFUND_STATUS_BADGE_CLASS[r.status]}`}>{REFUND_STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">
                    <div>Yêu cầu {formatDateTime(r.requestedAt)}</div>
                    {r.completedAt ? <div>Hoàn lúc {formatDateTime(r.completedAt)}</div> : null}
                    {r.externalReference ? <div>Mã giao dịch: {r.externalReference}</div> : null}
                    {r.cancelReason ? <div>Lý do hủy: {r.cancelReason}</div> : null}
                    {r.note ? <div>Ghi chú: {r.note}</div> : null}
                    {r.proofFileUrl ? (
                      <a href={r.proofFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                        Xem chứng từ <ExternalLink size={12} />
                      </a>
                    ) : null}
                  </td>
                  {canManage ? (
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {r.status === 'PENDING' ? (
                        <>
                          <button type="button" className="text-sm font-medium text-emerald-700 hover:text-emerald-800 mr-3" onClick={() => setAction({ kind: 'complete', refund: r })}>
                            Đã hoàn tiền
                          </button>
                          <button type="button" className="text-sm font-medium text-amber-700 hover:text-amber-800 mr-3" onClick={() => setAction({ kind: 'fail', refund: r })}>
                            Thất bại
                          </button>
                          <button type="button" className="text-sm font-medium text-rose-700 hover:text-rose-800" onClick={() => setAction({ kind: 'cancel', refund: r })}>
                            Hủy
                          </button>
                        </>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-4 py-2 text-xs text-slate-500 border-t border-outline-variant">
        Hệ thống không tự chuyển tiền (kể cả khách đã trả qua payOS): nhân viên trả lại khách bằng tiền mặt hoặc chuyển khoản rồi ghi nhận ở đây. Khoản thất bại có thể tạo lại khoản mới.
      </p>

      {action?.kind === 'request' ? (
        <RequestRefundModal scope={scope} remaining={remaining} onClose={() => setAction(null)} onDone={() => finish('Đã tạo khoản hoàn tiền, chờ xác nhận khi đã trả tiền cho khách')} />
      ) : null}
      {action?.kind === 'complete' ? (
        <CompleteRefundModal scope={scope} refund={action.refund} onClose={() => setAction(null)} onDone={() => finish('Đã ghi nhận hoàn tiền cho khách')} />
      ) : null}
      {action?.kind === 'fail' ? <NoteDialog title="Đánh dấu hoàn tiền thất bại" message="Dùng khi chuyển khoản lỗi hoặc không trả được tiền. Khoản này đóng lại, bạn tạo khoản hoàn mới để thử lại." label="Ghi chú (không bắt buộc)" confirmLabel="Đánh dấu thất bại" tone="danger" busy={busy} requireText={false} onClose={() => setAction(null)} onConfirm={(text) => fail(action.refund, text)} /> : null}
      {action?.kind === 'cancel' ? <NoteDialog title="Hủy khoản hoàn tiền" message="Khoản hoàn bị hủy, số tiền này được tính lại là chưa hoàn." label="Lý do hủy (bắt buộc)" confirmLabel="Hủy khoản hoàn" tone="danger" busy={busy} requireText onClose={() => setAction(null)} onConfirm={(text) => cancel(action.refund, text)} /> : null}
    </div>
  )
}

function NoteDialog({
  title,
  message,
  label,
  confirmLabel,
  tone,
  busy,
  requireText,
  onClose,
  onConfirm,
}: {
  title: string
  message: string
  label: string
  confirmLabel: string
  tone: 'primary' | 'danger'
  busy: boolean
  requireText: boolean
  onClose: () => void
  onConfirm: (text: string) => void
}) {
  const [text, setText] = useState('')
  return (
    <ConfirmModal open title={title} message={message} confirmLabel={confirmLabel} tone={tone} busy={busy} confirmDisabled={requireText && text.trim() === ''} onConfirm={() => onConfirm(text.trim())} onClose={onClose}>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700" htmlFor="rf-note-dialog">
          {label}
        </label>
        <textarea id="rf-note-dialog" className="w-full min-h-[64px] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
    </ConfirmModal>
  )
}

function CompleteRefundModal({ scope, refund, onClose, onDone }: { scope: RefundScope; refund: Refund; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast()
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [proofName, setProofName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const upload = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > MAX_PROOF_BYTES) {
      showToast('Chứng từ phải là ảnh (jpg, png, webp) tối đa 3 MB', 'warning')
      return
    }
    setUploading(true)
    try {
      const res = await refundsApi.uploadProof(file)
      setProofUrl(res.url)
      setProofName(file.name)
    } catch (err) {
      showToast(describeError(err, 'Không tải được ảnh chứng từ; bạn vẫn có thể ghi nhận hoàn tiền không kèm ảnh'), 'error')
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    setBusy(true)
    const body = { externalReference: reference.trim() || null, proofFileUrl: proofUrl, note: note.trim() || null }
    try {
      if (scope.kind === 'return') await refundsApi.completeForReturn(scope.returnId, refund.id, body)
      else await refundsApi.completeForOrder(scope.orderId, refund.id, body)
      onDone()
    } catch (err) {
      showToast(describeError(err, 'Không ghi nhận được hoàn tiền'), 'error')
      setBusy(false)
    }
  }

  return (
    <DetailModal open onClose={busy ? () => undefined : onClose} widthClassName="max-w-lg">
      <div className="p-5 space-y-4">
        <div>
          <h3 className="text-lg text-slate-900 font-bold">Xác nhận đã hoàn tiền</h3>
          <p className="text-sm text-slate-600 mt-1">
            Khoản <span className="font-mono">{refund.refundNumber}</span>: <strong>{formatVnd(refund.amount)}</strong> ({REFUND_METHOD_LABEL[refund.refundMethod] ?? refund.refundMethod}). Chỉ bấm khi bạn đã thật sự trả tiền cho khách.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="rf-ref">
            Mã giao dịch / số chứng từ (không bắt buộc)
          </label>
          <input id="rf-ref" className={inputClassName} maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ví dụ: mã chuyển khoản ngân hàng" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Ảnh chứng từ (không bắt buộc)</label>
          <div className="flex items-center gap-3">
            <input ref={fileInput} id="rf-proof" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0] ?? null)} />
            <button type="button" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm disabled:opacity-50" onClick={() => fileInput.current?.click()} disabled={uploading || busy}>
              {uploading ? 'Đang tải ảnh...' : proofUrl ? 'Chọn ảnh khác' : 'Chọn ảnh'}
            </button>
            <span className="text-sm text-slate-600 truncate">{proofName ? `Đã tải lên: ${proofName}` : 'Chưa có ảnh'}</span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="rf-note">
            Ghi chú
          </label>
          <input id="rf-note" className={inputClassName} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm shadow-sm disabled:opacity-50" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="button" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm disabled:opacity-50" onClick={submit} disabled={busy || uploading}>
            {busy ? 'Đang ghi...' : 'Đã hoàn tiền'}
          </button>
        </div>
      </div>
    </DetailModal>
  )
}

function RequestRefundModal({ scope, remaining, onClose, onDone }: { scope: RefundScope; remaining: number | null; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast()
  const [payments, setPayments] = useState<PaymentResponse[]>([])
  const [paymentId, setPaymentId] = useState('')
  const [method, setMethod] = useState<RefundMethod>('CASH')
  const [amount, setAmount] = useState(remaining !== null ? String(remaining) : '')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    paymentsApi
      .getOrderPayments(scope.orderId)
      .then((summary) => {
        if (cancelled) return
        const paid = summary.payments.filter((p) => p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED')
        setPayments(paid)
        if (scope.kind === 'order' && paid.length > 0) setPaymentId(paid[0].id)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.orderId, scope.kind])

  const value = Number(amount)
  const amountOk = /^\d+(\.\d{1,2})?$/.test(amount.trim()) && value > 0 && (remaining === null || value <= remaining)
  const paymentOk = scope.kind === 'return' || paymentId !== ''
  const canSubmit = !busy && amountOk && paymentOk

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    const body = { refundMethod: method, amount: value, originalPaymentId: paymentId || null, externalReference: reference.trim() || null, note: note.trim() || null }
    try {
      if (scope.kind === 'return') await refundsApi.requestForReturn(scope.returnId, body)
      else await refundsApi.requestForOrder(scope.orderId, { ...body, originalPaymentId: paymentId })
      onDone()
    } catch (err) {
      showToast(describeError(err, 'Không tạo được khoản hoàn tiền'), 'error')
      setBusy(false)
    }
  }

  return (
    <DetailModal open onClose={busy ? () => undefined : onClose} widthClassName="max-w-lg">
      <div className="p-5 space-y-4">
        <div>
          <h3 className="text-lg text-slate-900 font-bold">Tạo khoản hoàn tiền</h3>
          <p className="text-sm text-slate-600 mt-1">
            {remaining !== null ? `Còn ${formatVnd(remaining)} chưa có khoản hoàn.` : 'Dùng để tạo lại khoản hoàn sau khi khoản trước thất bại hoặc bị hủy.'} Khoản mới ở trạng thái chờ, bạn xác nhận khi đã trả tiền cho khách.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rq-method">
              Hình thức hoàn
            </label>
            <select id="rq-method" className={inputClassName} value={method} onChange={(e) => setMethod(e.target.value as RefundMethod)}>
              {(Object.keys(REFUND_METHOD_LABEL) as RefundMethod[]).map((m) => (
                <option key={m} value={m}>
                  {REFUND_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rq-amount">
              Số tiền (đ)
            </label>
            <input id="rq-amount" type="number" min={0} step="0.01" className={inputClassName} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="rq-pay">
            Hoàn cho khoản thanh toán {scope.kind === 'order' ? '*' : '(không bắt buộc)'}
          </label>
          <select id="rq-pay" className={inputClassName} value={paymentId} onChange={(e) => setPaymentId(e.target.value)}>
            {scope.kind === 'return' ? <option value="">Không chọn</option> : payments.length === 0 ? <option value="">Đang tải...</option> : null}
            {payments.map((p) => (
              <option key={p.id} value={p.id}>
                {p.paymentNumber} · {p.paymentMethod === 'CASH' ? 'Tiền mặt' : 'payOS'} · {formatVnd(p.amount)}
              </option>
            ))}
          </select>
        </div>
        {amount !== '' && !amountOk ? (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" role="alert">
            {remaining !== null && value > remaining ? `Tối đa ${formatVnd(remaining)}.` : 'Số tiền phải lớn hơn 0, tối đa 2 chữ số thập phân.'}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rq-ref">
              Mã giao dịch (nếu có)
            </label>
            <input id="rq-ref" className={inputClassName} maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rq-note">
              Ghi chú
            </label>
            <input id="rq-note" className={inputClassName} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm shadow-sm disabled:opacity-50" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="button" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm disabled:opacity-50" onClick={submit} disabled={!canSubmit}>
            {busy ? 'Đang tạo...' : 'Tạo khoản hoàn'}
          </button>
        </div>
      </div>
    </DetailModal>
  )
}
