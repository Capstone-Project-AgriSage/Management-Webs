import { api, toQuery } from './client'
import type { Paged } from './types'
import { LIST_PAGE_SIZE } from '@/utils/pagination'

export type CatalogKind = 'categories' | 'active-ingredients'
export interface AdminCatalogRow {
  id: string
  code: string | null
  name: string
  description: string | null
  isActive: boolean
  parentId?: string | null
  displayOrder?: number
}
export interface CatalogInput { code?: string | null; name: string; description: string | null; parentId?: string | null; displayOrder?: number }
export const adminCatalogApi = {
  list: (kind: CatalogKind, page: number, search: string, isActive: boolean | undefined, signal?: AbortSignal) =>
    api<Paged<AdminCatalogRow>>(`/api/${kind}${toQuery({ page, pageSize: LIST_PAGE_SIZE, search: search || undefined, isActive })}`, { signal }),
  create: (kind: CatalogKind, data: CatalogInput) => api<AdminCatalogRow>(`/api/${kind}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (kind: CatalogKind, id: string, data: CatalogInput) => api<AdminCatalogRow>(`/api/${kind}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setActive: (kind: CatalogKind, id: string, active: boolean) => api<void>(`/api/${kind}/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }),
  remove: (kind: CatalogKind, id: string) => api<void>(`/api/${kind}/${id}`, { method: 'DELETE' }),
}
