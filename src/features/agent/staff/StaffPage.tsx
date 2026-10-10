import { useEffect, useState } from 'react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { usePermission } from '@/context/PermissionContext'
import { staffApi, type StaffResponse } from '@/api/staffApi'
import { describeError } from '@/api/client'
import Pagination from '@/components/ui/Pagination'
import MemberPermissionEditor from './MemberPermissionEditor'
import ListReportCards from '@/features/agent/reports/ListReportCards'
export default function StaffPage() {
  usePageHeader({ title: 'Quản lý nhân sự', subtitle: 'Nhân viên và quyền truy cập tại đại lý' })
  const [staff, setStaff] = useState<StaffResponse[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [target, setTarget] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const { has } = usePermission()
  useEffect(() => {
    let active = true; setBusy(true); setError('')
    staffApi.getStaff({ page, pageSize: 15 }).then(result => { if (active) { setStaff(result.items); setTotal(result.totalCount) } }).catch(err => { if (active) { setError(describeError(err)); setStaff([]) } }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [page, refreshKey])
  return <div className="space-y-4">
    <ListReportCards title="Tổng hợp nhân sự" totalCount={total} unit="nhân viên" loading={busy} error={!!error} metrics={[
      { label: 'Đang làm việc', value: staff.filter(item => item.memberStatus === 'ACTIVE' && item.status === 'ACTIVE').length },
      { label: 'Ngừng hoạt động', value: staff.filter(item => item.memberStatus !== 'ACTIVE' || item.status !== 'ACTIVE').length },
      { label: 'Nhân viên bán hàng', value: staff.filter(item => item.role === 'SALES_STAFF').length },
    ]} />
    {target && <MemberPermissionEditor key={target} userId={target} onClose={() => setTarget(null)} />}
    <div className="bg-white border rounded-xl p-4">
      <div className="flex justify-between mb-4"><h2 className="font-bold">Danh sách nhân viên</h2><button disabled={busy} onClick={() => setRefreshKey(k => k + 1)}>Làm mới</button></div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {busy && <p role="status">Đang tải…</p>}
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Nhân viên</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        {staff.map(s => <tr key={s.id} className="border-t"><td className="p-3"><strong>{s.fullName}</strong><div className="text-slate-500">{s.email ?? s.phoneNumber}</div></td><td>{s.role === 'SALES_STAFF' ? 'Sale' : s.role === 'STORE_OWNER' ? 'Owner' : 'Giao hàng'}</td><td>{s.memberStatus === 'ACTIVE' && s.status === 'ACTIVE' ? 'Đang làm việc' : 'Ngừng hoạt động'}</td><td>{has('PERMISSIONS.DELEGATE') && s.role === 'SALES_STAFF' && s.memberStatus === 'ACTIVE' && s.status === 'ACTIVE' && <button className="text-emerald-700 font-semibold" onClick={() => setTarget(s.id)}>Phân quyền</button>}</td></tr>)}
        {!busy && !staff.length && <tr><td colSpan={4} className="p-5 text-center">Không có nhân viên.</td></tr>}
      </tbody></table></div>
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / 15))} totalCount={total} startIndex={total ? (page - 1) * 15 + 1 : 0} endIndex={Math.min(page * 15, total)} goPrev={() => setPage(p => Math.max(1, p - 1))} goNext={() => setPage(p => p + 1)} setPage={setPage} unitLabel="nhân viên" />
    </div>
  </div>
}
