import type { NotificationItem } from '../../api/notificationsApi'

export const notificationFilters = [
  { value: '', label: 'Tất cả' },
  { value: 'UNREAD', label: 'Chưa đọc' },
  { value: 'READ', label: 'Đã đọc' },
  { value: 'ARCHIVED', label: 'Đã lưu trữ' },
] as const

export function notificationIcon(type: string) {
  switch (type) {
    case 'ORDER_STATUS_CHANGED': return 'task_alt'
    case 'PAYMENT_CONFIRMED': return 'payments'
    case 'DELIVERY_ASSIGNED': case 'DELIVERY_COMPLETED': return 'local_shipping'
    case 'DEBT_OVERDUE': case 'DEBT_DUE_SOON': case 'CREDIT_LIMIT_CHANGED': return 'account_balance_wallet'
    case 'LOW_STOCK': return 'inventory_2'
    case 'EXPIRY_WARNING': return 'event_busy'
    default: return 'notifications'
  }
}
export function notificationTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
}
export function notificationTarget(item: NotificationItem, role: string | null): string | null {
  const data = item.data
  if (!data || typeof data.entityId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.entityId)) return null
  if (role === 'delivery_staff') return data.entityType === 'DELIVERY' ? '/delivery/deliveries/' + data.entityId : null
  const prefix = role === 'agent' ? '/agent' : role === 'sales_staff' ? '/sales' : null
  if (!prefix) return null
  switch (data.entityType) {
    case 'ORDER': return prefix + '/orders'
    case 'PAYMENT': return prefix + '/payments'
    case 'DELIVERY': return prefix + '/deliveries'
    case 'STORE_PRODUCT': case 'INVENTORY_LOT': return prefix + '/inventory'
    case 'DEBT_ENTRY': case 'CREDIT_PROFILE': return prefix + '/debts'
    default: return null
  }
}
