import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppRole, AppUser } from '@/types'
import { DEFAULT_USERS } from '@/config/roles'

const STORAGE_KEY = 'agrisage_auth'
const ROLE_KEY = 'agrisage_role'

interface AuthContextValue {
  isAuthenticated: boolean
  user: AppUser
  currentRole: AppRole
  login: (email: string, password: string, role: AppRole) => Promise<void>
  logout: () => void
  switchRole: (role: AppRole) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<AppRole>(
    () => (localStorage.getItem(ROLE_KEY) as AppRole) || 'admin',
  )
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1',
  )

  const user = DEFAULT_USERS[currentRole]

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem(STORAGE_KEY, '1')
      localStorage.setItem(ROLE_KEY, currentRole)
    } else {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(ROLE_KEY)
    }
  }, [isAuthenticated, currentRole])

  const login = async (_email: string, _password: string, role: AppRole) => {
    await new Promise((resolve) => setTimeout(resolve, 900))
    setCurrentRole(role)
    setIsAuthenticated(true)
  }

  const logout = () => {
    setIsAuthenticated(false)
  }

  const switchRole = (role: AppRole) => {
    setCurrentRole(role)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, currentRole, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
