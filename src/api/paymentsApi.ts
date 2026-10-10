import { api, toQuery } from './client'
import type { PaymentResponse, Money, Uuid, RefundResponse, PagedResult } from './types'
import type { PaymentListItem } from './customersApi'

export interface CashPaymentRequest {
  paymentContext: 'ORDER_PAYMENT' | 'DEBT_REPAYMENT'
  amount: Money
  /** ORDER_PAYMENT only. */
  orderId?: Uuid | null
  /** DEBT_REPAYMENT only: the payer. */
  farmerProfileId?: Uuid | null
  /** DEBT_REPAYMENT: explicit entries; null = oldest due date first. */
  debtAllocations?: { debtEntryId: Uuid; amount: Money }[] | null
  note?: string
}

export interface BankDebtPaymentRequest {
  farmerProfileId: Uuid
  amount: Money
  /** yyyy-MM-dd */
  paymentDate?: string | null
  note?: string | null
  reference?: string | null
}

export interface OrderPaymentsSummary {
  orderTotal: Money
  paidAmount: Money
  remainingToPay: Money
  payments: PaymentResponse[]
  refunds: RefundResponse[]
}

export interface PaymentListQuery {
  paymentContext?: 'ORDER_PAYMENT' | 'DEBT_REPAYMENT'
  paymentMethod?: string
  status?: string
  orderId?: string
  farmerProfileId?: string
  fromDate?: string
  toDate?: string
  search?: string
  page?: number
  pageSize?: number
}

export const paymentsApi = {
  /** Staff-recorded cash (FLOW_1); also debt repayments at the counter (FLOW_3 §7). */
  createCashPayment: (data: CashPaymentRequest) => {
    return api<PaymentResponse>('/api/payments/cash', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getOrderPayments: (orderId: Uuid, signal?: AbortSignal) => {
    return api<OrderPaymentsSummary>(`/api/orders/${orderId}/payments`, { signal })
  },

  getPayments: (q: PaymentListQuery = {}) =>
    api<PagedResult<PaymentListItem>>(
      `/api/payments${toQuery({
        PaymentContext: q.paymentContext,
        PaymentMethod: q.paymentMethod,
        Status: q.status,
        OrderId: q.orderId,
        FarmerProfileId: q.farmerProfileId,
        FromDate: q.fromDate,
        ToDate: q.toDate,
        Search: q.search,
        Page: q.page,
        PageSize: q.pageSize,
      })}`,
    ),

  getPayment: (id: Uuid) => api<PaymentResponse>(`/api/payments/${id}`),

  /** Operate: records a bank transfer as a PENDING debt repayment; nothing is allocated until confirmed. */
  createBankDebtPayment: (data: BankDebtPaymentRequest) =>
    api<PaymentResponse>('/api/payments/bank-transfer', { method: 'POST', body: JSON.stringify(data) }),

  /** Manage: allocates oldest due first; confirming twice returns the same PAID receipt. */
  confirmPayment: (id: Uuid) => api<PaymentResponse>(`/api/payments/${id}/confirm`, { method: 'POST' }),

  /** Manage: maps to FAILED; a reason is required. */
  rejectPayment: (id: Uuid, reason: string) =>
    api<PaymentResponse>(`/api/payments/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
}
