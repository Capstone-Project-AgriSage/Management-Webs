import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, FilterX, Users, UserCheck, UserX, ShieldAlert } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import Pagination from '../../components/ui/Pagination'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import SearchInput from '../../components/ui/SearchInput'
import FilterSelect from '../../components/ui/FilterSelect'
import StatusBadge from '../../components/ui/StatusBadge'
import { usePagination } from '../../hooks/usePagination'
import { staffMembers as INITIAL_STAFF } from '../../data/mockStaff'
import type { StaffStatus } from '../../types'

const ROLE_OPTIONS = ['Tất cả vai trò', 'Store Owner', 'Sales Staff', 'Delivery Staff']
const STATUS_OPTIONS = ['Tất cả trạng thái', 'Đang làm việc', 'Đã khóa']

export default function StaffManagementPage() {
  usePageHeader({
    title: 'Quản lý nhân viên',
  })

  const { showToast } = useToast()
  const [staff, setStaff] = useState(INITIAL_STAFF)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState(ROLE_OPTIONS[0])
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0])

  const keyword = search.trim().toLowerCase()
  const filteredStaff = staff.filter(
    (s) =>
      (!keyword || s.name.toLowerCase().includes(keyword) || s.phone.includes(keyword)) &&
      (roleFilter === ROLE_OPTIONS[0] || s.role === roleFilter) &&
      (statusFilter === STATUS_OPTIONS[0] || s.status === statusFilter),
  )

  const handleClearFilters = () => {
    setSearch('')
    setRoleFilter(ROLE_OPTIONS[0])
    setStatusFilter(STATUS_OPTIONS[0])
  }

  const { page, totalPages, paginated, startIndex, endIndex, totalCount: pageTotalCount, goPrev, goNext, setPage } =
    usePagination(filteredStaff, 10)

  const handleAction = (id: string, label: string) => {
    const person = staff.find(s => s.id === id)
    if (!person) return

    if (label === 'Khóa tài khoản') {
      setStaff(prev => prev.map(s => s.id === id ? { ...s, status: 'Đã khóa' as StaffStatus, actions: s.actions.map(a => a.label === 'Khóa tài khoản' ? { ...a, label: 'Mở khóa tài khoản', icon: 'lock_open' } : a) } : s))
      showToast(`Đã khóa tài khoản nhân viên ${person.name}`)
    } else if (label === 'Mở khóa tài khoản') {
      setStaff(prev => prev.map(s => s.id === id ? { ...s, status: 'Đang làm việc' as StaffStatus, actions: s.actions.map(a => a.label === 'Mở khóa tài khoản' ? { ...a, label: 'Khóa tài khoản', icon: 'lock' } : a) } : s))
      showToast(`Đã mở khóa tài khoản nhân viên ${person.name}`)
    } else {
      showToast(`Đã thực hiện "${label}" cho nhân viên ${person.name}`)
    }
  }

  const toggleAiReview = (id: string, currentValue: boolean) => {
    const person = staff.find(s => s.id === id)
    if (!person) return
    
    // Chỉ cho phép Owner và Sales Staff có quyền này
    if (person.role === 'Delivery Staff') {
      showToast('Không thể cấp quyền duyệt AI cho nhân viên giao hàng')
      return
    }

    setStaff(prev => prev.map(s => s.id === id ? { ...s, can_review_ai: !currentValue } : s))
    showToast(`Đã ${currentValue ? 'thu hồi' : 'cấp'} quyền duyệt AI cho ${person.name}`)
  }

  const totalCount = staff.length
  const activeCount = staff.filter((s) => s.status === 'Đang làm việc').length
  const lockedCount = staff.filter((s) => s.status === 'Đã khóa').length
  const aiReviewersCount = staff.filter((s) => s.can_review_ai).length

  return (
    <>
      <section className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Nhân sự</span>
        </nav>
        <div className="flex justify-end">
          <button
            className="flex items-center gap-2 h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            onClick={() => showToast('Tính năng thêm nhân viên mới đang phát triển')}
            type="button"
          >
            <Plus size={16} />
            <span>Thêm nhân viên</span>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng nhân viên</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{totalCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
            <Users size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đang làm việc</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">{activeCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
            <UserCheck size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đã khóa</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-600 tabular-nums">{lockedCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-rose-50 rounded-lg text-rose-500">
            <UserX size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Được duyệt AI</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-indigo-700 tabular-nums">{aiReviewersCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-600">
            <ShieldAlert size={20} />
          </div>
        </div>
      </section>

      <section className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên, SĐT..." className="relative flex-1 min-w-[240px]" />
          <FilterSelect value={roleFilter} onChange={setRoleFilter} options={ROLE_OPTIONS} className="relative min-w-[180px]" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[180px]" />
          <button
            className="h-9 px-3 text-slate-500 hover:text-slate-900 text-xs font-medium flex items-center gap-1 transition-colors"
            onClick={handleClearFilters}
            type="button"
          >
            <FilterX size={14} />
            <span>Đặt lại</span>
          </button>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-4 pl-4 px-3 w-24">Mã NV</th>
                <th className="py-4 px-3 min-w-[200px]">Họ tên & SĐT</th>
                <th className="py-4 px-3 min-w-[140px]">Phân quyền</th>
                <th className="py-4 px-3 min-w-[130px]">Trạng thái</th>
                <th className="py-4 px-3 text-center min-w-[120px]">Quyền duyệt AI</th>
                <th className="py-4 pr-4 pl-3 w-10 "></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không tìm thấy nhân viên phù hợp." />
              ) : null}
              {paginated.map((person) => {
                const getRoleBadge = (r: string) => {
                  switch (r) {
                    case 'Store Owner': return 'bg-purple-100 text-purple-700 border-purple-200'
                    case 'Sales Staff': return 'bg-blue-100 text-blue-700 border-blue-200'
                    case 'Delivery Staff': return 'bg-amber-100 text-amber-700 border-amber-200'
                    default: return 'bg-slate-100 text-slate-700'
                  }
                }
                const isLocked = person.status === 'Đã khóa'
                return (
                  <tr key={person.id} className={`hover:bg-slate-50/50 transition-colors ${isLocked ? 'opacity-60' : ''}`}>
                    <td className="py-4 pl-4 px-3 font-mono text-slate-500">{person.id}</td>
                    <td className="py-4 px-3">
                      <div className="font-semibold text-slate-900">{person.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{person.phone}</div>
                    </td>
                    <td className="py-4 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getRoleBadge(person.role)}`}>
                        {person.role}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      <StatusBadge 
                        label={person.status} 
                        className={isLocked ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}
                      />
                    </td>
                    <td className="py-4 px-3 text-center">
                      <button
                        onClick={() => toggleAiReview(person.id, person.can_review_ai)}
                        disabled={person.role === 'Delivery Staff'}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${person.can_review_ai ? 'bg-emerald-500' : 'bg-slate-200'} ${person.role === 'Delivery Staff' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        role="switch"
                        aria-checked={person.can_review_ai}
                      >
                        <span className="sr-only">Toggle AI Review</span>
                        <span aria-hidden="true" className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${person.can_review_ai ? 'translate-x-2' : '-translate-x-2'}`} />
                      </button>
                    </td>
                    <td className="py-4 pr-4 pl-3 text-center">
                      <RowActionsMenu
                        triggerLabel={`Thao tác ${person.name}`}
                        actions={person.actions.map(a => ({
                          ...a,
                          onClick: () => handleAction(person.id, a.label)
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
          unitLabel="nhân viên"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </section>
    </>
  )
}
