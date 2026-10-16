import { lazy, Suspense, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ordersApi } from '@/api/ordersApi'
import type { OrderStatus } from '@/api/types'
import { usePermission } from '@/context/PermissionContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import AttentionTiles from './AttentionTiles'
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import ListReportCards from '@/features/agent/reports/ListReportCards'
import { useReportData } from '@/features/agent/reports/useReportData'
import { firstOfMonthVn, periodProblem, reportInputClass } from '@/features/agent/reports/reportFilters'
import { todayVn } from '@/utils/creditLabels'
import { formatDateTime } from '@/utils/units'
import { formatVnd } from '@/utils/money'

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', PREPARING: 'Đang chuẩn bị',
  READY_FOR_FULFILLMENT: 'Sẵn sàng giao', PARTIALLY_FULFILLED: 'Giao một phần', COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy', PARTIALLY_CANCELLED: 'Hủy một phần',
}

// recharts is heavy and only the owner's dashboard draws it, so it loads on demand.
const RevenueByDayChart = lazy(() => import('./RevenueByDayChart'))

/** Period totals use report APIs; operational counts always state their visible-list scope. `area` adds the "needs doing now" tiles. */
export default function OrderDashboard({ reports = false, ordersPath, area }: { reports?: boolean; ordersPath?: string; area?: 'agent' | 'sales' }) {
  const { has } = usePermission()
  const canReadOrders = has('ORDERS.READ')
  const [fromDate, setFromDate] = useState(reports ? firstOfMonthVn : todayVn)
  const [toDate, setToDate] = useState(todayVn)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const keyword = useDebouncedValue(search.trim())
  const problem = periodProblem(fromDate, toDate)
  const load = useCallback((signal: AbortSignal) => ordersApi.getOrders({ page: 1, pageSize: 5, fromDate, toDate, search: keyword || undefined, status: status || undefined }, signal), [fromDate, toDate, keyword, status])
  const { data, loading, error, refresh } = useReportData(load, canReadOrders ? problem : 'Chưa được cấp quyền xem đơn hàng.')
  const items = data?.items ?? []
  const reset = () => { setSearch(''); setStatus(''); setFromDate(reports ? firstOfMonthVn() : todayVn()); setToDate(todayVn()) }

  return <div className="agrisage-dashboard max-w-[1440px] min-w-0 mx-auto flex flex-col gap-5">
    {area && <AttentionTiles area={area} />}
    {reports ? <BusinessReportCards kind="sales" fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} /> :
      <ListReportCards title="Tổng hợp đơn hàng theo bộ lọc" totalCount={canReadOrders ? data?.totalCount ?? null : null} unit="đơn hàng" loading={loading} error={!!error || !!problem} metrics={[
        { label: 'Cần xử lý', value: items.filter(order => ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY_FOR_FULFILLMENT', 'PARTIALLY_FULFILLED'].includes(order.status)).length, note: 'Trong 5 đơn gần nhất đang hiển thị' },
        { label: 'Đã hoàn thành', value: items.filter(order => order.status === 'COMPLETED').length, note: 'Trong 5 đơn gần nhất đang hiển thị' },
        { label: 'Giá trị đơn đang hiển thị', value: items.filter(order => order.status !== 'CANCELLED').reduce((sum, order) => sum + order.totalAmount, 0), kind: 'money', note: 'Trong 5 đơn gần nhất, chưa phải doanh thu' },
      ]} />}
    {reports && has('REPORTS.READ') && <Suspense fallback={<div aria-hidden="true" className="h-80 animate-pulse rounded-xl bg-slate-50" />}><RevenueByDayChart fromDate={fromDate} toDate={toDate} /></Suspense>}
    {canReadOrders ? <>
      <ListToolbar search={{ value: search, onChange: setSearch, placeholder: 'Tìm mã đơn, tên hoặc số điện thoại khách hàng...' }} onClear={reset} actions={<button type="button" disabled={loading || !!problem} onClick={refresh} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Làm mới</button>}>
        <FilterSelect label="Trạng thái đơn hàng" labelPlacement="inside" value={status} onChange={value => setStatus(value as OrderStatus | '')} options={[{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
        {!reports && <>
          <input aria-label="Từ ngày" type="date" className={reportInputClass} value={fromDate} max={toDate} onChange={event => setFromDate(event.target.value)} />
          <input aria-label="Đến ngày" type="date" className={reportInputClass} value={toDate} min={fromDate} onChange={event => setToDate(event.target.value)} />
        </>}
      </ListToolbar>
      {(problem || error) && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{problem ?? error}</p>}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Đơn hàng gần nhất" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-900">5 đơn gần nhất theo bộ lọc</h2>
          {ordersPath && <Link className="text-sm font-medium text-primary" to={ordersPath}>Xem toàn bộ đơn hàng</Link>}
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Mã đơn</th><th className="px-4 py-3">Khách hàng</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Ngày tạo</th><th className="px-4 py-3 text-right">Giá trị đơn</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(order => <tr key={order.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-semibold text-primary">{ordersPath ? <Link to={`${ordersPath}?open=${encodeURIComponent(order.id)}`}>{order.orderNumber}</Link> : order.orderNumber}</td><td className="px-4 py-3">{order.customerName}<div className="mt-1 text-xs text-slate-500">{order.customerPhone}</div></td><td className="px-4 py-3"><StatusBadge label={STATUS_LABELS[order.status]} /></td><td className="px-4 py-3 whitespace-nowrap">{formatDateTime(order.createdAt)}</td><td className="px-4 py-3 text-right whitespace-nowrap font-semibold">{formatVnd(order.totalAmount)}</td></tr>)}
            {!items.length && <EmptyTableRow colSpan={5} message={loading ? 'Đang tải đơn hàng...' : error ? 'Không tải được đơn hàng.' : 'Không có đơn hàng phù hợp.'} />}
          </tbody>
        </table></div>
        <p className="border-t border-slate-100 p-4 text-xs text-slate-500">{data ? `Hiển thị ${items.length} / ${data.totalCount} đơn theo bộ lọc.` : 'Danh sách theo quyền truy cập hiện tại.'}</p>
      </section>
    </> : <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Chưa được cấp quyền xem đơn hàng.</p>}
  </div>
}
