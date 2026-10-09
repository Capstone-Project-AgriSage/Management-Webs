import type { NotificationItem } from '../../api/notificationsApi'

export const notificationFilters = [
  { value: '', label: 'Tất cả' },
  { value: 'UNREAD', label: 'Chưa đọc' },
  { value: 'READ', label: 'Đã đọc' },
  { value: 'ARCHIVED', label: 'Đã lưu trữ' },
] as const

export function notificationIcon(type: string) {
  switch (type) {
    case 'ORDER_PLACED': return 'receipt_long'
    case 'ORDER_STATUS_CHANGED': return 'task_alt'
    case 'PAYMENT_CONFIRMED': case 'DEBT_PAYMENT_CONFIRMED': return 'payments'
    case 'PAYMENT_FAILED': case 'DELIVERY_FAILED': return 'error_outline'
    case 'RETURN_REQUESTED': case 'RETURN_RESULT': return 'assignment_return'
    case 'REFUND_REQUESTED': case 'REFUND_RESULT': return 'currency_exchange'
    case 'AI_DIAGNOSIS_COMPLETED': case 'DIAGNOSIS_REVIEWED': case 'DIAGNOSIS_RECOMMENDATIONS': return 'psychology'
    case 'DELIVERY_ASSIGNED': case 'DELIVERY_COMPLETED': case 'DELIVERY_REQUIRED': case 'DELIVERY_PARTIAL': return 'local_shipping'
    case 'DEBT_CREATED': case 'DEBT_DISPUTED': case 'DEBT_OVERDUE': case 'DEBT_DUE_SOON': case 'CREDIT_LIMIT_CHANGED': return 'account_balance_wallet'
    case 'OUT_OF_STOCK': case 'STOCK_RECEIVED': case 'STOCK_ISSUED': case 'STOCK_ADJUSTED': case 'LOW_STOCK': return 'inventory_2'
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
    case 'SALES_RETURN': return prefix + '/returns/' + data.entityId
    case 'REFUND': return role === 'agent' ? prefix + '/refunds' : prefix + '/orders'
    case 'STOCK_MOVEMENT': return role === 'agent' ? prefix + '/inventory/movements' : null
    case 'STORE_PRODUCT': case 'INVENTORY_LOT': return prefix + '/inventory'
    case 'DEBT_ENTRY': case 'CREDIT_PROFILE': return prefix + '/debts'
    default: return null
  }
}
