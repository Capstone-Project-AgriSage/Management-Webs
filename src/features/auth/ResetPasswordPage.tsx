import { useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { ApiError, describeError } from '@/api/client'

const SMS_CODE = /^[0-9]{6}$/
const EMAIL_TOKEN_LENGTH = 76
const BAD_CODE = 'Mã không đúng hoặc đã hết hạn. Mỗi mã chỉ được thử tối đa 5 lần, nếu hết lượt hãy yêu cầu mã mới.'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  // The forgot-password page hands over what was typed, so an SMS code is checked together with that phone number.
  const [identifier, setIdentifier] = useState((location.state as { identifier?: string } | null)?.identifier ?? params.get('identifier') ?? '')
  const [token, setToken] = useState(params.get('token') ?? '')
  // Step 1 confirms the code, step 2 asks for the new password. An email link carries a long token that only the final
  // call can check, so it opens straight on step 2.
  const [step, setStep] = useState<'code' | 'password'>(token.trim().length === EMAIL_TOKEN_LENGTH ? 'password' : 'code')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const code = token.trim()
  const isSmsCode = SMS_CODE.test(code)

  const backToCode = (message: string) => { setStep('code'); setPassword(''); setConfirmation(''); setError(message) }

  const confirmCode = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!isSmsCode && code.length !== EMAIL_TOKEN_LENGTH) { setError('Mã khôi phục không đúng định dạng: 6 chữ số trong tin nhắn SMS, hoặc mã dài trong email'); return }
    if (!isSmsCode) { setError(''); setStep('password'); return }
    if (!identifier.trim()) { setError('Nhập số điện thoại đã nhận mã SMS'); return }
    if (identifier.includes('@')) { setError('Mã 6 số được gửi qua SMS, hãy nhập số điện thoại'); return }
    setBusy(true); setError('')
    try {
      await authApi.verifyResetCode(identifier.trim(), code)
      setStep('password')
    }
    catch (err) { setError(err instanceof ApiError && err.status === 422 ? BAD_CODE : describeError(err, 'Không kiểm tra được mã')) }
    finally { setBusy(false) }
  }

  const savePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (password !== confirmation) { setError('Mật khẩu xác nhận chưa khớp'); return }
    setBusy(true); setError('')
    try {
      if (isSmsCode) await authApi.resetPasswordWithCode(identifier.trim(), code, password)
      else await authApi.resetPassword(code, password)
      setDone(true); setPassword(''); setConfirmation(''); setToken('')
    }
    catch (err) {
      // 422 = the code was used up or expired in the meantime: ask for it again instead of leaving the form stuck.
      if (err instanceof ApiError && err.status === 422) backToCode(BAD_CODE)
      else setError(describeError(err, 'Không đặt lại được mật khẩu'))
    }
    finally { setBusy(false) }
  }

  return <div className="agrisage-auth min-h-screen bg-background flex items-center justify-center p-4">
    <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Đặt lại mật khẩu</h1>
      {done ? <p role="status" className="text-sm text-emerald-700">Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.</p>
        : step === 'code' ? <form onSubmit={confirmCode} className="space-y-4">
          <p className="text-sm text-slate-600">Bước 1/2: nhập mã khôi phục để xác nhận.</p>
          <label className="block text-sm text-slate-700">Số điện thoại hoặc email nhận mã<input id="resetIdentifier" maxLength={255} value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete="username" placeholder="0912345678" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          <label className="block text-sm text-slate-700">Mã khôi phục<input id="resetCode" required maxLength={EMAIL_TOKEN_LENGTH} value={token} onChange={event => setToken(event.target.value)} autoComplete="one-time-code" placeholder="6 chữ số từ SMS, hoặc mã từ email" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Đang kiểm tra...' : 'Xác nhận mã'}</button>
        </form>
        : <form onSubmit={savePassword} className="space-y-4">
          {/* Only an SMS code can be checked ahead of the save; an email token is checked by the save itself. */}
          <p className="text-sm text-slate-600">Bước 2/2: {isSmsCode
            ? <><span className="text-emerald-700">mã đã được xác nhận</span>, nhập mật khẩu mới.</>
            : 'nhập mật khẩu mới (mã trong email được kiểm tra khi lưu).'}</p>
          <label className="block text-sm text-slate-700">Mật khẩu mới<input id="resetPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          <label className="block text-sm text-slate-700">Xác nhận mật khẩu mới<input id="resetConfirmation" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Đang lưu...' : 'Đặt lại mật khẩu'}</button>
          <button type="button" disabled={busy} onClick={() => backToCode('')} className="w-full text-sm text-slate-600 hover:underline disabled:opacity-50">Nhập lại mã</button>
        </form>}
      <Link to="/login" className="inline-block text-sm text-emerald-700 hover:underline">Quay lại đăng nhập</Link>
    </section>
  </div>
}
