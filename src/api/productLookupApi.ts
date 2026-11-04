import { api } from './client'
import { lookupCache } from './lookupCache'
import { buildQuery } from './stockApi'
import type { Paged, Uuid } from './types'

/** Read-only product lookups for the receiving screens: which store products exist and which packagings can be bought. */

export interface StoreProductRef {
  id: Uuid
  productId: Uuid
  sku: string
  name: string
  storeSku: string | null
  productStatus: string
  isActive: boolean
}

export interface ProductPackaging {
  id: Uuid
  unitId: Uuid
  unitCode: string
  unitName: string
  packagingName: string | null
  conversionToBase: number
  isBaseUnit: boolean
  isPurchaseUnit: boolean
  isSaleUnit: boolean
  status: string
}

export interface ProductDetail {
  id: Uuid
  sku: string
  name: string
  status: string
  requiresLotTracking: boolean
  requiresExpiryDate: boolean
  packagings: ProductPackaging[]
}

export const productLookupApi = {
  searchStoreProducts: (params: { search?: string; page?: number; pageSize?: number }) =>
    api<Paged<StoreProductRef>>(`/api/store-products${buildQuery({ isActive: true, ...params })}`),

  getStoreProduct: (storeProductId: Uuid) => api<StoreProductRef>(`/api/store-products/${storeProductId}`),

  getProduct: (productId: Uuid) => lookupCache.get(`product-lookup:${productId}`, async () => {
    const product = await api<ProductDetail>(`/api/products/${productId}`)
    // Cache only the receiving lookup fields, excluding operational store flags in the full API response.
    const { id, sku, name, status, requiresLotTracking, requiresExpiryDate, packagings } = product
    return { id, sku, name, status, requiresLotTracking, requiresExpiryDate, packagings }
  }),
}
