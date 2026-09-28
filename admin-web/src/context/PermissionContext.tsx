import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import * as rolesService from '../services/rolesService'

interface PermissionContextValue {
  /** True if the signed-in admin's role has been granted `<moduleKey>:<permKey>`
   * in Phân quyền. Backed by rolesService, so a permission edit made there is what
   * actually decides what's rendered here — not just decorative UI state. */
  hasPermission: (moduleKey: string, permKey: string) => boolean
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined)

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const value = useMemo<PermissionContextValue>(
    () => ({
      hasPermission: (moduleKey, permKey) => rolesService.hasPermission(user.role, moduleKey, permKey),
    }),
    [user.role],
  )

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}

export function usePermission() {
  const ctx = useContext(PermissionContext)
  if (!ctx) throw new Error('usePermission must be used within PermissionProvider')
  return ctx
}
