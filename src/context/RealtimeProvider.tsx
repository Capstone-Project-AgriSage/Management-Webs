import { useEffect, type ReactNode } from 'react'
import { HttpTransportType, HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useAuth } from './AuthContext'
import { startRealtimeSession } from '../realtime/realtimeSession'

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const token = isAuthenticated ? localStorage.getItem('agrisage_token') : null
  useEffect(() => {
    if (!token) return
    const connection = new HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL || ''}/api/realtime`, {
        accessTokenFactory: () => localStorage.getItem('agrisage_token') || '',
        withCredentials: false,
        transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents,
      })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: context => Math.min(30_000, 1000 * 2 ** Math.min(context.previousRetryCount, 5) + Math.random() * 1000) })
      .configureLogging(LogLevel.None)
      .build()
    const emit = (topic: string) => window.dispatchEvent(new CustomEvent('agrisage-realtime-change', { detail: { topic } }))
    const dispose = startRealtimeSession(connection, emit)
    // Browsers may suspend sockets in background tabs; an explicit snapshot repairs any missed invalidations.
    const synchronize = () => { if (!document.hidden) emit('resync') }
    window.addEventListener('online', synchronize)
    window.addEventListener('focus', synchronize)
    document.addEventListener('visibilitychange', synchronize)
    return () => {
      dispose()
      window.removeEventListener('online', synchronize)
      window.removeEventListener('focus', synchronize)
      document.removeEventListener('visibilitychange', synchronize)
    }
  }, [token])
  return children
}
