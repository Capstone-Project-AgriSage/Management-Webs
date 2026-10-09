import { useContext } from 'react'
import { NotificationsContext } from '../context/notificationsState'

export function useNotifications() {
  const value = useContext(NotificationsContext)
  if (!value) throw new Error('useNotifications must be used within NotificationsProvider')
  return value
}
