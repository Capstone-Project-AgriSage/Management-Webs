import { api, toQuery } from './client'
import type { Paged, CatalogProduct, CatalogProductDetail, CatalogCategory } from './types'

/** Store product as the owner manages it (any sellable state), with the catalog product id needed for its packagings. */
export interface StoreProductRef {
  id: string
  productId: string
  sku: string
  name: string
  isSellable: boolean
  isActive: boolean
}

/** Packaging of a product as defined in the master data; only sale units can carry a price. */
export interface ProductPackagingRef {
  id: string
  unitName: string | null
  packagingName: string | null
  conversionToBase: number
  isBaseUnit: boolean
  isSaleUnit: boolean
  status: string
}

export const catalogApi = {
  getStoreProducts: (params: { search?: string; page?: number; pageSize?: number } = {}) =>
    api<Paged<StoreProductRef>>(`/api/store-products${toQuery({ isActive: true, ...params })}`),

  getProductPackagings: (productId: string) =>
    api<{ id: string; packagings: ProductPackagingRef[] }>(`/api/products/${productId}`).then((p) => p.packagings ?? []),

  getCategories: () => {
    return api<Paged<CatalogCategory>>(`/api/catalog/categories`)
  },
  getProducts: (params?: { search?: string; categoryId?: string; page?: number; pageSize?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.categoryId) searchParams.append('categoryId', params.categoryId)
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString())
    
    const qs = searchParams.toString()
    return api<Paged<CatalogProduct>>(`/api/catalog/products${qs ? `?${qs}` : ''}`)
  },
  
  getProductDetail: (id: string) => {
    return api<CatalogProductDetail>(`/api/catalog/products/${id}`)
  }
}
