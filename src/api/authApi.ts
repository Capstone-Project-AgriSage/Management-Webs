import { api, ApiError } from './client'

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
  /**
   * Called with fetch directly: here a 401 means wrong credentials (or a locked account), not an expired session,
   * so it must reach the login form instead of going through api()'s "redirect to /login" handling.
   */
  login: async (identifier: string, password: string) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    })
    if (res.ok) return (await res.json()) as LoginResponse
    const p = await res.json().catch(() => ({}))
    throw new ApiError(res.status, p.title ?? res.statusText, p.detail, p.errors, p.traceId)
  },
  me: () => {
    return api<any>('/api/auth/me')
  }
}
