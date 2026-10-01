import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, RefreshCw, MapPin } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useDeliveries } from '@/context/DeliveryContext'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import StatusBadge from '@/components/ui/StatusBadge'
import { usePagination } from '@/hooks/usePagination'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'ASSIGNED', label: 'Chờ giao' },
  { value: 'OUT_FOR_DELIVERY', label: 'Đang giao' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'FAILED', label: 'Giao thất bại' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

function getStatusLabel(status: string) {
  switch (status) {
    case 'ASSIGNED': return 'Chờ giao'
    case 'OUT_FOR_DELIVERY': return 'Đang giao'
    case 'DELIVERED': return 'Đã giao'
    case 'FAILED': return 'Giao thất bại'
    case 'CANCELLED': return 'Đã hủy'
    default: return status
  }
}

export default function DeliveriesPage() {
  usePageHeader({ title: 'Quản lý giao hàng', subtitle: 'Theo dõi lộ trình và kết quả giao nhận' })

  const { orders } = useDeliveries()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái')

  const keyword = search.trim().toLowerCase()
  const filtered = orders.filter((o) => {
    const matchesSearch =
      !keyword ||
      o.orderCode.toLowerCase().includes(keyword) ||
      o.farmerName.toLowerCase().includes(keyword) ||
      o.deliveryAddress.toLowerCase().includes(keyword)

    const filterObj = STATUS_OPTIONS.find(opt => opt.label === statusFilter)
    const filterVal = filterObj ? filterObj.value : 'ALL'
    const matchesStatus = filterVal === 'ALL' || o.status === filterVal

    return matchesSearch && matchesStatus
  })

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filtered, 10)

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('Tất cả trạng thái')
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Quản lý giao hàng</span>
          </nav>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đang giao</div>
          <div className="mt-2 text-2xl font-bold text-amber-600 tabular-nums">{orders.filter(o => o.status === 'OUT_FOR_DELIVERY').length}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đã giao trong ngày</div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 tabular-nums">{orders.filter(o => o.status === 'DELIVERED').length}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Giao thất bại</div>
          <div className="mt-2 text-2xl font-bold text-rose-600 tabular-nums">{orders.filter(o => o.status === 'FAILED').length}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Chờ điều phối</div>
          <div className="mt-2 text-2xl font-bold text-slate-700 tabular-nums">{orders.filter(o => o.status === 'ASSIGNED').length}</div>
        </div>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã đơn, tên nông dân, địa chỉ..." className="relative flex-1" />
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS.map(o => o.label)} className="relative min-w-[200px]" />
          <button
            className="px-3 py-1.5 h-9 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            type="button"
            onClick={handleClearFilters}
          >
            <RefreshCw size={14} />
            <span>Xóa lọc</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Mã Đơn / Khách hàng</th>
                <th className="py-3 px-3" scope="col">Địa chỉ &amp; Lịch trình</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-3" scope="col">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={4} message="Không tìm thấy đơn giao hàng nào." />
              ) : null}
              {paginated.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-900">{o.farmerName}</div>
                    <div className="font-mono text-xs text-slate-500 mt-0.5">{o.orderCode}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{o.farmerPhone}</div>
                  </td>
                  <td className="py-4 px-3">
                    <div className="font-medium text-slate-700 flex items-start gap-1">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                      <span className="line-clamp-2" title={o.deliveryAddress}>{o.deliveryAddress}</span>
                    </div>
                    <div className="font-mono text-xs text-slate-500 mt-1 pl-4 flex items-center gap-2">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{o.scheduledDate}</span>
                      <span>{o.scheduledWindowLabel}</span>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-center">
                    <StatusBadge label={getStatusLabel(o.status)} className="" />
                    {o.status === 'FAILED' && o.redeliveryDate && (
                      <div className="mt-1 text-[10px] text-rose-500 font-semibold">
                        Giao lại: {o.redeliveryDate}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-3">
                    {o.attempts.length > 0 && o.attempts[o.attempts.length - 1].note && (
                      <div className="text-xs text-slate-600 italic line-clamp-2" title={o.attempts[o.attempts.length - 1].note}>
                        "{o.attempts[o.attempts.length - 1].note}"
                      </div>
                    )}
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
          unitLabel="đơn"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>
    </div>
  )
}
