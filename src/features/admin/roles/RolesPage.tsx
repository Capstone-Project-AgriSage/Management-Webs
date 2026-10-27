import { useCallback, useEffect, useRef, useState } from 'react'
import { Info, LockKeyhole, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { permissionsApi, type Permission, type RolePermissions } from '@/api/permissionsApi'
import { ApiError, describeError } from '@/api/client'
import PermissionChecklist from '@/components/auth/PermissionChecklist'
import PermissionSaveBar from '@/components/auth/PermissionSaveBar'
import UserPermissionsPanel from './UserPermissionsPanel'
import { usePermission } from '@/context/PermissionContext'
import { useToast } from '@/context/ToastContext'
import { usePermissionDraftGuard } from '@/hooks/usePermissionDraftGuard'

export default function RolesPage() {
  usePageHeader({ title: 'Phân quyền', subtitle: 'Quản lý quyền truy cập theo vai trò và người dùng' })
  const [tab, setTab] = useState<'roles' | 'users'>('roles')
  const [roles, setRoles] = useState<RolePermissions[]>([]), [catalog, setCatalog] = useState<Permission[]>([])
  const [roleId, setRoleId] = useState(''), [selected, setSelected] = useState<string[]>([]), [reason, setReason] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(true), [stale, setStale] = useState(false)
  const [userDirty, setUserDirty] = useState(false), [userBusy, setUserBusy] = useState(false)
  const sequence = useRef(0)
  const invalidate = useCallback(() => { ++sequence.current }, [])
  const { refresh } = usePermission(), { showToast } = useToast()
  const role = roles.find(r => r.id === roleId)
  const changed = role ? new Set([...role.permissionCodes, ...selected].filter(code => role.permissionCodes.includes(code) !== selected.includes(code))).size : 0
  const { guard, dialog } = usePermissionDraftGuard(tab === 'roles' ? changed > 0 : userDirty)
  const load = useCallback(async (selectedRoleId = '') => {
    const request = ++sequence.current
    setBusy(true); setError('')
    try {
      const [rs, cs] = await Promise.all([permissionsApi.roles(), permissionsApi.catalog()])
      if (sequence.current !== request) return
      setRoles(rs); setCatalog(cs)
      const current = rs.find(r => r.id === selectedRoleId) ?? rs[0]
      setRoleId(current?.id ?? ''); setSelected(current?.permissionCodes ?? []); setStale(false); setReason('')
    } catch (err) { if (sequence.current === request) setError(describeError(err)) }
    finally { if (sequence.current === request) setBusy(false) }
  }, [])
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void load() }); return () => { active = false; invalidate() } }, [load, invalidate])
  async function save() {
    if (!role || !role.editable || !reason.trim() || !changed || stale || busy) return
    setBusy(true); setError('')
    try {
      const updated = await permissionsApi.setRole(role, selected, reason.trim())
      setRoles(prev => prev.map(r => r.id === updated.id ? updated : r)); setSelected(updated.permissionCodes); setReason('')
      showToast('Đã lưu cấu hình quyền vai trò', 'success')
      await refresh(); window.dispatchEvent(new Event('agrisage-permissions-changed'))
    } catch (err) { setError(describeError(err)); if (err instanceof ApiError && err.status === 409) setStale(true) }
    finally { setBusy(false) }
  }
  function selectRole(id: string) {
    const next = roles.find(r => r.id === id)
    setRoleId(id); setSelected(next?.permissionCodes ?? []); setReason(''); setStale(false); setError('')
  }
  const roleCatalog = catalog.filter(p => role && p.allowedRoles.includes(role.code))
  function changeTab(next: 'roles' | 'users') {
    if (next === tab) return
    guard(() => {
      if (tab === 'roles' && role) { setSelected(role.permissionCodes); setReason('') }
      setTab(next); setUserDirty(false); requestAnimationFrame(() => document.getElementById(`permission-tab-${next}`)?.focus())
    })
  }
  return <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-3 sm:p-5 lg:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-emerald-700"><ShieldCheck size={12} />QUẢN LÝ TRUY CẬP</div><h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Permission Management</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Thiết lập quyền theo vai trò, tinh chỉnh quyền cho từng người dùng.</p></div><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"><span className="size-1.5 rounded-full bg-emerald-500" />RBAC + User Override</div></div>
    <div role="tablist" aria-label="Phạm vi phân quyền" className="flex gap-1 self-start rounded-xl border border-slate-200 bg-white p-1">{[{ id: 'roles' as const, label: 'Role Permissions', icon: ShieldCheck }, { id: 'users' as const, label: 'User Permissions', icon: Users }].map(item => <button type="button" role="tab" id={`permission-tab-${item.id}`} aria-controls={`permission-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} key={item.id} disabled={busy || userBusy} onClick={() => { changeTab(item.id) }} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); if (!busy && !userBusy) { const next = e.key === 'Home' ? 'roles' : e.key === 'End' ? 'users' : tab === 'roles' ? 'users' : 'roles'; if (next !== tab) changeTab(next) } } }} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition sm:px-5 sm:text-sm ${tab === item.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'} disabled:cursor-wait`}><item.icon size={16} />{item.label}</button>)}</div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}{stale && <p className="mt-1 font-medium">Bản nháp đã cũ. Tải lại cấu hình trước khi tiếp tục.</p>}{!roles.length && <button type="button" onClick={() => void load()} className="ml-3 underline">Thử lại</button>}</div>}
    {busy && !roles.length && <div role="status" className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6"><div className="mb-4 h-10 w-1/3 rounded-lg bg-slate-100" /><div className="h-72 rounded-xl bg-slate-50" /><span className="sr-only">Đang tải cấu hình phân quyền</span></div>}
    {tab === 'roles' && <section role="tabpanel" id="permission-panel-roles" aria-labelledby="permission-tab-roles" className="space-y-4">
      {role && <><div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-wrap items-center gap-4"><span className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:flex"><ShieldCheck size={24} /></span><label className="min-w-0 text-xs font-medium text-slate-500">Vai trò<select aria-label="Vai trò" value={roleId} disabled={busy} onChange={e => { const next = e.target.value; guard(() => selectRole(next)) }} className="mt-1.5 block min-h-10 w-full min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500">{roles.map(current => <option key={current.id} value={current.id}>{current.name}</option>)}</select></label><div className="text-xs text-slate-500"><p className="font-mono text-[10px] text-slate-400">{role.code}</p><p className="mt-1"><strong className="font-semibold text-slate-800">{selected.length}</strong> quyền được cấp <span className="mx-1 text-slate-300">/</span> {roleCatalog.length} quyền khả dụng</p></div></div><button type="button" disabled={busy} onClick={() => guard(() => void load(roleId))} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 disabled:opacity-50"><RefreshCw size={14} className={busy ? 'animate-spin' : ''} />Tải lại cấu hình</button></div>
      <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs leading-5 ${role.editable ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{role.editable ? <Info size={16} className="mt-0.5 shrink-0" /> : <LockKeyhole size={16} className="mt-0.5 shrink-0" />}<span>{role.editable ? role.description || 'Quyền mặc định áp dụng cho người dùng thuộc vai trò này. Quyền riêng của từng người dùng được ưu tiên và vẫn chịu giới hạn truy cập của cửa hàng.' : 'Vai trò Admin có toàn bộ quyền hệ thống. Cấu hình này được bảo vệ và chỉ cho phép xem.'}</span></div>
      <PermissionChecklist catalog={roleCatalog} selected={selected} editable={p => role.editable && !busy && !stale && p.allowedRoles.includes(role.code)} onToggle={(code, checked) => setSelected(prev => checked ? [...new Set([...prev, code])] : prev.filter(c => c !== code))} />
      {role.editable && <PermissionSaveBar reason={reason} onReason={setReason} dirtyCount={changed} busy={busy} stale={stale} onSave={() => void save()} onDiscard={() => { setSelected(role.permissionCodes); setReason('') }} />}</>}
      {!busy && !error && !roles.length && <p role="status" className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Chưa có vai trò hoạt động.</p>}
    </section>}
    {tab === 'users' && <section role="tabpanel" id="permission-panel-users" aria-labelledby="permission-tab-users"><UserPermissionsPanel catalog={catalog} guard={guard} onDirtyChange={setUserDirty} onBusyChange={setUserBusy} saving={userBusy} /></section>}
    {dialog}
  </div>
}
