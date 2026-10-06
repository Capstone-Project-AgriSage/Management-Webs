import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppRole } from '@/types'
import { authApi } from '@/api/authApi'
import { ApiError } from '@/api/client'

const TOKEN_KEY = 'agrisage_token'

interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  user: any // Ideally map from BE user
  currentRole: AppRole | null
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const roleMapping: Record<string, AppRole> = {
  'STORE_OWNER': 'agent',
  'SALES_STAFF': 'sales_staff',
  'ADMIN': 'admin',
  'DELIVERY_STAFF': 'delivery_staff'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) {
        setIsLoading(false)
        return
      }
      // Only the server's answer ends the session (401 is handled by api(), a non-staff role here). A network error —
      // a dropped connection, or the request aborted because the page is being left — must not log the user out.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const userData = await authApi.me()
          if (roleMapping[userData.role]) {
            setUser(userData)
            setCurrentRole(roleMapping[userData.role])
            setIsAuthenticated(true)
          } else {
            localStorage.removeItem(TOKEN_KEY)
          }
          break
        } catch (err) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            localStorage.removeItem(TOKEN_KEY)
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
        }
      }
      setIsLoading(false)
    }
    initAuth()
  }, [])

  const login = async (identifier: string, password: string) => {
    const res = await authApi.login(identifier, password)
    // Farmers sign in to the farmer app; this web is for store staff only.
    if (!roleMapping[res.user.role]) {
      throw new ApiError(403, 'Forbidden', 'Tài khoản này không có quyền truy cập trang quản lý. Nông dân vui lòng dùng ứng dụng dành cho nông dân.')
    }
    localStorage.setItem(TOKEN_KEY, res.accessToken)
    setUser(res.user)
    setCurrentRole(roleMapping[res.user.role] || null)
    setIsAuthenticated(true)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setIsAuthenticated(false)
    setCurrentRole(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, currentRole, login, logout }}>
      {!isLoading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
