import { api } from './client'
import type { PagedResult } from './types'

export interface StaffResponse {
  id: string
  code: string
  fullName: string
  phoneNumber: string
  email: string
  role: string
  status: string
  memberStatus: string
  employeeCode: string | null
  joinedAt: string | null
  leftAt: string | null
  canReviewAi: boolean
  createdAt: string
  isActive?: boolean
}

export const staffApi = {
  getStaff: (params?: { role?: string; status?: 'ACTIVE' | 'INACTIVE'; page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.role) searchParams.append('Role', params.role)
    if (params?.status) searchParams.append('Status', params.status)
    if (params?.page) searchParams.append('Page', params.page.toString())
    if (params?.pageSize) searchParams.append('PageSize', params.pageSize.toString())
    
    return api<PagedResult<StaffResponse>>(`/api/staff?${searchParams.toString()}`)
  },

  /** Admin and Store Owner. Whether the member may decide AI diagnosis cases (not a role); only Sales staff and Store Owners. */
  setAiReview: (userId: string, enabled: boolean, reason?: string) =>
    api<StaffResponse>(`/api/staff/${userId}/ai-review`, { method: 'PUT', body: JSON.stringify({ enabled, reason: reason ?? null }) })
}
