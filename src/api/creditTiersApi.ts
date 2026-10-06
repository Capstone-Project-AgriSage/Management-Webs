import { api } from './client'
import type { PagedResult } from './types'

import type { CustomerReference } from './customersApi'

export type { CustomerReference }

export interface CreditTierResponse {
  id: string
  code: string
  name: string
  description?: string
  defaultCreditLimit: number
  defaultPaymentTermDays: number
  isActive: boolean
  profileCount: number
  groups?: CustomerReference[]
}

export interface CreditTierRequest {
  code: string
  name: string
  description?: string
  defaultCreditLimit: number
  defaultPaymentTermDays: number
}

export const creditTiersApi = {
  getCreditTiers: (params?: { page?: number; pageSize?: number; search?: string; isActive?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('Page', params.page.toString())
    if (params?.pageSize) searchParams.append('PageSize', params.pageSize.toString())
    if (params?.search) searchParams.append('Search', params.search)
    if (params?.isActive !== undefined) searchParams.append('IsActive', params.isActive.toString())
    
    return api<PagedResult<CreditTierResponse>>(`/api/credit-tiers?${searchParams.toString()}`)
  },
  
  getCreditTierById: (id: string) => {
    return api<CreditTierResponse>(`/api/credit-tiers/${id}`)
  },
  
  createCreditTier: (data: CreditTierRequest) => {
    return api<CreditTierResponse>('/api/credit-tiers', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
  /** Code is immutable; changing a tier never changes existing profiles or confirmed orders (FLOW_3 §4.1). */
  updateCreditTier: (id: string, data: Omit<CreditTierRequest, 'code'>) => {
    return api<CreditTierResponse>(`/api/credit-tiers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },
  
  activateCreditTier: (id: string) => {
    return api<CreditTierResponse>(`/api/credit-tiers/${id}/activate`, { method: 'POST' })
  },
  
  deactivateCreditTier: (id: string) => {
    return api<CreditTierResponse>(`/api/credit-tiers/${id}/deactivate`, { method: 'POST' })
  }
}
