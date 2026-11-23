import { api, toQuery } from './client'

export interface ReportPeriod { fromDate: string; toDate: string; groupBy?: string }
export interface CounterSalesTodaySummary {
  date: string
  asOf: string
  paidSalesRevenue: number
  completedOrderCount: number
  receivedAmount: number
  creditSalesAmount: number
}
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
/** GET /api/reports/advisory-diagnosis (REPORTS.READ): advice given and photo diagnoses of a period. */
export interface AdvisoryDiagnosisReport {
  fromDate: string
  toDate: string
  /** A session "converted" when the same Farmer ordered a suggested product within this many days (an attribution). */
  attributionDays: number
  advisory: {
    sessionCount: number
    farmerCount: number
    textSessionCount: number
    diagnosisSessionCount: number
    sessionsWithProducts: number
    estimatedValue: number
    convertedSessions: number
    conversionPercent: number | null
    convertedOrderValue: number
  }
  topProblems: { diseaseId: string; code: string; name: string; cropType: string; sessionCount: number }[]
  diagnosis: {
    caseCount: number
    byCrop: { cropType: string; cropName: string; caseCount: number; confidentCount: number; uncertainCount: number; verifiedCount: number; noResultCount: number }[]
  }
}
/** GET /api/reports/my-sales (COUNTER_SALES.SELL): the signed-in seller's own figures; never cost of goods or profit. */
export interface MySalesReport {
  fromDate: string
  toDate: string
  orders: { createdCount: number; completedCount: number; cancelledCount: number; openCount: number }
  sales: { orderCount: number; fulfilledValue: number; returnValue: number; netSales: number; averageOrderValue: number }
  payments: { paymentCount: number; receivedAmount: number; orderPaymentAmount: number; debtRepaymentAmount: number }
}

// Report requests share the authenticated client and support cancellation when filters or pages change.
export const businessReportsApi = {
  counterSalesToday: (signal?: AbortSignal) => api<CounterSalesTodaySummary>('/api/reports/counter-sales-today', { signal }),
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
  advisoryDiagnosis: (params: ReportPeriod, signal?: AbortSignal) =>
    api<AdvisoryDiagnosisReport>(`/api/reports/advisory-diagnosis${toQuery({ fromDate: params.fromDate, toDate: params.toDate })}`, { signal }),
  mySales: (params: ReportPeriod, signal?: AbortSignal) =>
    api<MySalesReport>(`/api/reports/my-sales${toQuery({ fromDate: params.fromDate, toDate: params.toDate })}`, { signal }),
}
