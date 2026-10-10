import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { debtApi, type AllocationPreview, type DebtEntryListItem } from '@/api/debtApi'
import { paymentsApi } from '@/api/paymentsApi'
import { useToast } from '@/context/ToastContext'
import { formatVnd } from '@/utils/money'
import { formatDay } from '@/utils/creditLabels'

interface CollectCashModalProps {
  open: boolean
  farmerProfileId: string
  customerName: string
  outstanding: number
  /** Open entries of this customer (for choosing entries by hand). */
  openEntries: DebtEntryListItem[]
  onClose: () => void
  onCollected: () => void
}

const inputClassName = 'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'

// FLOW_3 §7 + B-D6: cash enters through POST /api/payments/cash (DEBT_REPAYMENT); null allocations = oldest due first.
export default function CollectCashModal({ open, farmerProfileId, customerName, outstanding, openEntries, onClose, onCollected }: CollectCashModalProps) {
  const { showToast } = useToast()
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<AllocationPreview | null>(null)
  const [manual, setManual] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setMode('auto')
      setAmount('')
      setNote('')
      setPreview(null)
      setManual({})
    }
  }, [open])

  // Preview the oldest-due-first split as the cashier types.
  useEffect(() => {
    if (!open || mode !== 'auto') return
    const value = Number(amount)
    if (!(value > 0)) {
      setPreview(null)
      return
    }
    const t = setTimeout(() => {
      debtApi.getAllocationPreview(farmerProfileId, value).then(setPreview).catch(() => setPreview(null))
    }, 300)
    return () => clearTimeout(t)
  }, [open, mode, amount, farmerProfileId])

  const manualAllocations = Object.entries(manual)
    .map(([debtEntryId, v]) => ({ debtEntryId, amount: Number(v) }))
    .filter((a) => a.amount > 0)
  const manualTotal = manualAllocations.reduce((s, a) => s + a.amount, 0)
  const manualInvalid = manualAllocations.some((a) => a.amount > (openEntries.find((e) => e.id === a.debtEntryId)?.outstandingAmount ?? 0))

  const total = mode === 'auto' ? Number(amount) || 0 : manualTotal
  const canSubmit = total > 0 && !(mode === 'manual' && manualInvalid) && !saving

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const payment = await paymentsApi.createCashPayment({
        paymentContext: 'DEBT_REPAYMENT',
        amount: total,
        farmerProfileId,
        debtAllocations: mode === 'manual' ? manualAllocations : null,
        note: note.trim() || undefined,
      })
      showToast(`Đã thu ${formatVnd(payment.amount)} — phiếu ${payment.paymentNumber}`, 'success')
      onCollected()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Thu tiền thất bại', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Thu nợ tiền mặt — ${customerName}`} widthClassName="max-w-xl">
      <ModalLayout footer={<div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-sm text-slate-600">
          Tổng thu: <strong className="text-slate-900 tabular-nums">{formatVnd(total)}</strong>
          {mode === 'manual' && manualInvalid && <span className="text-rose-600"> · vượt số còn nợ</span>}
        </span>
        <div className="flex gap-2">
          <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50" onClick={onClose}>
            Hủy
          </button>
          <PermissionAction codes={["PAYMENTS.RECEIVE_CASH"]}><button type="button" disabled={!canSubmit} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50" onClick={submit}>
            {saving ? 'Đang thu...' : 'Xác nhận thu tiền'}
          </button></PermissionAction>
        </div>
      </div>} bodyClassName="space-y-4"><p className="text-sm text-slate-600">
          Dư nợ hiện tại: <strong className="text-slate-900">{formatVnd(outstanding)}</strong>
        </p><div className="flex bg-slate-100 p-1 rounded-lg w-fit text-sm" role="tablist">
          {(['auto', 'manual'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`px-3 py-1.5 rounded-md font-medium ${mode === m ? 'bg-white shadow text-emerald-700' : 'text-slate-600'}`}
              onClick={() => setMode(m)}
            >
              {m === 'auto' ? 'Trừ khoản đến hạn trước' : 'Chọn khoản nợ'}
            </button>
          ))}
        </div>{mode === 'auto' ? (
          <>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Số tiền thu (đ)<span className="text-rose-600 ml-0.5">*</span></span>
              <input className={inputClassName} type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </label>
            {preview && (
              <div className="rounded-lg border border-slate-200 text-sm">
                <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">Dự kiến trừ vào</div>
                <ul className="divide-y divide-slate-100">
                  {preview.allocations.map((a) => (
                    <li key={a.debtEntryId} className="px-3 py-2 flex justify-between gap-3">
                      <span>
                        <span className="font-mono">{a.entryNumber}</span>
                        <span className="text-xs text-slate-500"> · hạn {formatDay(a.dueDate)} · còn {formatVnd(a.outstandingAmount)}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{formatVnd(a.allocatedAmount)}</span>
                    </li>
                  ))}
                </ul>
                {preview.unallocatedAmount > 0 && (
                  <div className="px-3 py-2 text-xs text-amber-800 bg-amber-50 border-t border-amber-100">
                    Thừa {formatVnd(preview.unallocatedAmount)} so với dư nợ — phần này không trừ vào khoản nào.
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-slate-200 text-sm max-h-72 overflow-y-auto">
            {openEntries.length === 0 ? (
              <p className="px-3 py-4 text-slate-500">Khách không có khoản nợ đang mở.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {openEntries.map((e) => {
                  const v = manual[e.id] ?? ''
                  const over = Number(v) > e.outstandingAmount
                  return (
                    <li key={e.id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono">{e.entryNumber}</div>
                        <div className={`text-xs ${e.isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
                          hạn {formatDay(e.dueDate)} · còn {formatVnd(e.outstandingAmount)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="text-xs text-emerald-700 hover:underline"
                          onClick={() => setManual((m) => ({ ...m, [e.id]: String(e.outstandingAmount) }))}
                        >
                          Trả hết
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={e.outstandingAmount}
                          aria-label={`Số tiền trả cho ${e.entryNumber}`}
                          className={`w-32 h-9 px-2 text-right rounded-lg border text-sm ${over ? 'border-rose-400' : 'border-slate-200'}`}
                          value={v}
                          onChange={(ev) => setManual((m) => ({ ...m, [e.id]: ev.target.value }))}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}<label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Ghi chú</span>
          <input className={inputClassName} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </ModalLayout>
    </Modal>
  )
}
