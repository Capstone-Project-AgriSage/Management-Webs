import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FilterX, Download, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import Pagination from '../../components/ui/Pagination'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import SearchInput from '../../components/ui/SearchInput'
import FilterSelect from '../../components/ui/FilterSelect'
import StatusBadge from '../../components/ui/StatusBadge'
import { usePagination } from '../../hooks/usePagination'
import { stockMovements as INITIAL_MOVEMENTS } from '../../data/mockStock'
import type { StockMovementType } from '../../data/mockStock'

const TYPE_OPTIONS = ['Tất cả loại giao dịch', 'Nhập kho (STOCK_IN)', 'Xuất bán (SALE)', 'Điều chỉnh (ADJUSTMENT)']

const mapTypeToOption = (type: StockMovementType) => {
  switch (type) {
    case 'STOCK_IN': return 'Nhập kho (STOCK_IN)'
    case 'SALE': return 'Xuất bán (SALE)'
    case 'ADJUSTMENT': return 'Điều chỉnh (ADJUSTMENT)'
    default: return ''
  }
}

export default function StockMovementsPage() {
  usePageHeader({
    title: 'Biến động kho',
  })

  const { showToast } = useToast()
  const [movements] = useState(INITIAL_MOVEMENTS)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState(TYPE_OPTIONS[0])

  const keyword = search.trim().toLowerCase()
  const filteredMovements = movements.filter(
    (m) =>
      (!keyword || m.productName.toLowerCase().includes(keyword) || m.id.toLowerCase().includes(keyword) || (m.referenceId && m.referenceId.toLowerCase().includes(keyword))) &&
      (typeFilter === TYPE_OPTIONS[0] || mapTypeToOption(m.type) === typeFilter)
  )

  const handleClearFilters = () => {
    setSearch('')
    setTypeFilter(TYPE_OPTIONS[0])
  }

  const { page, totalPages, paginated, startIndex, endIndex, totalCount: pageTotalCount, goPrev, goNext, setPage } =
    usePagination(filteredMovements, 10)

  const totalCount = movements.length
  const stockInCount = movements.filter(m => m.type === 'STOCK_IN').length
  const saleCount = movements.filter(m => m.type === 'SALE').length
  const adjustmentCount = movements.filter(m => m.type === 'ADJUSTMENT').length

  const getTypeBadge = (type: StockMovementType) => {
    switch (type) {
      case 'STOCK_IN': return { label: 'Nhập kho', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'SALE': return { label: 'Xuất bán', className: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'ADJUSTMENT': return { label: 'Điều chỉnh', className: 'bg-amber-50 text-amber-700 border-amber-200' }
    }
  }

  return (
    <>
      <section className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Biến động kho</span>
        </nav>
        <div className="flex justify-end">
          <button
            className="flex items-center gap-2 h-9 px-3 bg-white hover:bg-slate-50/50 border border-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors shadow-sm"
            onClick={() => showToast('Tính năng xuất báo cáo đang phát triển')}
            type="button"
          >
            <Download size={16} className="text-slate-500" />
            <span>Xuất báo cáo</span>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng giao dịch</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{totalCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
            <SlidersHorizontal size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lượt nhập kho</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">{stockInCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
            <ArrowDownToLine size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lượt xuất bán</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-700 tabular-nums">{saleCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600">
            <ArrowUpFromLine size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lượt điều chỉnh</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700 tabular-nums">{adjustmentCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600">
            <SlidersHorizontal size={20} />
          </div>
        </div>
      </section>

      <section className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Sản phẩm, Mã giao dịch, Tham chiếu..." className="relative flex-1 min-w-[300px]" />
          <FilterSelect value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} className="relative min-w-[220px]" />
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
                <th className="py-4 pl-4 px-3 w-[140px]">Thời gian</th>
                <th className="py-4 px-3 min-w-[200px]">Sản phẩm & SKU</th>
                <th className="py-4 px-3 min-w-[140px]">Loại</th>
                <th className="py-4 px-3 min-w-[120px] text-right">Thay đổi</th>
                <th className="py-4 px-3 min-w-[120px] text-right">Tồn cuối</th>
                <th className="py-4 pr-4 pl-3 min-w-[200px]">Chi tiết & Người thực hiện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không tìm thấy lịch sử biến động kho." />
              ) : null}
              {paginated.map((m) => {
                const badge = getTypeBadge(m.type)
                const isPositive = m.quantityChange > 0
                return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 pl-4 px-3">
                      <div className="font-semibold text-slate-900">{new Date(m.createdAt).toLocaleDateString('vi-VN')}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-900">{m.productName}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">{m.sku}</div>
                    </td>
                    <td className="py-4 px-3">
                      <StatusBadge label={badge.label} className={badge.className} />
                    </td>
                    <td className={`py-3 px-3 text-right font-semibold font-mono ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isPositive ? '+' : ''}{m.quantityChange}
                    </td>
                    <td className="py-4 px-3 text-right font-semibold font-mono text-slate-900">
                      {m.balanceAfter}
                    </td>
                    <td className="py-4 pr-4 pl-3">
                      <div className="text-sm text-slate-700">{m.note}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Bởi: <span className="font-medium text-slate-700">{m.createdBy}</span> 
                        {m.referenceId && <span className="ml-2 font-mono bg-slate-100 px-1 py-0.5 rounded">Ref: {m.referenceId}</span>}
                      </div>
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
          unitLabel="giao dịch"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </section>
    </>
  )
}
