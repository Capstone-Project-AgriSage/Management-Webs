import { api } from './client'
import type { PagedResult } from './types'
import type { CustomerReference } from './creditTiersApi'

export interface CustomerProfileResponse {
  id: string
  code: string
  fullName: string
  phoneNumber: string
  address: string
  joinDate: string
  isActive: boolean
  customerGroup?: CustomerReference
  creditLimit: number
  outstandingReceivable: number
  availableCredit: number
  paymentTermDays: number
  isCreditSuspended: boolean
}

export const customersApi = {
  getCustomers: (params?: { page?: number; pageSize?: number; search?: string; hasDebt?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('Page', params.page.toString())
    if (params?.pageSize) searchParams.append('PageSize', params.pageSize.toString())
    if (params?.search) searchParams.append('Search', params.search)
    if (params?.hasDebt !== undefined) searchParams.append('HasDebt', params.hasDebt.toString())
    
    return api<PagedResult<CustomerProfileResponse>>(`/api/customers?${searchParams.toString()}`)
  },
  
  getCustomerById: (id: string) => {
    return api<CustomerProfileResponse>(`/api/customers/${id}`)
  },
  
  getCustomerAddresses: (id: string) => {
    return api<any[]>(`/api/customers/${id}/addresses`)
  },
  
  updateCustomerGroup: (id: string, groupId: string) => {
    return api<CustomerProfileResponse>(`/api/customers/${id}/group`, {
      method: 'PUT',
      body: JSON.stringify({ groupId })
    })
  },
  
  updateCreditLimit: (id: string, creditLimit: number) => {
    return api<CustomerProfileResponse>(`/api/customers/${id}/credit/limit`, {
      method: 'PUT',
      body: JSON.stringify({ creditLimit })
    })
  },
  
  suspendCredit: (id: string) => {
    return api<CustomerProfileResponse>(`/api/customers/${id}/credit/suspend`, { method: 'POST' })
  },
  
  activateCredit: (id: string) => {
    return api<CustomerProfileResponse>(`/api/customers/${id}/credit/activate`, { method: 'POST' })
  }
}
