export function isoDateOffsetFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function isToday(dateIso: string): boolean {
  return dateIso === isoDateOffsetFromToday(0)
}

// ---- One way to show dates everywhere: Vietnamese day/month/year, 24-hour clock, Vietnam time ----

const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

const vnPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function vnParts(date: Date): Record<string, string> {
  return Object.fromEntries(vnPartsFormatter.formatToParts(date).map(part => [part.type, part.value]))
}

/**
 * "20/11/2026". A date-only value ("2026-11-20") is a Vietnam calendar day and is shown as it is; a date-time is shown
 * on the Vietnam calendar. Text that is not a date comes back unchanged.
 */
export function vnDate(value: string): string {
  const day = DATE_ONLY.exec(value)
  if (day) return `${day[3]}/${day[2]}/${day[1]}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const p = vnParts(date)
  return `${p.day}/${p.month}/${p.year}`
}

/** "20/11/2026 14:21" (or "20/11/2026 14:21:05" with seconds) in Vietnam time. */
export function vnDateTime(value: string, withSeconds = false): string {
  if (DATE_ONLY.test(value)) return vnDate(value)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const p = vnParts(date)
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}${withSeconds ? `:${p.second}` : ''}`
}

/** Today on the Vietnam calendar as yyyy-MM-dd. */
export function todayIsoVn(): string {
  const p = vnParts(new Date())
  return `${p.year}-${p.month}-${p.day}`
}

export function formatDateLabel(dateIso: string): string {
  return vnDate(dateIso)
}

export function formatDateTimeLabel(isoDateTime: string): string {
  return vnDateTime(isoDateTime)
}

// ---- Reading what a person types in a date field ----

export type DateTextResult =
  | { kind: 'empty' }
  | { kind: 'partial'; display: string }
  | { kind: 'complete'; iso: string; display: string }
  | { kind: 'invalid'; display: string }

const pad2 = (value: number) => String(value).padStart(2, '0')

/** yyyy-MM-dd for a real calendar day, or null (31/02, month 13, year before 1900...). */
export function isoFromParts(day: number, month: number, year: number): string | null {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null
  if (year < 1900 || year > 9998 || month < 1 || month > 12 || day < 1) return null
  const lastDay = new Date(year, month, 0).getDate()
  if (day > lastDay) return null
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** "dd/mm/yyyy" for a yyyy-MM-dd value, '' for anything else. */
export function isoToDisplay(iso: string): string {
  const day = DATE_ONLY.exec(iso)
  return day ? `${day[3]}/${day[2]}/${day[1]}` : ''
}

function complete(iso: string | null, display: string): DateTextResult {
  return iso ? { kind: 'complete', iso, display: isoToDisplay(iso) } : { kind: 'invalid', display }
}

/**
 * Reads a date field as the person types it. Digits get their slashes added ("20112026" → "20/11/2026"); a day or month
 * of one digit works with slashes ("5/1/2026"); a pasted or filled ISO date ("2026-11-20") is accepted too.
 */
export function parseDateText(raw: string): DateTextResult {
  const text = raw.trim()
  if (!text) return { kind: 'empty' }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (iso) return complete(isoFromParts(Number(iso[3]), Number(iso[2]), Number(iso[1])), text)

  if (/[/.-]/.test(text)) {
    const parts = text.split(/[/.-]/).slice(0, 3).map(part => part.replace(/\D/g, ''))
    // Digits typed past a full day or month flow on to the next part ("05/112" → "05/11/2").
    for (let i = 0; i < 2; i++) {
      if (parts[i].length > 2) {
        const extra = parts[i].slice(2)
        parts[i] = parts[i].slice(0, 2)
        if (parts.length > i + 1) parts[i + 1] = extra + parts[i + 1]
        else parts.push(extra)
      }
    }
    if (parts.length > 2) parts[2] = parts[2].slice(0, 4)
    const display = parts.join('/')
    if (parts.length === 3 && parts[0] && parts[1] && parts[2].length === 4) {
      return complete(isoFromParts(Number(parts[0]), Number(parts[1]), Number(parts[2])), display)
    }
    return { kind: 'partial', display }
  }

  const digits = text.replace(/\D/g, '').slice(0, 8)
  if (!digits) return { kind: 'partial', display: '' }
  const display = digits.length <= 2 ? digits
    : digits.length <= 4 ? `${digits.slice(0, 2)}/${digits.slice(2)}`
    : `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  if (digits.length < 8) return { kind: 'partial', display }
  return complete(isoFromParts(Number(digits.slice(0, 2)), Number(digits.slice(2, 4)), Number(digits.slice(4))), display)
}

/** "HH:mm" as typed: digits get their colon ("1430" → "14:30"); null while it is not a real time yet. */
export function parseTimeText(raw: string): { display: string; time: string | null } {
  const text = raw.trim()
  const parts = text.includes(':')
    ? text.split(':').slice(0, 2).map(part => part.replace(/\D/g, '').slice(0, 2))
    : (() => { const digits = text.replace(/\D/g, '').slice(0, 4); return digits.length <= 2 ? [digits] : [digits.slice(0, 2), digits.slice(2)] })()
  const display = parts.join(':')
  if (parts.length === 2 && parts[0].length >= 1 && parts[1].length === 2) {
    const hour = Number(parts[0]); const minute = Number(parts[1])
    if (hour <= 23 && minute <= 59) return { display: `${pad2(hour)}:${pad2(minute)}`, time: `${pad2(hour)}:${pad2(minute)}` }
  }
  return { display, time: null }
}
