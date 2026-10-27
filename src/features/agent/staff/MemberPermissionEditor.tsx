import { useCallback, useEffect, useRef, useState } from 'react'
import { LockKeyhole, RefreshCw, RotateCcw, ShieldCheck, UserRound, X } from 'lucide-react'
import { permissionsApi, type MemberPermissions, type Permission } from '@/api/permissionsApi'
import { ApiError, describeError } from '@/api/client'
import PermissionChecklist from '@/components/auth/PermissionChecklist'
import PermissionSaveBar from '@/components/auth/PermissionSaveBar'
import { memberChanges, memberDraft, memberEffective, type OverrideState, type PermissionDraft } from '@/components/auth/permissionDraft'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { usePermission } from '@/context/PermissionContext'
import { useToast } from '@/context/ToastContext'

export default function MemberPermissionEditor({ userId, onClose, onDirtyChange, onBusyChange, permissionCatalog }: {
  userId: string; onClose?: () => void; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void; permissionCatalog?: Permission[]
}) {
  const [member, setMember] = useState<MemberPermissions | null>(null), [catalog, setCatalog] = useState<Permission[]>([])
  const [draft, setDraft] = useState<PermissionDraft>({}), [reason, setReason] = useState(''), [error, setError] = useState('')
  const [busy, setBusy] = useState(true), [stale, setStale] = useState(false)
  const [confirmation, setConfirmation] = useState<'reset' | 'reload' | 'close' | null>(null)
  const sequence = useRef(0)
  const invalidate = useCallback(() => { ++sequence.current }, [])
  const { refresh } = usePermission(), { showToast } = useToast()
  const load = useCallback(async () => {
    const request = ++sequence.current
    setBusy(true); setError(''); setMember(null)
    try {
      const [data, list] = await Promise.all([permissionsApi.member(userId), permissionCatalog ? Promise.resolve(permissionCatalog) : permissionsApi.catalog()])
      if (sequence.current !== request) return
      setMember(data); setCatalog(list); setDraft(memberDraft(data)); setReason(''); setStale(false)
    } catch (err) { if (sequence.current === request) setError(describeError(err)) }
    finally { if (sequence.current === request) setBusy(false) }
  }, [userId, permissionCatalog])
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void load() }); return () => { active = false; invalidate() } }, [load, invalidate])
  const changes = member ? memberChanges(member, draft) : []
  const dirty = changes.length > 0
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false) }, [busy, onBusyChange])
  const visibleCatalog = catalog.filter(p => member && p.allowedRoles.includes(member.role))
  const effective = member ? visibleCatalog.filter(p => memberEffective(member, draft, p.code)).map(p => p.code) : []
  const allow = visibleCatalog.filter(p => draft[p.code] === 'allow').length, deny = visibleCatalog.filter(p => draft[p.code] === 'deny').length
  const setOverride = (code: string, state: OverrideState) => { if (!busy && !stale && (state !== 'inherit' || Array.isArray(member?.permissionCeiling)) && member?.grantablePermissions.includes(code)) setDraft(prev => ({ ...prev, [code]: state })) }
  const inheritanceAvailable = Array.isArray(member?.permissionCeiling)
  const resettable = inheritanceAvailable && member?.grantablePermissions.some(code => draft[code] && draft[code] !== 'inherit')
  async function save() {
    if (!member || !reason.trim() || !changes.length || stale || busy) return
    setBusy(true); setError('')
    try {
      const updated = await permissionsApi.setMember(member, changes, reason.trim())
      setMember(updated); setDraft(memberDraft(updated)); setReason('')
      showToast('Đã lưu quyền riêng của người dùng', 'success')
      await refresh(); window.dispatchEvent(new Event('agrisage-permissions-changed'))
    } catch (err) { setError(describeError(err)); if (err instanceof ApiError && err.status === 409) setStale(true) }
    finally { setBusy(false) }
  }
  function confirm() {
    const action = confirmation; setConfirmation(null)
    if (action === 'reset' && member) setDraft(prev => ({ ...prev, ...Object.fromEntries(member.grantablePermissions.map(code => [code, 'inherit' as const])) }))
    if (action === 'reload') void load()
    if (action === 'close') onClose?.()
  }
  return <section aria-label="Phân quyền nhân viên" className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex min-w-0 items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><UserRound size={21} /></span><div className="min-w-0"><h2 className="truncate text-base font-semibold text-slate-900">{member?.fullName ?? (busy ? 'Đang tải người dùng…' : 'Quyền người dùng')}</h2><p className="mt-1 text-xs text-slate-500">{member ? 'Nhân viên bán hàng · Quyền riêng tại cửa hàng' : 'Đọc cấu hình quyền từ hệ thống'}</p></div></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => dirty ? setConfirmation('reload') : void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 disabled:opacity-40"><RefreshCw size={14} className={busy ? 'animate-spin' : ''} />Tải lại cấu hình</button><button type="button" disabled={busy || stale || !resettable} onClick={() => setConfirmation('reset')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 disabled:opacity-40"><RotateCcw size={14} />Reset về Role</button>{onClose && <button type="button" aria-label="Đóng phân quyền" disabled={busy} onClick={() => dirty ? setConfirmation('close') : onClose()} className="p-2 text-slate-400"><X size={18} /></button>}</div></div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}{stale && <p className="mt-1 font-medium">Bản nháp đã cũ. Tải lại cấu hình trước khi tiếp tục.</p>}</div>}
    {busy && !member && <div role="status" className="animate-pulse space-y-3 rounded-2xl border bg-white p-6"><div className="h-5 w-1/3 rounded bg-slate-100" /><div className="h-40 rounded-xl bg-slate-50" /><span className="sr-only">Đang tải quyền người dùng</span></div>}
    {member && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{ label: 'Kế thừa Role', value: visibleCatalog.length - allow - deny, style: 'text-slate-800' }, { label: 'Allow · Cấp riêng', value: allow, style: 'text-emerald-700' }, { label: 'Deny · Từ chối riêng', value: deny, style: 'text-rose-600' }, { label: 'Quyền hiệu lực dự kiến', value: effective.length, style: 'text-slate-800' }].map(item => <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="text-[11px] text-slate-500">{item.label}</p><p className={`mt-1 text-xl font-semibold tabular-nums ${item.style}`}>{item.value}</p></div>)}</div>
      <p className="flex items-start gap-2 px-1 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />Allow và Deny được ưu tiên hơn quyền Role. Kế thừa sẽ tự cập nhật khi Role thay đổi. Quyền hiệu lực vẫn chịu giới hạn của vai trò cửa hàng.</p>
      {!inheritanceAvailable && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Khôi phục về quyền mặc định chưa khả dụng trên phiên bản hệ thống hiện tại. Bạn vẫn có thể lưu quyền Allow hoặc Deny.</p>}
      <PermissionChecklist catalog={visibleCatalog} selected={effective} overrides={draft} defaultPermissions={member.defaultPermissions} ceiling={member.permissionCeiling} allowInheritanceReset={inheritanceAvailable} editable={p => !busy && !stale && member.grantablePermissions.includes(p.code)} onToggle={(code, checked) => setOverride(code, checked ? 'allow' : 'deny')} onOverride={setOverride} />
      {!member.grantablePermissions.length && <p className="flex items-center gap-2 text-xs text-slate-500"><LockKeyhole size={14} />Bạn chỉ có thể xem cấu hình của người dùng này.</p>}
      <PermissionSaveBar reason={reason} onReason={setReason} dirtyCount={changes.length} busy={busy} stale={stale} onSave={() => void save()} onDiscard={() => { setDraft(memberDraft(member)); setReason('') }} label={`Lưu quyền (${changes.length})`} />
    </>}
    <ConfirmModal open={!!confirmation} title={confirmation === 'reset' ? 'Khôi phục quyền mặc định từ Role?' : 'Bỏ thay đổi chưa lưu?'} message={confirmation === 'reset' ? 'Các quyền riêng mà bạn được phép quản lý sẽ trở về kế thừa Role. Những quyền ngoài phạm vi quản lý được giữ nguyên. Bấm Lưu quyền để áp dụng bản nháp.' : 'Bản nháp quyền hiện tại sẽ bị bỏ. Các quyền đã lưu trên hệ thống không thay đổi.'} confirmLabel={confirmation === 'reset' ? 'Đặt về kế thừa' : 'Bỏ thay đổi'} onClose={() => setConfirmation(null)} onConfirm={confirm} />
  </section>
}
