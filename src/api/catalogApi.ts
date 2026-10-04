import { api } from './client'
import type { Paged, CatalogProduct, CatalogProductDetail, CatalogCategory } from './types'

export const catalogApi = {
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
