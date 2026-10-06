import { api, toQuery } from './client'
import type { Uuid, Paged } from './types'

// FE_GUIDE_FLOW_1 §M12 — writes are Manage (store owner, admin); sales staff only read.

export type PriceListStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'

export interface PriceList {
  id: Uuid
  code: string
  name: string
  description: string | null
  effectiveFrom: string
  effectiveTo: string | null
  isWalkInDefault: boolean
  status: PriceListStatus
  itemCount: number
  groups: { id: Uuid; code: string; name: string }[]
  createdAt: string
}

export interface PriceListItem {
  id: Uuid
  storeProductId: Uuid
  productPackagingId: Uuid
  sku: string | null
  productName: string
  packagingName: string | null
  sellingPrice: number
}

export interface PriceListWriteRequest {
  name: string
  effectiveFrom: string
  effectiveTo?: string | null
  isWalkInDefault: boolean
  description?: string | null
}

export interface PriceListItemInput {
  storeProductId: Uuid
  productPackagingId: Uuid
  sellingPrice: number
}

/**
 * Validity dates are DateTimeOffset on the server and only a UTC offset is stored: a bare "2026-10-06" is read with
 * the server's +07:00 offset and fails with a 500. Send the day as UTC midnight, like the existing lists.
 */
const toUtcDay = (day: string | null | undefined) => (day ? `${day.slice(0, 10)}T00:00:00Z` : null)

const withUtcDays = <T extends PriceListWriteRequest>(data: T): T => ({
  ...data,
  effectiveFrom: toUtcDay(data.effectiveFrom) as string,
  effectiveTo: toUtcDay(data.effectiveTo),
})

export const priceListsApi = {
  getPriceLists: (params: { status?: string; isWalkInDefault?: boolean; search?: string; page?: number; pageSize?: number } = {}) =>
    api<Paged<PriceList>>(`/api/price-lists${toQuery(params)}`),

  create: (data: PriceListWriteRequest & { code: string }) =>
    api<PriceList>('/api/price-lists', { method: 'POST', body: JSON.stringify(withUtcDays(data)) }),

  update: (id: Uuid, data: PriceListWriteRequest) =>
    api<PriceList>(`/api/price-lists/${id}`, { method: 'PUT', body: JSON.stringify(withUtcDays(data)) }),

  /** Only a draft list that was never used can be deleted. */
  delete: (id: Uuid) => api<void>(`/api/price-lists/${id}`, { method: 'DELETE' }),

  activate: (id: Uuid) => api<PriceList>(`/api/price-lists/${id}/activate`, { method: 'POST' }),

  deactivate: (id: Uuid) => api<PriceList>(`/api/price-lists/${id}/deactivate`, { method: 'POST' }),

  getItems: (priceListId: Uuid, params: { search?: string; page?: number; pageSize?: number } = {}) =>
    api<Paged<PriceListItem>>(`/api/price-lists/${priceListId}/items${toQuery(params)}`),

  /** Creates or updates up to 500 prices at once; one invalid row rejects the whole batch (422, errors["items[i]"]). */
  updateItems: (priceListId: Uuid, items: PriceListItemInput[]) =>
    api<{ created: number; updated: number }>(`/api/price-lists/${priceListId}/items`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),

  deleteItem: (priceListId: Uuid, itemId: Uuid) =>
    api<void>(`/api/price-lists/${priceListId}/items/${itemId}`, { method: 'DELETE' }),
}
