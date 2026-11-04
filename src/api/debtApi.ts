import { api, toQuery } from './client'
import type { PagedResult } from './types'
import type { CustomerReference, PaymentListItem } from './customersApi'

// FLOW_3 §6–§7 — debt ledger and actions. Money only enters through payments (paymentsApi), decision B-D6.
// Debt by crop season (FE_GUIDE_FLOW_3 §4.3, §10): every entry has an origin season (never changes) and a collection
// season (changes when the entry is rolled over). Reports read the origin season, collecting screens the other one.

export type DueState = 'NOT_DUE' | 'DUE_SOON' | 'OVERDUE'
export type DueRule = 'SEASON' | 'CAPPED' | 'TERM_DAYS' | 'MANUAL' | 'NONE'
export interface SeasonRef { id: string; code: string; name: string }

/** Season, due date and state of a group of entries collected together (customer debt page, farmer debt). */
export interface DebtCollectionGroup {
  collectionSeason: SeasonRef | null
  dueDate: string
  outstandingAmount: number
  entryCount: number
  dueState: DueState
}

/** Season fields every staff-facing entry now carries. */
export interface DebtEntrySeasonFields {
  originSeason: SeasonRef | null
  collectionSeason: SeasonRef | null
  /** The due date when the entry was created; total extension time counts from it. */
  originalDueDate: string
  rolloverCount: number
  isRolledOver: boolean
  /** null once the entry is fully paid. */
  dueState: DueState | null
  /** Owner decides: still owed, not disputed, and past the N5 milestone or rolled over often enough. */
  needsDecision: boolean
}

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
  /** Open debt grouped by (collection season, due date). A null season means the due date follows the credit tier. */
  groups?: DebtCollectionGroup[]
}

export type DebtEntryStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'DISPUTED' | 'ADJUSTED' | 'CANCELLED' | string

export interface DebtEntryListItem extends DebtEntrySeasonFields {
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

export type DebtReasonCode = 'MAT_MUA' | 'THIEN_TAI' | 'KHO_KHAN' | 'TRI_AN' | 'SAI_SOT' | 'KHONG_THU_HOI' | 'KHAC'

/** Rollover accepts only the four hardship codes; the other three are for reduce, write-off and due-date changes. */
export type RolloverReasonCode = 'MAT_MUA' | 'THIEN_TAI' | 'KHO_KHAN' | 'KHAC'

export interface RolloverRequest {
  reasonCode: RolloverReasonCode
  /** Required. */
  note: string
  /** Omit to let the server pick the next open season whose due date is later than the entry's. */
  targetCropSeasonId?: string
  /** Owner only: go past the policy's total extension limit. */
  overrideExtensionLimit?: boolean
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
  /** null on actions taken before the policy existed (isPrePolicy). */
  reasonCode?: DebtReasonCode | null
  isPrePolicy?: boolean
  oldCropSeasonId?: string | null
  newCropSeasonId?: string | null
  actorName?: string | null
  actorRole?: string | null
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

export interface DebtEntry extends DebtEntrySeasonFields {
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
  /** Season dashboard additions; absent on a server that predates them. */
  currentSeason?: SeasonRef | null
  currentSeasonOutstanding?: number
  dueSoonAmount?: number
  needsDecisionCount?: number
  needsDecision?: DebtEntryListItem[]
  creditLimitAlertCount?: number
  creditLimitAlerts?: CreditLimitAlert[]
}

export interface CreditLimitAlert {
  farmerProfileId: string
  fullName: string
  phoneNumber: string | null
  creditLimit: number
  usedCredit: number
  availableCredit: number
  state: 'NEAR_LIMIT' | 'AT_LIMIT'
}

export type DebtEntrySortBy = 'CreatedAt' | 'DueDate' | 'OutstandingAmount' | 'DaysOverdue'

export interface DebtEntryQuery {
  farmerProfileId?: string
  orderId?: string
  status?: string
  search?: string
  overdueOnly?: boolean
  originSeasonId?: string
  collectionSeasonId?: string
  dueState?: DueState
  rolledOverOnly?: boolean
  needsDecision?: boolean
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
        OriginSeasonId: q.originSeasonId,
        CollectionSeasonId: q.collectionSeasonId,
        DueState: q.dueState,
        RolledOverOnly: q.rolledOverOnly,
        NeedsDecision: q.needsDecision,
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
  /** Staff once (DEBT.ROLLOVER), the owner without limit. 403 = staff out of rollovers, 422 = rule broken (e.g. total extension). */
  rollover: (id: string, data: RolloverRequest) => post<DebtEntry>(`${entry(id)}/rollover`, data),

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
