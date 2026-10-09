import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { pushToast, toastDuration, type Toast, type ToastType } from './toastState'

export type { ToastType } from './toastState'

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
  // The latest list, so a burst of showToast calls in the same tick each sees the previous one's result.
  const current = useRef<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, number>())

  const commit = useCallback((next: Toast[]) => {
    current.current = next
    setToasts(next)
  }, [])

  const clearTimer = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) window.clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const dismiss = useCallback((id: number) => {
    clearTimer(id)
    commit(current.current.filter((toast) => toast.id !== id))
  }, [clearTimer, commit])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const result = pushToast(current.current, message, type, nextId.current)
    if (result.isNew) nextId.current += 1
    result.droppedIds.forEach(clearTimer)
    commit(result.toasts)

    // Showing the same message again restarts its countdown instead of stacking another popup.
    clearTimer(result.shownId)
    timers.current.set(result.shownId, window.setTimeout(() => dismiss(result.shownId), toastDuration(type)))
  }, [clearTimer, commit, dismiss])

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer))
      pending.clear()
    }
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
            {toast.count > 1 && (
              <span className="shrink-0 rounded-full bg-white/20 px-1.5 text-xs tabular-nums" aria-label={`${toast.count} lần`}>
                ×{toast.count}
              </span>
            )}
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
