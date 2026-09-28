import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { AppRole } from '@/types'

interface RequireRoleProps {
  role: AppRole | AppRole[]
  children: ReactNode
}

export default function RequireRole({ role, children }: RequireRoleProps) {
  const { currentRole } = useAuth()
  const allowed = Array.isArray(role) ? role : [role]

  if (!allowed.includes(currentRole)) {
    return (
      <div className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm py-16 flex flex-col items-center text-center gap-2">
        <span className="material-symbols-outlined text-[40px] text-outline">block</span>
        <p className="font-title-md text-title-md text-on-surface font-semibold">Không có quyền truy cập</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">
          Trang này không thuộc vai trò của bạn. Vui lòng chuyển đổi vai trò hoặc liên hệ quản trị viên.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
