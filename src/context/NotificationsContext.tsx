import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { notificationsApi } from '../api/notificationsApi'

import { NotificationsContext } from './notificationsState'

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const identity = isAuthenticated ? user?.id || 'authenticated' : ''
  const [snapshot, setSnapshot] = useState({ identity: '', count: 0 })
  const [revision, setRevision] = useState(0)
  const request = useRef<AbortController | null>(null)

  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    try {
      const response = await notificationsApi.unreadCount(controller.signal)
      if (!controller.signal.aborted) setSnapshot({ identity, count: response.count })
    } catch {
      // Retain the last confirmed badge on transient errors; the API client handles expired sessions.
    }
  }, [identity, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    const refreshVisible = () => { if (active && document.visibilityState === 'visible') void refreshUnread() }
    queueMicrotask(refreshVisible)
    const interval = window.setInterval(refreshVisible, 30_000)
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      active = false
      request.current?.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [isAuthenticated, refreshUnread])

  const notifyChanged = useCallback(() => {
    setRevision((value) => value + 1)
    void refreshUnread()
  }, [refreshUnread])

  return <NotificationsContext.Provider value={{
    unreadCount: isAuthenticated && snapshot.identity === identity ? snapshot.count : 0,
    revision, refreshUnread, notifyChanged,
  }}>{children}</NotificationsContext.Provider>
}
