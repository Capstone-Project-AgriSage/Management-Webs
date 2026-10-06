import { api, toQuery } from './client'
import type { PagedResult } from './types'

// Customer directory — CUSTOMER_MANAGEMENT.md. Customer id = farmerProfileId.

export interface CustomerReference {
  id: string
  code: string | null
  name: string | null
}

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED'

export interface CustomerAddress {
  recipientName: string | null
  recipientPhone: string | null
  addressLine: string | null
  province: string | null
  ward?: string | null
  district?: string | null
}

export interface CustomerDebtSummary {
  totalOutstandingDebt: number
  confirmedDebt: number
  pendingConfirmationDebt: number | null
  overdueDebt: number
  totalPaid: number
  creditLimit: number
  reservedCredit: number
  availableCredit: number
  openDebtCount: number
  oldestDueDate: string | null
  hasOverdueDebt: boolean
}

export interface CustomerResponse {
  id: string
  userId: string
  customerCode: string | null
  fullName: string
  phoneNumber: string | null
  email: string | null
  customerType: string
  customerGroup: CustomerReference | null
  status: CustomerStatus | string
  notes: string | null
  totalOrders: number
  totalPurchaseAmount: number
  currentDebt: number
  creditLimit: number
  allowCreditPurchase: boolean
  reservedCredit: number
  availableCredit: number
  paymentTermDays: number | null
  createdAt: string
  updatedAt: string
  address: CustomerAddress | null
  debtSummary: CustomerDebtSummary | null
}

/** Shared by create/update; omitted address/group/credit fields leave those relationships untouched. */
export interface CustomerWriteRequest {
  fullName: string
  phoneNumber?: string | null
  email?: string | null
  address?: CustomerAddress | null
  notes?: string | null
  customerGroupId?: string | null
  allowCreditPurchase?: boolean | null
  creditTierId?: string | null
  creditLimit?: number | null
  creditChangeReason?: string | null
}

export interface CreateCustomerRequest extends CustomerWriteRequest {
  password: string
  customerType: 'REGISTERED'
}

export type CustomerSortBy = 'NAME' | 'CREATED_AT' | 'TOTAL_ORDERS' | 'CURRENT_DEBT'

export interface CustomerListQuery {
  search?: string
  customerGroupId?: string
  status?: string
  hasDebt?: boolean
  sortBy?: CustomerSortBy
  descending?: boolean
  page?: number
  pageSize?: number
}

export interface CustomerOrder {
  orderId: string
  orderNumber: string
  orderDate: string
  totalAmount: number
  paymentMethods: string[]
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | string
  orderStatus: string
}

export interface PaymentListItem {
  id: string
  paymentNumber: string
  paymentContext: 'ORDER_PAYMENT' | 'DEBT_REPAYMENT' | string
  paymentMethod: string
  amount: number
  status: string
  payerName: string | null
  confirmedAt: string | null
  initiatedAt: string
}

export interface PaymentAllocation {
  id: string
  allocationType: string
  orderId: string | null
  orderNumber: string | null
  debtEntryId: string | null
  entryNumber: string | null
  allocatedAmount: number
  prepaymentConsumedAmount: number
  status: string
  allocatedAt: string
}

export interface CustomerPayment {
  payment: PaymentListItem
  confirmedBy: string | null
  debtEntries: PaymentAllocation[]
}

export interface GroupAssignment {
  id: string
  customerGroup: CustomerReference
  effectiveFrom: string
  effectiveTo: string | null
  assignedBy: string
  reason: string | null
}

export interface AddressResponse extends CustomerAddress {
  id: string
  addressType: string | null
  isDefault: boolean
  createdAt: string
}

export const customersApi = {
  getCustomers: (q: CustomerListQuery = {}) =>
    api<PagedResult<CustomerResponse>>(
      `/api/customers${toQuery({
        Search: q.search,
        CustomerGroupId: q.customerGroupId,
        Status: q.status,
        HasDebt: q.hasDebt,
        SortBy: q.sortBy,
        Descending: q.descending,
        Page: q.page,
        PageSize: q.pageSize,
      })}`,
    ),

  getCustomer: (id: string) => api<CustomerResponse>(`/api/customers/${id}`),

  createCustomer: (data: CreateCustomerRequest) =>
    api<CustomerResponse>('/api/customers', { method: 'POST', body: JSON.stringify(data) }),

  updateCustomer: (id: string, data: CustomerWriteRequest) =>
    api<CustomerResponse>(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  /** Manage (owner/admin) only. */
  setStatus: (id: string, status: CustomerStatus) =>
    api<CustomerResponse>(`/api/customers/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  assignGroup: (id: string, customerGroupId: string, reason?: string) =>
    api<CustomerResponse>(`/api/customers/${id}/group`, { method: 'PUT', body: JSON.stringify({ customerGroupId, reason: reason || null }) }),

  getGroupHistory: (id: string) => api<GroupAssignment[]>(`/api/customers/${id}/group-history`),

  getOrders: (id: string, q: { search?: string; status?: string; paymentStatus?: string; fromDate?: string; toDate?: string; page?: number; pageSize?: number } = {}) =>
    api<PagedResult<CustomerOrder>>(
      `/api/customers/${id}/orders${toQuery({ Search: q.search, Status: q.status, PaymentStatus: q.paymentStatus, FromDate: q.fromDate, ToDate: q.toDate, Page: q.page, PageSize: q.pageSize })}`,
    ),

  getDebtSummary: (id: string) => api<CustomerDebtSummary>(`/api/customers/${id}/debts`),

  getPayments: (id: string, q: { page?: number; pageSize?: number } = {}) =>
    api<PagedResult<CustomerPayment>>(`/api/customers/${id}/payments${toQuery({ Page: q.page, PageSize: q.pageSize })}`),

  getAddresses: (id: string) => api<AddressResponse[]>(`/api/customers/${id}/addresses`),
}
