import { api } from './client'

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
  getDeliveryReports: (params: { fromDate: string; toDate: string; groupBy?: 'STAFF' | 'DAY' }) => {
    const searchParams = new URLSearchParams()
    searchParams.append('fromDate', params.fromDate)
    searchParams.append('toDate', params.toDate)
    if (params.groupBy) searchParams.append('groupBy', params.groupBy)

    return api<DeliveryReportResponse>(`/api/reports/deliveries?${searchParams.toString()}`)
  },

  getDebtAging: () => {
    return api<DebtAgingReport>('/api/reports/debt-aging')
  },
  
  getDebtCollections: (params: { fromDate: string; toDate: string }) => {
    return api<DebtCollectionReport>(`/api/reports/debt-collections?fromDate=${params.fromDate}&toDate=${params.toDate}`)
  },
  
  getDebtByGroup: () => {
    return api<DebtByGroupReport[]>('/api/reports/debt-by-customer-group')
  }
}

export interface DebtAgingReport {
  totalDebt: number;
  notYetDue: number;
  overdue1_30: number;
  overdue31_60: number;
  overdue61_90: number;
  overdue91Plus: number;
}

export interface DebtCollectionReport {
  totalCollected: number;
  byMethod: { method: string; amount: number }[];
}

export interface DebtByGroupReport {
  groupName: string;
  totalDebt: number;
  totalOverdue: number;
  customerCount: number;
}

