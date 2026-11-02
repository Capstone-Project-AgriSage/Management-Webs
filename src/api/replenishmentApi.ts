import { api, apiBlob, saveBlob, toQuery } from './client'
import type { Paged } from './types'

export interface ReplenishmentSettings {
  enabled: boolean; targetStockLevelBase: number | null; leadTimeDays: number
  safetyStockBase: number; targetCoverageDays: number
}
export interface StorePlanningProduct {
  id: string; name: string; sku: string; storeSku: string | null
  minStockLevelBase: number | null; replenishment: ReplenishmentSettings
}
export interface SeasonalProduct {
  storeProductId: string; sku: string; productName: string; targetStockLevelBase: number | null
}
export interface SeasonalRule {
  id: string; name: string; cropType: string; region: string | null; startsOn: string; endsOn: string
  prepareDays: number; demandFactor: number; isActive: boolean; version: number; items: SeasonalProduct[]
}
export interface SeasonalRuleInput {
  name: string; cropType: string; region: string | null; startsOn: string; endsOn: string
  prepareDays: number; demandFactor: number; isActive: boolean; version?: number
  items: { storeProductId: string; targetStockLevelBase: number | null }[]
}
export interface SeasonalInfluence {
  id: string; name: string; cropType: string; region: string | null; startsOn: string; endsOn: string
  demandFactor: number; targetStockLevelBase: number | null
}
export interface ReplenishmentItem {
  storeProductId: string; sku: string; productName: string; baseUnit: string
  onHandBaseQuantity: number; reservedBaseQuantity: number; sellableBaseQuantity: number
  minStockLevelBase: number | null; targetBaseQuantity: number | null; suggestedBaseQuantity: number | null
  suggestedPurchaseQuantity: number | null; purchasePackagingId: string | null; purchaseUnit: string | null
  purchaseConversionToBase: number; averageDailySales: number | null; expectedDemandBaseQuantity: number | null
  daysOfStock: number | null; estimatedStockoutDate: string | null; suggestedOrderDate: string | null
  leadTimeDays: number; soldBaseQuantity: number; observedDays: number; saleDays: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'; dataStatus: string; reasonCodes: string[]; explanation: string
  warnings: string[]; seasons: SeasonalInfluence[]; forecast: { date: string; expectedBaseQuantity: number }[]
}
export type PlanningView = 'suggestions' | 'stockout' | 'forecast' | 'seasonal'
export interface PlanningQuery {
  search?: string; categoryId?: string; storeProductId?: string; priority?: string; reason?: string
  dataStatus?: string; historyDays?: number; horizonDays?: number; page?: number; pageSize?: number
  sortBy?: string; descending?: boolean
}
export interface PlanningPage extends Paged<ReplenishmentItem> {
  summary: { totalProducts: number; outOfStock: number; highPriority: number; needsConfiguration: number
    insufficientHistory: number; seasonalProducts: number }
  generatedAt: string; fromDate: string; toDate: string; horizonDays: number
}
export interface SeasonalPage extends Paged<SeasonalRule> {
  summary: { total: number; active: number; upcoming: number; ended: number }
}
export interface VelocityItem {
  storeProductId: string; sku: string; productName: string; baseUnit: string; soldBaseQuantity: number
  onHandBaseQuantity: number; sellableBaseQuantity: number; averageDailySales: number | null
  daysOfStock: number | null; lastSaleDate: string | null; velocity: string; dataStatus: string
}
export interface VelocityPage extends Paged<VelocityItem> {
  summary: { products: number; fast: number; slow: number; noSales: number }; fromDate: string; toDate: string
}
export interface ExpiryRiskItem {
  inventoryLotId: string; storeProductId: string; sku: string; productName: string; baseUnit: string
  lotNumber: string | null; expiryDate: string; lotStatus: string; onHandBaseQuantity: number
  reservedBaseQuantity: number; atRiskBaseQuantity: number | null; atRiskValue: number | null; dataStatus: string
}
export interface ExpiryRiskPage extends Paged<ExpiryRiskItem> {
  summary: { lots: number; knownRiskLots: number; unknownRiskLots: number; knownRiskValue: number }; withinDays: number
}
export const replenishmentApi = {
  list: (view: PlanningView, query: PlanningQuery, signal?: AbortSignal) =>
    api<PlanningPage>(`/api/inventory/replenishment/${view}${toQuery({ ...query })}`, { signal }),
  product: (id: string, signal?: AbortSignal) => api<StorePlanningProduct>(`/api/store-products/${id}`, { signal }),
  configure: (id: string, data: { storeSku: string | null; minStockLevelBase: number | null; replenishment: ReplenishmentSettings }) =>
    api<StorePlanningProduct>(`/api/store-products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  rules: (query: { search?: string; isActive?: boolean; fromDate?: string; toDate?: string; page?: number; pageSize?: number }, signal?: AbortSignal) =>
    api<SeasonalPage>(`/api/inventory/seasonal-rules${toQuery(query)}`, { signal }),
  rule: (id: string, signal?: AbortSignal) => api<SeasonalRule>(`/api/inventory/seasonal-rules/${id}`, { signal }),
  saveRule: (id: string | null, data: SeasonalRuleInput) => api<SeasonalRule>(`/api/inventory/seasonal-rules${id ? `/${id}` : ''}`,
    { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }),
  deactivate: (id: string) => api<SeasonalRule>(`/api/inventory/seasonal-rules/${id}/deactivate`, { method: 'POST' }),
  velocity: (query: { search?: string; categoryId?: string; historyDays?: number; velocity?: string; page?: number; pageSize?: number }, signal?: AbortSignal) =>
    api<VelocityPage>(`/api/reports/inventory-turnover${toQuery(query)}`, { signal }),
  expiryRisk: (query: { search?: string; categoryId?: string; historyDays?: number; withinDays?: number; page?: number; pageSize?: number }, signal?: AbortSignal) =>
    api<ExpiryRiskPage>(`/api/inventory/expiry-risk${toQuery(query)}`, { signal }),
  exportMovement: async (query: { fromDate: string; toDate: string; categoryId?: string; search?: string }) => {
    const result = await apiBlob(`/api/reports/inventory-movement/export${toQuery(query)}`)
    saveBlob(result.blob, result.fileName ?? 'nhap-xuat-ton.xlsx')
  },
}
