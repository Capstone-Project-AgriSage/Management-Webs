import { api } from './client'
import type { PaymentResponse, Money, Uuid, RefundResponse } from './types'

export interface CashPaymentRequest {
  paymentContext: 'ORDER_PAYMENT' | 'DEBT_REPAYMENT'
  orderId: Uuid
  amount: Money
  note?: string
}

export interface OrderPaymentsSummary {
  orderTotal: Money
  paidAmount: Money
  remainingToPay: Money
  payments: PaymentResponse[]
  refunds: RefundResponse[]
}

export const paymentsApi = {
  createCashPayment: (data: CashPaymentRequest) => {
    return api<PaymentResponse>('/api/payments/cash', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getOrderPayments: (orderId: Uuid) => {
    return api<OrderPaymentsSummary>(`/api/orders/${orderId}/payments`)
  }
}
