import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  /** `type` defaults to 'success'. Callers that already pass 'error' | 'warning' | 'info' now get the matching look. */
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const TOAST_STYLE: Record<ToastType, { icon: string; box: string; iconClassName: string; durationMs: number }> = {
  success: { icon: 'check_circle', box: 'bg-on-surface text-white', iconClassName: 'text-primary-fixed-dim', durationMs: 3000 },
  info: { icon: 'info', box: 'bg-on-surface text-white', iconClassName: 'text-sky-300', durationMs: 3500 },
  warning: { icon: 'warning', box: 'bg-amber-700 text-white', iconClassName: 'text-amber-200', durationMs: 5000 },
  error: { icon: 'error', box: 'bg-rose-700 text-white', iconClassName: 'text-rose-200', durationMs: 6000 },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_STYLE[type].durationMs)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((toast) => {
          const style = TOAST_STYLE[toast.type]
          return (
            <div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium max-w-sm ${style.box}`}
            >
              <span className={`material-symbols-outlined text-[18px] shrink-0 ${style.iconClassName}`}>{style.icon}</span>
              <span>{toast.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
