import { mockNotifications, mockAuditLogs } from '../data/mockContentAndSystem'
import type { SystemNotification, NotificationStatus, NotificationActionId, AuditLog, AuditLogActionId } from '../types'

let notifications = [...mockNotifications]
let auditLogs = [...mockAuditLogs]

// --- Notifications ---
export function listNotifications(): SystemNotification[] {
  return notifications
}

export function updateNotificationStatus(id: string, status: NotificationStatus): void {
  notifications = notifications.map(n => n.id === id ? { ...n, status } : n)
}

export function createNotification(data: Partial<SystemNotification>): SystemNotification {
  const newId = `NOTIF-${String(notifications.length + 1).padStart(3, '0')}`
  const newNotif: SystemNotification = {
    id: newId,
    title: data.title || '',
    content: data.content || '',
    target: data.target || 'Tất cả',
    type: data.type || 'Hệ thống',
    status: data.status || 'Bản nháp',
    scheduledFor: data.scheduledFor || new Date().toISOString().split('T')[0] + ' 00:00',
    sentCount: 0
  }
  notifications = [newNotif, ...notifications]
  return newNotif
}

export function updateNotification(id: string, data: Partial<SystemNotification>): void {
  notifications = notifications.map(n => n.id === id ? { ...n, ...data } : n)
}

export function deleteNotification(id: string): void {
  notifications = notifications.filter(n => n.id !== id)
}

export function notificationActionsFor(status: NotificationStatus): { id: NotificationActionId; label: string; icon: string; danger?: boolean }[] {
  const actions: { id: NotificationActionId; label: string; icon: string; danger?: boolean }[] = [
    { id: 'view', label: 'Xem chi tiết', icon: 'visibility' }
  ]
  if (status === 'Bản nháp' || status === 'Lên lịch') {
    actions.push({ id: 'edit', label: 'Chỉnh sửa', icon: 'edit' })
    actions.push({ id: 'send-now', label: 'Gửi ngay', icon: 'send' })
  }
  actions.push({ id: 'delete', label: 'Xóa thông báo', icon: 'delete', danger: true })
  return actions
}

// --- Audit Logs ---
export function listAuditLogs(): AuditLog[] {
  return auditLogs
}

export function auditLogActionsFor(): { id: AuditLogActionId; label: string; icon: string; danger?: boolean }[] {
  return [
    { id: 'view-details', label: 'Xem JSON chi tiết', icon: 'data_object' }
  ]
}
