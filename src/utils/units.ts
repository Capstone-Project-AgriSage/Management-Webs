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
