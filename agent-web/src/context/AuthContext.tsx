import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AgentUser } from '../types'

const STORAGE_KEY = 'agrisage_agent_auth'

const DEFAULT_USER: AgentUser = {
  name: 'Nguyễn Văn Minh',
  role: 'Đại lý & Thẩm định AI',
  initials: 'NM',
  hub: 'Đại lý Vật tư Nông nghiệp Hai Thắng (Thới Lai)',
  can_review_ai: true,
  storeId: 'STORE-HT-01',
}

interface AuthContextValue {
  isAuthenticated: boolean
  user: AgentUser
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1',
  )

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem(STORAGE_KEY, '1')
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [isAuthenticated])

  const login = async (_email: string, _password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 900))
    setIsAuthenticated(true)
  }

  const logout = () => setIsAuthenticated(false)

  return (
    <AuthContext.Provider value={{ isAuthenticated, user: DEFAULT_USER, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
