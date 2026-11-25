import { lazy, Suspense, useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Search } from 'lucide-react'
import { ordersApi } from '@/api/ordersApi'
import type { OrderStatus } from '@/api/types'
import { usePermission } from '@/context/PermissionContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import AttentionTiles from './AttentionTiles'
import SeasonalSuggestionNotice from '@/features/agent/inventory/SeasonalSuggestionNotice'
import PeriodFilter from './PeriodFilter'
import { STATUS_LABELS } from './orderStatus'
import type { DashboardLinks } from './DashboardCharts'
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import CounterSalesReportCards from '@/features/sales/counter-sales/CounterSalesReportCards'
import MySalesSummary from '@/features/sales/dashboard/MySalesSummary'
import { useReportData } from '@/features/agent/reports/useReportData'
import { firstOfMonthVn, periodProblem, reportInputClass } from '@/features/agent/reports/reportFilters'
import { formatDay, todayVn } from '@/utils/creditLabels'
import { formatDateTime } from '@/utils/units'
import { formatVnd } from '@/utils/money'
import DateInput from '@/components/ui/DateInput'

// recharts is heavy and only the owner's and the admin's dashboards draw it, so it loads on demand.
const DashboardCharts = lazy(() => import('./DashboardCharts'))

const AGENT_LINKS: DashboardLinks = {
  orders: '/agent/orders', payments: '/agent/payments', products: '/agent/products', debts: '/agent/debts',
  planning: '/agent/inventory/reports/planning', expiry: '/agent/inventory/reports/planning?tab=expiry', customers: '/agent/farmers',
  inventory: '/agent/inventory/reports', purchases: '/agent/purchases/receipts', advisory: '/agent/advisory-sessions', diagnosis: '/agent/ai-recommendations',
}

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

/**
 * Period totals use report APIs. The owner and the admin read the business reports; sale staff see today's counter and their
 * own results (COUNTER_SALES.SELL, decision 2026-11-23). `area` adds the "needs doing now" tiles.
 */
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
  const setPeriod = (from: string, to: string) => { setFromDate(from); setToDate(to) }
  const navigate = useNavigate()
  const periodNote = `${formatDay(fromDate)} – ${formatDay(toDate)} · so với khoảng liền trước cùng số ngày`

  return <div className="agrisage-dashboard max-w-[1440px] min-w-0 mx-auto flex flex-col gap-6">
    {area && <AttentionTiles area={area} />}
    {area && <SeasonalSuggestionNotice variant="banner" productsPath={area === 'agent' ? '/agent/products' : '/sales/products'} />}
    {showCharts ? <section aria-label="Kết quả kinh doanh" className="flex flex-col gap-4">
      <PeriodFilter title="Kết quả kinh doanh" note={periodNote} fromDate={fromDate} toDate={toDate} onChange={setPeriod} onRefresh={refreshAll} />
      {problem && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{problem}</p>}
      <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-zinc-50" />}>
        <DashboardCharts fromDate={fromDate} toDate={toDate} links={area === 'agent' ? AGENT_LINKS : undefined} manager={area === 'agent'} />
      </Suspense>
    </section> : reports ? <BusinessReportCards kind="sales" fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} /> :
      <>
        <CounterSalesReportCards variant="strip" />
        <section aria-label="Kết quả của tôi" className="flex flex-col gap-4">
          <PeriodFilter title="Kết quả của tôi" fromDate={fromDate} toDate={toDate} onChange={setPeriod} onRefresh={refreshAll} />
          {problem && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{problem}</p>}
          <MySalesSummary fromDate={fromDate} toDate={toDate} problem={problem} />
        </section>
      </>}
    {canReadOrders ? <section aria-label="Đơn hàng gần đây" aria-busy={loading} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 p-5 pb-4">
        <div>
          <h2 className="text-sm text-zinc-500">Đơn hàng gần đây</h2>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-medium leading-8 tracking-tight text-zinc-900">
            {data ? `${data.totalCount.toLocaleString('vi-VN')} đơn` : '—'}
            <span className="text-sm font-normal tracking-normal text-zinc-500">{reports && !showCharts ? 'theo bộ lọc' : 'tạo trong kỳ, theo bộ lọc'} · hiện 5 đơn mới nhất</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reports && !showCharts && <>
            <DateInput aria-label="Từ ngày" className={reportInputClass} value={fromDate} max={toDate} onChange={event => setFromDate(event.target.value)} />
            <span aria-hidden="true" className="text-zinc-400">→</span>
            <DateInput aria-label="Đến ngày" className={reportInputClass} value={toDate} min={fromDate} onChange={event => setToDate(event.target.value)} />
          </>}
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Tìm đơn hàng</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã đơn, tên hoặc SĐT khách" className="h-10 w-full rounded-lg border border-zinc-200 bg-[#fff] pl-9 pr-3 text-sm" />
          </label>
          {ordersPath && <Link to={ordersPath} className="inline-flex h-10 items-center gap-1 rounded-lg border border-zinc-200 bg-[#fff] px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">Xem tất cả<ArrowUpRight size={15} aria-hidden="true" /></Link>}
        </div>
      </div>
      <div className="px-5">
        <div role="group" aria-label="Lọc theo trạng thái" className="inline-flex flex-wrap gap-0.5 rounded-lg bg-zinc-100 p-1">
          {TABS.map(tab => <button key={tab.value || 'all'} type="button" aria-pressed={status === tab.value} onClick={() => setStatus(tab.value)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${status === tab.value ? 'bg-[#fff] font-medium text-green-800 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>{tab.label}</button>)}
        </div>
      </div>
      {(error || (reports && !showCharts && problem)) && <p role="alert" className="mx-5 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error ?? problem}</p>}
      <div className="mt-4 overflow-x-auto border-t border-zinc-200"><table className="agrisage-flat-table w-full text-left text-sm sm:min-w-[650px]">
        <thead className="border-b border-zinc-200 text-zinc-700"><tr><th className="py-3 pl-4 pr-2 font-medium sm:px-5">Mã đơn</th><th className="px-2 py-3 font-medium sm:px-4">Khách hàng</th><th className="hidden px-4 py-3 font-medium sm:table-cell">Trạng thái</th><th className="hidden px-4 py-3 font-medium sm:table-cell">Ngày tạo</th><th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Giá trị đơn</th>{ordersPath && <th className="whitespace-nowrap py-3 pl-2 pr-3 text-right font-medium sm:px-5"><span className="sr-only sm:not-sr-only">Thao tác</span></th>}</tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map(order => <tr key={order.id} className="hover:bg-zinc-50">
            <td className="whitespace-nowrap py-3.5 pl-4 pr-2 font-semibold text-primary sm:px-5">{ordersPath ? <Link className="hover:underline" to={`${ordersPath}?open=${encodeURIComponent(order.id)}`}>{order.orderNumber}</Link> : order.orderNumber}<div className="mt-1 text-xs font-normal text-zinc-500 sm:hidden">{formatDateTime(order.createdAt)}</div><div className="mt-1.5 sm:hidden"><StatusBadge label={STATUS_LABELS[order.status]} /></div></td>
            <td className="px-2 py-3.5 text-zinc-800 sm:px-4">{order.customerName}<div className="mt-1 text-xs text-zinc-500">{order.customerPhone}</div><div className="mt-1.5 text-sm font-medium text-zinc-900 sm:hidden">{formatVnd(order.totalAmount)}</div></td>
            <td className="hidden px-4 py-3.5 sm:table-cell"><StatusBadge size="xs" label={STATUS_LABELS[order.status]} /></td>
            <td className="hidden whitespace-nowrap px-4 py-3.5 text-zinc-600 sm:table-cell">{formatDateTime(order.createdAt)}</td>
            <td className="hidden whitespace-nowrap px-4 py-3.5 text-right font-medium tabular-nums text-zinc-900 sm:table-cell">{formatVnd(order.totalAmount)}</td>
            {ordersPath && <td className="py-3.5 pl-2 pr-3 text-right sm:px-5"><RowActionsMenu triggerLabel={`Thao tác đơn ${order.orderNumber}`} actions={[
              { label: 'Xem chi tiết đơn', icon: 'visibility', permissionCodes: ['ORDERS.READ'], onClick: () => navigate(`${ordersPath}?open=${encodeURIComponent(order.id)}`) },
            ]} /></td>}
          </tr>)}
          {!items.length && <EmptyTableRow colSpan={ordersPath ? 6 : 5} message={loading ? 'Đang tải đơn hàng...' : error ? 'Không tải được đơn hàng.' : 'Không có đơn hàng phù hợp.'} />}
        </tbody>
      </table></div>
      {data && data.totalCount > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-5 py-3 text-sm text-zinc-500">
        <span>Đang xem {items.length.toLocaleString('vi-VN')} trên {data.totalCount.toLocaleString('vi-VN')} đơn</span>
        {ordersPath && data.totalCount > items.length && <Link to={ordersPath} className="font-medium text-green-800 hover:underline">Xem tất cả đơn hàng</Link>}
      </div>}
    </section> : <p role="status" className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">Chưa được cấp quyền xem đơn hàng.</p>}
  </div>
}
