/** Short Vietnamese label of a unit code returned by the API (units are seeded reference data). */
const UNIT_LABELS: Record<string, string> = {
  KG: 'kg',
  GRAM: 'g',
  LITER: 'lít',
  ML: 'ml',
  BAG: 'bao',
  BOX: 'hộp',
  CARTON: 'thùng',
  BOTTLE: 'chai',
  PACK: 'gói',
}

export function unitLabel(code: string | null | undefined): string {
  if (!code) return ''
  return UNIT_LABELS[code.toUpperCase()] ?? code.toLowerCase()
}

export function formatQty(value: number): string {
  return value.toLocaleString('vi-VN')
}

/** "9.998 kg": a base quantity with its unit. */
export function formatQtyUnit(value: number, unitCode: string | null | undefined): string {
  const unit = unitLabel(unitCode)
  return unit ? `${formatQty(value)} ${unit}` : formatQty(value)
}

/** "dd/MM/yyyy" for a date-only string from the API ("2026-11-19"). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** "14:05 05/10/2026" in the browser's local time, from an ISO date-time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${time} ${date}`
}

/** "yyyy-MM-dd" for a Date in the browser's local calendar (not UTC), the format of the API's date filters. */
export function toDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthStartInput(): string {
  const now = new Date()
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1))
}

export function todayInput(): string {
  return toDateInput(new Date())
}

/** Number of days in the inclusive range, or 0 when a date is missing/invalid. */
export function rangeDays(from: string, to: string): number {
  if (!from || !to) return 0
  const a = Date.parse(from)
  const b = Date.parse(to)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000) + 1
}
