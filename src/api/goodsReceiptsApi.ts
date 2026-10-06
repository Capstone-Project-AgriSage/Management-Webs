import { api, apiBlob } from './client'
import { buildQuery } from './stockApi'
import type { Paged, Uuid } from './types'

/** Goods receipts and the Excel import (flow L4, F4.3). All routes need Operate (Admin, Store Owner, Sales). Only DRAFT receipts change. */

export type ReceiptStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'

export interface GoodsReceiptListItem {
  id: Uuid
  receiptNumber: string
  supplierId: Uuid
  supplierName: string
  supplierInvoiceNumber: string | null
  receivedAt: string
  status: ReceiptStatus
  totalAmount: number
  itemCount: number
}

export interface GoodsReceiptItem {
  id: Uuid
  storeProductId: Uuid
  sku: string
  productName: string
  productPackagingId: Uuid
  unitName: string
  packagingName: string | null
  receivedQuantity: number
  conversionToBaseSnapshot: number
  baseQuantity: number
  purchaseUnitCost: number
  baseUnitCost: number
  lineTotalAmount: number
  supplierLotNumber: string | null
  manufacturingDate: string | null
  expiryDate: string | null
  /** Set when the receipt is confirmed: the lot the stock went into. */
  inventoryLotId: Uuid | null
  note: string | null
}

export interface GoodsReceipt {
  id: Uuid
  receiptNumber: string
  supplierId: Uuid
  supplierName: string
  supplierInvoiceNumber: string | null
  supplierInvoiceDate: string | null
  receivedAt: string
  receivedBy: Uuid
  /** MANUAL or EXCEL_TEMPLATE. */
  sourceType: string
  status: ReceiptStatus
  subtotalAmount: number
  totalAmount: number
  note: string | null
  confirmedAt: string | null
  confirmedBy: Uuid | null
  cancelledAt: string | null
  cancelledBy: Uuid | null
  cancelReason: string | null
  stockMovementId: Uuid | null
  items: GoodsReceiptItem[]
}

export interface ReceiptHeaderInput {
  supplierId: Uuid
  receivedAt?: string | null
  supplierInvoiceNumber?: string | null
  supplierInvoiceDate?: string | null
  note?: string | null
}

export interface ReceiptItemInput {
  receivedQuantity: number
  purchaseUnitCost: number
  supplierLotNumber?: string | null
  manufacturingDate?: string | null
  expiryDate?: string | null
  note?: string | null
}

export interface ReceiptImportRow {
  rowNumber: number
  sku: string | null
  packaging: string | null
  storeProductId: Uuid | null
  productPackagingId: Uuid | null
  productName: string | null
  quantity: number | null
  unitCost: number | null
  lotNumber: string | null
  expiryDate: string | null
  manufactureDate: string | null
  lineTotalAmount: number | null
  errors: { column: string; message: string }[]
}

export interface ReceiptImportPreview {
  fileName: string | null
  rowCount: number
  validRowCount: number
  subtotalAmount: number
  rows: ReceiptImportRow[]
}

function importForm(header: ReceiptHeaderInput, file: File): FormData {
  const form = new FormData()
  form.append('file', file)
  form.append('supplierId', header.supplierId)
  if (header.receivedAt) form.append('receivedAt', header.receivedAt)
  if (header.supplierInvoiceNumber) form.append('supplierInvoiceNumber', header.supplierInvoiceNumber)
  if (header.supplierInvoiceDate) form.append('supplierInvoiceDate', header.supplierInvoiceDate)
  if (header.note) form.append('note', header.note)
  return form
}

export const goodsReceiptsApi = {
  list: (params: { status?: ReceiptStatus; supplierId?: Uuid; fromDate?: string; toDate?: string; search?: string; page?: number; pageSize?: number }) =>
    api<Paged<GoodsReceiptListItem>>(`/api/goods-receipts${buildQuery(params)}`),

  get: (id: Uuid) => api<GoodsReceipt>(`/api/goods-receipts/${id}`),

  /** An empty DRAFT with its header; lines are added afterwards. */
  create: (header: ReceiptHeaderInput) =>
    api<GoodsReceipt>('/api/goods-receipts', { method: 'POST', body: JSON.stringify({ ...header, items: [] }) }),

  updateHeader: (id: Uuid, header: ReceiptHeaderInput & { receivedAt: string }) =>
    api<GoodsReceipt>(`/api/goods-receipts/${id}`, { method: 'PUT', body: JSON.stringify(header) }),

  addItem: (id: Uuid, item: ReceiptItemInput & { storeProductId: Uuid; productPackagingId: Uuid }) =>
    api<GoodsReceipt>(`/api/goods-receipts/${id}/items`, { method: 'POST', body: JSON.stringify(item) }),

  updateItem: (id: Uuid, itemId: Uuid, item: ReceiptItemInput) =>
    api<GoodsReceipt>(`/api/goods-receipts/${id}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(item) }),

  removeItem: (id: Uuid, itemId: Uuid) => api<GoodsReceipt>(`/api/goods-receipts/${id}/items/${itemId}`, { method: 'DELETE' }),

  /** Creates or finds the lots, adds the stock at cost and posts a STOCK_IN movement. */
  confirm: (id: Uuid) => api<GoodsReceipt>(`/api/goods-receipts/${id}/confirm`, { method: 'POST' }),

  /** DRAFT only; a confirmed receipt is corrected with an adjustment. */
  cancel: (id: Uuid, reason?: string) => api<GoodsReceipt>(`/api/goods-receipts/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: reason || null }) }),

  /** Soft delete of a DRAFT. */
  remove: (id: Uuid) => api<void>(`/api/goods-receipts/${id}`, { method: 'DELETE' }),

  downloadTemplate: () => apiBlob('/api/goods-receipts/import-template'),

  /** Nothing is saved: every row is checked like manual entry. */
  previewImport: (header: ReceiptHeaderInput, file: File) =>
    api<ReceiptImportPreview>('/api/goods-receipts/import/preview', { method: 'POST', body: importForm(header, file) }),

  /** Creates one DRAFT receipt (source EXCEL_TEMPLATE) when every row is valid; 422 with per-row errors otherwise. */
  importFile: (header: ReceiptHeaderInput, file: File) =>
    api<GoodsReceipt>('/api/goods-receipts/import', { method: 'POST', body: importForm(header, file) }),
}
