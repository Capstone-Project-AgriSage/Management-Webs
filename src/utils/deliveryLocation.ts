import type { LocationPoint } from '@/api/deliveriesApi'
import { vnDateTime } from './date'

/** A last position older than this is shown as a lost signal (FLOW_2 §9a). */
export const STALE_AFTER_MS = 3 * 60 * 1000

/** How often the map pages read positions again. */
export const LOCATION_POLL_MS = 15_000

export interface LocationFreshness {
  stale: boolean
  /** "Cập nhật lúc 10:42", "Mất tín hiệu từ 10:42" or "Chưa có tín hiệu vị trí". */
  label: string
}

/** HH:mm on the Vietnam clock. */
function vnClock(iso: string): string {
  return vnDateTime(iso).split(' ')[1] ?? iso
}

export function locationFreshness(lastPoint: LocationPoint | null | undefined, now: number = Date.now()): LocationFreshness {
  if (!lastPoint) return { stale: true, label: 'Chưa có tín hiệu vị trí' }
  const age = now - new Date(lastPoint.recordedAt).getTime()
  return age > STALE_AFTER_MS
    ? { stale: true, label: `Mất tín hiệu từ ${vnClock(lastPoint.recordedAt)}` }
    : { stale: false, label: `Cập nhật lúc ${vnClock(lastPoint.recordedAt)}` }
}
