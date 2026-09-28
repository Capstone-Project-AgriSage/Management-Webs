import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { FAILURE_REASON_OPTIONS } from '@/features/delivery/data/failureReasons'
import type { DeliveryFailureReasonCode, ReportFailureInput } from '@/types'
import { isoDateOffsetFromToday } from '@/utils/date'

interface DeliveryFailureModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (input: ReportFailureInput) => void
}

const RETRY_REASONS = FAILURE_REASON_OPTIONS.filter((r) => r.outcome === 'RETRY')
const CANCEL_REASONS = FAILURE_REASON_OPTIONS.filter((r) => r.outcome === 'CANCEL')

export default function DeliveryFailureModal({ open, onClose, onConfirm }: DeliveryFailureModalProps) {
  const [reasonCode, setReasonCode] = useState<DeliveryFailureReasonCode | ''>('')
  const [note, setNote] = useState('')
  const [redeliveryDate, setRedeliveryDate] = useState(isoDateOffsetFromToday(1))
  const [error, setError] = useState('')
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const selectedOption = FAILURE_REASON_OPTIONS.find((r) => r.code === reasonCode)

  const reset = () => {
    setReasonCode('')
    setNote('')
    setRedeliveryDate(isoDateOffsetFromToday(1))
    setError('')
    setConfirmingCancel(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = () => {
    if (!reasonCode) {
      setError('Vui lòng chọn lý do giao thất bại.')
      return
    }
    if (selectedOption?.outcome === 'CANCEL') {
      // Cancelling can't be undone, so it gets its own confirmation screen
      // instead of firing straight off this button.
      setConfirmingCancel(true)
      return
    }
    onConfirm({ reasonCode, note: note.trim() || undefined, redeliveryDate })
    reset()
  }

  const handleConfirmCancel = () => {
    if (!reasonCode) return
    onConfirm({ reasonCode, note: note.trim() || undefined })
    reset()
  }

  if (confirmingCancel) {
    return (
      <Modal open={open} onClose={handleClose} title="Xác nhận hủy đơn">
        <div className="space-y-space-md">
          <div className="p-space-md bg-error-container/40 border border-error/30 rounded-lg flex items-start gap-space-sm">
            <span className="material-symbols-outlined text-[22px] text-error shrink-0">warning</span>
            <p className="font-body-md text-body-md text-on-error-container">
              Đơn hàng sẽ chuyển sang trạng thái <strong>Đã hủy</strong> và không thể giao lại. Lý do:{' '}
              <strong>{selectedOption?.label}</strong>.
            </p>
          </div>
          <div className="flex gap-space-sm">
            <Button variant="outline" fullWidth={false} className="flex-1" onClick={() => setConfirmingCancel(false)}>
              Quay lại
            </Button>
            <Button variant="danger" icon="cancel" fullWidth={false} className="flex-1" onClick={handleConfirmCancel}>
              Xác nhận hủy đơn
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={handleClose} title="Báo giao thất bại">
      <div className="space-y-space-md">
        <fieldset>
          <legend className="font-label-md text-label-md text-on-surface-variant mb-space-xs">Lý do (có thể giao lại)</legend>
          <div className="space-y-1.5">
            {RETRY_REASONS.map((r) => (
              <label
                key={r.code}
                className={`flex items-center gap-2 px-space-sm py-space-sm rounded border cursor-pointer transition-colors ${
                  reasonCode === r.code ? 'border-primary bg-primary-fixed/40' : 'border-outline-variant hover:bg-surface-container-low'
                }`}
              >
                <input type="radio" name="failure-reason" checked={reasonCode === r.code} onChange={() => setReasonCode(r.code)} className="accent-primary" />
                <span className="font-body-md text-body-md text-on-surface">{r.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-label-md text-label-md text-error mb-space-xs">Lý do dẫn đến hủy đơn</legend>
          <div className="space-y-1.5">
            {CANCEL_REASONS.map((r) => (
              <label
                key={r.code}
                className={`flex items-center gap-2 px-space-sm py-space-sm rounded border cursor-pointer transition-colors ${
                  reasonCode === r.code ? 'border-error bg-error-container/40' : 'border-outline-variant hover:bg-surface-container-low'
                }`}
              >
                <input type="radio" name="failure-reason" checked={reasonCode === r.code} onChange={() => setReasonCode(r.code)} className="accent-error" />
                <span className="font-body-md text-body-md text-on-surface">{r.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {selectedOption?.outcome === 'RETRY' ? (
          <label className="block">
            <span className="font-label-md text-label-md text-on-surface-variant block mb-space-xs">Ngày giao lại</span>
            <input
              type="date"
              value={redeliveryDate}
              onChange={(e) => setRedeliveryDate(e.target.value)}
              className="w-full h-10 px-space-sm text-sm bg-surface-container-low border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface"
            />
          </label>
        ) : null}

        {selectedOption?.outcome === 'CANCEL' ? (
          <div className="p-space-sm bg-error-container/40 border border-error/30 rounded-lg font-body-sm text-body-sm text-on-error-container">
            Lựa chọn này sẽ hủy đơn hàng, không thể giao lại.
          </div>
        ) : null}

        <label className="block">
          <span className="font-label-md text-label-md text-on-surface-variant block mb-space-xs">Ghi chú</span>
          <textarea
            className="w-full min-h-20 p-space-sm text-sm bg-surface-container-low border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface"
            placeholder="Mô tả thêm về tình huống giao hàng..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {error ? <p className="font-body-sm text-body-sm text-error">{error}</p> : null}

        <Button
          variant={selectedOption?.outcome === 'CANCEL' ? 'danger' : 'primary'}
          icon={selectedOption?.outcome === 'CANCEL' ? 'cancel' : 'event_repeat'}
          onClick={handleSubmit}
        >
          {selectedOption?.outcome === 'CANCEL' ? 'Tiếp tục hủy đơn' : 'Ghi nhận giao thất bại'}
        </Button>
      </div>
    </Modal>
  )
}
