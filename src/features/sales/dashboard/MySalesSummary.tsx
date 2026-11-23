import { useCallback, type ReactNode } from 'react'
import { CircleDollarSign, ClipboardList, Receipt, Wallet, type LucideIcon } from 'lucide-react'
import { businessReportsApi } from '@/api/businessReportsApi'
import { usePermission } from '@/context/PermissionContext'
import { useReportData } from '@/features/agent/reports/useReportData'
import { formatVnd } from '@/utils/money'

const num = (value: number) => value.toLocaleString('vi-VN')

/**
 * The signed-in seller's own figures for the period (GET /api/reports/my-sales, COUNTER_SALES.SELL): the orders they created,
 * the goods of those orders handed over and the money they took. Never cost of goods or profit (decision 2026-11-23).
 */
export default function MySalesSummary({ fromDate, toDate, problem }: { fromDate: string; toDate: string; problem: string | null }) {
  const { has } = usePermission()
  const allowed = has('COUNTER_SALES.SELL')
  const load = useCallback((signal: AbortSignal) => businessReportsApi.mySales({ fromDate, toDate }, signal), [fromDate, toDate])
  const { data, loading, error } = useReportData(load, allowed ? problem : 'Cần quyền bán tại quầy.')
  if (!allowed) return <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Cần quyền bán tại quầy để xem kết quả của bạn.</p>

  const stats: { label: string; icon: LucideIcon; value: ReactNode; note: ReactNode }[] = [
    {
      label: 'Đơn tôi tạo', icon: ClipboardList, value: data && `${num(data.orders.createdCount)} đơn`,
      note: data ? `${num(data.orders.completedCount)} hoàn thành · ${num(data.orders.openCount)} đang xử lý · ${num(data.orders.cancelledCount)} đã hủy` : 'Đơn bạn tạo trong kỳ',
    },
    {
      label: 'Doanh số của tôi', icon: CircleDollarSign, value: data && formatVnd(data.sales.netSales),
      note: data ? `${num(data.sales.orderCount)} đơn đã giao${data.sales.returnValue > 0 ? ` · trả lại ${formatVnd(data.sales.returnValue)}` : ''}` : 'Hàng đã giao của đơn bạn tạo, trừ hàng trả',
    },
    {
      label: 'Tiền tôi đã thu', icon: Wallet, value: data && formatVnd(data.payments.receivedAmount),
      note: data ? `${num(data.payments.paymentCount)} lần thu${data.payments.debtRepaymentAmount > 0 ? ` · gồm thu nợ ${formatVnd(data.payments.debtRepaymentAmount)}` : ''}` : 'Khoản thu bạn xác nhận',
    },
    {
      label: 'Giá trị đơn trung bình', icon: Receipt, value: data && formatVnd(data.sales.averageOrderValue),
      note: 'Doanh số đã giao chia cho số đơn đã giao',
    },
  ]

  return <div className="flex flex-col gap-2">
    <section aria-label="Kết quả của tôi trong kỳ" aria-busy={loading} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm xl:grid-cols-4">
      {stats.map(stat => {
        const Icon = stat.icon
        return <div key={stat.label} className="flex min-w-0 flex-col gap-2 bg-[#fff] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-slate-600">{stat.label}</h3>
            <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg bg-green-50 text-green-700 sm:grid"><Icon size={16} aria-hidden="true" /></span>
          </div>
          <p className="text-lg font-semibold leading-8 tabular-nums text-slate-900 [overflow-wrap:anywhere] sm:text-2xl">
            {stat.value ?? (loading ? <span aria-hidden="true" className="inline-block h-7 w-24 animate-pulse rounded bg-slate-100 align-middle" /> : '—')}
          </p>
          <p className="text-xs leading-5 text-slate-500">{stat.note}</p>
        </div>
      })}
    </section>
    {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    <p className="text-xs text-slate-500">Chỉ tính đơn bạn tạo và khoản thu bạn xác nhận. Thanh toán payOS do hệ thống tự xác nhận nên không tính cho ai.</p>
  </div>
}
