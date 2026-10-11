import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { authApi, type AuthSession } from '@/api/authApi'
import { describeError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { formatDateTime } from '@/utils/units'

export default function AccountSettings() {
  const { user, clearSession } = useAuth()
  const { showToast } = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [sessions, setSessions] = useState<AuthSession[] | null>(null)
  const [sessionError, setSessionError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [busy, setBusy] = useState(false)
  const loadSessions = useCallback(async () => {
    setSessionError('')
    try { setSessions(await authApi.sessions()) }
    catch (err) { setSessionError(describeError(err, 'Không tải được phiên đăng nhập')) }
  }, [])
  useEffect(() => { void loadSessions() }, [loadSessions])
  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (newPassword !== confirmation) { setPasswordError('Mật khẩu xác nhận chưa khớp'); return }
    setBusy(true); setPasswordError('')
    try {
      await authApi.changePassword(currentPassword, newPassword)
      setCurrentPassword(''); setNewPassword(''); setConfirmation('')
      showToast('Đã đổi mật khẩu. Vui lòng đăng nhập lại.')
      clearSession()
    } catch (err) { setPasswordError(describeError(err, 'Không đổi được mật khẩu')) }
    finally { setBusy(false) }
  }
  const revoke = async (session: AuthSession) => {
    if (busy) return
    setBusy(true); setSessionError('')
    try { await authApi.revokeSession(session.id); if (session.isCurrent) clearSession(); else await loadSessions() }
    catch (err) { setSessionError(describeError(err, 'Không đăng xuất được phiên này')) }
    finally { setBusy(false) }
  }
  const logoutAll = async () => {
    if (busy) return
    setBusy(true); setSessionError('')
    try { await authApi.logoutAll(); clearSession() }
    catch (err) { setSessionError(describeError(err, 'Không đăng xuất được các thiết bị')); setBusy(false) }
  }
  return <div className="grid gap-6 xl:grid-cols-2">
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="text-base font-semibold text-slate-900">Tài khoản và mật khẩu</h2>
      <p className="text-sm text-slate-600">{user?.fullName} · {user?.email || user?.phoneNumber || ''}</p>
      <form onSubmit={changePassword} className="space-y-4">
        <label className="block text-sm text-slate-700">Mật khẩu hiện tại<input type="password" required maxLength={128} autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
        <label className="block text-sm text-slate-700">Mật khẩu mới<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
        <label className="block text-sm text-slate-700">Xác nhận mật khẩu mới<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
        {passwordError && <p role="alert" className="text-sm text-rose-700">{passwordError}</p>}
        <button type="submit" disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50">Đổi mật khẩu</button>
      </form>
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-900">Phiên đăng nhập</h2><button type="button" disabled={busy} onClick={() => void loadSessions()} className="text-sm text-emerald-700">Làm mới phiên</button></div>
      {sessionError ? <p role="alert" className="text-sm text-rose-700">{sessionError}</p> : sessions === null ? <p role="status" className="text-sm text-slate-500">Đang tải phiên đăng nhập...</p> : sessions.length === 0 ? <p className="text-sm text-slate-500">Không có phiên đang hoạt động.</p> : <ul className="divide-y divide-slate-100">{sessions.map(session => <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <div><p className="font-medium text-slate-800">{session.isCurrent ? 'Thiết bị hiện tại' : 'Thiết bị khác'}</p><p className="mt-1 text-xs text-slate-500">Dùng gần nhất: {formatDateTime(session.lastUsedAt)}</p></div>
        <button type="button" disabled={busy} onClick={() => void revoke(session)} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 disabled:opacity-50">{session.isCurrent ? 'Đăng xuất thiết bị này' : 'Đăng xuất phiên'}</button>
      </li>)}</ul>}
      <button type="button" disabled={busy} onClick={() => void logoutAll()} className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 disabled:opacity-50">Đăng xuất mọi thiết bị</button>
    </section>
  </div>
}
