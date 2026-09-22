export interface DeliveryStaffUser {
  name: string
  role: string
  initials: string
  hubName: string
  storeId?: string
}

export interface NavItem {
  label: string
  to: string
  icon: string
  badge?: string
  badgeTone?: 'neutral' | 'primary' | 'error' | 'warning'
  iconTone?: 'default' | 'primary'
}

export interface PageHeaderState {
  title: string
  subtitle?: string
  badge?: string
}

/** Lifecycle of a single delivery order as seen by the delivery staff app.
 * ASSIGNED: handed to this staff, not yet picked up.
 * OUT_FOR_DELIVERY: staff started the delivery run.
 * DELIVERED / FAILED: outcome of the current attempt.
 * CANCELLED: order will not be delivered again (farmer refused, no longer
 * wants it, or damaged goods couldn't be replaced and both sides agreed). */
export type DeliveryStatus = 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'CANCELLED'

export type DeliveryFailureReasonCode =
  | 'CUSTOMER_ABSENT'
  | 'CUSTOMER_UNREACHABLE'
  | 'BAD_WEATHER'
  | 'VEHICLE_BREAKDOWN'
  | 'DAMAGED_REPLACEABLE'
  | 'CUSTOMER_REFUSED'
  | 'CUSTOMER_NO_LONGER_NEEDS'
  | 'DAMAGED_NOT_REPLACEABLE_AGREED_CANCEL'

/** Picking a failure reason decides what happens next: RETRY reasons let the
 * staff schedule a redelivery date, CANCEL reasons close the order out. */
export interface DeliveryFailureReasonOption {
  code: DeliveryFailureReasonCode
  label: string
  outcome: 'RETRY' | 'CANCEL'
}

export interface DeliveryProduct {
  name: string
  quantityLabel: string
}

/** Every time the staff goes out for this order — first try or a redelivery —
 * is recorded as its own attempt so the history stays auditable. */
export interface DeliveryAttempt {
  id: string
  attemptNumber: number
  status: 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED'
  startedAt: string
  completedAt?: string
  failureReasonCode?: DeliveryFailureReasonCode
  failureReasonLabel?: string
  note?: string
  proofPhotoUrl?: string
}

export interface DeliveryOrder {
  id: string
  orderCode: string
  farmerName: string
  farmerPhone: string
  deliveryAddress: string
  deliveryNote?: string
  /** Mua chịu — a successful delivery on this order creates a Debt Entry. */
  isCreditPurchase: boolean
  scheduledDate: string
  scheduledWindowLabel: string
  status: DeliveryStatus
  cancelReasonLabel?: string
  redeliveryDate?: string
  products: DeliveryProduct[]
  attempts: DeliveryAttempt[]
}

/** Input for DeliveryContext's confirmDelivered — shared by the context and
 * DeliverySuccessModal so the two can't drift apart on the payload shape. */
export interface ConfirmDeliveredInput {
  proofPhotoUrl: string
  note?: string
}

/** Input for DeliveryContext's reportFailure — shared by the context and
 * DeliveryFailureModal for the same reason as ConfirmDeliveredInput above. */
export interface ReportFailureInput {
  reasonCode: DeliveryFailureReasonCode
  note?: string
  redeliveryDate?: string
}
