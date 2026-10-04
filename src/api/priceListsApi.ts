import { api } from './client'
import type { Uuid, Paged } from './types'

export interface PriceList {
  id: Uuid
  code: string
  name: string
  effectiveFrom: string
  effectiveTo: string | null
  isWalkInDefault: boolean
  description: string | null
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE'
  storeId: Uuid
}

export interface PriceListItem {
  id: Uuid
  storeProductId: Uuid
  productPackagingId: Uuid
  sellingPrice: number
  productName: string
  packagingName: string
}

export const priceListsApi = {
  getPriceLists: (params?: { status?: string; isWalkInDefault?: boolean; search?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.append('status', params.status)
    if (params?.isWalkInDefault !== undefined) searchParams.append('isWalkInDefault', params.isWalkInDefault.toString())
    if (params?.search) searchParams.append('search', params.search)
    return api<Paged<PriceList>>(`/api/price-lists?${searchParams.toString()}`)
  },

  create: (data: { code: string; name: string; effectiveFrom: string; effectiveTo?: string; isWalkInDefault: boolean; description?: string }) => {
    return api<PriceList>('/api/price-lists', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  update: (id: Uuid, data: { name: string; effectiveFrom: string; effectiveTo?: string; isWalkInDefault: boolean; description?: string }) => {
    return api<PriceList>(`/api/price-lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  delete: (id: Uuid) => {
    return api<void>(`/api/price-lists/${id}`, { method: 'DELETE' })
  },

  activate: (id: Uuid) => {
    return api<void>(`/api/price-lists/${id}/activate`, { method: 'POST' })
  },

  deactivate: (id: Uuid) => {
    return api<void>(`/api/price-lists/${id}/deactivate`, { method: 'POST' })
  },

  getItems: (priceListId: Uuid, params?: { search?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    return api<Paged<PriceListItem>>(`/api/price-lists/${priceListId}/items?${searchParams.toString()}`)
  },

  updateItems: (priceListId: Uuid, data: { items: { storeProductId: Uuid; productPackagingId: Uuid; sellingPrice: number }[] }) => {
    return api<{ created: number; updated: number }>(`/api/price-lists/${priceListId}/items`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  deleteItem: (priceListId: Uuid, itemId: Uuid) => {
    return api<void>(`/api/price-lists/${priceListId}/items/${itemId}`, { method: 'DELETE' })
  }
}
