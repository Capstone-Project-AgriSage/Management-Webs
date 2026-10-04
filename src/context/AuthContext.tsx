import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppRole, AppUser } from '@/types'
import { authApi } from '@/api/authApi'

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
      try {
        const userData = await authApi.me()
        setUser(userData)
        setCurrentRole(roleMapping[userData.role] || null)
        setIsAuthenticated(true)
      } catch (err) {
        localStorage.removeItem(TOKEN_KEY)
      } finally {
        setIsLoading(false)
      }
    }
    initAuth()
  }, [])

  const login = async (identifier: string, password: string) => {
    const res = await authApi.login(identifier, password)
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
