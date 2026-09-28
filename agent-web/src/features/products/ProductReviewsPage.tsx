import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FilterX, MessageSquare, Star, EyeOff } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import Pagination from '../../components/ui/Pagination'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import SearchInput from '../../components/ui/SearchInput'
import FilterSelect from '../../components/ui/FilterSelect'
import StatusBadge from '../../components/ui/StatusBadge'
import FormModal from '../../components/ui/FormModal'
import { usePagination } from '../../hooks/usePagination'
import { productReviews as INITIAL_REVIEWS } from '../../data/mockReviews'
import { useFormValues } from '../../hooks/useFormValues'
import type { ReviewStatus } from '../../data/mockReviews'

const STATUS_OPTIONS = ['Tất cả trạng thái', 'Đang hiển thị', 'Đã ẩn']

const mapStatusToOption = (status: ReviewStatus) => {
  switch (status) {
    case 'VISIBLE': return 'Đang hiển thị'
    case 'HIDDEN': return 'Đã ẩn'
    default: return ''
  }
}

export default function ProductReviewsPage() {
  usePageHeader({
    title: 'Đánh giá sản phẩm',
  })

  const { showToast } = useToast()
  const [reviews, setReviews] = useState(INITIAL_REVIEWS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0])
  const [replyRevId, setReplyRevId] = useState<string | null>(null)

  const { values: replyForm, update: updateReplyForm } = useFormValues({ reply: '' })

  const keyword = search.trim().toLowerCase()
  const filteredReviews = reviews.filter(
    (r) =>
      (!keyword || r.productName.toLowerCase().includes(keyword) || r.farmerName.toLowerCase().includes(keyword) || r.comment.toLowerCase().includes(keyword)) &&
      (statusFilter === STATUS_OPTIONS[0] || mapStatusToOption(r.status) === statusFilter)
  )

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter(STATUS_OPTIONS[0])
  }

  const { page, totalPages, paginated, startIndex, endIndex, totalCount: pageTotalCount, goPrev, goNext, setPage } =
    usePagination(filteredReviews, 10)

  const handleAction = (id: string, label: string) => {
    const rev = reviews.find(r => r.id === id)
    if (!rev) return

    if (label === 'Phản hồi' || label === 'Sửa phản hồi') {
      setReplyRevId(id)
      updateReplyForm('reply', rev.reply || '')
    } else if (label === 'Ẩn bình luận') {
      setReviews(prev => prev.map(r => r.id === id ? {
        ...r,
        status: 'HIDDEN' as ReviewStatus,
        actions: [{ label: 'Hiển thị bình luận', icon: 'visibility' }]
      } : r))
      showToast(`Đã ẩn bình luận của ${rev.farmerName}`)
    } else if (label === 'Hiển thị bình luận') {
      setReviews(prev => prev.map(r => r.id === id ? {
        ...r,
        status: 'VISIBLE' as ReviewStatus,
        actions: [{ label: r.reply ? 'Sửa phản hồi' : 'Phản hồi', icon: r.reply ? 'edit' : 'reply' }, { label: 'Ẩn bình luận', icon: 'visibility_off' }]
      } : r))
      showToast(`Đã hiển thị lại bình luận của ${rev.farmerName}`)
    } else {
      showToast(`Đã thực hiện "${label}"`)
    }
  }

  const handleConfirmReply = () => {
    if (!replyRevId) return
    setReviews(prev => prev.map(r => r.id === replyRevId ? {
      ...r,
      reply: replyForm.reply,
      repliedAt: new Date().toISOString(),
      actions: r.actions.map(a => a.label === 'Phản hồi' ? { ...a, label: 'Sửa phản hồi', icon: 'edit' } : a)
    } : r))
    showToast(`Đã lưu phản hồi cho bình luận ${replyRevId}`)
    setReplyRevId(null)
  }

  const totalCount = reviews.length
  const visibleCount = reviews.filter(r => r.status === 'VISIBLE').length
  const hiddenCount = reviews.filter(r => r.status === 'HIDDEN').length

  const getStatusBadgeProps = (status: ReviewStatus) => {
    switch (status) {
      case 'VISIBLE': return { label: 'Đang hiển thị', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'HIDDEN': return { label: 'Đã ẩn', className: 'bg-slate-100 text-slate-700 border-slate-200' }
    }
  }

  return (
    <>
      <section className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <Link className="hover:text-slate-900 transition-colors" to="/products">Sản phẩm</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Đánh giá</span>
        </nav>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng đánh giá</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{totalCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
            <MessageSquare size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đang hiển thị</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">{visibleCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
            <Star size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đã ẩn</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-700 tabular-nums">{hiddenCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-500">
            <EyeOff size={20} />
          </div>
        </div>
      </section>

      <section className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm sản phẩm, nội dung..." className="relative flex-1 min-w-[300px]" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[200px]" />
          <button
            className="h-9 px-3 text-slate-500 hover:text-slate-900 text-xs font-medium flex items-center gap-1 transition-colors"
            onClick={handleClearFilters}
            type="button"
          >
            <FilterX size={14} />
            <span>Xóa tìm kiếm</span>
          </button>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-4 pl-4 px-3 min-w-[150px]">Khách hàng</th>
                <th className="py-4 px-3 min-w-[200px]">Sản phẩm</th>
                <th className="py-4 px-3 min-w-[100px]">Đánh giá</th>
                <th className="py-4 px-3 min-w-[250px]">Nội dung & Phản hồi</th>
                <th className="py-4 px-3 min-w-[130px]">Trạng thái</th>
                <th className="py-4 pr-4 pl-3 w-10 "></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không tìm thấy đánh giá nào." />
              ) : null}
              {paginated.map((rev) => {
                const badge = getStatusBadgeProps(rev.status)
                const isHidden = rev.status === 'HIDDEN'
                return (
                  <tr key={rev.id} className={`hover:bg-slate-50/50 transition-colors ${isHidden ? 'opacity-60' : ''}`}>
                    <td className="py-4 pl-4 px-3">
                      <div className="font-semibold text-slate-900">{rev.farmerName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{new Date(rev.createdAt).toLocaleDateString('vi-VN')}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-900">{rev.productName}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-1 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={14} fill={i < rev.rating ? 'currentColor' : 'none'} className={i >= rev.rating ? 'text-slate-300' : ''} />
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="text-sm text-slate-800">{rev.comment}</div>
                      {rev.reply && (
                        <div className="mt-2 bg-slate-50 p-2 rounded border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Cửa hàng phản hồi:</span>
                          <p className="text-xs text-slate-700 mt-1">{rev.reply}</p>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-3">
                      <StatusBadge label={badge.label} className={badge.className} />
                    </td>
                    <td className="py-4 pr-4 pl-3 text-center">
                      <RowActionsMenu
                        triggerLabel={`Thao tác ${rev.id}`}
                        actions={rev.actions.map(a => ({
                          ...a,
                          onClick: () => handleAction(rev.id, a.label)
                        }))}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalCount={pageTotalCount}
          unitLabel="đánh giá"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </section>

      {/* REPLY MODAL */}
      <FormModal
        open={replyRevId !== null}
        onClose={() => setReplyRevId(null)}
        title="Phản hồi đánh giá"
        fields={[
          { key: 'reply', label: 'Nội dung phản hồi *', type: 'text', placeholder: 'Nhập nội dung phản hồi của cửa hàng...' }
        ]}
        values={replyForm}
        onChange={updateReplyForm}
        onSubmit={handleConfirmReply}
        submitLabel="Lưu phản hồi"
      />
    </>
  )
}
