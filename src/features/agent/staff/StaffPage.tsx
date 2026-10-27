import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { usePermission } from '@/context/PermissionContext';
import { useToast } from '@/context/ToastContext';
import { staffApi, type StaffResponse, type StaffRole, type StaffStatus } from '@/api/staffApi';
import { describeError } from '@/api/client';
import { useAuth } from '@/context/AuthContext'
import RowActionsMenu, { type RowAction } from '@/components/ui/RowActionsMenu'
import ConfirmModal from '@/components/ui/ConfirmModal'
import StaffFormModal, { type StaffFormMode } from './StaffFormModal'

import MemberPermissionEditor from './MemberPermissionEditor'
import ListReportCards from '@/features/agent/reports/ListReportCards'
import { LIST_PAGE_SIZE } from '@/utils/pagination';
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import ServerPagination from '@/components/ui/ServerPagination'
export default function StaffPage() {
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
  const { currentRole, user } = useAuth()
  // The admin opens this page as "Quản lý tài khoản" and also manages the store owner's account.
  usePageHeader(currentRole === 'admin'
    ? { title: 'Quản lý tài khoản', subtitle: 'Tài khoản chủ cửa hàng và nhân viên của hệ thống' }
    : { title: 'Quản lý nhân sự', subtitle: 'Nhân viên và quyền truy cập tại đại lý' })
  const { showToast } = useToast()
  const [form, setForm] = useState<{ mode: StaffFormMode; member?: StaffResponse } | null>(null)
  const [confirmation, setConfirmation] = useState<{ kind: 'lock' | 'unlock' | 'remove'; member: StaffResponse } | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const roles: { value: StaffRole; label: string }[] = [
    ...(currentRole === 'admin' ? [{ value: 'STORE_OWNER' as const, label: 'Chủ cửa hàng' }] : []),
    { value: 'SALES_STAFF', label: 'Nhân viên bán hàng' },
    { value: 'DELIVERY_STAFF', label: 'Nhân viên giao hàng' },
  ]
  const canManage = (member: StaffResponse) => currentRole === 'admin' || (currentRole === 'agent' && (member.role === 'SALES_STAFF' || member.role === 'DELIVERY_STAFF'))
  const saved = (message: string) => { setForm(null); setRefreshKey(key => key + 1); showToast(message, 'success') }
  const confirmAction = async () => {
    if (!confirmation || actionBusy) return
    setActionBusy(true)
    try {
      if (confirmation.kind === 'lock') await staffApi.lock(confirmation.member.id)
      else if (confirmation.kind === 'unlock') await staffApi.unlock(confirmation.member.id)
      else await staffApi.remove(confirmation.member.id)
      showToast(confirmation.kind === 'lock' ? 'Đã khóa tài khoản nhân viên' : confirmation.kind === 'unlock' ? 'Đã mở khóa và kích hoạt nhân viên' : 'Đã ghi nhận nhân viên nghỉ việc', 'success')
      setConfirmation(null)
      setRefreshKey(key => key + 1)
    } catch (err) { showToast(describeError(err, 'Không cập nhật được nhân viên'), 'error') }
    finally { setActionBusy(false) }
  }
  const rowActions = (member: StaffResponse): RowAction[] => {
    const actions: RowAction[] = [{ label: 'Xem thông tin', permissionCodes: ['STAFF.READ_GET'], onClick: () => setForm({ mode: 'view', member }) }]
    const active = member.memberStatus === 'ACTIVE' && member.status === 'ACTIVE'
    if (has('PERMISSIONS.DELEGATE') && member.role === 'SALES_STAFF' && active) actions.push({ label: 'Phân quyền', onClick: () => setTarget(member.id) })
    if (!canManage(member)) return actions
    actions.push({ label: 'Cập nhật thông tin', permissionCodes: ['STAFF.UPDATE', 'STAFF.READ_GET'], onClick: () => setForm({ mode: 'edit', member }) })
    if (member.id !== user?.id) {
      actions.push({ label: 'Đặt lại mật khẩu', permissionCodes: ['STAFF.RESET_PASSWORD'], onClick: () => setForm({ mode: 'reset-password', member }) })
      if (member.status !== 'LOCKED') actions.push({ label: 'Khóa tài khoản', permissionCodes: ['STAFF.LOCK'], tone: 'danger', onClick: () => setConfirmation({ kind: 'lock', member }) })
      if (member.memberStatus !== 'LEFT') actions.push({ label: 'Cho nhân viên nghỉ việc', permissionCodes: ['STAFF.DELETE'], tone: 'danger', onClick: () => setConfirmation({ kind: 'remove', member }) })
    }
    if (!active) actions.push({ label: member.memberStatus === 'LEFT' ? 'Kích hoạt lại nhân viên' : 'Mở khóa / kích hoạt', permissionCodes: ['STAFF.UNLOCK'], onClick: () => setConfirmation({ kind: 'unlock', member }) })
    return actions
  }
  useEffect(() => {
    const controller = new AbortController()
    // Skip the discarded StrictMode effect before starting a request.
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return
      setBusy(true); setError('')
      return staffApi.getStaff({ page, pageSize: LIST_PAGE_SIZE, search: debouncedSearch || undefined, role: role || undefined, status: status as StaffStatus || undefined }, controller.signal).then(result => { if (!controller.signal.aborted) {
      const lastPage = Math.max(1, result.totalPages)
      if (page > lastPage) { setPage(lastPage); return }
      setStaff(result.items); setTotal(result.totalCount)
      } }).catch(err => { if (!controller.signal.aborted) { setError(describeError(err)); setStaff([]) } }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    })
    return () => controller.abort()
  }, [page, refreshKey, debouncedSearch, role, status])
  return <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
    <ListReportCards title="Tổng hợp nhân sự" totalCount={total} unit="nhân viên" loading={busy} error={!!error} metrics={[
      { label: 'Đang làm việc', value: staff.filter(item => item.memberStatus === 'ACTIVE' && item.status === 'ACTIVE').length },
      { label: 'Ngừng hoạt động', value: staff.filter(item => item.memberStatus !== 'ACTIVE' || item.status !== 'ACTIVE').length },
      { label: 'Nhân viên bán hàng', value: staff.filter(item => item.role === 'SALES_STAFF').length },
    ]} />
    {target && <MemberPermissionEditor key={target} userId={target} onClose={() => setTarget(null)} />}
    {form && <StaffFormModal key={`${form.mode}:${form.member?.id ?? 'new'}`} {...form} roles={roles} onClose={() => setForm(null)} onSaved={saved} />}
    <ConfirmModal open={!!confirmation} title={confirmation?.kind === 'remove' ? 'Cho nhân viên nghỉ việc' : confirmation?.kind === 'lock' ? 'Khóa tài khoản nhân viên' : 'Kích hoạt nhân viên'} message={confirmation && <p>{confirmation.member.fullName}: {confirmation.kind === 'remove' ? 'Ghi nhận nghỉ việc và khóa tài khoản. Lịch sử giao dịch được giữ lại.' : confirmation.kind === 'lock' ? 'Nhân viên sẽ không thể đăng nhập bằng tài khoản này.' : 'Tài khoản được mở khóa và nhân viên trở lại trạng thái đang làm việc.'}</p>} confirmLabel="Xác nhận" tone={confirmation?.kind === 'unlock' ? 'primary' : 'danger'} busy={actionBusy} onClose={() => setConfirmation(null)} onConfirm={() => void confirmAction()} />
    <ListToolbar search={{ value: search, onChange: value => { setSearch(value.slice(0, 100)); setPage(1) }, placeholder: 'Tìm theo tên, email, SĐT hoặc mã nhân viên...' }} onClear={() => { setSearch(''); setRole(''); setStatus(''); setPage(1) }} actions={<>
      <button type="button" disabled={busy} onClick={() => setRefreshKey(k => k + 1)} className="inline-flex items-center gap-2 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm disabled:opacity-50">
        <RefreshCw size={16} aria-hidden="true" className={busy ? 'animate-spin' : ''} /> Làm mới
      </button>
      {has('STAFF.CREATE') && <button type="button" onClick={() => setForm({ mode: 'create' })} className="inline-flex items-center gap-2 px-4 rounded-[10px] bg-primary-dark text-white text-sm font-semibold"><Plus size={16} aria-hidden="true" /> Thêm nhân viên</button>}
    </>}>
      <FilterSelect label="Vai trò" value={role} onChange={value => { setRole(value); setPage(1) }} options={[{ value: '', label: 'Mọi vai trò' }, { value: 'STORE_OWNER', label: 'Chủ cửa hàng' }, { value: 'SALES_STAFF', label: 'Nhân viên bán hàng' }, { value: 'DELIVERY_STAFF', label: 'Nhân viên giao hàng' }]} />
      <FilterSelect label="Trạng thái tài khoản" value={status} onChange={value => { setStatus(value); setPage(1) }} options={[{ value: '', label: 'Mọi trạng thái' }, { value: 'ACTIVE', label: 'Đang hoạt động' }, { value: 'INACTIVE', label: 'Ngừng hoạt động' }, { value: 'SUSPENDED', label: 'Tạm đình chỉ' }, { value: 'LOCKED', label: 'Bị khóa' }]} />
    </ListToolbar>
    <section aria-label="Danh sách nhân viên" className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      {error && <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="overflow-x-auto">
        <table aria-busy={busy} className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
            <tr>{['Nhân viên', 'Vai trò', 'Trạng thái', 'Thao tác'].map(label => <th key={label} scope="col" className="py-3 px-4 font-medium">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/50">
            {busy && staff.length === 0 ? <EmptyTableRow colSpan={4} message="Đang tải…" className="text-slate-500 animate-pulse" /> : staff.map(s => {
              const active = s.memberStatus === 'ACTIVE' && s.status === 'ACTIVE'
              return <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                <td className="py-3 px-4"><div className="font-semibold text-slate-900">{s.fullName}</div><div className="mt-1 text-xs text-slate-500">{s.email ?? s.phoneNumber}</div></td>
                <td className="py-3 px-4 whitespace-nowrap">{s.role === 'SALES_STAFF' ? 'Nhân viên bán hàng' : s.role === 'STORE_OWNER' ? 'Chủ cửa hàng' : 'Nhân viên giao hàng'}</td>
                <td className="py-3 px-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{active ? 'Đang làm việc' : 'Ngừng hoạt động'}</span></td>
                <td className="py-3 px-4 whitespace-nowrap"><RowActionsMenu triggerLabel={`Thao tác nhân viên ${s.fullName}`} actions={rowActions(s)} /></td>
              </tr>
            })}
            {!busy && !staff.length && <EmptyTableRow colSpan={4} message="Không có nhân viên." />}
          </tbody>
        </table>
      </div>
      <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalPages={Math.max(1, Math.ceil(total / LIST_PAGE_SIZE))} totalCount={total} onPageChange={setPage} unitLabel="nhân viên" />
    </section>
  </div>
}
