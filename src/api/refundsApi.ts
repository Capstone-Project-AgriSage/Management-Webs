import { api } from './client'
import type { Uuid } from './types'

/** Refunds of a sales return and of a cancelled order (flow L4, F4.5). Every refund route needs Manage; there is no automatic payOS refund. */

export type RefundStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type RefundMethod = 'CASH' | 'BANK_TRANSFER' | 'OTHER_EXTERNAL'

export interface Refund {
  id: Uuid
  refundNumber: string
  /** SALES_RETURN or ORDER. */
  source: string
  salesReturnId: Uuid | null
  orderId: Uuid | null
  originalPaymentId: Uuid | null
  refundMethod: RefundMethod
  amount: number
  status: RefundStatus
  externalReference: string | null
  proofFileUrl: string | null
  requestedBy: Uuid
  requestedAt: string
  completedBy: Uuid | null
  completedAt: string | null
  cancelledBy: Uuid | null
  cancelledAt: string | null
  cancelReason: string | null
  note: string | null
}

export interface RefundRequestInput {
  refundMethod: RefundMethod
  amount: number
  originalPaymentId?: Uuid | null
  externalReference?: string | null
  note?: string | null
}

export interface RefundCompleteInput {
  externalReference?: string | null
  proofFileUrl?: string | null
  note?: string | null
}

export const refundsApi = {
  // ---- refunds of a sales return ----
  requestForReturn: (returnId: Uuid, data: RefundRequestInput) =>
    api<Refund>(`/api/returns/${returnId}/refunds`, { method: 'POST', body: JSON.stringify(data) }),

  completeForReturn: (returnId: Uuid, refundId: Uuid, data: RefundCompleteInput) =>
    api<Refund>(`/api/returns/${returnId}/refunds/${refundId}/complete`, { method: 'POST', body: JSON.stringify(data) }),

  failForReturn: (returnId: Uuid, refundId: Uuid, note?: string) =>
    api<Refund>(`/api/returns/${returnId}/refunds/${refundId}/fail`, { method: 'POST', body: JSON.stringify({ note: note || null }) }),

  cancelForReturn: (returnId: Uuid, refundId: Uuid, reason: string) =>
    api<Refund>(`/api/returns/${returnId}/refunds/${refundId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // ---- refunds of a cancelled order ----
  listForOrder: (orderId: Uuid) => api<Refund[]>(`/api/orders/${orderId}/refunds`),

  requestForOrder: (orderId: Uuid, data: RefundRequestInput & { originalPaymentId: Uuid }) =>
    api<Refund>(`/api/orders/${orderId}/refunds`, { method: 'POST', body: JSON.stringify(data) }),

  completeForOrder: (orderId: Uuid, refundId: Uuid, data: RefundCompleteInput) =>
    api<Refund>(`/api/orders/${orderId}/refunds/${refundId}/complete`, { method: 'POST', body: JSON.stringify(data) }),

  failForOrder: (orderId: Uuid, refundId: Uuid, note?: string) =>
    api<Refund>(`/api/orders/${orderId}/refunds/${refundId}/fail`, { method: 'POST', body: JSON.stringify({ note: note || null }) }),

  cancelForOrder: (orderId: Uuid, refundId: Uuid, reason: string) =>
    api<Refund>(`/api/orders/${orderId}/refunds/${refundId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
}
