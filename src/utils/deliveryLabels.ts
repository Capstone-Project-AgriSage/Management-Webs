import type { AttemptStatus, DeliveryAllocation, DeliveryStatus, FailureReason, ResolutionType } from '@/api/deliveriesApi'

// Vietnamese labels for the delivery enums of FE_GUIDE_FLOW_2 (§4–§5). Unknown codes fall back to the raw value.
export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  DRAFT: 'Lưu nháp',
  ASSIGNED: 'Chờ xuất phát',
  OUT_FOR_DELIVERY: 'Đang giao',
  PARTIALLY_DELIVERED: 'Đã giao một phần',
  RETRY_PENDING: 'Chờ giao lại',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
}

export const ATTEMPT_STATUS_LABEL: Record<AttemptStatus, string> = {
  IN_PROGRESS: 'Đang giao',
  SUCCESS: 'Thành công',
  PARTIAL_SUCCESS: 'Giao một phần',
  FAILED: 'Giao thất bại',
  CANCELLED: 'Đã hủy',
}

export const FAILURE_REASON_LABEL: Record<FailureReason, string> = {
  CUSTOMER_ABSENT: 'Khách vắng nhà',
  UNREACHABLE: 'Không liên lạc được',
  CUSTOMER_REFUSED: 'Khách từ chối nhận',
  DAMAGED: 'Hàng hư hỏng',
  WEATHER: 'Thời tiết xấu',
  VEHICLE_ISSUE: 'Sự cố xe',
  ADDRESS_ISSUE: 'Sai / khó tìm địa chỉ',
  OTHER: 'Lý do khác',
}

export const RESOLUTION_TYPE_LABEL: Record<ResolutionType, string> = {
  RETRY_DELIVERY: 'Giao lại',
  REPLACE_GOODS: 'Đổi hàng',
  RETURN_TO_STORE: 'Mang về kho',
  WRITE_OFF: 'Hủy hàng',
  CANCEL_REMAINDER: 'Hủy phần còn lại',
  NO_ACTION: 'Không cần xử lý',
  OTHER: 'Khác',
}

/** Resolutions that change stock need an adjustment from flow 4 first (§Q5), so they are flagged in the UI. */
export const STOCK_CHANGING_RESOLUTIONS: ResolutionType[] = ['REPLACE_GOODS', 'RETURN_TO_STORE', 'WRITE_OFF']

export function labelOf<K extends string>(map: Record<K, string>, key: string | null | undefined): string {
  if (!key) return '--'
  return (map as Record<string, string>)[key] ?? key
}

/** Statuses where the store can still (re)assign a driver or swap lots (§Q4). */
export const EDITABLE_DELIVERY_STATUSES: DeliveryStatus[] = ['DRAFT', 'ASSIGNED', 'PARTIALLY_DELIVERED', 'RETRY_PENDING']
/** Statuses that allow "Xuất phát"; a driver must also be assigned (§Q4). */
export const DISPATCHABLE_DELIVERY_STATUSES: DeliveryStatus[] = ['ASSIGNED', 'PARTIALLY_DELIVERED', 'RETRY_PENDING']

/** Base quantity of a lot still waiting to be delivered on this trip. */
export function openAllocationQuantity(a: DeliveryAllocation): number {
  return Math.max(0, a.allocatedBaseQuantity - a.deliveredBaseQuantity - a.releasedBaseQuantity)
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '--'
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso
    ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '--'
}
