import { api } from './client'
import type { PagedResult } from './types'

export interface StaffResponse {
  id: string
  fullName: string
  phoneNumber: string | null
  email: string | null
  role: string
  status: string
  memberStatus: string
  employeeCode: string | null
  joinedAt: string | null
  leftAt: string | null
  canReviewAi: boolean
  createdAt: string
}

export type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED'
export type StaffRole = 'STORE_OWNER' | 'SALES_STAFF' | 'DELIVERY_STAFF'
export interface StaffProfileRequest {
  fullName: string
  phoneNumber: string | null
  email: string | null
  employeeCode: string | null
  joinedAt: string | null
}
export interface CreateStaffRequest extends StaffProfileRequest {
  role: StaffRole
  password: string
}

export const staffApi = {
  getStaff: (params?: { search?: string; role?: string; status?: StaffStatus; page?: number; pageSize?: number }, signal?: AbortSignal) => {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('Search', params.search)
    if (params?.role) searchParams.append('Role', params.role)
    if (params?.status) searchParams.append('Status', params.status)
    if (params?.page) searchParams.append('Page', params.page.toString())
    if (params?.pageSize) searchParams.append('PageSize', params.pageSize.toString())

    return api<PagedResult<StaffResponse>>(`/api/staff?${searchParams.toString()}`, { signal })
  },

  get: (id: string, signal?: AbortSignal) => api<StaffResponse>(`/api/staff/${encodeURIComponent(id)}`, { signal }),
  create: (body: CreateStaffRequest) => api<StaffResponse>('/api/staff', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: StaffProfileRequest) => api<StaffResponse>(`/api/staff/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
  lock: (id: string) => api<void>(`/api/staff/${encodeURIComponent(id)}/lock`, { method: 'POST' }),
  unlock: (id: string) => api<void>(`/api/staff/${encodeURIComponent(id)}/unlock`, { method: 'POST' }),
  resetPassword: (id: string, newPassword: string) => api<void>(`/api/staff/${encodeURIComponent(id)}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
  remove: (id: string) => api<void>(`/api/staff/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** Admin and Store Owner. Whether the member may decide AI diagnosis cases (not a role); only Sales staff and Store Owners. */
  setAiReview: (userId: string, enabled: boolean, reason?: string) =>
    api<StaffResponse>(`/api/staff/${userId}/ai-review`, { method: 'PUT', body: JSON.stringify({ enabled, reason: reason ?? null }) })
}
