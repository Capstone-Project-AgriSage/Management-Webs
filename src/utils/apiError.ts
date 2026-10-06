import { ApiError } from '@/api/client'

/** One readable toast message: the per-field validation messages when the API sent them, else its detail/title. */
export function describeApiError(err: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại'): string {
  if (err instanceof ApiError) {
    if (err.errors && Object.keys(err.errors).length > 0) return Object.values(err.errors).flat().join('; ')
    return err.detail || err.title || fallback
  }
  return err instanceof Error && err.message ? err.message : fallback
}

/** Row index → messages from validation keys such as "items[3]" or "items[3].lots" (FE_GUIDE_FLOW_1 §5). */
export function rowErrors(err: unknown, collection = 'items'): Record<number, string> {
  const out: Record<number, string> = {}
  if (!(err instanceof ApiError) || !err.errors) return out
  const pattern = new RegExp(`^${collection}\\[(\\d+)\\]`, 'i')
  for (const [key, messages] of Object.entries(err.errors)) {
    const m = pattern.exec(key)
    if (m) out[Number(m[1])] = [out[Number(m[1])], ...messages].filter(Boolean).join('; ')
  }
  return out
}
