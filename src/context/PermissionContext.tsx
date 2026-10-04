import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import * as rolesService from '@/features/admin/services/rolesService'

interface PermissionContextValue {
  hasPermission: (moduleKey: string, permKey: string) => boolean
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined)

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  // Map AppRole to AccountRole for admin permission lookups
  const accountRole = user?.role === 'admin' ? 'Admin' : (user?.roleLabel || '')

  const value = useMemo<PermissionContextValue>(
    () => ({
      hasPermission: (moduleKey, permKey) => rolesService.hasPermission(accountRole, moduleKey, permKey),
    }),
    [accountRole],
  )

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}

export function usePermission() {
  const ctx = useContext(PermissionContext)
  if (!ctx) throw new Error('usePermission must be used within PermissionProvider')
  return ctx
}
