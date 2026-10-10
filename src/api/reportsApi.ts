import { api, toQuery } from './client'

export interface DeliveryReportRow {
  key: string
  label: string
  deliveries: number
  attempts: number
  successful: number
  partial: number
  failed: number
  successRate: number
}

export interface FailureReasonStat {
  code: string
  count: number
}

export interface IncidentStat {
  incidentType: string
  open: number
  resolved: number
}

export interface DeliveryReportResponse {
  fromDate: string
  toDate: string
  groupBy: 'STAFF' | 'DAY'
  rows: DeliveryReportRow[]
  failureReasons: FailureReasonStat[]
  incidents: IncidentStat[]
  totals: {
    deliveries: number
    attempts: number
    successful: number
    partial: number
    failed: number
    successRate: number
  }
}

export const reportsApi = {
  getDeliveryReports: (params: { fromDate: string; toDate: string; groupBy?: 'STAFF' | 'DAY' }, signal?: AbortSignal) => {
    const searchParams = new URLSearchParams()
    searchParams.append('fromDate', params.fromDate)
    searchParams.append('toDate', params.toDate)
    if (params.groupBy) searchParams.append('groupBy', params.groupBy)

    return api<DeliveryReportResponse>(`/api/reports/deliveries?${searchParams.toString()}`, { signal })
  },

  /** FLOW_3 §8 (Manage): asOf = Vietnam day, default today. */
  getDebtAging: (params: { asOf?: string; customerGroupId?: string } = {}, signal?: AbortSignal) =>
    api<DebtAgingReport>(`/api/reports/debt-aging${toQuery({ asOf: params.asOf, customerGroupId: params.customerGroupId })}`, { signal }),

  /** ≤ 366 days; groupBy DAY (default) | METHOD | STAFF. */
  getDebtCollections: (params: { fromDate: string; toDate: string; groupBy?: 'DAY' | 'METHOD' | 'STAFF' }, signal?: AbortSignal) =>
    api<DebtCollectionReport>(`/api/reports/debt-collections${toQuery({ fromDate: params.fromDate, toDate: params.toDate, groupBy: params.groupBy })}`, { signal }),

  getDebtByGroup: (signal?: AbortSignal) => api<DebtByGroupReport>('/api/reports/debt-by-customer-group', { signal }),
}

export interface AgingBuckets {
  notDue: number
  days1To30: number
  days31To60: number
  days61To90: number
  over90: number
  total: number
}

export interface DebtAgingReport {
  asOf: string
  rows: (AgingBuckets & { farmerProfileId: string; fullName: string | null; phoneNumber: string | null; customerGroup: { id: string; code: string | null; name: string | null } | null })[]
  totals: AgingBuckets
}

export interface DebtCollectionRow {
  key: string | null
  label: string | null
  paymentCount: number
  collectedAmount: number
}

export interface DebtCollectionReport {
  fromDate: string
  toDate: string
  groupBy: string
  rows: DebtCollectionRow[]
  totals: DebtCollectionRow
}

export interface DebtByGroupReport {
  rows: {
    customerGroup: { id: string; code: string | null; name: string | null } | null
    customersWithDebt: number
    outstanding: number
    overdueAmount: number
    totalCreditLimit: number
    /** outstanding ÷ total limit; null when the limit total is 0. */
    utilization: number | null
  }[]
}
