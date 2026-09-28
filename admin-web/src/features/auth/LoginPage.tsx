import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email quản trị và mật khẩu.')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[24px]">shield_person</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight">
              AgriSage
            </span>
            <span className="bg-surface-container text-primary font-label-sm text-label-sm px-1.5 py-0.5 rounded border border-outline-variant">
              ADMIN
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-outline-variant/60 shadow-2xs p-6 sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">Đăng nhập Quản trị viên</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Truy cập bảng điều khiển quản trị hệ thống AgriSage
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                className="block font-label-sm text-label-sm uppercase text-on-surface-variant mb-1.5"
                htmlFor="emailInput"
              >
                Email quản trị
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">
                  person
                </span>
                <input
                  id="emailInput"
                  name="email"
                  type="text"
                  autoComplete="username"
                  placeholder="admin@agrisage.vn"
                  className="w-full h-11 pl-10 pr-3 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-on-surface placeholder:text-outline font-body-md transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className="block font-label-sm text-label-sm uppercase text-on-surface-variant"
                  htmlFor="passwordInput"
                >
                  Mật khẩu
                </label>
                <Link
                  to="/forgot-password"
                  className="font-label-md text-label-md text-primary hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">
                  lock
                </span>
                <input
                  id="passwordInput"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  className="w-full h-11 pl-10 pr-10 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-on-surface placeholder:text-outline font-body-md transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label="Hiện hoặc ẩn mật khẩu"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error ? (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-error-container text-on-error-container text-xs font-medium">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-primary hover:bg-primary-container active:bg-on-primary-fixed-variant text-on-primary font-semibold text-sm rounded shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-on-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Đang xác thực...
                </>
              ) : (
                <>
                  Đăng nhập hệ thống
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center font-body-sm text-body-sm text-on-surface-variant mt-6">
          Tài khoản quản trị được cấp phát nội bộ.{' '}
          <span className="text-on-surface font-medium">Liên hệ bộ phận IT nếu cần hỗ trợ.</span>
        </p>
      </div>
    </div>
  )
}
