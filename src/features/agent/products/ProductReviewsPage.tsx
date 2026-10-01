import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Star, RefreshCw } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { usePagination } from '@/hooks/usePagination'
import { productReviews as INITIAL_REVIEWS } from '@/features/agent/data/mockReviews'

const STATUS_OPTIONS = ['Tất cả trạng thái', 'VISIBLE', 'HIDDEN']

export default function ProductReviewsPage() {
  usePageHeader({ title: 'Đánh giá sản phẩm', subtitle: 'Phản hồi từ nông dân' })
  const { showToast } = useToast()
  const [reviews] = useState(INITIAL_REVIEWS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái')

  const keyword = search.trim().toLowerCase()
  const filtered = reviews.filter((r) => {
    const matchesSearch = !keyword || r.productName.toLowerCase().includes(keyword) || r.farmerName.toLowerCase().includes(keyword)
    const matchesStatus = statusFilter === 'Tất cả trạng thái' || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(filtered, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Đánh giá sản phẩm</span>
      </nav>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng đánh giá</span>
            <Star size={20} className="text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">{reviews.length}</div>
        </div>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm sản phẩm, nông dân..." className="relative flex-1 max-w-md" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[200px]" />
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Sản phẩm / Nông dân</th>
                <th className="py-3 px-3" scope="col">Đánh giá</th>
                <th className="py-3 px-3" scope="col">Nội dung</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-4 text-center w-28" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? <EmptyTableRow colSpan={5} message="Không có đánh giá nào." /> : null}
              {paginated.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-900">{r.productName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{r.farmerName}</div>
                  </td>
                  <td className="py-4 px-3 flex text-amber-500">
                    {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={i < r.rating ? 'currentColor' : 'none'} />)}
                  </td>
                  <td className="py-4 px-3">
                    <div className="text-slate-700">{r.comment}</div>
                    {r.reply && <div className="mt-1 text-xs text-emerald-700 bg-emerald-50 p-2 rounded line-clamp-2">{r.reply}</div>}
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${r.status === 'VISIBLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <RowActionsMenu triggerLabel="Thao tác" actions={r.actions.map(a => ({ ...a, onClick: () => showToast(`Đã thực hiện: ${a.label}`) }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="đánh giá" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
