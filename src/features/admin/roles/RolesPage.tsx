import { useCallback, useEffect, useState } from 'react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { permissionsApi, type Permission, type RolePermissions } from '@/api/permissionsApi';
import { ApiError, describeError } from '@/api/client';
import PermissionChecklist from '@/components/auth/PermissionChecklist'
import FilterSelect from '@/components/ui/FilterSelect'
import { usePermission } from '@/context/PermissionContext';
export default function RolesPage() {
  usePageHeader({ title: 'Phân quyền', subtitle: 'Cấu hình quyền mặc định theo vai trò' })
  const [roles, setRoles] = useState<RolePermissions[]>([])
  const [catalog, setCatalog] = useState<Permission[]>([])
  const [roleId, setRoleId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [stale, setStale] = useState(false)
  const { refresh } = usePermission()
  const role = roles.find(r => r.id === roleId)
  const load = useCallback(async (selectedRoleId = '') => {
    setBusy(true); setError('')
    try { const [rs, cs] = await Promise.all([permissionsApi.roles(), permissionsApi.catalog()]); setRoles(rs); setCatalog(cs); const current = rs.find(r => r.id === selectedRoleId) ?? rs[0]; setRoleId(current?.id ?? ''); setSelected(current?.permissionCodes ?? []); setStale(false); setReason('') }
    catch (err) { setError(describeError(err)) } finally { setBusy(false) }
  }, [])
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void load() }); return () => { active = false } }, [load])
  const dirty = role && (selected.length !== role.permissionCodes.length || selected.some(c => !role.permissionCodes.includes(c)))
  async function save() {
    if (!role || !role.editable || !reason.trim() || !dirty || stale) return
    setBusy(true); setError('')
    try { const updated = await permissionsApi.setRole(role, selected, reason.trim()); setRoles(prev => prev.map(r => r.id === updated.id ? updated : r)); setSelected(updated.permissionCodes); setReason(''); await refresh(); window.dispatchEvent(new Event('agrisage-permissions-changed')) }
    catch (err) { setError(describeError(err)); if (err instanceof ApiError && err.status === 409) setStale(true) } finally { setBusy(false) }
  }
  return <div className="bg-white border rounded-xl p-5 space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect label="Vai trò" value={roleId} disabled={busy || roles.length === 0} className="relative min-w-[220px]" options={roles.map(current => ({ value: current.id, label: current.name }))} onChange={value => { const next = roles.find(current => current.id === value); setRoleId(value); setSelected(next?.permissionCodes ?? []); setReason(''); setStale(false); setError('') }} />
      <button type="button" disabled={busy} onClick={() => void load(roleId)} className="min-h-[42px] rounded-[10px] border border-slate-200 px-4 text-sm text-slate-700 disabled:opacity-50">Tải lại cấu hình</button>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {role && <>
      <PermissionChecklist catalog={catalog.filter(p => p.allowedRoles.includes(role.code))} selected={selected} editable={p => role.editable && !busy && !stale && p.allowedRoles.includes(role.code)} onToggle={(code, checked) => setSelected(prev => checked ? [...prev, code] : prev.filter(c => c !== code))} />
      {role.editable && <><label className="block text-sm">Lý do thay đổi <textarea maxLength={500} value={reason} disabled={busy || stale} onChange={e => setReason(e.target.value)} className="block w-full border rounded-lg p-2 mt-1" /></label><button disabled={busy || stale || !dirty || !reason.trim()} onClick={() => void save()} className="bg-emerald-600 text-white px-4 py-2 rounded-lg disabled:opacity-40">Lưu thay đổi</button></>}
    </>}
  </div>
}
