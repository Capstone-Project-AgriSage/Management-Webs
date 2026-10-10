import { businessReportsApi } from '@/api/businessReportsApi'
import { reportsApi } from '@/api/reportsApi'
import { inventoryReportsApi } from '@/api/inventoryReportsApi'

export interface ReportMetric { label: string; value: number | null; kind: 'money' | 'count' | 'percent'; note?: string }
export interface InlineReportResult { metrics: ReportMetric[] }
type Period = { fromDate: string; toDate: string }
const money = (label: string, value: number): ReportMetric => ({ label, value, kind: 'money' })
const count = (label: string, value: number): ReportMetric => ({ label, value, kind: 'count' })
const percent = (label: string, value: number | null, note?: string): ReportMetric => ({ label, value, kind: 'percent', note })

export const inlineReports = {
  orders: {
    labels: ['Đơn trong kỳ', 'Giá trị đơn trong kỳ'],
    title: 'Tổng hợp đơn hàng', period: true,
    note: 'Đơn được tạo trong kỳ; giá trị đơn hàng chưa phải doanh thu đã ghi nhận.',
    async load(period: Period, signal: AbortSignal): Promise<InlineReportResult> {
      const { totals } = await businessReportsApi.orders(period, signal)
      return { metrics: [count('Đơn trong kỳ', totals.orderCount), money('Giá trị đơn trong kỳ', totals.orderValue)] }
    },
  },
  payments: {
    labels: ['Tiền đã thu', 'Tiền đã hoàn', 'Tiền thu ròng'],
    title: 'Tổng hợp thanh toán', period: true, note: 'Khoản thu đã xác nhận và hoàn tiền đã hoàn tất trong kỳ.',
    async load(period: Period, signal: AbortSignal): Promise<InlineReportResult> {
      const { totals } = await businessReportsApi.payments(period, signal)
      return { metrics: [money('Tiền đã thu', totals.receivedAmount), money('Tiền đã hoàn', totals.refundedAmount), money('Tiền thu ròng', totals.netReceivedAmount)] }
    },
  },
  purchases: {
    labels: ['Phiếu nhập đã xác nhận', 'Giá trị nhập trong kỳ'],
    title: 'Tổng hợp nhập hàng', period: true, note: 'Phiếu nhập đã xác nhận trong kỳ, tính theo ngày xác nhận.',
    async load(period: Period, signal: AbortSignal): Promise<InlineReportResult> {
      const { totals } = await businessReportsApi.purchases(period, signal)
      return { metrics: [count('Phiếu nhập đã xác nhận', totals.receiptCount), money('Giá trị nhập trong kỳ', totals.purchaseAmount)] }
    },
  },
  returns: {
    labels: ['Phiếu trả hoàn tất', 'Giá trị trả trong kỳ', 'Công nợ được giảm', 'Khoản cần hoàn trong kỳ'],
    title: 'Tổng hợp trả hàng', period: true, note: 'Phiếu trả đã hoàn tất trong kỳ. Khoản cần hoàn là nghĩa vụ hoàn tiền của phiếu trả.',
    async load(period: Period, signal: AbortSignal): Promise<InlineReportResult> {
      const { totals } = await businessReportsApi.returns(period, signal)
      return { metrics: [count('Phiếu trả hoàn tất', totals.returnCount), money('Giá trị trả trong kỳ', totals.returnAmount), money('Công nợ được giảm', totals.debtAdjustmentAmount), money('Khoản cần hoàn trong kỳ', totals.refundAmount)] }
    },
  },
  refunds: {
    labels: ['Lần hoàn tiền trong kỳ', 'Tiền đã hoàn trong kỳ'],
    title: 'Tổng hợp hoàn tiền', period: true, note: 'Khoản hoàn tiền đã hoàn tất trong kỳ, từ trả hàng hoặc hủy đơn.',
    async load(period: Period, signal: AbortSignal): Promise<InlineReportResult> {
      const { totals } = await businessReportsApi.refunds(period, signal)
      return { metrics: [count('Lần hoàn tiền trong kỳ', totals.refundCount), money('Tiền đã hoàn trong kỳ', totals.refundedAmount)] }
    },
  },
  sales: {
    labels: ['Doanh thu thuần trong kỳ', 'Lãi gộp trong kỳ', 'Giá trị đơn trung bình', 'So với kỳ trước'],
    title: 'Doanh thu và bán hàng', period: true, note: 'Doanh thu ghi nhận khi giao hàng; lãi gộp trước trả hàng và chưa trừ chi phí vận hành.',
    async load(period: Period, signal: AbortSignal): Promise<InlineReportResult> {
      const [sales, revenue, summary] = await Promise.all([
        businessReportsApi.sales(period, signal),
        businessReportsApi.revenue({ ...period, groupBy: 'DAY', page: 1, pageSize: 20 }, signal),
        businessReportsApi.revenueSummary(period, signal),
      ])
      return { metrics: [money('Doanh thu thuần trong kỳ', revenue.totals.netSales), money('Lãi gộp trong kỳ', sales.totals.grossProfit), money('Giá trị đơn trung bình', revenue.totals.averageOrderValue), percent('So với kỳ trước', summary.netSalesChangePercent, summary.netSalesChangePercent == null ? 'Kỳ trước bằng 0' : undefined)] }
    },
  },
  inventory: {
    labels: ['Tồn đầu kỳ', 'Nhập kho trong kỳ', 'Xuất bán trong kỳ', 'Tồn cuối kỳ'],
    title: 'Tổng hợp xuất nhập tồn', period: true, note: 'Giá trị biến động trong kỳ theo đơn vị cơ sở và giá vốn bình quân.',
    async load(period: Period, signal: AbortSignal): Promise<InlineReportResult> {
      const report = await inventoryReportsApi.getMovement(period, signal)
      return { metrics: [money('Tồn đầu kỳ', report.totals.openingValue), money('Nhập kho trong kỳ', report.totals.stockIn), money('Xuất bán trong kỳ', report.totals.sale), money('Tồn cuối kỳ', report.totals.closingValue)] }
    },
  },
  valuation: {
    labels: ['Giá trị tồn hiện tại', 'Giá trị hàng hết hạn'],
    title: 'Giá trị tồn kho', period: false, note: 'Giá trị tồn kho hiện tại theo giá vốn bình quân.',
    async load(_period: Period, signal: AbortSignal): Promise<InlineReportResult> {
      const report = await inventoryReportsApi.getValuation({}, signal)
      return { metrics: [money('Giá trị tồn hiện tại', report.totals.stockValue), money('Giá trị hàng hết hạn', report.totals.expiredValue)] }
    },
  },
  deliveries: {
    labels: ['Lượt giao trong kỳ', 'Lượt giao thành công', 'Lượt giao thất bại', 'Tỷ lệ giao thành công'],
    title: 'Tổng hợp giao hàng', period: true, note: 'Các lượt giao hàng trong kỳ; tỷ lệ thành công tính trên lượt giao.',
    async load(period: Period, signal: AbortSignal): Promise<InlineReportResult> {
      const { totals } = await reportsApi.getDeliveryReports(period, signal)
      return { metrics: [count('Lượt giao trong kỳ', totals.attempts), count('Lượt giao thành công', totals.successful), count('Lượt giao thất bại', totals.failed), percent('Tỷ lệ giao thành công', totals.successRate * 100)] }
    },
  },
  debt: {
    labels: ['Dư nợ tại ngày kết thúc', 'Nợ quá hạn tại ngày kết thúc', 'Tiền thu nợ trong kỳ', 'Hạn mức các nhóm hiện tại'],
    title: 'Tổng hợp công nợ', period: true, note: 'Tuổi nợ tính tại ngày kết thúc; thu nợ tính trong kỳ; hạn mức theo nhóm là số liệu hiện tại.',
    async load(period: Period, signal: AbortSignal): Promise<InlineReportResult> {
      const [aging, collections, groups] = await Promise.all([
        reportsApi.getDebtAging({ asOf: period.toDate }, signal),
        reportsApi.getDebtCollections(period, signal),
        reportsApi.getDebtByGroup(signal),
      ])
      return { metrics: [money('Dư nợ tại ngày kết thúc', aging.totals.total), money('Nợ quá hạn tại ngày kết thúc', aging.totals.total - aging.totals.notDue), money('Tiền thu nợ trong kỳ', collections.totals.collectedAmount), money('Hạn mức các nhóm hiện tại', groups.rows.reduce((sum, row) => sum + row.totalCreditLimit, 0))] }
    },
  },
  credit: {
    labels: ['Tổng hạn mức tín dụng', 'Tín dụng đang giữ', 'Tổng mức sử dụng', 'Hạn mức khả dụng'],
    title: 'Mức sử dụng tín dụng', period: false, note: 'Số liệu hiện tại. Tổng mức sử dụng gồm dư nợ và tín dụng đang giữ.',
    async load(_period: Period, signal: AbortSignal): Promise<InlineReportResult> {
      const { totals } = await businessReportsApi.creditExposure(signal)
      return { metrics: [money('Tổng hạn mức tín dụng', totals.creditLimit), money('Tín dụng đang giữ', totals.reservedCredit), money('Tổng mức sử dụng', totals.exposure), money('Hạn mức khả dụng', totals.availableCredit)] }
    },
  },
}
export type InlineReportKind = keyof typeof inlineReports
