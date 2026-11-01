import { api, toQuery } from './client'
import type { Uuid, Paged } from './types'

// Debt by crop season (tài liệu "Luồng công nợ theo vụ mùa", mục 6, 12, 13).
// PROPOSED CONTRACT: the backend has no crop season API yet. Field names follow the doc's crop_seasons table in
// camelCase; confirm them with the backend before merging.

export type CropSeasonStatus = 'PLANNED' | 'OPEN' | 'HARVESTING' | 'COLLECTING' | 'CLOSED'

export interface CropSeason {
  id: Uuid
  code: string
  name: string
  cropType: string
  /** Vietnam day (yyyy-MM-dd): credit orders confirmed from this day belong to the season. */
  orderWindowStart: string
  /** From this day new orders go to the next season. */
  harvestStart: string
  harvestEnd: string
  graceDays: number
  /** harvestEnd + graceDays, computed by the server. */
  paymentDueDate: string
  status: CropSeasonStatus
  /** Debt still owed on entries of this season; lets the page warn before closing. */
  outstandingAmount: number
  openEntryCount: number
  closedAt: string | null
  createdAt: string
}

export interface CropSeasonWriteRequest {
  name: string
  cropType: string
  orderWindowStart: string
  harvestStart: string
  harvestEnd: string
  graceDays: number
}

export const cropSeasonsApi = {
  getSeasons: (params: { status?: string; year?: number; page?: number; pageSize?: number } = {}) =>
    api<Paged<CropSeason>>(`/api/crop-seasons${toQuery(params)}`),

  create: (data: CropSeasonWriteRequest & { code: string }) =>
    api<CropSeason>('/api/crop-seasons', { method: 'POST', body: JSON.stringify(data) }),

  // BR-D16: changing dates never moves the due date of debt already recorded unless the owner asks for it.
  update: (id: Uuid, data: CropSeasonWriteRequest & { applyNewDueDateToDebts: boolean }) =>
    api<CropSeason>(`/api/crop-seasons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // BR-D15: the server refuses while the season still has open debt entries.
  close: (id: Uuid) => api<CropSeason>(`/api/crop-seasons/${id}/close`, { method: 'POST' }),
}
