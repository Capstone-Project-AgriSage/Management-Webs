import { lazy, Suspense, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, ClipboardList, Search, XCircle } from 'lucide-react'
import { ordersApi } from '@/api/ordersApi'
import type { OrderStatus } from '@/api/types'
import { usePermission } from '@/context/PermissionContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import AttentionTiles from './AttentionTiles'
import PeriodFilter from './PeriodFilter'
import StatStrip from './StatStrip'
import { STATUS_LABELS } from './orderStatus'
import type { DashboardLinks } from './DashboardCharts'
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import { useReportData } from '@/features/agent/reports/useReportData'
import { firstOfMonthVn, periodProblem, reportInputClass } from '@/features/agent/reports/reportFilters'
import { todayVn } from '@/utils/creditLabels'
import { formatDateTime } from '@/utils/units'
import { formatVnd } from '@/utils/money'

// recharts is heavy and only the owner's and the admin's dashboards draw it, so it loads on demand.
const DashboardCharts = lazy(() => import('./DashboardCharts'))

const AGENT_LINKS: DashboardLinks = { orders: '/agent/orders', payments: '/agent/payments', products: '/agent/products', debts: '/agent/debts' }

// The statuses people look for from the dashboard; the order page keeps the full filter.
const TABS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING_CONFIRMATION', label: STATUS_LABELS.PENDING_CONFIRMATION },
  { value: 'PREPARING', label: STATUS_LABELS.PREPARING },
  { value: 'COMPLETED', label: STATUS_LABELS.COMPLETED },
  { value: 'CANCELLED', label: STATUS_LABELS.CANCELLED },
]

// Every report on the page already reloads on this event (it also follows any change saved elsewhere in the app).
const refreshAll = () => window.dispatchEvent(new Event('agrisage-business-data-changed'))

/** Period totals use report APIs; operational counts always state their visible-list scope. `area` adds the "needs doing now" tiles. */
export default function OrderDashboard({ reports = false, ordersPath, area }: { reports?: boolean; ordersPath?: string; area?: 'agent' | 'sales' }) {
  const { has } = usePermission()
  const canReadOrders = has('ORDERS.READ')
  const showCharts = reports && has('REPORTS.READ')
  const [fromDate, setFromDate] = useState(reports ? firstOfMonthVn : todayVn)
  const [toDate, setToDate] = useState(todayVn)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const keyword = useDebouncedValue(search.trim())
  const problem = periodProblem(fromDate, toDate)
  const load = useCallback((signal: AbortSignal) => ordersApi.getOrders({ page: 1, pageSize: 5, fromDate, toDate, search: keyword || undefined, status: status || undefined }, signal), [fromDate, toDate, keyword, status])
  const { data, loading, error } = useReportData(load, canReadOrders ? problem : 'Chưa được cấp quyền xem đơn hàng.')
  const items = data?.items ?? []
  // The staff view has no revenue report, so its figures are counts of the period's orders from the same list API.
  const counts = useReportData(useCallback((signal: AbortSignal) => Promise.all(([undefined, 'COMPLETED', 'CANCELLED'] as const).map(async orderStatus => (await ordersApi.getOrders({ page: 1, pageSize: 1, fromDate, toDate, status: orderStatus }, signal)).totalCount)), [fromDate, toDate]), reports ? 'Không dùng ở dashboard báo cáo.' : canReadOrders ? problem : 'Chưa được cấp quyền xem đơn hàng.')
  const setPeriod = (from: string, to: string) => { setFromDate(from); setToDate(to) }

  return <div className="agrisage-dashboard max-w-[1440px] min-w-0 mx-auto flex flex-col gap-7">
    {area && <AttentionTiles area={area} />}
    {showCharts ? <section aria-label="Kết quả kinh doanh" className="flex flex-col gap-4">
      <PeriodFilter title="Kết quả kinh doanh" fromDate={fromDate} toDate={toDate} onChange={setPeriod} onRefresh={refreshAll} />
      {problem && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{problem}</p>}
      <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-2xl bg-slate-50" />}>
        <DashboardCharts fromDate={fromDate} toDate={toDate} links={area === 'agent' ? AGENT_LINKS : undefined} />
      </Suspense>
    </section> : reports ? <BusinessReportCards kind="sales" fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} /> :
      <StatStrip label="Đơn hàng trong kỳ" loading={counts.loading} stats={[
        { key: 'total', label: 'Đơn trong kỳ', icon: ClipboardList, value: counts.data ? counts.data[0].toLocaleString('vi-VN') : null, note: 'Tất cả đơn tạo trong khoảng ngày đã chọn' },
        { key: 'done', label: 'Đã hoàn thành', icon: CheckCircle2, value: counts.data ? counts.data[1].toLocaleString('vi-VN') : null, note: 'Đơn tạo trong kỳ đã hoàn thành' },
        { key: 'cancelled', label: 'Đã hủy', icon: XCircle, value: counts.data ? counts.data[2].toLocaleString('vi-VN') : null, note: 'Đơn tạo trong kỳ đã bị hủy', attention: !!counts.data?.[2] },
      ]} />}
    {canReadOrders ? <section aria-label="Đơn hàng gần đây" aria-busy={loading} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 p-5 pb-4">
        <div>
          <h2 className="text-sm font-medium text-slate-500">Đơn hàng gần đây</h2>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold leading-8 text-slate-900">
            {data ? `${data.totalCount.toLocaleString('vi-VN')} đơn` : '—'}
            <span className="text-sm font-normal text-slate-500">{showCharts ? 'tạo trong kỳ, theo bộ lọc' : 'theo bộ lọc'} · hiện 5 đơn mới nhất</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!showCharts && <>
            <input aria-label="Từ ngày" type="date" className={reportInputClass} value={fromDate} max={toDate} onChange={event => setFromDate(event.target.value)} />
            <span aria-hidden="true" className="text-slate-400">→</span>
            <input aria-label="Đến ngày" type="date" className={reportInputClass} value={toDate} min={fromDate} onChange={event => setToDate(event.target.value)} />
          </>}
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Tìm đơn hàng</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã đơn, tên hoặc SĐT khách" className="h-10 w-full rounded-lg border border-slate-200 bg-[#fff] pl-9 pr-3 text-sm" />
          </label>
          {ordersPath && <Link to={ordersPath} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-[#fff] px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900">Xem tất cả<ArrowUpRight size={15} aria-hidden="true" /></Link>}
        </div>
      </div>
      <div className="px-5">
        <div role="group" aria-label="Lọc theo trạng thái" className="inline-flex flex-wrap gap-0.5 rounded-xl bg-slate-100 p-1">
          {TABS.map(tab => <button key={tab.value || 'all'} type="button" aria-pressed={status === tab.value} onClick={() => setStatus(tab.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${status === tab.value ? 'bg-[#fff] text-green-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{tab.label}</button>)}
        </div>
      </div>
      {(error || (!showCharts && problem)) && <p role="alert" className="mx-5 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error ?? problem}</p>}
      <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm sm:min-w-[650px]">
        <thead className="text-slate-500"><tr><th className="px-4 py-3">Mã đơn</th><th className="px-4 py-3">Khách hàng</th><th className="hidden px-4 py-3 sm:table-cell">Trạng thái</th><th className="hidden px-4 py-3 sm:table-cell">Ngày tạo</th><th className="hidden px-4 py-3 text-right sm:table-cell">Giá trị đơn</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(order => <tr key={order.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 font-semibold text-primary">{ordersPath ? <Link to={`${ordersPath}?open=${encodeURIComponent(order.id)}`}>{order.orderNumber}</Link> : order.orderNumber}<div className="mt-1 text-xs font-normal text-slate-500 sm:hidden">{formatDateTime(order.createdAt)}</div><div className="mt-1.5 sm:hidden"><StatusBadge label={STATUS_LABELS[order.status]} /></div></td><td className="px-4 py-3">{order.customerName}<div className="mt-1 text-xs text-slate-500">{order.customerPhone}</div><div className="mt-1.5 text-sm font-semibold text-slate-900 sm:hidden">{formatVnd(order.totalAmount)}</div></td><td className="hidden px-4 py-3 sm:table-cell"><StatusBadge label={STATUS_LABELS[order.status]} /></td><td className="hidden px-4 py-3 whitespace-nowrap sm:table-cell">{formatDateTime(order.createdAt)}</td><td className="hidden px-4 py-3 text-right whitespace-nowrap font-semibold sm:table-cell">{formatVnd(order.totalAmount)}</td></tr>)}
          {!items.length && <EmptyTableRow colSpan={5} message={loading ? 'Đang tải đơn hàng...' : error ? 'Không tải được đơn hàng.' : 'Không có đơn hàng phù hợp.'} />}
        </tbody>
      </table></div>
    </section> : <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Chưa được cấp quyền xem đơn hàng.</p>}
  </div>
}
