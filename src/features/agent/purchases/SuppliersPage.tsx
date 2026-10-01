import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, Building2, CheckCircle2, Phone, Mail, MapPin } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import SearchInput from '@/components/ui/SearchInput'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { usePagination } from '@/hooks/usePagination'
import { suppliers as INITIAL_SUPPLIERS } from '@/features/agent/data/mockPurchases'

export default function SuppliersPage() {
  usePageHeader({ title: 'Nhà cung cấp', subtitle: 'Danh sách và đánh giá đối tác cung ứng' })

  const { showToast } = useToast()
  const [suppliers] = useState(INITIAL_SUPPLIERS)
  const [search, setSearch] = useState('')

  const keyword = search.trim().toLowerCase()
  const filtered = suppliers.filter((s) =>
    !keyword ||
    s.name.toLowerCase().includes(keyword) ||
    s.contactName.toLowerCase().includes(keyword) ||
    s.phone.toLowerCase().includes(keyword)
  )

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filtered, 10)

  const handleAction = (id: string, label: string) => {
    showToast(`Đã thực hiện: ${label} cho NCC ${id}`)
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Nhà cung cấp</span>
          </nav>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            type="button"
            onClick={() => showToast('Mở form thêm NCC mới')}
          >
            <Plus size={16} />
            <span>Thêm nhà cung cấp</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng đối tác</span>
            <div className="p-2.5 bg-slate-100 rounded-lg text-emerald-600">
              <Building2 size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{suppliers.length}</div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đang hợp tác</span>
            <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600 tabular-nums">{suppliers.filter(s => s.status === 'Đang hợp tác').length}</div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên NCC, người liên hệ, số điện thoại..." className="relative flex-1 max-w-md" />
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Tên / Mã NCC</th>
                <th className="py-3 px-3" scope="col">Liên hệ</th>
                <th className="py-3 px-3" scope="col">Địa chỉ</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-4 text-center w-28" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Không tìm thấy nhà cung cấp nào." />
              ) : null}
              {paginated.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="font-mono text-xs text-slate-500 mt-0.5">{s.id}</div>
                  </td>
                  <td className="py-4 px-3">
                    <div className="font-medium text-slate-700">{s.contactName}</div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 font-mono">
                      <Phone size={12} /> {s.phone}
                    </div>
                    {s.email && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                        <Mail size={12} /> {s.email}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex items-start gap-1 text-slate-600">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                      <span className="line-clamp-2 max-w-[250px]" title={s.address}>{s.address}</span>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      s.status === 'Đang hợp tác' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <RowActionsMenu
                      triggerLabel={`Thao tác ${s.name}`}
                      actions={s.actions.map(a => ({
                        ...a,
                        onClick: () => handleAction(s.id, a.label)
                      }))}
                    />
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
          unitLabel="nhà cung cấp"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>
    </div>
  )
}
