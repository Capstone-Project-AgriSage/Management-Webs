import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { notificationsApi } from '../api/notificationsApi'

import { NotificationsContext } from './notificationsState'

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const identity = isAuthenticated ? user?.id || 'authenticated' : ''
  const [snapshot, setSnapshot] = useState({ identity: '', count: 0 })
  const [revision, setRevision] = useState(0)
  const confirmed = useRef({ identity: '', count: 0 })
  const request = useRef<AbortController | null>(null)

  const refreshUnread = useCallback(async (forceRevision = false) => {
    if (!isAuthenticated) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    try {
      const response = await notificationsApi.unreadCount(controller.signal)
      if (!controller.signal.aborted) {
        if (forceRevision || confirmed.current.identity !== identity || confirmed.current.count !== response.count) {
          setRevision((value) => value + 1)
        }
        confirmed.current = { identity, count: response.count }
        setSnapshot(confirmed.current)
      }
    } catch {
      // Retain the last confirmed badge on transient errors; the API client handles expired sessions.
      if (!controller.signal.aborted && forceRevision) setRevision(value => value + 1)
    }
  }, [identity, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    const refreshVisible = () => { if (active && document.visibilityState === 'visible') void refreshUnread() }
    queueMicrotask(refreshVisible)
    const realtime = (event: Event) => {
      const topic = (event as CustomEvent<{ topic: string }>).detail?.topic
      if (!document.hidden && (topic === 'notifications' || topic === 'resync')) void refreshUnread(true)
    }
    window.addEventListener('agrisage-realtime-change', realtime)
    return () => {
      active = false
      request.current?.abort()
      window.removeEventListener('agrisage-realtime-change', realtime)
    }
  }, [isAuthenticated, refreshUnread])

  const notifyChanged = useCallback(() => {
    void refreshUnread(true)
  }, [refreshUnread])

  return <NotificationsContext.Provider value={{
    unreadCount: isAuthenticated && snapshot.identity === identity ? snapshot.count : 0,
    revision, refreshUnread, notifyChanged,
  }}>{children}</NotificationsContext.Provider>
}
