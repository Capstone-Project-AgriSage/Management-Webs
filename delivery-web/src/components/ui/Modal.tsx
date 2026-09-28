import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-inverse-surface/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-lg rounded-t-xl shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-space-lg py-space-md border-b border-outline-variant/60 sticky top-0 bg-white">
          <h3 id="modal-title" className="font-title-lg text-title-lg text-on-surface font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-low"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="p-space-lg">{children}</div>
      </div>
    </div>
  )
}
