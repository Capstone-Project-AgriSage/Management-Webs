/** Parses a Vietnamese-formatted money string like "14.200.000 đ" into a plain number (14200000). */
export function parseVnd(value: string): number {
  const digits = value.replace(/[^0-9]/g, '')
  return digits ? Number(digits) : 0
}

/** Formats a plain number into a Vietnamese-style money string, e.g. 14200000 -> "14.200.000 đ". */
export function formatVnd(value: number): string {
  return `${Math.round(value).toLocaleString('vi-VN')} đ`
}

/** Formats a plain number into a compact abbreviation, e.g. 46207500 -> "46.2M", 8500 -> "8.5K". */
export function formatVndShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(Math.round(value))
}
