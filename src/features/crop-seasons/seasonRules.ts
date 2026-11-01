import type { CropSeason, CropSeasonStatus } from '@/api/cropSeasonsApi'

export const SEASON_STATUS: Record<CropSeasonStatus, { label: string; className: string }> = {
  PLANNED: { label: 'Sắp tới', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  OPEN: { label: 'Đang nhận đơn', className: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  HARVESTING: { label: 'Đang thu hoạch', className: 'bg-amber-50 text-amber-800 border border-amber-200' },
  COLLECTING: { label: 'Đang thu nợ', className: 'bg-sky-50 text-sky-800 border border-sky-200' },
  CLOSED: { label: 'Đã đóng', className: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

export const CROP_TYPES = [{ value: 'RICE', label: 'Lúa' }]

export const DEFAULT_GRACE_DAYS = 30

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Adds whole days to a Vietnam day (yyyy-MM-dd) without any timezone shift. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** CS-04: due date of every debt entry of the season = expected harvest end + grace days. */
export function seasonDueDate(harvestEnd: string, graceDays: number): string | null {
  if (!DAY.test(harvestEnd) || !Number.isInteger(graceDays) || graceDays < 0) return null
  return addDays(harvestEnd, graceDays)
}

export interface SeasonDates {
  orderWindowStart: string
  harvestStart: string
  harvestEnd: string
  graceDays: string
}

/** Field errors of the form, in Vietnamese; an empty object means the dates are consistent. */
export function validateSeasonDates(v: SeasonDates): Partial<Record<keyof SeasonDates, string>> {
  const errors: Partial<Record<keyof SeasonDates, string>> = {}
  if (!DAY.test(v.orderWindowStart)) errors.orderWindowStart = 'Chọn ngày bắt đầu nhận đơn.'
  if (!DAY.test(v.harvestStart)) errors.harvestStart = 'Chọn ngày bắt đầu thu hoạch.'
  if (!DAY.test(v.harvestEnd)) errors.harvestEnd = 'Chọn ngày kết thúc thu hoạch.'
  if (!errors.orderWindowStart && !errors.harvestStart && v.harvestStart <= v.orderWindowStart)
    errors.harvestStart = 'Ngày bắt đầu thu hoạch phải sau ngày bắt đầu nhận đơn.'
  if (!errors.harvestStart && !errors.harvestEnd && v.harvestEnd <= v.harvestStart)
    errors.harvestEnd = 'Ngày kết thúc thu hoạch phải sau ngày bắt đầu thu hoạch.'
  const grace = Number(v.graceDays)
  if (v.graceDays.trim() === '' || !Number.isInteger(grace) || grace < 0 || grace > 365)
    errors.graceDays = 'Ân hạn là số ngày nguyên từ 0 đến 365.'
  return errors
}

export interface WindowIssue {
  kind: 'gap' | 'overlap'
  previous: CropSeason
  next: CropSeason
  /** Days without a season (gap) or counted twice (overlap). */
  days: number
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

/**
 * Seasons follow each other: the order window of a season runs from the previous season's harvest start to the day
 * before its own harvest start (mục 6). A later season that starts after that day leaves a gap (orders confirmed in
 * between have no season); one that starts before it overlaps.
 */
export function findWindowIssues(seasons: CropSeason[]): WindowIssue[] {
  const sorted = seasons.slice().sort((a, b) => a.orderWindowStart.localeCompare(b.orderWindowStart))
  const issues: WindowIssue[] = []
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]
    const next = sorted[i]
    const diff = daysBetween(previous.harvestStart, next.orderWindowStart)
    if (diff > 0) issues.push({ kind: 'gap', previous, next, days: diff })
    else if (diff < 0) issues.push({ kind: 'overlap', previous, next, days: -diff })
  }
  return issues
}

/** Where a new season's order window should start so it follows the latest season without gap or overlap. */
export function suggestedWindowStart(seasons: CropSeason[]): string | null {
  const latest = seasons.slice().sort((a, b) => b.orderWindowStart.localeCompare(a.orderWindowStart))[0]
  return latest?.harvestStart ?? null
}
