import { useState, useEffect, useCallback } from 'react';
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRight, MapPin, UserCircle } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { deliveriesApi, type DeliveryListItem, type DeliveryStatus } from '@/api/deliveriesApi';
import { useToast } from '@/context/ToastContext';

import FilterSelect from '@/components/ui/FilterSelect'

import EmptyTableRow from '@/components/ui/EmptyTableRow'
import StatusBadge from '@/components/ui/StatusBadge'
import RowActionsMenu, { type RowAction } from '@/components/ui/RowActionsMenu';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { LIST_PAGE_SIZE } from '@/utils/pagination';
import ServerPagination from '@/components/ui/ServerPagination'
import ListToolbar from '@/components/ui/ListToolbar'
import { DELIVERY_STATUS_LABEL, formatDate, labelOf } from '@/utils/deliveryLabels';
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
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [statusCounts, setStatusCounts] = useState<Partial<Record<DeliveryStatus, number>>>({})
  const [countRevision, setCountRevision] = useState(0)
  const debouncedSearch = useDebouncedValue(search.trim())
  const statusValue = STATUS_OPTIONS.find(opt => opt.label === statusFilter)?.value ?? 'ALL'
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // "?open=<deliveryId>" (from the order's delivery list) opens that delivery's detail, where the driver is assigned.
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('open')
  useEffect(() => {
    if (!openId) return
    setSelectedId(openId)
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId])

  const fetchDeliveries = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const data = await deliveriesApi.getDeliveries({ page, pageSize: LIST_PAGE_SIZE, search: debouncedSearch || undefined, status: statusValue === 'ALL' ? undefined : statusValue }, signal)
      if (signal?.aborted) return
      const lastPage = Math.max(1, data.totalPages)
      if (page > lastPage) { setPage(lastPage); return }
      setDeliveries(data.items || []); setTotalCount(data.totalCount); setTotalPages(lastPage)
    } catch {
      if (!signal?.aborted) { setDeliveries([]); showToast('Lỗi tải danh sách giao hàng', 'error') }
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [page, debouncedSearch, statusValue, showToast])

  useEffect(() => {
    const controller = new AbortController()
    void fetchDeliveries(controller.signal)
    return () => controller.abort()
  }, [fetchDeliveries])

  useEffect(() => {
    const controller = new AbortController()
    const statuses: DeliveryStatus[] = ['DRAFT', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'RETRY_PENDING', 'PARTIALLY_DELIVERED', 'DELIVERED']
    Promise.all(statuses.map(async status => {
      const result = await deliveriesApi.getDeliveries({ status, page: 1, pageSize: 1 }, controller.signal)
      return [status, result.totalCount] as const
    })).then(entries => { if (!controller.signal.aborted) setStatusCounts(Object.fromEntries(entries)) }).catch(() => {})
    return () => controller.abort()
  }, [countRevision])

  const buildActions = (delivery: DeliveryListItem): RowAction[] => [
    { label: 'Xem chi tiết', icon: 'visibility', onClick: () => setSelectedId(delivery.id) },
  ]

  const count = (...statuses: DeliveryStatus[]) => statuses.every(status => statusCounts[status] !== undefined) ? statuses.reduce((sum, status) => sum + statusCounts[status]!, 0) : '—'

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

      <BusinessReportCards kind="deliveries" />
      <ListToolbar search={{ value: search, onChange: value => { setSearch(value); setPage(1) }, placeholder: 'Tìm mã phiếu, mã đơn, tên hoặc SĐT người nhận...' }} onClear={() => { setSearch(''); setStatusFilter(ALL_STATUSES); setPage(1) }}>
        <FilterSelect label="Lọc trạng thái" value={statusFilter} onChange={value => { setStatusFilter(value); setPage(1) }} options={STATUS_OPTIONS.map(option => option.label)} />
      </ListToolbar>

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
              ) : deliveries.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Không tìm thấy phiếu giao hàng nào." />
              ) : null}
              {!loading &&
                deliveries.map((d) => (
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
        <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalPages={totalPages} totalCount={totalCount} unitLabel="phiếu" onPageChange={setPage} />
      </div>

      <DeliveryDetailModal deliveryId={selectedId} onClose={() => setSelectedId(null)} onChanged={() => { void fetchDeliveries(); setCountRevision(value => value + 1) }} />
    </div>
  )
}
