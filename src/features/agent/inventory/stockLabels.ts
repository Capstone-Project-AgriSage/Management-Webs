import type { AdjustmentReason, AlertType, LotStatus } from '@/api/stockApi'

export const ADJUSTMENT_REASONS: { value: AdjustmentReason; label: string }[] = [
  { value: 'DAMAGED', label: 'Hư hỏng' },
  { value: 'EXPIRED', label: 'Hết hạn dùng' },
  { value: 'LOST', label: 'Mất / thất thoát' },
  { value: 'MANUAL_CORRECTION', label: 'Sửa sai số liệu' },
  { value: 'OTHER', label: 'Lý do khác' },
]

export const ALERT_LABEL: Record<AlertType, string> = {
  EXPIRING: 'Sắp hết hạn',
  EXPIRED: 'Đã hết hạn',
  LOW_STOCK: 'Sắp hết hàng',
}

export const ALERT_BADGE_CLASS: Record<AlertType, string> = {
  EXPIRING: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-rose-100 text-rose-700',
  LOW_STOCK: 'bg-orange-100 text-orange-800',
}

export const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  ACTIVE: 'Đang bán',
  QUARANTINED: 'Cách ly',
  EXPIRED: 'Hết hạn',
  BLOCKED: 'Đang khóa',
  DEPLETED: 'Hết lô',
}

export const LOT_STATUS_BADGE_CLASS: Record<LotStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  QUARANTINED: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-rose-100 text-rose-700',
  BLOCKED: 'bg-amber-100 text-amber-800',
  DEPLETED: 'bg-slate-100 text-slate-600',
}

/** "còn 12 ngày" / "quá hạn 3 ngày" / "hết hạn hôm nay" for a days-to-expiry count. */
export function expiryLabel(daysToExpiry: number | null | undefined): string {
  if (daysToExpiry === null || daysToExpiry === undefined) return ''
  if (daysToExpiry === 0) return 'hết hạn hôm nay'
  if (daysToExpiry > 0) return `còn ${daysToExpiry} ngày`
  return `quá hạn ${Math.abs(daysToExpiry)} ngày`
}

/** Whole days from today (local date) to a "yyyy-MM-dd" expiry date; negative when already past. */
export function daysUntil(dateOnly: string | null | undefined): number | null {
  if (!dateOnly) return null
  const [y, m, d] = dateOnly.slice(0, 10).split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86_400_000)
}
