import { api } from './client'
import { buildQuery } from './stockApi'
import type { Uuid } from './types'

/** Inventory reports (flow L4, F4.6). Report routes need the Manage permission (Admin, Store Owner). */

export interface InventoryValuationRow {
  storeProductId: Uuid
  sku: string
  productName: string
  category: string | null
  onHandBaseQuantity: number
  averageUnitCost: number | null
  stockValue: number
  expiredValue: number
}

export interface InventoryValuationReport {
  rows: InventoryValuationRow[]
  byCategory: { categoryId: Uuid; name: string; stockValue: number }[]
  totals: { stockValue: number; expiredValue: number }
}

export interface InventoryMovementAmount {
  quantity: number
  value: number
}

export interface InventoryMovementRow {
  storeProductId: Uuid
  sku: string
  productName: string
  baseUnit: string
  openingQuantity: number
  openingValue: number
  stockIn: InventoryMovementAmount
  returnIn: InventoryMovementAmount
  adjustmentIn: InventoryMovementAmount
  sale: InventoryMovementAmount
  adjustmentOut: InventoryMovementAmount
  reversal: InventoryMovementAmount
  closingQuantity: number
  closingValue: number
}

export interface InventoryMovementReport {
  fromDate: string
  toDate: string
  rows: InventoryMovementRow[]
  totals: {
    openingValue: number
    stockIn: number
    returnIn: number
    adjustmentIn: number
    sale: number
    adjustmentOut: number
    reversal: number
    closingValue: number
  }
}

export const inventoryReportsApi = {
  getValuation: (params: { categoryId?: Uuid } = {}, signal?: AbortSignal) =>
    api<InventoryValuationReport>(`/api/reports/inventory-valuation${buildQuery(params)}`, { signal }),

  getMovement: (params: { fromDate: string; toDate: string; categoryId?: Uuid }, signal?: AbortSignal) =>
    api<InventoryMovementReport>(`/api/reports/inventory-movement${buildQuery(params)}`, { signal }),
}
