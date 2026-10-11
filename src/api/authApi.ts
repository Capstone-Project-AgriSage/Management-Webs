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

export interface AuthSession { id: string; createdAt: string; lastUsedAt: string; expiresAt: string; isCurrent: boolean }

async function publicAuthPost(path: string, body: object, authenticated = false): Promise<void> {
  const token = authenticated ? localStorage.getItem('agrisage_token') : null
  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
  })
  if (response.ok) return
  const problem = await response.json().catch(() => ({}))
  throw new ApiError(response.status, problem.title ?? response.statusText, problem.detail, problem.errors, problem.traceId)
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
  },
  forgotPassword: (identifier: string) => publicAuthPost('/api/auth/forgot-password', { identifier }),
  resetPassword: (token: string, newPassword: string) => publicAuthPost('/api/auth/reset-password', { token, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) => publicAuthPost('/api/auth/change-password', { currentPassword, newPassword }, true),
  logout: () => api<void>('/api/auth/logout', { method: 'POST' }),
  logoutAll: () => api<void>('/api/auth/logout-all', { method: 'POST' }),
  sessions: () => api<AuthSession[]>('/api/auth/sessions'),
  revokeSession: (id: string) => api<void>(`/api/auth/sessions/${id}`, { method: 'DELETE' }),
}
