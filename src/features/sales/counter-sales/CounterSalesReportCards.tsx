import { useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { businessReportsApi, type CounterSalesTodaySummary } from '@/api/businessReportsApi'
import KpiCard from '@/components/ui/KpiCard'
import { usePermission } from '@/context/PermissionContext'
import { useReportData } from '@/features/agent/reports/useReportData'
import { formatDay, todayVn } from '@/utils/creditLabels'
import { formatVnd } from '@/utils/money'

const metrics = [
  { key: 'paidSalesRevenue', title: 'Doanh thu hôm nay', note: 'Tổng doanh thu từ các đơn bán tại quầy đã thanh toán.', money: true },
  { key: 'completedOrderCount', title: 'Đơn hàng hoàn thành', note: 'Tổng số đơn tại quầy đã bán thành công trong ngày.', money: false },
  { key: 'receivedAmount', title: 'Tiền đã thu', note: 'Tiền mặt, chuyển khoản và thu nợ từ các đơn tại quầy.', money: true },
  { key: 'creditSalesAmount', title: 'Công nợ phát sinh', note: 'Tổng số tiền bán chịu phát sinh từ các đơn tại quầy.', money: true },
] satisfies { key: keyof Pick<CounterSalesTodaySummary, 'paidSalesRevenue' | 'completedOrderCount' | 'receivedAmount' | 'creditSalesAmount'>; title: string; note: string; money: boolean }[]

export default function CounterSalesReportCards() {
  const { has } = usePermission()
  if (!has('REPORTS.READ')) {
    return <section aria-label="Báo cáo bán tại quầy hôm nay" className="agrisage-summary-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(metric => <KpiCard key={metric.key} title={metric.title} value="—" subtitle="Cần quyền xem báo cáo" />)}
    </section>
  }
  return <AuthorizedCounterSalesReportCards />
}

function AuthorizedCounterSalesReportCards() {
  const load = useCallback((signal: AbortSignal) => businessReportsApi.counterSalesToday(signal), [])
  const { data, loading, error, refresh } = useReportData(load)

  return <section aria-label="Báo cáo bán tại quầy hôm nay" aria-busy={loading} className="space-y-3 shrink-0">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-on-surface">Hôm nay <span className="font-normal text-on-surface-variant">· {formatDay(data?.date ?? todayVn())}</span></h2>
      <button type="button" onClick={refresh} disabled={loading} aria-label="Làm mới báo cáo bán tại quầy" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3 text-xs font-medium text-on-surface-variant hover:bg-surface-container disabled:opacity-50">
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
      </button>
    </div>
    <div className="agrisage-summary-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(metric => <KpiCard
        key={metric.key}
        title={metric.title}
        value={data ? metric.money ? formatVnd(data[metric.key]) : data[metric.key].toLocaleString('vi-VN') : loading ? <span aria-hidden="true" className="inline-block h-7 w-28 animate-pulse rounded bg-slate-100 align-middle" /> : '—'}
        valueClassName={metric.key === 'paidSalesRevenue' ? 'text-emerald-700' : 'text-on-surface'}
        valueSuffix={!metric.money && data ? <span className="text-xs text-on-surface-variant">đơn</span> : undefined}
        subtitle={metric.note}
      />)}
    </div>
    {loading && <p role="status" className="text-xs text-on-surface-variant">Đang tải báo cáo hôm nay…</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
  </section>
}
