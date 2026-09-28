import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!email) return
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[24px]">eco</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight">
              AgriSage
            </span>
            <span className="bg-surface-container text-primary font-label-sm text-label-sm px-1.5 py-0.5 rounded border border-outline-variant">
              OS
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-outline-variant/60 shadow-2xs p-6 sm:p-8">
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary-fixed/50 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[24px] text-primary">mail</span>
              </div>
              <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Đã gửi liên kết khôi phục
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                Kiểm tra hộp thư <span className="font-semibold text-on-surface">{email}</span> để đặt lại mật khẩu.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 mt-6 font-label-md text-label-md text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">Quên mật khẩu</h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  Nhập email đăng ký để nhận liên kết đặt lại mật khẩu.
                </p>
              </div>
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                <div>
                  <label
                    className="block font-label-sm text-label-sm uppercase text-on-surface-variant mb-1.5"
                    htmlFor="resetEmail"
                  >
                    Email hoặc số điện thoại
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">
                      mail
                    </span>
                    <input
                      id="resetEmail"
                      name="email"
                      type="text"
                      placeholder="agent@agrisage.vn"
                      autoComplete="username"
                      className="w-full h-11 pl-10 pr-3 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-on-surface placeholder:text-outline font-body-md transition-all"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full h-11 bg-primary hover:bg-primary-container text-on-primary font-semibold text-sm rounded shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  Gửi liên kết khôi phục
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </form>
              <div className="text-center pt-5">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Quay lại đăng nhập
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
