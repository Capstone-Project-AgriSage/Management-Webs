import ModalLayout from '@/components/ui/ModalLayout'
import type { ReactNode } from 'react';
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
    tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700 disabled:hover:bg-rose-600' : 'bg-primary hover:bg-green-800 disabled:hover:bg-primary'

  return (
    <DetailModal open={open} onClose={onClose} busy={busy}>
      <ModalLayout header={<h3 className="text-lg leading-7 text-slate-900 font-semibold">{title}</h3>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className="agrisage-button min-h-[42px] px-4 py-2 rounded-[10px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={onClose}
          disabled={busy}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`agrisage-button min-h-[42px] px-4 py-2 rounded-[10px] text-white font-semibold transition-colors text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${confirmClassName}`}
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
        >
          {busy ? 'Đang xử lý...' : confirmLabel}
        </button>
      </div>} bodyClassName="space-y-4">{message ? <div className="text-sm text-slate-500 leading-relaxed">{message}</div> : null}{children}
      </ModalLayout>
    </DetailModal>
  )
}
