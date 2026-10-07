import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  widthClassName?: string
}

export default function Modal({ open, onClose, title, children, widthClassName = 'max-w-md' }: ModalProps) {
  useEffect(() => {
    if (!open) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = originalOverflow
    }
  }, [open, onClose])

  if (!open) return null

  // Rendered into <body>: opened from inside a panel that has its own stacking context (e.g. the counter cart, z-10),
  // an in-place modal would stay below the top bar (z-40) and its top would be hidden behind it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className={`relative w-full ${widthClassName} my-4 sm:my-8`}>
        <div className="bg-white rounded-xl shadow-xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Đóng"
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-4 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
