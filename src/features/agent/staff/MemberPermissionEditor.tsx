import { useCallback, useEffect, useState } from 'react'
import { permissionsApi, type MemberPermissions, type Permission } from '@/api/permissionsApi'
import { ApiError, describeError } from '@/api/client'
import PermissionChecklist from '@/components/auth/PermissionChecklist'
import { usePermission } from '@/context/PermissionContext'

export default function MemberPermissionEditor({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [member, setMember] = useState<MemberPermissions | null>(null)
  const [catalog, setCatalog] = useState<Permission[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [stale, setStale] = useState(false)
  const { refresh } = usePermission()
  const load = useCallback(async () => {
    setBusy(true); setError(''); setMember(null)
    try { const [data, list] = await Promise.all([permissionsApi.member(userId), permissionsApi.catalog()]); setMember(data); setCatalog(list); setSelected(data.effectivePermissions); setReason(''); setStale(false) }
    catch (err) { setError(describeError(err)) } finally { setBusy(false) }
  }, [userId])
  useEffect(() => { void load() }, [load])
  const changed = member ? member.grantablePermissions.filter(code => selected.includes(code) !== member.effectivePermissions.includes(code)) : []
  async function save() {
    if (!member || !reason.trim() || !changed.length || stale) return
    setBusy(true); setError('')
    try {
      const updated = await permissionsApi.setMember(member, changed.map(code => ({ code, granted: selected.includes(code) })), reason.trim())
      setMember(updated); setSelected(updated.effectivePermissions); setReason(''); await refresh()
      window.dispatchEvent(new Event('agrisage-permissions-changed'))
    } catch (err) { setError(describeError(err)); if (err instanceof ApiError && err.status === 409) setStale(true) } finally { setBusy(false) }
  }
  return <section aria-label="Phân quyền nhân viên" className="bg-white border rounded-xl p-5 space-y-4">
    <div className="flex justify-between"><h2 className="font-bold">Phân quyền: {member?.fullName ?? 'Đang tải…'}</h2><button onClick={onClose}>Đóng</button></div>
    <p className="text-sm text-slate-600">Quyền mặc định của Sale và quyền riêng tại đại lý. Chỉ những quyền bạn được phép cấp mới có thể thay đổi.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {member && <PermissionChecklist catalog={catalog.filter(p => p.allowedRoles.includes('SALES_STAFF'))} selected={selected} editable={p => !busy && !stale && member.grantablePermissions.includes(p.code)} onToggle={(code, checked) => setSelected(prev => checked ? [...prev, code] : prev.filter(c => c !== code))} />}
    <label className="block text-sm">Lý do thay đổi <textarea maxLength={500} value={reason} disabled={busy || stale} onChange={e => setReason(e.target.value)} className="block w-full border rounded-lg p-2 mt-1" /></label>
    <div className="flex gap-3"><button disabled={busy || stale || !changed.length || !reason.trim()} onClick={() => void save()} className="bg-emerald-600 text-white px-4 py-2 rounded-lg disabled:opacity-40">Lưu quyền ({changed.length})</button><button disabled={busy} onClick={() => void load()} className="border rounded-lg px-4 py-2">Tải lại cấu hình</button></div>
  </section>
}
