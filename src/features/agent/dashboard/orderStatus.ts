import type { OrderStatus } from '@/api/types'

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', PREPARING: 'Đang chuẩn bị',
  READY_FOR_FULFILLMENT: 'Sẵn sàng giao', PARTIALLY_FULFILLED: 'Giao một phần', COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy', PARTIALLY_CANCELLED: 'Hủy một phần',
}
