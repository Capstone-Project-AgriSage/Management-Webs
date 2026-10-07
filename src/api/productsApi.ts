import { api, toQuery } from './client'
import type { Paged, Uuid } from './types'

// Catalog management for the store owner and the admin: products with their packagings, the lookups they need,
// the store's own product list (sellable or not) and the product image upload. Backend: ProductsController,
// StoreProductsController, CategoriesController, BrandsController, UnitsController, FilesController.

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'

export interface ProductListItem {
  id: Uuid
  sku: string
  name: string
  categoryId: Uuid
  categoryName: string
  brandId: Uuid | null
  brandName: string | null
  imageUrl: string | null
  status: ProductStatus
}

export interface ProductPackagingRow {
  id: Uuid
  unitId: Uuid
  unitCode: string
  unitName: string
  packagingName: string | null
  conversionToBase: number
  isBaseUnit: boolean
  isPurchaseUnit: boolean
  isSaleUnit: boolean
  barcode: string | null
  status: 'ACTIVE' | 'INACTIVE'
}

export interface ProductIngredientRow {
  activeIngredientId: Uuid
  name: string
  concentration: string | null
  note: string | null
}

export interface ProductStoreInfo {
  storeProductId: Uuid
  isSellable: boolean
  isActive: boolean
}

export interface ProductResponse {
  id: Uuid
  sku: string
  name: string
  categoryId: Uuid
  categoryName: string
  brandId: Uuid | null
  brandName: string | null
  description: string | null
  usageInstructions: string | null
  requiresLotTracking: boolean
  requiresExpiryDate: boolean
  imageUrl: string | null
  status: ProductStatus
  packagings: ProductPackagingRow[]
  ingredients: ProductIngredientRow[]
  store: ProductStoreInfo | null
}

export interface PackagingInput {
  unitId: Uuid
  conversionToBase: number
  isBaseUnit: boolean
  isPurchaseUnit: boolean
  isSaleUnit: boolean
  packagingName?: string | null
  barcode?: string | null
}

export interface CreateProductInput {
  sku: string
  name: string
  categoryId: Uuid
  packagings: PackagingInput[]
  brandId?: Uuid | null
  description?: string | null
  usageInstructions?: string | null
  imageUrl?: string | null
  requiresLotTracking: boolean
  requiresExpiryDate: boolean
}

/** PUT replaces these fields: send the current value of the ones that do not change. imageUrl null removes the image. */
export interface UpdateProductInput {
  name: string
  categoryId: Uuid
  brandId?: Uuid | null
  description?: string | null
  usageInstructions?: string | null
  imageUrl?: string | null
}

export interface ProductListQuery {
  search?: string
  categoryId?: Uuid
  status?: ProductStatus
  page?: number
  pageSize?: number
}

export interface CategoryOption {
  id: Uuid
  parentId: Uuid | null
  code: string
  name: string
  isActive: boolean
}

export interface BrandOption {
  id: Uuid
  name: string
  isActive: boolean
}

export interface UnitOption {
  id: Uuid
  code: string
  name: string
  symbol: string | null
  isActive: boolean
}

/** A product of the store's own list: only an active, sellable one reaches the public catalogue and the counter. */
export interface StoreProductRow {
  id: Uuid
  productId: Uuid
  sku: string
  name: string
  imageUrl: string | null
  productStatus: string
  storeSku: string | null
  minStockLevelBase: number | null
  isSellable: boolean
  isActive: boolean
}

export interface UploadedImage {
  url: string
  storageKey: string
  sizeBytes: number
}

/** JPEG, PNG or WebP, at most 3 MB (the server also checks the file content, not the name). */
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** The storage key of an image we uploaded, read back from its public URL; null for any other URL (kept untouched). */
export function storageKeyFromUrl(url: string | null | undefined): string | null {
  const match = url ? /(\d{4}\/\d{2}\/[0-9a-f]{32}\.(?:jpg|png|webp))$/.exec(url) : null
  return match ? match[1] : null
}

const MAX_LOOKUP = 100

export const productsApi = {
  list: (q: ProductListQuery = {}) =>
    api<Paged<ProductListItem>>(
      `/api/products${toQuery({ Search: q.search, CategoryId: q.categoryId, Status: q.status, Page: q.page, PageSize: q.pageSize })}`,
    ),

  get: (id: Uuid) => api<ProductResponse>(`/api/products/${id}`),

  create: (data: CreateProductInput) => api<ProductResponse>('/api/products', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: Uuid, data: UpdateProductInput) => api<ProductResponse>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  changeStatus: (id: Uuid, status: ProductStatus) =>
    api<ProductResponse>(`/api/products/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  /** "Delete" is DISCONTINUED plus the store product deactivated; nothing is removed. */
  discontinue: (id: Uuid) => api<void>(`/api/products/${id}`, { method: 'DELETE' }),

  categories: () => api<Paged<CategoryOption>>(`/api/categories${toQuery({ IsActive: true, PageSize: MAX_LOOKUP })}`),

  brands: () => api<Paged<BrandOption>>(`/api/brands${toQuery({ IsActive: true, PageSize: MAX_LOOKUP })}`),

  units: () => api<Paged<UnitOption>>(`/api/units${toQuery({ PageSize: MAX_LOOKUP })}`),

  /** Every store product (a store has a few dozen): lets the product list show which ones are on sale. */
  async storeProducts(): Promise<StoreProductRow[]> {
    const all: StoreProductRow[] = []
    for (let page = 1; page <= 20; page++) {
      const res = await api<Paged<StoreProductRow>>(`/api/store-products${toQuery({ Page: page, PageSize: MAX_LOOKUP })}`)
      all.push(...res.items)
      if (page >= res.totalPages) break
    }
    return all
  },

  addToStore: (productId: Uuid) =>
    api<StoreProductRow>('/api/store-products', { method: 'POST', body: JSON.stringify({ productId }) }),

  setSellable: (storeProductId: Uuid, sellable: boolean) =>
    api<void>(`/api/store-products/${storeProductId}/${sellable ? 'mark-sellable' : 'mark-not-sellable'}`, { method: 'POST' }),

  setStoreActive: (storeProductId: Uuid, active: boolean) =>
    api<void>(`/api/store-products/${storeProductId}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }),

  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api<UploadedImage>('/api/files/product-images', { method: 'POST', body: form })
  },

  /** Only a key produced by an upload is accepted. Errors are ignored by the callers: a leftover file is harmless. */
  deleteImage: (storageKey: string) => api<void>(`/api/files/product-images${toQuery({ key: storageKey })}`, { method: 'DELETE' }),
}
