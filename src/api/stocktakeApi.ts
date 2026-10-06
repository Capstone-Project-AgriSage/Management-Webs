import { api } from './client'
import { buildQuery } from './stockApi'
import type { Paged, Uuid } from './types'

/** Stocktake (flow L4, F4.2). Create / count / refresh / cancel need Operate; completing needs Manage and a different person than the counters. */

export type StocktakeStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export type StocktakeReason = 'DAMAGED' | 'EXPIRED' | 'LOST' | 'STOCKTAKE_DIFFERENCE' | 'MANUAL_CORRECTION' | 'OTHER'

export interface StocktakeListItem {
  id: Uuid
  stocktakeNumber: string
  status: StocktakeStatus
  lineCount: number
  countedCount: number
  differenceCount: number
  createdBy: Uuid
  createdAt: string
  completedAt: string | null
}

export interface StocktakeItem {
  id: Uuid
  inventoryLotId: Uuid
  sku: string
  productName: string
  lotNumber: string | null
  expiryDate: string | null
  systemQuantitySnapshot: number
  snapshotAt: string
  countedQuantity: number | null
  differenceQuantity: number | null
  /** Average cost when the snapshot was taken; null when the lot was empty. */
  unitCostSnapshot: number | null
  differenceCostValue: number | null
  reasonCode: StocktakeReason | null
  note: string | null
  countedBy: Uuid | null
  countedAt: string | null
  /** A posted movement touched this lot around the count: the line must be refreshed and recounted. */
  isStale: boolean
}

export interface Stocktake {
  id: Uuid
  stocktakeNumber: string
  status: StocktakeStatus
  note: string | null
  createdBy: Uuid
  createdAt: string
  startedBy: Uuid | null
  startedAt: string | null
  completedBy: Uuid | null
  completedAt: string | null
  totals: { lines: number; counted: number; withDifference: number; differenceCostValue: number }
  /** The ADJUSTMENT_IN / ADJUSTMENT_OUT documents created when the stocktake was completed. */
  movements: { id: Uuid; movementNumber: string; movementType: string }[]
  items: StocktakeItem[]
}

export interface StocktakeCount {
  itemId: Uuid
  countedQuantity: number
  unitCost?: number | null
  reasonCode?: StocktakeReason | null
  note?: string | null
}

export const stocktakeApi = {
  list: (params: { status?: StocktakeStatus; fromDate?: string; toDate?: string; search?: string; page?: number; pageSize?: number }) =>
    api<Paged<StocktakeListItem>>(`/api/stocktakes${buildQuery(params)}`),

  get: (id: Uuid) => api<Stocktake>(`/api/stocktakes/${id}`),

  /** No `storeProductIds` = every store product. One line per lot in scope. */
  create: (data: { storeProductIds?: Uuid[]; includeEmptyLots: boolean; note?: string | null }) =>
    api<Stocktake>('/api/stocktakes', { method: 'POST', body: JSON.stringify(data) }),

  start: (id: Uuid) => api<Stocktake>(`/api/stocktakes/${id}/start`, { method: 'POST' }),

  saveCounts: (id: Uuid, counts: StocktakeCount[]) =>
    api<Stocktake>(`/api/stocktakes/${id}/counts`, { method: 'PUT', body: JSON.stringify({ counts }) }),

  /** Re-snapshots only the stale lines and clears their counts. */
  refreshStale: (id: Uuid) => api<Stocktake>(`/api/stocktakes/${id}/refresh-stale`, { method: 'POST' }),

  /** Manage. Posts one ADJUSTMENT_IN and one ADJUSTMENT_OUT movement for the differences. */
  complete: (id: Uuid) => api<Stocktake>(`/api/stocktakes/${id}/complete`, { method: 'POST' }),

  cancel: (id: Uuid, reason?: string) => api<Stocktake>(`/api/stocktakes/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: reason || null }) }),

  /** DRAFT only. */
  remove: (id: Uuid) => api<void>(`/api/stocktakes/${id}`, { method: 'DELETE' }),
}
