export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: number
  message: string
  type: ToastType
  /** How many times this same message was raised while it was on screen. */
  count: number
}

/** More than this many at once and the oldest is dropped: a screen full of popups hides the page and none is read. */
export const MAX_VISIBLE_TOASTS = 3

/** Errors stay longer so staff can read the server's reason. */
export function toastDuration(type: ToastType): number {
  return type === 'error' ? 5000 : 3000
}

export interface PushResult {
  toasts: Toast[]
  /** The toast that now shows the message: a new one, or the one that already did. */
  shownId: number
  /** True when `shownId` is a new toast and the next id has been used. */
  isNew: boolean
  /** Toasts pushed out by the limit; their dismissal timers are no longer needed. */
  droppedIds: number[]
}

/**
 * Adds a message to the list of visible toasts.
 *
 * One failing request often means several (a page asks for its data in parallel), so the same message and type while
 * it is still showing is not shown again: it is counted on the toast that is there, which keeps showing for a full
 * duration again. The list never grows past MAX_VISIBLE_TOASTS.
 */
export function pushToast(current: Toast[], message: string, type: ToastType, nextId: number): PushResult {
  const existing = current.find((toast) => toast.message === message && toast.type === type)
  if (existing) {
    return {
      toasts: current.map((toast) => (toast.id === existing.id ? { ...toast, count: toast.count + 1 } : toast)),
      shownId: existing.id,
      isNew: false,
      droppedIds: [],
    }
  }

  const added = [...current, { id: nextId, message, type, count: 1 }]
  const overflow = Math.max(0, added.length - MAX_VISIBLE_TOASTS)
  return {
    toasts: added.slice(overflow),
    shownId: nextId,
    isNew: true,
    droppedIds: added.slice(0, overflow).map((toast) => toast.id),
  }
}
