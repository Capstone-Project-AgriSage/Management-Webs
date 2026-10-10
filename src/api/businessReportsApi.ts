import { api, toQuery } from './client'

export interface ReportPeriod { fromDate: string; toDate: string; groupBy?: string }
export interface PeriodReport<M, T = M> {
  fromDate: string
  toDate: string
  groupBy: string
  rows: (M & { key: string; label: string })[]
  totals: T
}
export interface SalesMetrics {
  orderCount: number
  fulfilledValue: number
  costOfGoods: number
  grossProfit: number
  returnValue: number
  netSales: number
}
export interface RevenueMetrics extends SalesMetrics { averageOrderValue: number; grossMarginPercent: number | null }
export interface RevenueReport extends PeriodReport<RevenueMetrics> { page: number; pageSize: number; totalCount: number; totalPages: number }
export interface RevenueSummary {
  fromDate: string
  toDate: string
  current: RevenueMetrics
  previousFromDate: string
  previousToDate: string
  previous: RevenueMetrics
  netSalesChangePercent: number | null
}
export interface RevenueFilters {
  fromDate: string
  toDate: string
  storeProductId?: string
  categoryId?: string
  staffUserId?: string
  farmerProfileId?: string
  customerGroupId?: string
  source?: string
  settlementType?: string
}
export interface OrderMetrics { orderCount: number; orderValue: number }
export interface PaymentMetrics { paymentCount: number; receivedAmount: number }
export interface PaymentTotals extends PaymentMetrics { orderPaymentAmount: number; debtRepaymentAmount: number; refundedAmount: number; netReceivedAmount: number }
export interface PurchaseMetrics { receiptCount: number; purchaseAmount: number }
export interface ReturnMetrics { returnCount: number; returnAmount: number; debtAdjustmentAmount: number; refundAmount: number }
export interface RefundMetrics { refundCount: number; refundedAmount: number }
export interface CreditExposureMetrics { creditLimit: number; outstanding: number; reservedCredit: number; exposure: number; availableCredit: number }
export interface CreditExposureReport {
  asOf: string
  rows: (CreditExposureMetrics & { farmerProfileId: string; fullName: string; status: string; utilizationPercent: number | null })[]
  totals: CreditExposureMetrics
}

// Report requests share the authenticated client and support cancellation when filters or pages change.
export const businessReportsApi = {
  sales: (params: ReportPeriod, signal?: AbortSignal) => api<PeriodReport<SalesMetrics>>(`/api/reports/sales${toQuery({ ...params })}`, { signal }),
  revenue: (params: RevenueFilters & { groupBy: string; page: number; pageSize: number }, signal?: AbortSignal) =>
    api<RevenueReport>(`/api/reports/revenue${toQuery({ ...params })}`, { signal }),
  revenueSummary: (params: RevenueFilters, signal?: AbortSignal) => api<RevenueSummary>(`/api/reports/revenue-summary${toQuery({ ...params })}`, { signal }),
  orders: (params: ReportPeriod, signal?: AbortSignal) => api<PeriodReport<OrderMetrics>>(`/api/reports/orders${toQuery({ ...params })}`, { signal }),
  payments: (params: ReportPeriod, signal?: AbortSignal) => api<PeriodReport<PaymentMetrics, PaymentTotals>>(`/api/reports/payments${toQuery({ ...params })}`, { signal }),
  purchases: (params: ReportPeriod, signal?: AbortSignal) => api<PeriodReport<PurchaseMetrics>>(`/api/reports/purchases${toQuery({ ...params })}`, { signal }),
  returns: (params: ReportPeriod, signal?: AbortSignal) => api<PeriodReport<ReturnMetrics>>(`/api/reports/returns${toQuery({ ...params })}`, { signal }),
  refunds: (params: ReportPeriod, signal?: AbortSignal) => api<PeriodReport<RefundMetrics>>(`/api/reports/refunds${toQuery({ ...params })}`, { signal }),
  creditExposure: (signal?: AbortSignal) => api<CreditExposureReport>('/api/reports/credit-exposure', { signal }),
}
