import { api, toQuery } from './client'
import type { CustomerReference } from './customersApi'

// FLOW_3 §4.3 — a farmer's credit profile. Customer id = farmerProfileId.

export type CreditProfileStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | string

export interface CreditSummary {
  profileId: string
  farmerProfileId: string
  status: CreditProfileStatus
  creditTier: CustomerReference | null
  creditLimit: number
  /** The tier's defaultPaymentTermDays — the debt term. */
  paymentTermDays: number | null
  outstandingReceivable: number
  reservedCredit: number
  /** limit − outstanding − reserved; may be negative. */
  availableCredit: number
  approvedBy: string
  approvedAt: string
  note: string | null
  version: number
  allowCreditPurchase: boolean
  overdueAmount: number
  hasOverdueDebt: boolean
  totalPaid: number
  openDebtCount: number
  oldestDueDate: string | null
}

export interface CreditLimitHistory {
  id: string
  oldCreditTier: CustomerReference | null
  newCreditTier: CustomerReference | null
  oldCreditLimit: number
  newCreditLimit: number
  reason: string | null
  changedBy: string
  changedAt: string
}

export interface CreditReservation {
  id: string
  orderId: string
  orderNumber: string | null
  reservedAmount: number
  consumedAmount: number
  releasedAmount: number
  remainingAmount: number
  status: string
  createdAt: string
}

export interface CreditEligibility {
  customerId: string
  creditLimit: number
  currentOutstandingDebt: number
  reservedCredit: number
  availableCredit: number
  orderAmount: number
  availableCreditAfterOrder: number
  hasOverdueDebt: boolean
  overdueAmount: number
  eligible: boolean
  reasonCode: string | null
  message: string | null
}

const base = (id: string) => `/api/customers/${id}/credit`

export const customerCreditApi = {
  /** 404 when the farmer has no credit profile yet. */
  getCredit: (id: string) => api<CreditSummary>(base(id)),

  /** Tier: request → group's default tier → default group's tier → 422 "choose a credit tier". */
  createCredit: (id: string, data: { creditTierId?: string | null; creditLimit?: number | null; note?: string | null }) =>
    api<CreditSummary>(base(id), { method: 'POST', body: JSON.stringify(data) }),

  /** Rule 22: a reason is required; a limit below current exposure is allowed. */
  changeLimit: (id: string, data: { creditLimit: number; reason: string; creditTierId?: string | null }) =>
    api<CreditSummary>(`${base(id)}/limit`, { method: 'PUT', body: JSON.stringify(data) }),

  /** Manage only; reason required. */
  activate: (id: string, reason: string) => api<void>(`${base(id)}/activate`, { method: 'POST', body: JSON.stringify({ reason }) }),
  suspend: (id: string, reason: string) => api<void>(`${base(id)}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  block: (id: string, reason: string) => api<void>(`${base(id)}/block`, { method: 'POST', body: JSON.stringify({ reason }) }),

  getHistory: (id: string) => api<CreditLimitHistory[]>(`${base(id)}/history`),

  getReservations: (id: string, activeOnly?: boolean) => api<CreditReservation[]>(`${base(id)}/reservations${toQuery({ activeOnly })}`),

  checkEligibility: (id: string, orderAmount: number) =>
    api<CreditEligibility>(`/api/customers/${id}/credit-eligibility`, { method: 'POST', body: JSON.stringify({ orderAmount }) }),
}
