import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, FilterX, ClipboardList, CheckCircle2, Edit3 } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import Pagination from '../../components/ui/Pagination'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import SearchInput from '../../components/ui/SearchInput'
import FilterSelect from '../../components/ui/FilterSelect'
import StatusBadge from '../../components/ui/StatusBadge'
import { usePagination } from '../../hooks/usePagination'
import { stocktakes as INITIAL_STOCKTAKES } from '../../data/mockStock'
import type { StocktakeStatus } from '../../data/mockStock'

const STATUS_OPTIONS = ['Tất cả trạng thái', 'Bản nháp (DRAFT)', 'Đã hoàn tất (COMPLETED)']

const mapStatusToOption = (status: StocktakeStatus) => {
  switch (status) {
    case 'DRAFT': return 'Bản nháp (DRAFT)'
    case 'COMPLETED': return 'Đã hoàn tất (COMPLETED)'
    default: return ''
  }
}

export default function StocktakePage() {
  usePageHeader({
    title: 'Kiểm kê kho',
  })

  const { showToast } = useToast()
  const [stocktakes, setStocktakes] = useState(INITIAL_STOCKTAKES)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0])

  const keyword = search.trim().toLowerCase()
  const filteredStocktakes = stocktakes.filter(
    (st) =>
      (!keyword || st.id.toLowerCase().includes(keyword) || st.createdBy.toLowerCase().includes(keyword)) &&
      (statusFilter === STATUS_OPTIONS[0] || mapStatusToOption(st.status) === statusFilter)
  )

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter(STATUS_OPTIONS[0])
  }

  const { page, totalPages, paginated, startIndex, endIndex, totalCount: pageTotalCount, goPrev, goNext, setPage } =
    usePagination(filteredStocktakes, 10)

  const handleAction = (id: string, label: string) => {
    const st = stocktakes.find(s => s.id === id)
    if (!st) return

    if (label === 'Hoàn tất kiểm kê') {
      setStocktakes(prev => prev.map(s => s.id === id ? { ...s, status: 'COMPLETED' as StocktakeStatus, actions: [{ label: 'Xem chi tiết', icon: 'visibility' }] } : s))
      showToast(`Đã hoàn tất phiếu kiểm kê ${id}. Hệ thống đã tạo tự động phiếu điều chỉnh (ADJUSTMENT).`)
    } else {
      showToast(`Đã thực hiện "${label}" cho phiếu ${id}`)
    }
  }

  const totalCount = stocktakes.length
  const completedCount = stocktakes.filter(s => s.status === 'COMPLETED').length
  const draftCount = stocktakes.filter(s => s.status === 'DRAFT').length

  const getStatusBadgeProps = (status: StocktakeStatus) => {
    switch (status) {
      case 'DRAFT': return { label: 'Bản nháp', className: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'COMPLETED': return { label: 'Đã hoàn tất', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    }
  }

  return (
    <>
      <section className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <Link className="hover:text-slate-900 transition-colors" to="/inventory">Kho bãi</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Kiểm kê</span>
        </nav>
        <div className="flex justify-end">
          <button
            className="flex items-center gap-2 h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            onClick={() => showToast('Tính năng tạo phiếu kiểm kê đang phát triển')}
            type="button"
          >
            <Plus size={16} />
            <span>Tạo phiếu kiểm kê</span>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng phiếu kiểm kê</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{totalCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
            <ClipboardList size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đã hoàn tất</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">{completedCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đang kiểm kê (Nháp)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700 tabular-nums">{draftCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600">
            <Edit3 size={20} />
          </div>
        </div>
      </section>

      <section className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Mã phiếu, Người tạo..." className="relative flex-1 min-w-[300px]" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[220px]" />
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
                <th className="py-4 pl-4 px-3 w-[140px]">Mã phiếu</th>
                <th className="py-4 px-3 min-w-[150px]">Ngày tạo</th>
                <th className="py-4 px-3 min-w-[150px]">Người thực hiện</th>
                <th className="py-4 px-3 min-w-[120px]">Sản phẩm KP</th>
                <th className="py-4 px-3 min-w-[140px]">Trạng thái</th>
                <th className="py-4 pr-4 pl-3 w-10 "></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không tìm thấy phiếu kiểm kê." />
              ) : null}
              {paginated.map((st) => {
                const badge = getStatusBadgeProps(st.status)
                const hasVariance = st.items.some(i => i.variance !== 0)
                return (
                  <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 pl-4 px-3 font-semibold text-slate-900">{st.id}</td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-700">{new Date(st.createdAt).toLocaleDateString('vi-VN')}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{new Date(st.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-900">{st.createdBy}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-semibold tabular-nums text-slate-900">{st.items.length} loại</div>
                      {st.status === 'COMPLETED' && hasVariance && (
                        <div className="text-xs text-rose-600 mt-0.5 font-medium flex items-center gap-1">
                          Có chênh lệch
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-3">
                      <StatusBadge label={badge.label} className={badge.className} />
                    </td>
                    <td className="py-4 pr-4 pl-3 text-center">
                      <RowActionsMenu
                        triggerLabel={`Thao tác ${st.id}`}
                        actions={st.actions.map(a => ({
                          ...a,
                          onClick: () => handleAction(st.id, a.label)
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
          unitLabel="phiếu kiểm kê"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </section>
    </>
  )
}
