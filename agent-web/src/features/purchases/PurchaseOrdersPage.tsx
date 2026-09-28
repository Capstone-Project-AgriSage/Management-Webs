import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, FilterX, ShoppingCart, CheckCircle2, Clock, Ban } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import Pagination from '../../components/ui/Pagination'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import SearchInput from '../../components/ui/SearchInput'
import FilterSelect from '../../components/ui/FilterSelect'
import StatusBadge from '../../components/ui/StatusBadge'
import { usePagination } from '../../hooks/usePagination'
import { purchaseOrders as INITIAL_POS } from '../../data/mockPurchases'
import { formatVndShort } from '../../utils/money'
import type { POStatus } from '../../data/mockPurchases'

const STATUS_OPTIONS = ['Tất cả trạng thái', 'Nháp (DRAFT)', 'Đã đặt (ORDERED)', 'Nhận 1 phần', 'Đã nhận đủ', 'Đã hủy']

const mapStatusToOption = (status: POStatus) => {
  switch (status) {
    case 'DRAFT': return 'Nháp (DRAFT)'
    case 'ORDERED': return 'Đã đặt (ORDERED)'
    case 'PARTIALLY_RECEIVED': return 'Nhận 1 phần'
    case 'RECEIVED': return 'Đã nhận đủ'
    case 'CANCELLED': return 'Đã hủy'
    default: return ''
  }
}

export default function PurchaseOrdersPage() {
  usePageHeader({
    title: 'Phiếu nhập hàng',
  })

  const { showToast } = useToast()
  const [pos, setPos] = useState(INITIAL_POS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0])

  const keyword = search.trim().toLowerCase()
  const filteredPos = pos.filter(
    (p) =>
      (!keyword || p.id.toLowerCase().includes(keyword) || p.supplierName.toLowerCase().includes(keyword)) &&
      (statusFilter === STATUS_OPTIONS[0] || mapStatusToOption(p.status) === statusFilter)
  )

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter(STATUS_OPTIONS[0])
  }

  const { page, totalPages, paginated, startIndex, endIndex, totalCount: pageTotalCount, goPrev, goNext, setPage } =
    usePagination(filteredPos, 10)

  const handleAction = (id: string, label: string) => {
    const po = pos.find(p => p.id === id)
    if (!po) return

    if (label === 'Chốt đơn (ORDERED)') {
      setPos(prev => prev.map(p => p.id === id ? { ...p, status: 'ORDERED' as POStatus, actions: [{ label: 'Ghi nhận nhận hàng', icon: 'inventory_2' }, { label: 'Hủy phiếu', icon: 'cancel' }] } : p))
      showToast(`Đã chuyển phiếu ${id} sang trạng thái ORDERED`)
    } else if (label === 'Ghi nhận nhận hàng') {
      setPos(prev => prev.map(p => p.id === id ? { ...p, status: 'RECEIVED' as POStatus, items: p.items.map(i => ({...i, receivedQuantity: i.orderedQuantity})), actions: [{ label: 'Xem chi tiết', icon: 'visibility' }] } : p))
      showToast(`Đã nhận đủ hàng cho phiếu ${id}. Đã tạo tự động phiếu nhập kho (STOCK_IN).`)
    } else if (label === 'Hủy phiếu') {
      setPos(prev => prev.map(p => p.id === id ? { ...p, status: 'CANCELLED' as POStatus, actions: [{ label: 'Xem chi tiết', icon: 'visibility' }] } : p))
      showToast(`Đã hủy phiếu nhập hàng ${id}`)
    } else {
      showToast(`Đã thực hiện "${label}" cho phiếu ${id}`)
    }
  }

  const totalCount = pos.length
  const orderedCount = pos.filter(p => p.status === 'ORDERED').length
  const draftCount = pos.filter(p => p.status === 'DRAFT').length
  const receivedCount = pos.filter(p => p.status === 'RECEIVED' || p.status === 'PARTIALLY_RECEIVED').length

  const getStatusBadgeProps = (status: POStatus) => {
    switch (status) {
      case 'DRAFT': return { label: 'Nháp (DRAFT)', className: 'bg-slate-100 text-slate-700 border-slate-200' }
      case 'ORDERED': return { label: 'Đã đặt (ORDERED)', className: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'PARTIALLY_RECEIVED': return { label: 'Nhận một phần', className: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'RECEIVED': return { label: 'Đã nhận đủ', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'CANCELLED': return { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    }
  }

  return (
    <>
      <section className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Phiếu nhập hàng</span>
        </nav>
        <div className="flex justify-end">
          <button
            className="flex items-center gap-2 h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            onClick={() => showToast('Tính năng tạo phiếu nhập đang phát triển')}
            type="button"
          >
            <Plus size={16} />
            <span>Tạo phiếu nhập (PO)</span>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tất cả PO</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{totalCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
            <ShoppingCart size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đang đặt hàng</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-700 tabular-nums">{orderedCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600">
            <Clock size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đã nhận hàng</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">{receivedCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bản nháp</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-700 tabular-nums">{draftCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-500">
            <Ban size={20} />
          </div>
        </div>
      </section>

      <section className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Mã phiếu, Nhà cung cấp..." className="relative flex-1 min-w-[300px]" />
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
                <th className="py-4 pl-4 px-3 w-[140px]">Mã Phiếu</th>
                <th className="py-4 px-3 min-w-[220px]">Nhà cung cấp</th>
                <th className="py-4 px-3 min-w-[120px]">Ngày tạo</th>
                <th className="py-4 px-3 min-w-[140px] text-right">Tổng tiền</th>
                <th className="py-4 px-3 min-w-[150px]">Trạng thái</th>
                <th className="py-4 px-3 min-w-[150px]">Tiến độ nhận</th>
                <th className="py-4 pr-4 pl-3 w-10 "></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Không tìm thấy phiếu nhập phù hợp." />
              ) : null}
              {paginated.map((po) => {
                const badge = getStatusBadgeProps(po.status)
                
                // Calculate progress
                const totalOrdered = po.items.reduce((sum, item) => sum + item.orderedQuantity, 0)
                const totalReceived = po.items.reduce((sum, item) => sum + item.receivedQuantity, 0)
                const progressText = `${totalReceived}/${totalOrdered} sp`
                const progressPercent = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0
                
                return (
                  <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 pl-4 px-3 font-semibold text-slate-900">{po.id}</td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-900">{po.supplierName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{po.items.length} loại sản phẩm</div>
                    </td>
                    <td className="py-4 px-3 text-slate-600">
                      {new Date(po.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-4 px-3 text-right font-semibold font-mono text-slate-900">
                      {formatVndShort(po.totalAmount)}
                    </td>
                    <td className="py-4 px-3">
                      <StatusBadge label={badge.label} className={badge.className} />
                    </td>
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-600 w-12 text-right">{progressText}</span>
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full ${progressPercent === 100 ? 'bg-emerald-500' : progressPercent > 0 ? 'bg-amber-500' : 'bg-transparent'}`} style={{ width: `${progressPercent}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 pl-3 text-center">
                      <RowActionsMenu
                        triggerLabel={`Thao tác ${po.id}`}
                        actions={po.actions.map(a => ({
                          ...a,
                          onClick: () => handleAction(po.id, a.label)
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
          unitLabel="phiếu nhập"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </section>
    </>
  )
}
