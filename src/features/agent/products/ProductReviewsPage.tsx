import ListToolbar from '@/components/ui/ListToolbar'
import { useState } from 'react';

import { Star } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';

import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import ListReportCards from '@/features/agent/reports/ListReportCards'
import { usePagination } from '@/hooks/usePagination';
import { productReviews as INITIAL_REVIEWS } from '@/features/agent/data/mockReviews';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'VISIBLE', label: 'Đang hiển thị' },
  { value: 'HIDDEN', label: 'Đã ẩn' },
]

export default function ProductReviewsPage() {
  usePageHeader({ title: 'Đánh giá sản phẩm', subtitle: 'Phản hồi từ nông dân' })
  const { showToast } = useToast()
  const [reviews] = useState(INITIAL_REVIEWS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const keyword = search.trim().toLowerCase()
  const filtered = reviews.filter((r) => {
    const matchesSearch = !keyword || r.productName.toLowerCase().includes(keyword) || r.farmerName.toLowerCase().includes(keyword)
    const matchesStatus = !statusFilter || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(filtered, 10, [search, statusFilter].join('|'))

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">

      <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Dữ liệu mẫu — chưa có API backend cho đánh giá sản phẩm.</p>
      <ListReportCards title="Tổng hợp đánh giá mẫu" totalLabel="Đánh giá mẫu theo bộ lọc" totalNote="Tất cả dữ liệu mẫu khớp bộ lọc" totalCount={totalCount} unit="đánh giá mẫu" loading={false} metrics={[
        { label: 'Đang hiển thị', value: paginated.filter(review => review.status === 'VISIBLE').length, note: 'Dữ liệu mẫu trên trang đang hiển thị' },
        { label: 'Đã ẩn', value: paginated.filter(review => review.status === 'HIDDEN').length, note: 'Dữ liệu mẫu trên trang đang hiển thị' },
        { label: 'Đã phản hồi', value: paginated.filter(review => review.reply?.trim()).length, note: 'Dữ liệu mẫu trên trang đang hiển thị' },
      ]} />

      <ListToolbar search={{ value: search, onChange: setSearch, placeholder: "Tìm sản phẩm, nông dân..." }} onClear={() => { setSearch(''); setStatusFilter(''); setPage(1) }}>
        <FilterSelect label="Trạng thái đánh giá" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[200px]" />
      </ListToolbar>

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
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${r.status === 'VISIBLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.status === 'VISIBLE' ? 'Đang hiển thị' : 'Đã ẩn'}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <RowActionsMenu triggerLabel={`Thao tác đánh giá của ${r.farmerName}`} actions={r.actions.map(a => ({ ...a, onClick: () => showToast(`Chức năng “${a.label}” chưa có API backend cho đánh giá sản phẩm.`, 'info') }))} />
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
