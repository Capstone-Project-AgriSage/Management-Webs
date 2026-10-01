import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, ShoppingCart, Clock } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { usePagination } from '@/hooks/usePagination'
import { purchaseOrders as INITIAL_POS } from '@/features/agent/data/mockPurchases'
import { formatVndShort } from '@/utils/money'
import { formatDateLabel } from '@/utils/date'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'ORDERED', label: 'Đã đặt hàng' },
  { value: 'PARTIALLY_RECEIVED', label: 'Nhận một phần' },
  { value: 'RECEIVED', label: 'Đã nhận đủ' },
  { value: 'CANCELLED', label: 'Đã hủy' }
]

function getStatusBadge(status: string) {
  switch (status) {
    case 'DRAFT': return { label: 'Nháp', className: 'bg-slate-100 text-slate-600 border-slate-200' }
    case 'ORDERED': return { label: 'Đã đặt', className: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'PARTIALLY_RECEIVED': return { label: 'Nhận 1 phần', className: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'RECEIVED': return { label: 'Đã nhận', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'CANCELLED': return { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    default: return { label: status, className: 'bg-slate-100 text-slate-600' }
  }
}

export default function PurchaseOrdersPage() {
  usePageHeader({ title: 'Phiếu nhập hàng', subtitle: 'Quản lý quá trình nhập kho từ NCC' })

  const { showToast } = useToast()
  const [orders] = useState(INITIAL_POS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái')

  const keyword = search.trim().toLowerCase()
  const filtered = orders.filter((o) => {
    const matchesSearch =
      !keyword ||
      o.id.toLowerCase().includes(keyword) ||
      o.supplierName.toLowerCase().includes(keyword)

    const filterObj = STATUS_OPTIONS.find(opt => opt.label === statusFilter)
    const filterVal = filterObj ? filterObj.value : 'ALL'
    const matchesStatus = filterVal === 'ALL' || o.status === filterVal

    return matchesSearch && matchesStatus
  })

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filtered, 10)

  const handleAction = (id: string, label: string) => {
    showToast(`Đã thực hiện: ${label} cho phiếu ${id}`)
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Phiếu nhập hàng</span>
          </nav>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            type="button"
            onClick={() => showToast('Mở màn hình tạo Phiếu nhập hàng')}
          >
            <Plus size={16} />
            <span>Tạo phiếu nhập</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng phiếu nhập</span>
            <div className="p-2.5 bg-slate-100 rounded-lg text-emerald-600">
              <ShoppingCart size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{orders.length}</div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đang chờ nhận</span>
            <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-blue-600 tabular-nums">{orders.filter(o => o.status === 'ORDERED').length}</div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã phiếu, NCC..." className="relative flex-1 max-w-md" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS.map(o => o.label)} className="relative min-w-[200px]" />
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Mã phiếu / Ngày tạo</th>
                <th className="py-3 px-3" scope="col">Nhà cung cấp</th>
                <th className="py-3 px-3 text-right" scope="col">Giá trị (VNĐ)</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-4 text-center w-28" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Không tìm thấy phiếu nhập nào." />
              ) : null}
              {paginated.map((o) => {
                const badge = getStatusBadge(o.status)
                return (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-mono font-semibold text-slate-900">{o.id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{formatDateLabel(o.createdAt)}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-700">{o.supplierName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{o.items.length} mặt hàng</div>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <span className="font-mono font-semibold text-slate-900">{formatVndShort(o.totalAmount)}</span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <RowActionsMenu
                        triggerLabel={`Thao tác ${o.id}`}
                        actions={o.actions.map(a => ({
                          ...a,
                          onClick: () => handleAction(o.id, a.label)
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
          totalCount={totalCount}
          unitLabel="phiếu"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>
    </div>
  )
}
