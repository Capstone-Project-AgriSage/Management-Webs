import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Users, Plus, RefreshCw } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { usePagination } from '@/hooks/usePagination'
import { staffMembers as INITIAL_STAFF } from '@/features/agent/data/mockStaff'

export default function StaffPage() {
  usePageHeader({ title: 'Quản lý nhân sự', subtitle: 'Danh sách và phân quyền nhân viên' })
  const { showToast } = useToast()
  const [staff] = useState(INITIAL_STAFF)
  const [search, setSearch] = useState('')

  const keyword = search.trim().toLowerCase()
  const filtered = staff.filter((s) =>
    !keyword || s.name.toLowerCase().includes(keyword) || s.phone.toLowerCase().includes(keyword)
  )

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(filtered, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Nhân sự</span>
        </nav>
        <button
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          type="button"
          onClick={() => showToast('Mở form thêm nhân sự mới')}
        >
          <Plus size={16} />
          <span>Thêm nhân sự</span>
        </button>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên, số điện thoại..." className="relative flex-1 max-w-md" />
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Họ tên / SĐT</th>
                <th className="py-3 px-3" scope="col">Vai trò</th>
                <th className="py-3 px-3" scope="col">Ngày tham gia</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-4 text-center w-28" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? <EmptyTableRow colSpan={5} message="Không có nhân sự nào." /> : null}
              {paginated.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="font-mono text-xs text-slate-500 mt-0.5">{s.phone}</div>
                  </td>
                  <td className="py-4 px-3">
                    <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">{s.role}</span>
                  </td>
                  <td className="py-4 px-3 text-slate-600 text-xs">{s.joinedAt.substring(0, 10)}</td>
                  <td className="py-4 px-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${s.status === 'Đang làm việc' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{s.status}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <RowActionsMenu triggerLabel="Thao tác" actions={s.actions.map(a => ({ ...a, onClick: () => showToast(`Đã thực hiện: ${a.label}`) }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="nhân sự" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
