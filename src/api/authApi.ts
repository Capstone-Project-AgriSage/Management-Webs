import { api } from './client'

export interface LoginResponse {
  accessToken: string
  expiresAt: string
  user: {
    id: string
    fullName: string
    phoneNumber: string
    email: string | null
    role: string // 'SALES_STAFF' | 'STORE_OWNER' | 'ADMIN' | 'DELIVERY_STAFF' | 'FARMER'
  }
}

export const authApi = {
  login: (identifier: string, password: string) => {
    return api<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    })
  },
  me: () => {
    return api<any>('/api/auth/me')
  }
}
