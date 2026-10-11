import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '@/context/PageHeaderContext'
import { usePermission } from '@/context/PermissionContext'
import { deliveriesApi, type DeliveryStatus } from '@/api/deliveriesApi'
import KpiCard from '@/components/ui/KpiCard'
import { useReportData } from '@/features/agent/reports/useReportData'

const STATUS_GROUPS: DeliveryStatus[][] = [
  ['OUT_FOR_DELIVERY'], ['ASSIGNED'], ['RETRY_PENDING', 'PARTIALLY_DELIVERED'], ['DELIVERED'],
]
const CARDS = [
  { label: 'Cần giao' },
  { label: 'Chờ xuất phát' },
  { label: 'Chờ giao lại' },
  { label: 'Đã giao' },
]

export default function DashboardPage() {
  usePageHeader({ title: 'Tổng quan giao hàng', subtitle: 'Tất cả chuyến giao được phân công cho bạn' })
  const { has } = usePermission()
  const canRead = has('DELIVERIES.READ')
  const load = useCallback((signal: AbortSignal) => Promise.all(STATUS_GROUPS.map(async statuses => {
    const pages = await Promise.all(statuses.map(status => deliveriesApi.getDeliveries({ status, page: 1, pageSize: 1 }, signal)))
    return pages.reduce((sum, page) => sum + page.totalCount, 0)
  })), [])
  const { data, loading, error, refresh } = useReportData(load, canRead ? null : 'Chưa được cấp quyền xem giao hàng.')
  return <div className="agrisage-dashboard max-w-[1440px] mx-auto flex flex-col gap-5">
    <div className="agrisage-summary-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" aria-busy={loading}>
      {CARDS.map((card, index) => <KpiCard key={card.label} title={card.label} value={loading ? '…' : data?.[index] ?? '—'} subtitle="Tất cả chuyến được phân công" />)}
    </div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    {!canRead && <p role="status" className="text-sm text-slate-600">Chưa được cấp quyền xem giao hàng.</p>}
    {canRead && <div className="flex gap-3"><Link className="rounded-lg bg-primary-dark px-4 py-2 text-sm font-semibold text-white" to="/delivery/deliveries">Xem danh sách giao hàng</Link><button type="button" onClick={refresh} disabled={loading} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 disabled:opacity-50">Làm mới</button></div>}
  </div>
}
