import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { DeliveryStaffUser } from '../types'

const STORAGE_KEY = 'agrisage_delivery_staff_auth'

const DEFAULT_USER: DeliveryStaffUser = {
  name: 'Lê Văn Phúc',
  role: 'Nhân viên giao hàng',
  initials: 'LP',
  hubName: 'Cửa hàng Vật tư Nông nghiệp Hai Thắng (Thới Lai)',
  storeId: 'STORE-HT-01',
}

interface AuthContextValue {
  isAuthenticated: boolean
  user: DeliveryStaffUser
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
