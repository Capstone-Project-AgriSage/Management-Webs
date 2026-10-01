import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Wallet, Clock, CheckCircle2, RefreshCw } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { usePagination } from '@/hooks/usePagination'
import { mockCreditRequests as INITIAL_REQUESTS } from '@/features/agent/data/mockDebts'
import { formatVndShort } from '@/utils/money'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' }
]

function getStatusBadge(status: string) {
  switch (status) {
    case 'PENDING_APPROVAL': return { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'APPROVED': return { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'REJECTED': return { label: 'Từ chối', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    default: return { label: status, className: 'bg-slate-100 text-slate-600' }
  }
}

export default function SeasonalCreditPage() {
  usePageHeader({ title: 'Mua chịu (Seasonal)', subtitle: 'Phê duyệt hạn mức mua chịu nông dân' })
  const { showToast } = useToast()
  const [requests] = useState(INITIAL_REQUESTS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái')

  const keyword = search.trim().toLowerCase()
  const filtered = requests.filter((r) => {
    const matchesSearch =
      !keyword ||
      r.id.toLowerCase().includes(keyword) ||
      r.farmerName.toLowerCase().includes(keyword) ||
      r.orderCode.toLowerCase().includes(keyword)

    const filterObj = STATUS_OPTIONS.find(opt => opt.label === statusFilter)
    const filterVal = filterObj ? filterObj.value : 'ALL'
    const matchesStatus = filterVal === 'ALL' || r.status === filterVal

    return matchesSearch && matchesStatus
  })

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filtered, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Mua chịu mùa vụ</span>
        </nav>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng yêu cầu</span>
            <div className="p-2.5 bg-slate-100 rounded-lg text-emerald-600">
              <Wallet size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{requests.length}</div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Chờ duyệt</span>
            <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 tabular-nums">{requests.filter(r => r.status === 'PENDING_APPROVAL').length}</div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã, nông dân..." className="relative flex-1 max-w-md" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS.map(o => o.label)} className="relative min-w-[200px]" />
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Mã YC / Thời gian</th>
                <th className="py-3 px-3" scope="col">Khách hàng</th>
                <th className="py-3 px-3 text-right" scope="col">Số tiền (VNĐ)</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-4 text-center w-28" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? <EmptyTableRow colSpan={5} message="Không có yêu cầu mua chịu nào." /> : null}
              {paginated.map((r) => {
                const badge = getStatusBadge(r.status)
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-mono font-semibold text-slate-900">{r.id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{r.createdAt}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-700">{r.farmerName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Đơn: {r.orderCode}</div>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <span className="font-mono font-semibold text-slate-900">{formatVndShort(r.requestedAmount)}</span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <RowActionsMenu
                        triggerLabel="Thao tác"
                        actions={[
                          { label: 'Phê duyệt', icon: 'check', onClick: () => showToast('Đã phê duyệt') },
                          { label: 'Từ chối', icon: 'close', onClick: () => showToast('Đã từ chối') }
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="yêu cầu" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
