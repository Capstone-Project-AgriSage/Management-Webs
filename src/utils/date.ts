export function isoDateOffsetFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function isToday(dateIso: string): boolean {
  return dateIso === isoDateOffsetFromToday(0)
}

export function formatDateLabel(dateIso: string): string {
  const [y, m, d] = dateIso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateTimeLabel(isoDateTime: string): string {
  const d = new Date(isoDateTime)
  if (Number.isNaN(d.getTime())) return isoDateTime
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return `${time} ${formatDateLabel(isoDateTime.slice(0, 10))}`
}
