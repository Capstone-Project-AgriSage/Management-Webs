import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface DetailModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  widthClassName?: string
}

export default function DetailModal({ open, onClose, children, widthClassName = 'max-w-md' }: DetailModalProps) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className={`relative w-full ${widthClassName} my-4 sm:my-8`}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 shadow-md transition-colors"
          aria-label="Đóng"
        >
          <X size={16} />
        </button>
        <div className="bg-white rounded-xl shadow-xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
