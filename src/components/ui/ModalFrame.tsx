import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './modal.css'

interface ModalFrameProps {
  open: boolean
  onClose: () => void
  title?: string
  busy?: boolean
  children: ReactNode
  widthClassName?: string
}

const activeDialogs: symbol[] = []
let pageOverflow = ''
const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function ModalFrame({ open, onClose, title, busy = false, children, widthClassName }: ModalFrameProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(Symbol('dialog'))
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  useEffect(() => {
    closeRef.current = onClose
    busyRef.current = busy
  }, [onClose, busy])

  useEffect(() => {
    if (!open) return
    const id = idRef.current
    const opener = document.activeElement as HTMLElement | null
    if (activeDialogs.length === 0) {
      pageOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    activeDialogs.push(id)
    const panel = panelRef.current
    const controls = () => panel ? Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((el) => el.getClientRects().length > 0) : []
    const items = controls()
    const initialFocus = items.find((el) => el.matches('input, textarea, select')) ?? panel
    initialFocus?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (activeDialogs.at(-1) !== id) return
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const items = controls()
      const first = items[0]
      const last = items.at(-1)
      if (!first) { event.preventDefault(); panel?.focus(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault(); last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      const wasTop = activeDialogs.at(-1) === id
      const index = activeDialogs.indexOf(id)
      if (index >= 0) activeDialogs.splice(index, 1)
      if (activeDialogs.length === 0) document.body.style.overflow = pageOverflow
      if (wasTop && opener?.isConnected) opener.focus()
    }
  }, [open])

  if (!open) return null
  const width = widthClassName?.includes('max-w-4xl') ? 1024 : widthClassName?.includes('max-w-3xl') ? 896 : 760
  return createPortal(
    <div className="modal-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title ?? 'Thông tin và thao tác'} tabIndex={-1} className="modal-panel" style={{ '--modal-width': `${width}px` } as CSSProperties}>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Đóng" className="modal-close"><X size={22} /></button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
