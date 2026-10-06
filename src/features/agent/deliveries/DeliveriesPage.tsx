import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, RefreshCw, MapPin, UserCircle } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { deliveriesApi, type DeliveryListItem, type DeliveryStatus } from '@/api/deliveriesApi'
import { useToast } from '@/context/ToastContext'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import StatusBadge from '@/components/ui/StatusBadge'
import RowActionsMenu, { type RowAction } from '@/components/ui/RowActionsMenu'
import { usePagination } from '@/hooks/usePagination'
import { DELIVERY_STATUS_LABEL, formatDate, labelOf } from '@/utils/deliveryLabels'
import DeliveryDetailModal from './DeliveryDetailModal'

const ALL_STATUSES = 'Tất cả trạng thái'
const STATUS_OPTIONS: { value: DeliveryStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: ALL_STATUSES },
  ...(Object.keys(DELIVERY_STATUS_LABEL) as DeliveryStatus[]).map((s) => ({ value: s, label: DELIVERY_STATUS_LABEL[s] })),
]

// Q3 of FE_GUIDE_FLOW_2: the list endpoint returns summaries; Q4/Q5 live in DeliveryDetailModal.
export default function DeliveriesPage() {
  usePageHeader({ title: 'Quản lý giao hàng', subtitle: 'Theo dõi lộ trình và kết quả giao nhận' })
  const { showToast } = useToast()
  // Shared by Đại lý (/agent) and Bán hàng (/sales) — FE_GUIDE_FLOW_2 §4.
  const homePath = useLocation().pathname.startsWith('/sales') ? '/sales' : '/agent'

  const [deliveries, setDeliveries] = useState<DeliveryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchDeliveries = async () => {
    try {
      setLoading(true)
      const data = await deliveriesApi.getDeliveries({ pageSize: 100 })
      setDeliveries(data.items || [])
    } catch {
      showToast('Lỗi tải danh sách giao hàng', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeliveries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildActions = (delivery: DeliveryListItem): RowAction[] => [
    { label: 'Xem chi tiết', icon: 'visibility', onClick: () => setSelectedId(delivery.id) },
  ]

  const keyword = search.trim().toLowerCase()
  const statusValue = STATUS_OPTIONS.find((opt) => opt.label === statusFilter)?.value ?? 'ALL'
  const filtered = deliveries.filter((d) => {
    const matchesSearch =
      !keyword ||
      d.deliveryNumber.toLowerCase().includes(keyword) ||
      d.orderNumber.toLowerCase().includes(keyword) ||
      (d.recipientName || '').toLowerCase().includes(keyword) ||
      (d.province || '').toLowerCase().includes(keyword) ||
      (d.assignedTo?.fullName || '').toLowerCase().includes(keyword)
    return matchesSearch && (statusValue === 'ALL' || d.status === statusValue)
  })

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(filtered, 10)

  const count = (...statuses: DeliveryStatus[]) => deliveries.filter((d) => statuses.includes(d.status)).length

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to={homePath}>Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Quản lý giao hàng</span>
      </nav>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Chờ điều phối', value: count('DRAFT', 'ASSIGNED'), className: 'text-slate-700' },
          { label: 'Đang giao', value: count('OUT_FOR_DELIVERY'), className: 'text-amber-600' },
          { label: 'Chờ giao lại', value: count('RETRY_PENDING', 'PARTIALLY_DELIVERED'), className: 'text-rose-600' },
          { label: 'Đã giao', value: count('DELIVERED'), className: 'text-emerald-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{kpi.label}</div>
            <div className={`mt-2 text-2xl font-bold tabular-nums ${kpi.className}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã phiếu, mã đơn, người nhận, tài xế..." className="relative flex-1" />
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS.map((o) => o.label)} className="relative min-w-[200px]" />
          <button
            className="px-3 py-1.5 h-9 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            type="button"
            onClick={() => {
              setSearch('')
              setStatusFilter(ALL_STATUSES)
              fetchDeliveries()
            }}
          >
            <RefreshCw size={14} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4 w-[240px]" scope="col">Mã phiếu / Người nhận</th>
                <th className="py-3 px-3 min-w-[200px]" scope="col">Khu vực &amp; Lịch trình</th>
                <th className="py-3 px-3" scope="col">Tài xế</th>
                <th className="py-3 px-3 text-center min-w-[140px]" scope="col">Trạng thái</th>
                <th className="py-3 pr-4 pl-3 w-10"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {loading ? (
                <EmptyTableRow colSpan={5} message="Đang tải dữ liệu..." />
              ) : paginated.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Không tìm thấy phiếu giao hàng nào." />
              ) : null}
              {!loading &&
                paginated.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedId(d.id)}>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-primary">{d.deliveryNumber}</div>
                      <div className="font-medium text-slate-900 mt-1">{d.recipientName || '--'}</div>
                      <div className="font-mono text-xs text-slate-500 mt-0.5">Đơn {d.orderNumber} · {d.itemCount} mặt hàng</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-700 flex items-start gap-1">
                        <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        <span>{d.province || '--'}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 pl-4">
                        Hẹn: {formatDate(d.scheduledAt)}
                        {d.completedAt ? ` · Xong: ${formatDate(d.completedAt)}` : ''}
                      </div>
                    </td>
                    <td className="py-4 px-3 text-sm">
                      {d.assignedTo ? (
                        <span className="flex items-center gap-1 text-slate-700">
                          <UserCircle size={14} className="text-slate-400" /> {d.assignedTo.fullName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Chưa phân công</span>
                      )}
                    </td>
                    <td className="py-4 px-3 text-center">
                      <StatusBadge label={labelOf(DELIVERY_STATUS_LABEL, d.status)} />
                    </td>
                    <td className="py-4 pr-4 pl-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu triggerLabel={`Thao tác phiếu ${d.deliveryNumber}`} actions={buildActions(d)} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalCount={totalCount}
          unitLabel="phiếu"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>

      <DeliveryDetailModal deliveryId={selectedId} onClose={() => setSelectedId(null)} onChanged={fetchDeliveries} />
    </div>
  )
}
