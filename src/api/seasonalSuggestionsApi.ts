import { api, toQuery } from './client'
import type { Paged } from './types'

// F4.7 seasonal product suggestions (backend FLOW_4 "Seasonal product suggestions"). Read only: the server's reminder
// prepares them and notifies; SEASONAL_RULES.READ lists and reads them, SEASONAL_RULES.MANAGE reads a rule filled in
// from one. No AI and no screen that asks for one.

export type SuggestionGroup = 'FERTILIZER' | 'CROP_PROTECTION' | 'SEED' | 'OTHER'
export type SuggestionConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type EvidenceKind = 'SALES' | 'LINK' | 'DIAGNOSIS' | 'ADVISORY' | 'RULE' | 'STOCK'

export interface SuggestionEvidence { kind: EvidenceKind; text: string }

export interface SuggestionItem {
  id: string; rank: number; productId: string
  /** The store product now; null while the store does not carry the product. */
  storeProductId: string | null; inStore: boolean
  sku: string; productName: string; baseUnit: string
  group: SuggestionGroup; confidence: SuggestionConfidence
  /** Written by the server from data. */
  reason: string
  evidence: SuggestionEvidence[]
  soldLastSeasonBase: number | null; sellableBase: number | null
  /** From the replenishment rules; null when the history is too short or the store does not carry it. */
  suggestedTargetBase: number | null
  orderByDate: string | null
}

/** An active seasonal rule of the same crop whose days overlap the season: the season is planned already. */
export interface CoveringRule { id: string; name: string }

export interface SeasonalSuggestion {
  id: string; cropType: string; cropName: string; region: string | null
  startsOn: string; endsOn: string; prepareDays: number; comparedFrom: string; comparedTo: string
  candidateCount: number; seasonalRuleId: string | null; createdAt: string
  items: SuggestionItem[]
  coveringRule: CoveringRule | null
}

export interface SeasonalSuggestionRow {
  id: string; cropType: string; cropName: string; startsOn: string; endsOn: string; itemCount: number; createdAt: string
  coveringRule: CoveringRule | null
}

/**
 * A seasonal rule filled in from a suggestion (backend FLOW_4 rule 6). Nothing is saved: the owner checks it and saves
 * it with the usual seasonal-rule create. `demandFactorBasis`: LAST_SEASON = median of how much faster each product sold
 * in last year's season than in the 90 days before it; DEFAULT = 1.5 when no product has enough history.
 */
export interface SeasonalRuleDraft {
  suggestionId: string; name: string; cropType: string; cropName: string; region: string | null
  startsOn: string; endsOn: string; prepareDays: number
  demandFactor: number; demandFactorBasis: 'LAST_SEASON' | 'DEFAULT'; demandFactorProducts: number
  comparedFrom: string; comparedTo: string; baselineFrom: string; baselineTo: string
  coveringRule: CoveringRule | null
  items: { storeProductId: string; sku: string; productName: string; baseUnit: string; targetStockLevelBase: number | null }[]
  /** Suggested products left out: the store does not carry them yet. */
  skipped: { productId: string; sku: string; productName: string; reason: 'NOT_CARRIED' }[]
}

export const seasonalSuggestionsApi = {
  /** Earliest season start first; `fromDate` keeps the seasons that have not ended by then. */
  list: (query: { cropType?: string; fromDate?: string; toDate?: string; page?: number; pageSize?: number }, signal?: AbortSignal) =>
    api<Paged<SeasonalSuggestionRow>>(`/api/inventory/seasonal-suggestions${toQuery(query)}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api<SeasonalSuggestion>(`/api/inventory/seasonal-suggestions/${id}`, { signal }),
  /** Needs SEASONAL_RULES.MANAGE, like saving the rule. */
  ruleDraft: (id: string, signal?: AbortSignal) =>
    api<SeasonalRuleDraft>(`/api/inventory/seasonal-suggestions/${id}/rule-draft`, { signal }),
}

export const GROUP_LABEL: Record<SuggestionGroup, string> = {
  FERTILIZER: 'Phân bón', CROP_PROTECTION: 'Thuốc BVTV', SEED: 'Giống', OTHER: 'Khác',
}
export const CONFIDENCE_LABEL: Record<SuggestionConfidence, string> = { HIGH: 'Nên nhập', MEDIUM: 'Cân nhắc', LOW: 'Tham khảo' }
