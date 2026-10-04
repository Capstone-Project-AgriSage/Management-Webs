import { api } from './client'
import type { InventoryLot, Paged, Uuid } from './types'

export const inventoryApi = {
  getLots: (params?: { storeProductId?: string; hasStock?: boolean; status?: string; expiringBefore?: string; search?: string; page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.storeProductId) searchParams.append('storeProductId', params.storeProductId)
    if (params?.hasStock !== undefined) searchParams.append('hasStock', params.hasStock.toString())
    if (params?.status) searchParams.append('status', params.status)
    if (params?.expiringBefore) searchParams.append('expiringBefore', params.expiringBefore)
    if (params?.search) searchParams.append('search', params.search)
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString())
    
    const qs = searchParams.toString()
    return api<Paged<InventoryLot>>(`/api/inventory/lots${qs ? `?${qs}` : ''}`)
  },

  updateLotStatus: (lotId: Uuid, status: 'ACTIVE' | 'QUARANTINED' | 'BLOCKED' | 'DEPLETED') => {
    return api<InventoryLot>(`/api/inventory/lots/${lotId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    })
  }
}
