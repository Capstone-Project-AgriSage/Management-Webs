import { createContext } from 'react'

interface NotificationsContextValue {
  unreadCount: number
  revision: number
  refreshUnread: () => Promise<void>
  notifyChanged: () => void
}
export const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined)
