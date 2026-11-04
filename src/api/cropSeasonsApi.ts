import { api, toQuery } from './client'
import type { Uuid, Paged } from './types'
import type { RolloverReasonCode } from './debtApi'

// Debt by crop season (FE_GUIDE_FLOW_3 §4.1, §10). Dates are Vietnam days (yyyy-MM-dd); instants are UTC.

export type CropSeasonStatus = 'PLANNED' | 'OPEN' | 'HARVESTING' | 'COLLECTING' | 'CLOSED'

/** Debt figures of a season: `originated` = entries born in it (never changes), `collecting` = entries being collected in it. */
export interface DebtFigures {
  outstandingAmount: number
  openEntryCount: number
}

/** Present only on the PUT response that asked for applyNewDueDateToCollectingDebts; null or absent everywhere else. */
export interface DebtExtensionResult {
  moved: number
  skippedDisputed: number
}

export interface CropSeason {
  id: Uuid
  code: string
  name: string
  cropType: string
  /** Opens the order window; the server fills it from the previous season's harvestStart (only the first season is typed in). */
  orderWindowStart: string
  /** From this day new orders go to the next season. */
  harvestStart: string
  harvestEnd: string
  graceDays: number
  /** harvestEnd + graceDays, computed by the server. */
  paymentDueDate: string
  status: CropSeasonStatus
  seasonalRuleId: Uuid | null
  closedAt: string | null
  /** Required when updating or closing; 409 means someone else saved first. */
  version: number
  originated: DebtFigures
  collecting: DebtFigures
  debtExtension?: DebtExtensionResult | null
}

export interface CropSeasonCreateRequest {
  code: string
  name: string
  harvestStart: string
  harvestEnd: string
  graceDays?: number
  /** Only the first season; for later seasons the server derives it and rejects a different value. */
  orderWindowStart?: string
  cropType?: string
}

export interface CropSeasonUpdateRequest {
  name: string
  harvestStart: string
  harvestEnd: string
  graceDays: number
  version: number
  /** Owner only. Moves collecting entries that still follow the old due date; `reason` is then required. */
  applyNewDueDateToCollectingDebts?: boolean
  reason?: string
}

export type ClosingBlocker = 'ALREADY_CLOSED' | 'HARVEST_NOT_ENDED' | 'OPEN_ENTRIES' | 'OPEN_CREDIT_ORDERS'

export interface ClosingCheck {
  seasonId: Uuid
  status: CropSeasonStatus
  canClose: boolean
  reasons: ClosingBlocker[]
  openEntryCount: number
  openEntries: { entryId: Uuid; entryNumber: string; farmerProfileId: Uuid; fullName: string; outstandingAmount: number; status: string }[]
  openCreditOrderCount: number
  openCreditOrders: { orderId: Uuid; orderNumber: string; status: string }[]
}

export interface LimitSuggestions {
  seasonId: Uuid
  /** How many closed seasons in a row a customer must have paid on time (policy: onTimeSeasonsForLimitRaise). */
  requiredSeasons: number
  /** The seasons that were checked; empty when there are not enough closed seasons in a row. */
  seasons: { id: Uuid; code: string; name: string }[]
  items: { farmerProfileId: Uuid; fullName: string; phoneNumber: string | null; creditLimit: number; creditStatus: string; paidAmount: number; lastPaidOn: string }[]
}

export type RolloverSkipReason = 'NOT_FOUND' | 'NOT_IN_SEASON' | 'NOTHING_OWED' | 'DISPUTED' | 'NOT_LATER' | 'NEEDS_OWNER' | 'EXCEEDS_TOTAL_EXTENSION'

export interface SeasonRolloverRequest {
  reasonCode: RolloverReasonCode
  note: string
  targetCropSeasonId?: string
  /** At most 500; omit for every open entry collected in the season. */
  entryIds?: Uuid[]
  /** true reports the result and writes nothing; the real run is checked again and can differ. */
  dryRun?: boolean
  overrideExtensionLimit?: boolean
}

export interface SeasonRolloverResponse {
  sourceSeasonId: Uuid
  targetSeason: { id: Uuid; code: string; name: string }
  newDueDate: string
  dryRun: boolean
  rolledOver: { entryId: Uuid; entryNumber: string; farmerProfileId: Uuid; oldDueDate: string; newDueDate: string; outstandingAmount: number }[]
  skipped: { entryId: Uuid; entryNumber: string | null; reason: RolloverSkipReason }[]
}

export const cropSeasonsApi = {
  // The server caps pageSize at 100; a store has a handful of seasons a year.
  getSeasons: (params: { status?: string; year?: number; page?: number; pageSize?: number } = {}) =>
    api<Paged<CropSeason>>(`/api/crop-seasons${toQuery(params)}`),

  getSeason: (id: Uuid) => api<CropSeason>(`/api/crop-seasons/${id}`),

  create: (data: CropSeasonCreateRequest) =>
    api<CropSeason>('/api/crop-seasons', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: Uuid, data: CropSeasonUpdateRequest) =>
    api<CropSeason>(`/api/crop-seasons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  /** `id` is the season the debt is being collected in. */
  rolloverDebt: (id: Uuid, data: SeasonRolloverRequest) =>
    api<SeasonRolloverResponse>(`/api/crop-seasons/${id}/debt/rollover`, { method: 'POST', body: JSON.stringify(data) }),

  /** 422 unless the season is closed. Read only: nothing is changed by the server. */
  getLimitSuggestions: (id: Uuid) => api<LimitSuggestions>(`/api/crop-seasons/${id}/limit-suggestions`),

  getClosingCheck: (id: Uuid) => api<ClosingCheck>(`/api/crop-seasons/${id}/closing-check`),

  close: (id: Uuid, version: number, note?: string) =>
    api<CropSeason>(`/api/crop-seasons/${id}/close`, { method: 'POST', body: JSON.stringify({ version, note: note || null }) }),
}
