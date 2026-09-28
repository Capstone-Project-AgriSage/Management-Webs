import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, FilterX, Building2 } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import Pagination from '../../components/ui/Pagination'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import SearchInput from '../../components/ui/SearchInput'
import StatusBadge from '../../components/ui/StatusBadge'
import { usePagination } from '../../hooks/usePagination'
import { suppliers as INITIAL_SUPPLIERS } from '../../data/mockPurchases'

export default function SuppliersPage() {
  usePageHeader({
    title: 'Quản lý Nhà cung cấp',
  })

  const { showToast } = useToast()
  const [suppliers, setSuppliers] = useState(INITIAL_SUPPLIERS)
  const [search, setSearch] = useState('')

  const keyword = search.trim().toLowerCase()
  const filteredSuppliers = suppliers.filter(
    (s) =>
      (!keyword || s.name.toLowerCase().includes(keyword) || s.phone.includes(keyword) || s.contactName.toLowerCase().includes(keyword))
  )

  const handleClearFilters = () => {
    setSearch('')
  }

  const { page, totalPages, paginated, startIndex, endIndex, totalCount: pageTotalCount, goPrev, goNext, setPage } =
    usePagination(filteredSuppliers, 10)

  const handleAction = (id: string, label: string) => {
    const supplier = suppliers.find(s => s.id === id)
    if (!supplier) return

    if (label === 'Ngừng hợp tác') {
      setSuppliers(prev => prev.map(s => s.id === id ? { ...s, status: 'Ngừng hợp tác' as const, actions: s.actions.map(a => a.label === 'Ngừng hợp tác' ? { ...a, label: 'Tiếp tục hợp tác', icon: 'check_circle' } : a) } : s))
      showToast(`Đã ngừng hợp tác với nhà cung cấp ${supplier.name}`)
    } else if (label === 'Tiếp tục hợp tác') {
      setSuppliers(prev => prev.map(s => s.id === id ? { ...s, status: 'Đang hợp tác' as const, actions: s.actions.map(a => a.label === 'Tiếp tục hợp tác' ? { ...a, label: 'Ngừng hợp tác', icon: 'block' } : a) } : s))
      showToast(`Đã mở lại hợp tác với nhà cung cấp ${supplier.name}`)
    } else {
      showToast(`Đã thực hiện "${label}" cho ${supplier.name}`)
    }
  }

  const totalCount = suppliers.length

  return (
    <>
      <section className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Nhà cung cấp</span>
        </nav>
        <div className="flex justify-end">
          <button
            className="flex items-center gap-2 h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            onClick={() => showToast('Tính năng thêm nhà cung cấp đang phát triển')}
            type="button"
          >
            <Plus size={16} />
            <span>Thêm nhà cung cấp</span>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng nhà cung cấp</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{totalCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
            <Building2 size={20} />
          </div>
        </div>
      </section>

      <section className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên, SĐT, Người liên hệ..." className="relative flex-1 min-w-[300px]" />
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
                <th className="py-4 pl-4 px-3 w-24">Mã NCC</th>
                <th className="py-4 px-3 min-w-[220px]">Nhà cung cấp</th>
                <th className="py-4 px-3 min-w-[180px]">Liên hệ</th>
                <th className="py-4 px-3 min-w-[130px]">Trạng thái</th>
                <th className="py-4 pr-4 pl-3 w-10 "></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Không tìm thấy nhà cung cấp phù hợp." />
              ) : null}
              {paginated.map((supplier) => {
                const isInactive = supplier.status === 'Ngừng hợp tác'
                return (
                  <tr key={supplier.id} className={`hover:bg-slate-50/50 transition-colors ${isInactive ? 'opacity-60' : ''}`}>
                    <td className="py-4 pl-4 px-3 font-mono text-slate-500">{supplier.id}</td>
                    <td className="py-4 px-3">
                      <div className="font-semibold text-slate-900">{supplier.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 max-w-[250px] truncate" title={supplier.address}>{supplier.address}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-700">{supplier.contactName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{supplier.phone} - {supplier.email}</div>
                    </td>
                    <td className="py-4 px-3">
                      <StatusBadge 
                        label={supplier.status} 
                        className={isInactive ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}
                      />
                    </td>
                    <td className="py-4 pr-4 pl-3 text-center">
                      <RowActionsMenu
                        triggerLabel={`Thao tác ${supplier.name}`}
                        actions={supplier.actions.map(a => ({
                          ...a,
                          onClick: () => handleAction(supplier.id, a.label)
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
          unitLabel="nhà cung cấp"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </section>
    </>
  )
}
