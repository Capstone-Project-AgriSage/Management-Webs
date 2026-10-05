import type { ReactNode } from 'react'
import DetailModal from '@/components/ui/DetailModal'

interface ConfirmModalProps {
  open: boolean
  title: string
  /** Short explanation under the title. */
  message?: ReactNode
  /** Extra content (a reason field, a summary) between the message and the buttons. */
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** 'danger' = red confirm button (destructive or money-out actions). */
  tone?: 'primary' | 'danger'
  busy?: boolean
  confirmDisabled?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Small confirmation dialog shared by the flow screens: title, message, optional fields, Hủy / confirm. */
export default function ConfirmModal({
  open,
  title,
  message,
  children,
  confirmLabel,
  cancelLabel = 'Hủy',
  tone = 'primary',
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const confirmClassName =
    tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700 disabled:hover:bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-700 disabled:hover:bg-emerald-600'

  return (
    <DetailModal open={open} onClose={busy ? () => undefined : onClose}>
      <div className="p-5 space-y-4">
        <h3 className="text-lg text-slate-900 font-bold">{title}</h3>
        {message ? <div className="text-sm text-slate-600 leading-relaxed">{message}</div> : null}
        {children}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-white font-medium transition-colors text-sm shadow-sm disabled:opacity-50 ${confirmClassName}`}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </DetailModal>
  )
}
