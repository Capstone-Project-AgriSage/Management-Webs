import { api } from './client'
import type { PagedResult } from './types'

export interface DebtAccountResponse {
  customerId: string
  customerCode: string
  customerName: string
  customerPhone: string
  creditLimit: number
  outstandingReceivable: number
  availableCredit: number
  totalOverdueAmount: number
  status: 'NORMAL' | 'WARNING' | 'OVERDUE' | 'SUSPENDED'
}

export interface DebtTransactionResponse {
  id: string
  transactionType: 'ORDER_DEBT' | 'REPAYMENT' | 'ADJUSTMENT_INCREASE' | 'ADJUSTMENT_DECREASE'
  amount: number
  note: string
  createdAt: string
  referenceId: string // Mã đơn hàng nếu là order
  paymentMethod?: 'CASH' | 'BANK_TRANSFER'
  status: 'COMPLETED' | 'PENDING_VERIFICATION' | 'REJECTED'
}

export const debtApi = {
  // Q9: Danh sách sổ nợ
  getDebtAccounts: (params?: { page?: number; pageSize?: number; search?: string; hasOverdue?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('Page', params.page.toString())
    if (params?.pageSize) searchParams.append('PageSize', params.pageSize.toString())
    if (params?.search) searchParams.append('Search', params.search)
    if (params?.hasOverdue) searchParams.append('HasOverdue', params.hasOverdue.toString())
    
    return api<PagedResult<DebtAccountResponse>>(`/api/debt-accounts?${searchParams.toString()}`)
  },
  
  // Q9: Chi tiết nợ của 1 khách
  getCustomerDebt: (customerId: string) => {
    return api<DebtAccountResponse>(`/api/customers/${customerId}/debt`)
  },
  
  // Q9: Lịch sử giao dịch nợ
  getDebtTransactions: (customerId: string, params?: { page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('Page', params.page.toString())
    if (params?.pageSize) searchParams.append('PageSize', params.pageSize.toString())
    return api<PagedResult<DebtTransactionResponse>>(`/api/customers/${customerId}/debt/transactions?${searchParams.toString()}`)
  },
  
  // Q9: Điều chỉnh nợ (Tăng/Giảm)
  adjustDebt: (customerId: string, data: { amount: number; isIncrease: boolean; note: string }) => {
    return api<void>(`/api/customers/${customerId}/debt/adjust`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
  // Q10: Thu tiền trả nợ - Tiền mặt
  repayCash: (customerId: string, data: { amount: number; note: string }) => {
    return api<void>(`/api/customers/${customerId}/repayment/cash`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
  // Q10: Báo cáo chuyển khoản
  repayBankTransfer: (customerId: string, data: { amount: number; referenceCode: string; note: string }) => {
    return api<void>(`/api/customers/${customerId}/repayment/bank-transfer`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
  // Q10: Duyệt giao dịch bank-transfer (Kế toán)
  verifyRepayment: (customerId: string, transactionId: string, isApproved: boolean) => {
    return api<void>(`/api/customers/${customerId}/repayment/${transactionId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ isApproved })
    })
  }
}
