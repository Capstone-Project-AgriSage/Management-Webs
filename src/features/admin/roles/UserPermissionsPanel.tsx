import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react'
import { staffApi, type StaffResponse } from '@/api/staffApi'
import type { Permission } from '@/api/permissionsApi'
import { describeError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import MemberPermissionEditor from '@/features/agent/staff/MemberPermissionEditor'

export default function UserPermissionsPanel({ catalog, guard, onDirtyChange, onBusyChange, saving }: {
  catalog: Permission[]; guard: (action: () => void) => void; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void; saving: boolean
}) {
  const { user } = useAuth()
  const [search, setSearch] = useState(''), debounced = useDebouncedValue(search)
  const [page, setPage] = useState(1), [pages, setPages] = useState(1), [list, setList] = useState<StaffResponse[]>([])
  const [selected, setSelected] = useState<StaffResponse | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      setLoading(true); setError('')
      try {
        const data = await staffApi.getStaff({ search: debounced || undefined, role: 'SALES_STAFF', status: 'ACTIVE', page, pageSize: 20 }, controller.signal)
        if (controller.signal.aborted) return
      setLoading(true); setError('')
        const active = data.items.filter(item => item.role === 'SALES_STAFF' && item.memberStatus === 'ACTIVE' && item.status === 'ACTIVE' && item.id !== user?.id)
        setList(active); setPages(Math.max(1, data.totalPages)); setSelected(current => current ?? active[0] ?? null)
      } catch (err) { if (!controller.signal.aborted) { setError(describeError(err)); setList([]) } }
      finally { if (!controller.signal.aborted) setLoading(false) }
    })
    return () => controller.abort()
  }, [debounced, page, user?.id, retry])
  const options = selected && !list.some(item => item.id === selected.id) ? [selected, ...list] : list
  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-start gap-3"><Users size={20} className="mt-0.5 text-emerald-600" /><div><h2 className="text-sm font-semibold text-slate-900">Chọn người dùng</h2><p className="mt-1 text-xs leading-5 text-slate-500">Quản lý quyền riêng cho nhân viên bán hàng đang hoạt động trong cửa hàng. Tài khoản và vai trò khác được quản lý theo chính sách hiện có.</p></div></div><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="relative flex-1"><span className="mb-1.5 block text-xs text-slate-500">Tìm nhân viên</span><Search size={16} className="absolute bottom-3 left-3 text-slate-400" /><input value={search} onChange={e => { setSearch(e.target.value.slice(0, 100)); setPage(1) }} placeholder="Tên, email hoặc số điện thoại…" className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" /></label><label className="flex-1 text-xs text-slate-500">Người dùng<select aria-label="Người dùng" value={selected?.id ?? ''} disabled={saving || loading || !options.length} onChange={e => { const next = options.find(item => item.id === e.target.value); if (next && next.id !== selected?.id) guard(() => setSelected(next)) }} className="mt-1.5 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 disabled:opacity-50">{!selected && <option value="">{loading ? 'Đang tải…' : 'Chọn nhân viên'}</option>}{options.map(item => <option key={item.id} value={item.id}>{item.fullName}{item.email ? ` · ${item.email}` : ''}</option>)}</select></label><div className="flex min-h-10 items-center justify-end gap-2"><button type="button" aria-label="Trang nhân viên trước" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft size={17} /></button><span className="text-xs tabular-nums text-slate-500">{page}/{pages}</span><button type="button" aria-label="Trang nhân viên tiếp" disabled={loading || page >= pages} onClick={() => setPage(p => p + 1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight size={17} /></button></div></div>{error && <div role="alert" className="mt-3 text-sm text-rose-700">{error}<button type="button" onClick={() => setRetry(v => v + 1)} className="ml-3 underline">Thử lại</button></div>}{!loading && !list.length && !error && <p role="status" className="mt-3 text-xs text-slate-500">Không có nhân viên phù hợp với tìm kiếm trên trang này.</p>}</div>
    {selected ? <MemberPermissionEditor key={selected.id} userId={selected.id} permissionCatalog={catalog} onDirtyChange={onDirtyChange} onBusyChange={onBusyChange} /> : !loading && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><Users size={32} className="mx-auto mb-3 text-slate-300" /><h3 className="text-sm font-medium text-slate-700">Chưa có người dùng để phân quyền</h3><p className="mt-2 text-xs text-slate-500">Chọn một nhân viên bán hàng đang hoạt động hoặc điều chỉnh tìm kiếm.</p></div>}
  </div>
}
