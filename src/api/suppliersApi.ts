import { api } from './client'
import { buildQuery } from './stockApi'
import type { Paged, Uuid } from './types'

/** Suppliers (flow L4 maintains them). Read: Admin, Store Owner, Sales. Write: Admin and Store Owner. */

export interface Supplier {
  id: Uuid
  code: string | null
  name: string
  taxCode: string | null
  phoneNumber: string | null
  email: string | null
  contactPerson: string | null
  addressLine: string | null
  ward: string | null
  district: string | null
  province: string | null
  note: string | null
  isActive: boolean
}

export type SupplierInput = Omit<Supplier, 'id' | 'isActive'>

export const suppliersApi = {
  list: (params: { isActive?: boolean; search?: string; page?: number; pageSize?: number }) =>
    api<Paged<Supplier>>(`/api/suppliers${buildQuery(params)}`),

  get: (id: Uuid) => api<Supplier>(`/api/suppliers/${id}`),

  create: (data: SupplierInput) => api<Supplier>('/api/suppliers', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: Uuid, data: SupplierInput) => api<Supplier>(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  /** Soft delete; refused (409) once a goods receipt used the supplier: deactivate it instead. */
  remove: (id: Uuid) => api<void>(`/api/suppliers/${id}`, { method: 'DELETE' }),

  activate: (id: Uuid) => api<void>(`/api/suppliers/${id}/activate`, { method: 'POST' }),

  deactivate: (id: Uuid) => api<void>(`/api/suppliers/${id}/deactivate`, { method: 'POST' }),
}
