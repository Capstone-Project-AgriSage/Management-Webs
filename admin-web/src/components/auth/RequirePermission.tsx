import type { ReactNode } from 'react'
import { usePermission } from '../../context/PermissionContext'

interface RequirePermissionProps {
  /** Module key from permissionModules (mockRoles.ts), e.g. "accounts". Gates on
   * the "view" permission for that module. */
  module: string
  children: ReactNode
}

export default function RequirePermission({ module, children }: RequirePermissionProps) {
  const { hasPermission } = usePermission()

  if (!hasPermission(module, 'view')) {
    return (
      <div className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm py-16 flex flex-col items-center text-center gap-2">
        <span className="material-symbols-outlined text-[40px] text-outline">lock</span>
        <p className="font-title-md text-title-md text-on-surface font-semibold">Không có quyền truy cập</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">
          Tài khoản của bạn chưa được cấp quyền xem mục này. Liên hệ quản trị viên để được phân quyền trong mục Phân quyền.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
