import { api, toQuery } from './client'
import type { PagedResult } from './types'
import type { CustomerReference } from './customersApi'

// FLOW_3 §3 — customer groups drive both the price list and the credit tier (decision F-D2).

export interface CustomerGroupResponse {
  id: string
  code: string
  name: string
  description: string | null
  priority: number
  isDefault: boolean
  isActive: boolean
  memberCount: number
  currentPriceList: CustomerReference | null
  defaultCreditTier: CustomerReference | null
  createdAt: string
}

export interface CustomerGroupRequest {
  code: string
  name: string
  description?: string | null
  priority: number
}

export interface GroupPriceListLink {
  id: string
  priceList: CustomerReference
  status: string | null
  effectiveFrom: string
  effectiveTo: string | null
}

export const customerGroupsApi = {
  getCustomerGroups: (params: { page?: number; pageSize?: number; search?: string; isActive?: boolean } = {}) =>
    api<PagedResult<CustomerGroupResponse>>(
      `/api/customer-groups${toQuery({ Search: params.search, IsActive: params.isActive, Page: params.page, PageSize: params.pageSize })}`,
    ),

  getCustomerGroup: (id: string) => api<CustomerGroupResponse>(`/api/customer-groups/${id}`),

  createCustomerGroup: (data: CustomerGroupRequest) =>
    api<CustomerGroupResponse>('/api/customer-groups', { method: 'POST', body: JSON.stringify(data) }),

  /** Code is immutable after creation. */
  updateCustomerGroup: (id: string, data: Omit<CustomerGroupRequest, 'code'>) =>
    api<CustomerGroupResponse>(`/api/customer-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteCustomerGroup: (id: string) => api<void>(`/api/customer-groups/${id}`, { method: 'DELETE' }),
  activate: (id: string) => api<void>(`/api/customer-groups/${id}/activate`, { method: 'POST' }),
  deactivate: (id: string) => api<void>(`/api/customer-groups/${id}/deactivate`, { method: 'POST' }),
  setDefault: (id: string) => api<void>(`/api/customer-groups/${id}/set-default`, { method: 'POST' }),

  /** null removes the link. */
  setGroupCreditTier: (id: string, creditTierId: string | null) =>
    api<CustomerGroupResponse>(`/api/customer-groups/${id}/credit-tier`, { method: 'PUT', body: JSON.stringify({ creditTierId }) }),

  setGroupPriceList: (id: string, priceListId: string, effectiveFrom?: string) =>
    api<CustomerGroupResponse>(`/api/customer-groups/${id}/price-list`, {
      method: 'PUT',
      body: JSON.stringify({ priceListId, effectiveFrom: effectiveFrom || null }),
    }),

  getPriceListHistory: (id: string) => api<GroupPriceListLink[]>(`/api/customer-groups/${id}/price-lists`),
}
