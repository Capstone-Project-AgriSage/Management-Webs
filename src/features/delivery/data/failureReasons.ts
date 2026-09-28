import type { DeliveryFailureReasonOption } from '@/data/types'

/** Shown together in the "Giao thất bại" dialog — the outcome field is what
 * decides whether the staff is offered a redelivery date or a cancel confirm. */
export const FAILURE_REASON_OPTIONS: DeliveryFailureReasonOption[] = [
  { code: 'CUSTOMER_ABSENT', label: 'Không gặp người nhận', outcome: 'RETRY' },
  { code: 'CUSTOMER_UNREACHABLE', label: 'Không liên lạc được', outcome: 'RETRY' },
  { code: 'BAD_WEATHER', label: 'Thời tiết xấu', outcome: 'RETRY' },
  { code: 'VEHICLE_BREAKDOWN', label: 'Xe gặp sự cố', outcome: 'RETRY' },
  { code: 'DAMAGED_REPLACEABLE', label: 'Hàng bị rách/hỏng nhưng có thể thay hàng', outcome: 'RETRY' },
  { code: 'CUSTOMER_REFUSED', label: 'Farmer từ chối nhận hàng', outcome: 'CANCEL' },
  { code: 'CUSTOMER_NO_LONGER_NEEDS', label: 'Farmer không còn nhu cầu mua', outcome: 'CANCEL' },
  { code: 'DAMAGED_NOT_REPLACEABLE_AGREED_CANCEL', label: 'Hàng không thể thay, hai bên thống nhất hủy', outcome: 'CANCEL' },
]
