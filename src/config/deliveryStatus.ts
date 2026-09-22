import type { DeliveryStatus } from '../types'

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  ASSIGNED: 'Được phân công',
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Giao thành công',
  FAILED: 'Giao thất bại',
  CANCELLED: 'Đã hủy',
}

export const DELIVERY_STATUS_BADGE_CLASSNAME: Record<DeliveryStatus, string> = {
  ASSIGNED: 'bg-surface-container text-on-surface-variant border border-outline-variant',
  OUT_FOR_DELIVERY: 'bg-secondary-fixed text-on-secondary-fixed-variant border border-secondary-fixed-dim/60',
  DELIVERED: 'bg-primary-fixed text-on-primary-fixed-variant border border-primary-fixed-dim/60',
  FAILED: 'bg-error-container text-on-error-container border border-error/30',
  CANCELLED: 'bg-surface-container-high text-outline border border-outline-variant',
}

export const DELIVERY_STATUS_ICON: Record<DeliveryStatus, string> = {
  ASSIGNED: 'assignment_late',
  OUT_FOR_DELIVERY: 'local_shipping',
  DELIVERED: 'check_circle',
  FAILED: 'error',
  CANCELLED: 'cancel',
}
