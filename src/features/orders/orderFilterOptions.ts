import type { OrderStatus } from '@/api/types'

export const ORDER_STATUS_OPTIONS: { label: string; value: OrderStatus | '' }[] = [
  { label: 'Tất cả trạng thái', value: '' },
  { label: 'Chờ xác nhận', value: 'PENDING_CONFIRMATION' },
  { label: 'Đã xác nhận', value: 'CONFIRMED' },
  { label: 'Đang chuẩn bị', value: 'PREPARING' },
  { label: 'Sẵn sàng giao', value: 'READY_FOR_FULFILLMENT' },
  { label: 'Giao một phần', value: 'PARTIALLY_FULFILLED' },
  { label: 'Hoàn thành', value: 'COMPLETED' },
  { label: 'Đã hủy', value: 'CANCELLED' },
  { label: 'Hủy một phần', value: 'PARTIALLY_CANCELLED' },
]

export const ORDER_SOURCE_OPTIONS = [
  { label: 'Tất cả nguồn', value: '' },
  { label: 'Tại quầy', value: 'COUNTER' },
  { label: 'Đơn Online (Web)', value: 'FARMER_WEB' },
  { label: 'Đơn Online (App)', value: 'FARMER_MOBILE' },
]
