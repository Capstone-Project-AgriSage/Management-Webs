import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { permissionsApi } from '@/api/permissionsApi'
interface PermissionContextValue {
  has: (code: string) => boolean
  hasPermission: (module: string, operation: string) => boolean
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}
const aliases: Record<string, string> = { accounts: 'STAFF.READ', roles: 'PERMISSIONS.MANAGE_ROLES', products: 'PRODUCTS.READ', 'ai-config': 'PERMISSIONS.MANAGE_ROLES', articles: 'PERMISSIONS.MANAGE_ROLES', 'audit-logs': 'AUDIT.READ' }
const PermissionContext = createContext<PermissionContextValue | undefined>(undefined)
export function PermissionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const [codes, setCodes] = useState<Set<string>>(new Set())
  const [permissionUserId, setPermissionUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++sequence.current
    if (!isAuthenticated) { setCodes(new Set()); setLoading(false); return }
    try {
      const data = await permissionsApi.current()
      if (request === sequence.current) {
        const next = new Set(data.permissions)
        setCodes(previous => previous.size === next.size && [...previous].every(code => next.has(code)) ? previous : next)
        setPermissionUserId(user?.id ?? null); setError(null)
      }
    } catch {
      if (request === sequence.current) { setCodes(new Set()); setError('Không thể tải quyền truy cập. Vui lòng thử lại.') }
    } finally { if (request === sequence.current) setLoading(false) }
  }, [isAuthenticated, user?.id])
  useEffect(() => {
    setCodes(new Set()); setLoading(true); void refresh()
    const update = () => { if (!document.hidden) void refresh() }
    const interval = window.setInterval(update, 15000)
    window.addEventListener('focus', update)
    window.addEventListener('agrisage-permissions-changed', update)
    document.addEventListener('visibilitychange', update)
    return () => { ++sequence.current; clearInterval(interval); window.removeEventListener('focus', update); window.removeEventListener('agrisage-permissions-changed', update); document.removeEventListener('visibilitychange', update) }
  }, [refresh])
  const has = useCallback((code: string) => isAuthenticated && permissionUserId === user?.id && codes.has(code), [isAuthenticated, permissionUserId, user?.id, codes])
  const hasPermission = useCallback((module: string, operation: string) => has(aliases[module] ?? `${module.toUpperCase()}.${operation === 'view' ? 'READ' : operation.toUpperCase()}`), [has])
  const value = useMemo(() => ({ has, hasPermission, loading, error, refresh }), [has, hasPermission, loading, error, refresh])
  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}
export function usePermission() { const value = useContext(PermissionContext); if (!value) throw new Error('usePermission must be used within PermissionProvider'); return value }
