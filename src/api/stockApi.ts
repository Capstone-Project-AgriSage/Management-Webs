import { api } from './client'
import type { Paged, Uuid } from './types'

/** Stock overview, alerts, lots and manual adjustments (flow L4, F4.1 / F4.2). Quantities are in BASE units of the product. */

export type LotStatus = 'ACTIVE' | 'QUARANTINED' | 'EXPIRED' | 'BLOCKED' | 'DEPLETED'

export interface StockSummaryItem {
  storeProductId: Uuid
  sku: string
  productName: string
  /** Unit code of the base unit: KG, BAG, BOTTLE, PACK ... (see utils/units). */
  baseUnit: string
  onHandBaseQuantity: number
  reservedBaseQuantity: number
  availableBaseQuantity: number
  /** Only ACTIVE, not expired lots: what can still be sold. */
  sellableAvailableBaseQuantity: number
  stockValue: number
  minStockLevelBase: number | null
  isLowStock: boolean
  nearestExpiryDate: string | null
  lotCount: number
}

export type AlertType = 'EXPIRING' | 'EXPIRED' | 'LOW_STOCK'

export interface InventoryAlertItem {
  type: AlertType
  storeProductId: Uuid
  sku: string
  productName: string
  inventoryLotId: Uuid | null
  lotNumber: string | null
  expiryDate: string | null
  daysToExpiry: number | null
  lotStatus: LotStatus | null
  onHandBaseQuantity: number
  reservedBaseQuantity: number
  minStockLevelBase: number | null
}

export interface StockLot {
  id: Uuid
  storeProductId: Uuid
  productId: Uuid
  sku: string
  productName: string
  lotNumber: string | null
  manufacturingDate: string | null
  expiryDate: string | null
  isExpired: boolean
  status: LotStatus
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number
  averageUnitCost: number | null
  totalCostValue: number
}

export type AdjustmentReason = 'DAMAGED' | 'EXPIRED' | 'LOST' | 'MANUAL_CORRECTION' | 'OTHER'

export interface StockAdjustmentRequest {
  reasonCode: AdjustmentReason
  note: string
  lines: { inventoryLotId: Uuid; quantityDeltaBase: number; unitCost?: number | null }[]
}

export interface StockMovementItem {
  id: Uuid
  inventoryLotId: Uuid
  lotNumber: string | null
  expiryDate: string | null
  sku: string
  productName: string
  quantityDeltaBase: number
  unitCostSnapshot: number
  totalCostSnapshot: number
  quantityOnHandAfter: number | null
  totalCostValueAfter: number | null
  note: string | null
}

export interface StockMovement {
  id: Uuid
  movementNumber: string
  movementType: string
  status: string
  occurredAt: string
  goodsReceiptId: Uuid | null
  orderId: Uuid | null
  deliveryId: Uuid | null
  stocktakeId: Uuid | null
  reversalOfMovementId: Uuid | null
  reasonCode: string | null
  reason: string | null
  createdBy: Uuid
  postedAt: string | null
  postedBy: Uuid | null
  items: StockMovementItem[]
}

export interface ExpireDueResult {
  expiredLotCount: number
  lots: { id: Uuid; lotNumber: string | null; expiryDate: string | null }[]
}

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') sp.append(key, String(value))
  }
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export const stockApi = {
  getSummary: (params: { search?: string; categoryId?: string; lowStockOnly?: boolean; hasStock?: boolean; page?: number; pageSize?: number }) =>
    api<Paged<StockSummaryItem>>(`/api/inventory/stock-summary${query(params)}`),

  getAlerts: (params: { type?: AlertType; withinDays?: number; page?: number; pageSize?: number }) =>
    api<Paged<InventoryAlertItem>>(`/api/inventory/alerts${query(params)}`),

  getLots: (params: { storeProductId?: Uuid; status?: LotStatus; hasStock?: boolean; search?: string; page?: number; pageSize?: number }) =>
    api<Paged<StockLot>>(`/api/inventory/lots${query(params)}`),

  /** Manage. Marks every ACTIVE lot past its expiry date as EXPIRED. */
  expireDue: () => api<ExpireDueResult>('/api/inventory/lots/expire-due', { method: 'POST' }),

  /** Manage. An expired lot cannot be set back to ACTIVE; DEPLETED is derived. */
  changeLotStatus: (lotId: Uuid, status: 'ACTIVE' | 'QUARANTINED' | 'BLOCKED' | 'EXPIRED') =>
    api<StockLot>(`/api/inventory/lots/${lotId}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  /** Manage. All deltas positive = ADJUSTMENT_IN, all negative = ADJUSTMENT_OUT. */
  createAdjustment: (data: StockAdjustmentRequest) =>
    api<StockMovement>('/api/inventory/adjustments', { method: 'POST', body: JSON.stringify(data) }),
}

export { query as buildQuery }
