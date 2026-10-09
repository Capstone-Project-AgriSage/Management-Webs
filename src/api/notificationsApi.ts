import { api } from './client'
import type { PagedResult } from './types'

export type NotificationStatus = 'UNREAD' | 'READ' | 'ARCHIVED'
export interface NotificationItem {
  id: string
  notificationType: string
  title: string
  message: string
  data: { entityType?: string; entityId?: string; [key: string]: unknown } | null
  status: NotificationStatus
  readAt: string | null
  createdAt: string
}
export interface NotificationListParams {
  page?: number
  pageSize?: number
  status?: NotificationStatus
}
const base = '/api/me/notifications'
export const notificationsApi = {
  list: (params: NotificationListParams = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams()
    query.set('page', String(params.page ?? 1))
    query.set('pageSize', String(params.pageSize ?? 20))
    if (params.status) query.set('status', params.status)
    return api<PagedResult<NotificationItem>>(base + '?' + query, { signal })
  },
  unreadCount: (signal?: AbortSignal) => api<{ count: number }>(base + '/unread-count', { signal }),
  markRead: (id: string) => api<void>(base + '/' + encodeURIComponent(id) + '/read', { method: 'POST' }),
  markAllRead: () => api<void>(base + '/read-all', { method: 'POST' }),
  archive: (id: string) => api<void>(base + '/' + encodeURIComponent(id), { method: 'DELETE' }),
}
