import { api } from './client'
import type { PagedResult } from './types'
import type { CustomerReference } from './creditTiersApi'

export interface CustomerGroupResponse {
  id: string
  code: string
  name: string
  description?: string
  priority: number
  isDefault: boolean
  isActive: boolean
  memberCount: number
  currentPriceList?: CustomerReference
  defaultCreditTier?: CustomerReference
  createdAt: string
}

export interface CustomerGroupRequest {
  code: string
  name: string
  description?: string
  priority: number
}

export const customerGroupsApi = {
  getCustomerGroups: (params?: { page?: number; pageSize?: number; search?: string; isActive?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('Page', params.page.toString())
    if (params?.pageSize) searchParams.append('PageSize', params.pageSize.toString())
    if (params?.search) searchParams.append('Search', params.search)
    if (params?.isActive !== undefined) searchParams.append('IsActive', params.isActive.toString())
    
    return api<PagedResult<CustomerGroupResponse>>(`/api/customer-groups?${searchParams.toString()}`)
  },
  
  createCustomerGroup: (data: CustomerGroupRequest) => {
    return api<CustomerGroupResponse>('/api/customer-groups', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
  updateCustomerGroup: (id: string, data: CustomerGroupRequest) => {
    return api<CustomerGroupResponse>(`/api/customer-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },
  
  setGroupCreditTier: (id: string, creditTierId: string) => {
    return api<CustomerGroupResponse>(`/api/customer-groups/${id}/credit-tier`, {
      method: 'PUT',
      body: JSON.stringify({ creditTierId })
    })
  },
  
  setGroupPriceList: (id: string, priceListId: string) => {
    return api<CustomerGroupResponse>(`/api/customer-groups/${id}/price-list`, {
      method: 'PUT',
      body: JSON.stringify({ priceListId })
    })
  }
}
