import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const TOAST_ICON: Record<ToastType, { icon: string; className: string }> = {
  success: { icon: 'check_circle', className: 'text-primary-fixed-dim' },
  error: { icon: 'error', className: 'text-red-300' },
  info: { icon: 'info', className: 'text-sky-300' },
  warning: { icon: 'warning', className: 'text-amber-300' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, type }])
    // Errors stay longer so staff can read the server's reason.
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, type === 'error' ? 5000 : 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-center gap-2 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium max-w-sm ${
              toast.type === 'error' ? 'bg-red-800' : 'bg-on-surface'
            }`}
          >
            <span className={`material-symbols-outlined text-[18px] shrink-0 ${TOAST_ICON[toast.type].className}`}>
              {TOAST_ICON[toast.type].icon}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
