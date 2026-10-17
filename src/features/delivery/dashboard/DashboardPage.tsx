import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, MapPin, PackageCheck, RotateCcw, Truck } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { usePermission } from '@/context/PermissionContext'
import { deliveriesApi, type DeliveryStatus } from '@/api/deliveriesApi'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import StatStrip from '@/features/agent/dashboard/StatStrip'
import { useReportData } from '@/features/agent/reports/useReportData'
import { DELIVERY_STATUS_LABEL, formatDate, labelOf } from '@/utils/deliveryLabels'

// Same grouping as the delivery list page, so a figure here matches its tab there.
const GROUPS: { key: string; label: string; note: string; icon: typeof Truck; statuses: DeliveryStatus[]; attention?: boolean }[] = [
  { key: 'out', label: 'Cần giao', note: 'Chuyến đã xuất phát, đang chờ bạn giao', icon: Truck, statuses: ['OUT_FOR_DELIVERY'], attention: true },
  { key: 'assigned', label: 'Chờ xuất phát', note: 'Chuyến được phân công, cửa hàng chưa cho xuất phát', icon: PackageCheck, statuses: ['ASSIGNED'] },
  { key: 'retry', label: 'Chờ giao lại', note: 'Giao chưa thành công hoặc mới giao một phần', icon: RotateCcw, statuses: ['RETRY_PENDING', 'PARTIALLY_DELIVERED'], attention: true },
  { key: 'done', label: 'Đã giao', note: 'Chuyến đã giao xong', icon: CheckCircle2, statuses: ['DELIVERED'] },
]
const TABS = [{ key: '', label: 'Tất cả', statuses: [] as DeliveryStatus[] }, ...GROUPS.map(({ key, label, statuses }) => ({ key, label, statuses }))]
const LIST_PATH = '/delivery/deliveries'

export default function DashboardPage() {
  usePageHeader({ title: 'Tổng quan giao hàng', subtitle: 'Tất cả chuyến giao được phân công cho bạn' })
  const { has } = usePermission()
  const canRead = has('DELIVERIES.READ')
  const [tab, setTab] = useState('')
  const missing = canRead ? null : 'Chưa được cấp quyền xem giao hàng.'

  const loadCounts = useCallback((signal: AbortSignal) => Promise.all(GROUPS.map(async group => {
    const pages = await Promise.all(group.statuses.map(status => deliveriesApi.getDeliveries({ status, page: 1, pageSize: 1 }, signal)))
    return pages.reduce((sum, page) => sum + page.totalCount, 0)
  })), [])
  const counts = useReportData(loadCounts, missing)

  // An empty `statuses` means every status; otherwise one request per status, merged newest first.
  const loadRecent = useCallback(async (signal: AbortSignal) => {
    const statuses = TABS.find(item => item.key === tab)?.statuses ?? []
    const pages = await Promise.all((statuses.length ? statuses : [undefined]).map(status => deliveriesApi.getDeliveries({ status, page: 1, pageSize: 5 }, signal)))
    return {
      totalCount: pages.reduce((sum, page) => sum + page.totalCount, 0),
      items: pages.flatMap(page => page.items).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    }
  }, [tab])
  const recent = useReportData(loadRecent, missing)
  const items = recent.data?.items ?? []

  return <div className="agrisage-dashboard max-w-[1440px] min-w-0 mx-auto flex flex-col gap-7">
    <StatStrip label="Chuyến giao được phân công" loading={counts.loading} stats={GROUPS.map((group, index) => {
      const value = counts.data?.[index] ?? null
      return { key: group.key, label: group.label, note: group.note, icon: group.icon, value: value === null ? null : value.toLocaleString('vi-VN'), to: LIST_PATH, attention: !!group.attention && !!value }
    })} />
    {!canRead && <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Chưa được cấp quyền xem giao hàng.</p>}
    {(counts.error || recent.error) && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{counts.error ?? recent.error}</p>}
    {canRead && <section aria-label="Chuyến giao gần đây" aria-busy={recent.loading} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 p-5 pb-4">
        <div>
          <h2 className="text-sm font-medium text-slate-500">Chuyến giao gần đây</h2>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold leading-8 text-slate-900">
            {recent.data ? `${recent.data.totalCount.toLocaleString('vi-VN')} chuyến` : '—'}
            <span className="text-sm font-normal text-slate-500">được phân công · hiện 5 chuyến mới nhất</span>
          </p>
        </div>
        <Link to={LIST_PATH} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-[#fff] px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900">Xem tất cả<ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
      <div className="px-5">
        <div role="group" aria-label="Lọc theo trạng thái" className="inline-flex flex-wrap gap-0.5 rounded-xl bg-slate-100 p-1">
          {TABS.map(item => <button key={item.key || 'all'} type="button" aria-pressed={tab === item.key} onClick={() => setTab(item.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === item.key ? 'bg-[#fff] text-green-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{item.label}</button>)}
        </div>
      </div>
      <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm sm:min-w-[650px]">
        <thead className="text-slate-500"><tr><th className="px-4 py-3">Mã phiếu</th><th className="px-4 py-3">Người nhận</th><th className="hidden px-4 py-3 sm:table-cell">Trạng thái</th><th className="hidden px-4 py-3 sm:table-cell">Hẹn giao</th><th className="hidden px-4 py-3 text-right sm:table-cell">Mặt hàng</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(item => <tr key={item.id} className="hover:bg-slate-50">
            <td className="whitespace-nowrap px-4 py-3 font-semibold text-primary"><Link to={`${LIST_PATH}/${item.id}`}>{item.deliveryNumber}</Link><div className="mt-1 text-xs font-normal text-slate-500">Đơn {item.orderNumber}</div><div className="mt-1.5 sm:hidden"><StatusBadge label={labelOf(DELIVERY_STATUS_LABEL, item.status)} /></div></td>
            <td className="px-4 py-3">{item.recipientName || '--'}{item.province && <div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} aria-hidden="true" />{item.province}</div>}<div className="mt-1.5 text-xs text-slate-500 sm:hidden">Hẹn giao {formatDate(item.scheduledAt)} · {item.itemCount} mặt hàng</div></td>
            <td className="hidden px-4 py-3 sm:table-cell"><StatusBadge label={labelOf(DELIVERY_STATUS_LABEL, item.status)} /></td>
            <td className="hidden px-4 py-3 whitespace-nowrap sm:table-cell">{formatDate(item.scheduledAt)}</td>
            <td className="hidden px-4 py-3 text-right whitespace-nowrap font-semibold sm:table-cell">{item.itemCount}</td>
          </tr>)}
          {!items.length && <EmptyTableRow colSpan={5} message={recent.loading ? 'Đang tải chuyến giao...' : recent.error ? 'Không tải được chuyến giao.' : 'Không có chuyến giao nào trong mục này.'} />}
        </tbody>
      </table></div>
    </section>}
  </div>
}
