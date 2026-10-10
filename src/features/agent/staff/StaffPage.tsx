import { useEffect, useState } from 'react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { usePermission } from '@/context/PermissionContext';
import { useToast } from '@/context/ToastContext';
import { staffApi, type StaffResponse } from '@/api/staffApi';
import { describeError } from '@/api/client';

import MemberPermissionEditor from './MemberPermissionEditor'
import ListReportCards from '@/features/agent/reports/ListReportCards'
import { LIST_PAGE_SIZE } from '@/utils/pagination';
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
export default function StaffPage() {
  usePageHeader({ title: 'Quản lý nhân sự', subtitle: 'Nhân viên và quyền truy cập tại đại lý' })
  const [staff, setStaff] = useState<StaffResponse[]>([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])
  const [total, setTotal] = useState(0)
  const [target, setTarget] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const { has } = usePermission()
  const { showToast } = useToast()
  const [savingAi, setSavingAi] = useState<string | null>(null)
  const toggleAiReview = async (member: StaffResponse) => {
    setSavingAi(member.id)
    try {
      const updated = await staffApi.setAiReview(member.id, !member.canReviewAi)
      setStaff(list => list.map(x => (x.id === member.id ? { ...x, canReviewAi: updated.canReviewAi } : x)))
      showToast(updated.canReviewAi ? `Đã cấp quyền duyệt chẩn đoán AI cho ${member.fullName}` : `Đã thu hồi quyền duyệt chẩn đoán AI của ${member.fullName}`, 'success')
    } catch (err) {
      showToast(describeError(err, 'Không đổi được quyền duyệt AI'), 'error')
    } finally {
      setSavingAi(null)
    }
  }
  useEffect(() => {
    let active = true; setBusy(true); setError('')
    staffApi.getStaff({ page, pageSize: LIST_PAGE_SIZE, search: debouncedSearch || undefined, role: role || undefined, status: status as 'ACTIVE' | 'INACTIVE' || undefined }).then(result => { if (active) {
      const lastPage = Math.max(1, result.totalPages)
      if (page > lastPage) { setPage(lastPage); return }
      setStaff(result.items); setTotal(result.totalCount)
    } }).catch(err => { if (active) { setError(describeError(err)); setStaff([]) } }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [page, refreshKey, debouncedSearch, role, status])
  return <div className="space-y-4">
    <ListReportCards title="Tổng hợp nhân sự" totalCount={total} unit="nhân viên" loading={busy} error={!!error} metrics={[
      { label: 'Đang làm việc', value: staff.filter(item => item.memberStatus === 'ACTIVE' && item.status === 'ACTIVE').length },
      { label: 'Ngừng hoạt động', value: staff.filter(item => item.memberStatus !== 'ACTIVE' || item.status !== 'ACTIVE').length },
      { label: 'Nhân viên bán hàng', value: staff.filter(item => item.role === 'SALES_STAFF').length },
    ]} />
    {target && <MemberPermissionEditor key={target} userId={target} onClose={() => setTarget(null)} />}
    <ListToolbar search={{ value: search, onChange: value => { setSearch(value); setPage(1) }, placeholder: 'Tìm theo tên, email, SĐT hoặc mã nhân viên...' }} onClear={() => { setSearch(''); setRole(''); setStatus(''); setPage(1) }}>
      <FilterSelect label="Lọc vai trò" value={role} onChange={value => { setRole(value); setPage(1) }} options={[{ value: '', label: 'Mọi vai trò' }, { value: 'SALES_STAFF', label: 'Nhân viên bán hàng' }, { value: 'DELIVERY_STAFF', label: 'Nhân viên giao hàng' }]} />
      <FilterSelect label="Lọc trạng thái" value={status} onChange={value => { setStatus(value); setPage(1) }} options={[{ value: '', label: 'Mọi trạng thái' }, { value: 'ACTIVE', label: 'Đang hoạt động' }, { value: 'INACTIVE', label: 'Ngừng hoạt động' }]} />
    </ListToolbar>
    <div className="bg-white border rounded-xl p-4">
      <div className="flex justify-between mb-4"><h2 className="font-bold">Danh sách nhân viên</h2><button disabled={busy} onClick={() => setRefreshKey(k => k + 1)}>Làm mới</button></div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {busy && <p role="status">Đang tải…</p>}
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Nhân viên</th><th>Vai trò</th><th>Trạng thái</th><th>Duyệt AI</th><th>Thao tác</th></tr></thead><tbody>
        {staff.map(s => <tr key={s.id} className="border-t"><td className="p-3"><strong>{s.fullName}</strong><div className="text-slate-500">{s.email ?? s.phoneNumber}</div></td><td>{s.role === 'SALES_STAFF' ? 'Sale' : s.role === 'STORE_OWNER' ? 'Owner' : 'Giao hàng'}</td><td>{s.memberStatus === 'ACTIVE' && s.status === 'ACTIVE' ? 'Đang làm việc' : 'Ngừng hoạt động'}</td><td>{(s.role === 'SALES_STAFF' || s.role === 'STORE_OWNER') && (has('STAFF.SET_AI_REVIEW') && s.memberStatus === 'ACTIVE' && s.status === 'ACTIVE' ? <button disabled={savingAi === s.id} className={s.canReviewAi ? 'text-emerald-700 font-semibold' : 'text-slate-500'} onClick={() => void toggleAiReview(s)} aria-pressed={s.canReviewAi}>{s.canReviewAi ? 'Được duyệt' : 'Chưa được duyệt'}</button> : <span className={s.canReviewAi ? 'text-emerald-700' : 'text-slate-400'}>{s.canReviewAi ? 'Được duyệt' : '—'}</span>)}</td><td>{has('PERMISSIONS.DELEGATE') && s.role === 'SALES_STAFF' && s.memberStatus === 'ACTIVE' && s.status === 'ACTIVE' && <button className="text-emerald-700 font-semibold" onClick={() => setTarget(s.id)}>Phân quyền</button>}</td></tr>)}
        {!busy && !staff.length && <tr><td colSpan={5} className="p-5 text-center">Không có nhân viên.</td></tr>}
      </tbody></table></div>
      <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalPages={Math.max(1, Math.ceil(total / LIST_PAGE_SIZE))} totalCount={total} onPageChange={setPage} unitLabel="nhân viên" />
    </div>
  </div>
}
