import { api, toQuery } from './client'
import type { PagedResult } from './types'
import type { CustomerReference, PaymentListItem } from './customersApi'

// FLOW_3 §6–§7 — debt ledger and actions. Money only enters through payments (paymentsApi), decision B-D6.

export interface DebtAccountListItem {
  id: string
  farmerProfileId: string
  fullName: string | null
  phoneNumber: string | null
  customerGroup: CustomerReference | null
  currentBalance: number
  overdueAmount: number
  oldestDueDate: string | null
}

export interface DebtAccount {
  id: string
  farmerProfileId: string
  status: string
  currentBalance: number
  overdueAmount: number
  openEntryCount: number
  oldestDueDate: string | null
  lastTransactionAt: string | null
  version: number
}

export type DebtEntryStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'DISPUTED' | 'ADJUSTED' | 'CANCELLED' | string

export interface DebtEntryListItem {
  id: string
  entryNumber: string
  farmerProfileId: string
  fullName: string | null
  phoneNumber: string | null
  sourceType: 'DELIVERY' | 'PICKUP' | 'MANUAL_ADJUSTMENT' | string
  orderNumber: string | null
  originalAmount: number
  totalPaid: number
  outstandingAmount: number
  dueDate: string
  isOverdue: boolean
  overdueDays: number
  status: DebtEntryStatus
  createdAt: string
}

export interface DebtAction {
  id: string
  actionType: 'DISPUTE' | 'KEEP' | 'CHANGE_DUE_DATE' | 'ADJUST' | 'CANCEL' | string
  reason: string | null
  adjustmentAmount: number | null
  oldDueDate: string | null
  newDueDate: string | null
  createdBy: string
  createdAt: string
}

export interface DebtTransaction {
  id: string
  debtEntryId: string | null
  transactionType: 'CREDIT_SALE' | 'PAYMENT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RETURN' | string
  amountDelta: number
  balanceBefore: number
  balanceAfter: number
  occurredAt: string
  status: string
  paymentAllocationId: string | null
  salesReturnId: string | null
  debtEntryActionId: string | null
  note: string | null
  createdBy: string | null
}

export interface DebtEntry {
  id: string
  entryNumber: string
  sourceType: string
  orderId: string | null
  orderNumber: string | null
  deliveryId: string | null
  fulfillmentValue: number
  prepaymentAppliedAmount: number
  originalAmount: number
  totalPaid: number
  outstandingAmount: number
  dueDate: string
  isOverdue: boolean
  overdueDays: number
  status: DebtEntryStatus
  customer: { id: string; fullName: string | null; phoneNumber: string | null; creditLimit: number; currentOutstandingDebt: number; reservedCredit: number; availableCredit: number } | null
  order: { id: string; orderNumber: string; items?: { id: string; productName: string; packagingName: string; quantity: number; lineTotalAmount: number }[] } | null
  actions: DebtAction[]
  transactions: DebtTransaction[]
  payments: { id: string; paymentNumber: string; paymentMethod: string; amount: number; status: string; confirmedAt: string | null; initiatedAt: string }[]
  createdAt: string
}

export interface AllocationPreview {
  amount: number
  allocations: { debtEntryId: string; entryNumber: string; dueDate: string; outstandingAmount: number; allocatedAmount: number }[]
  unallocatedAmount: number
}

export interface DebtDashboard {
  totalOutstandingDebt: number
  totalOverdueDebt: number
  collectedToday: number
  collectedThisMonth: number
  customersWithDebt: number
  customersWithOverdueDebt: number
  topDebtors: DebtAccountListItem[]
  recentDebtPayments: PaymentListItem[]
  overdueDebts: DebtEntryListItem[]
}

export type DebtEntrySortBy = 'CreatedAt' | 'DueDate' | 'OutstandingAmount' | 'DaysOverdue'

export interface DebtEntryQuery {
  farmerProfileId?: string
  orderId?: string
  status?: string
  search?: string
  overdueOnly?: boolean
  dueFrom?: string
  dueTo?: string
  sortBy?: DebtEntrySortBy
  descending?: boolean
  page?: number
  pageSize?: number
}

const entry = (id: string) => `/api/debt-entries/${id}`
const post = <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const debtApi = {
  getDebtAccounts: (q: { search?: string; hasOutstanding?: boolean; overdueOnly?: boolean; page?: number; pageSize?: number } = {}) =>
    api<PagedResult<DebtAccountListItem>>(
      `/api/debt-accounts${toQuery({ Search: q.search, HasOutstanding: q.hasOutstanding, OverdueOnly: q.overdueOnly, Page: q.page, PageSize: q.pageSize })}`,
    ),

  getCustomerDebt: (farmerProfileId: string) => api<DebtAccount>(`/api/customers/${farmerProfileId}/debt`),

  getTransactions: (farmerProfileId: string, q: { fromDate?: string; toDate?: string; page?: number; pageSize?: number } = {}) =>
    api<PagedResult<DebtTransaction>>(
      `/api/customers/${farmerProfileId}/debt/transactions${toQuery({ FromDate: q.fromDate, ToDate: q.toDate, Page: q.page, PageSize: q.pageSize })}`,
    ),

  getEntries: (q: DebtEntryQuery = {}) =>
    api<PagedResult<DebtEntryListItem>>(
      `/api/debt-entries${toQuery({
        FarmerProfileId: q.farmerProfileId,
        OrderId: q.orderId,
        Status: q.status,
        Search: q.search,
        OverdueOnly: q.overdueOnly,
        DueFrom: q.dueFrom,
        DueTo: q.dueTo,
        SortBy: q.sortBy,
        Descending: q.descending,
        Page: q.page,
        PageSize: q.pageSize,
      })}`,
    ),

  getEntry: (id: string) => api<DebtEntry>(entry(id)),
  getEntryPayments: (id: string) => api<PaymentListItem[]>(`${entry(id)}/payments`),
  getEntryLedger: (id: string) => api<DebtTransaction[]>(`${entry(id)}/ledger`),

  /** Oldest due date first (rule 27) — preview before collecting cash. */
  getAllocationPreview: (farmerProfileId: string, amount: number) =>
    api<AllocationPreview>(`/api/customers/${farmerProfileId}/debt/allocation-preview${toQuery({ amount })}`),

  /** Operate: DISPUTE does not block payments; KEEP / ADJUST / CANCEL resolve it. */
  dispute: (id: string, reason: string) => post<DebtEntry>(`${entry(id)}/dispute`, { reason }),
  keep: (id: string, reason: string) => post<DebtEntry>(`${entry(id)}/keep`, { reason }),
  /** The new date cannot be in the past. */
  changeDueDate: (id: string, newDueDate: string, reason: string) => post<DebtEntry>(`${entry(id)}/change-due-date`, { newDueDate, reason }),
  /** Manage: amount > 0 is the amount to REDUCE (≤ outstanding). */
  adjust: (id: string, amount: number, reason: string) => post<DebtEntry>(`${entry(id)}/adjust`, { amount, reason }),
  /** Manage: writes off the full outstanding. */
  cancel: (id: string, reason: string) => post<DebtEntry>(`${entry(id)}/cancel`, { reason }),
  /** Manage: the only way to increase receivable by hand. */
  createManualEntry: (farmerProfileId: string, data: { amount: number; dueDate: string; reason: string }) =>
    post<DebtEntry>(`/api/customers/${farmerProfileId}/debt/manual-entries`, data),

  /** Manage. */
  getDashboard: () => api<DebtDashboard>('/api/debt-entries/dashboard'),
}
