export class ApiError extends Error {
  status: number
  title: string
  detail?: string
  errors?: Record<string, string[]>
  traceId?: string

  constructor(status: number, title: string, detail?: string, errors?: Record<string, string[]>, traceId?: string) {
    super(detail ?? title)
    this.status = status
    this.title = title
    this.detail = detail
    this.errors = errors
    this.traceId = traceId
  }
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('agrisage_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function apiUrl(path: string): string {
  return `${import.meta.env.VITE_API_URL || ''}${path}`
}

function handleUnauthorized(): never {
  localStorage.removeItem('agrisage_token')
  window.location.assign('/login')
  throw new ApiError(401, 'Unauthorized')
}

async function toApiError(res: Response): Promise<ApiError> {
  const p = await res.json().catch(() => ({}))
  return new ApiError(res.status, p.title ?? res.statusText, p.detail, p.errors, p.traceId)
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  // A FormData body (file upload) needs the browser to set the multipart Content-Type with its boundary.
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader(),
      ...init.headers,
    },
  })

  if (res.status === 401) {
    handleUnauthorized()
  }

  if (res.ok) {
    return (res.status === 204 ? undefined : await res.json()) as T
  }

  throw await toApiError(res)
}

/** Downloads a binary response (e.g. the Excel template) with the bearer token; `fileName` comes from Content-Disposition. */
export async function apiBlob(path: string): Promise<{ blob: Blob; fileName: string | null }> {
  const res = await fetch(apiUrl(path), { headers: authHeader() })

  if (res.status === 401) {
    handleUnauthorized()
  }

  if (!res.ok) {
    throw await toApiError(res)
  }

  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  return { blob: await res.blob(), fileName: match ? decodeURIComponent(match[1]) : null }
}

/** Saves a downloaded blob through a temporary link. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** One readable message for a toast: per-field validation messages when the API sent them, else the detail/title. */
export function describeError(err: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại'): string {
  if (err instanceof ApiError) {
    if (err.errors && Object.keys(err.errors).length > 0) {
      return Object.values(err.errors).flat().join('; ')
    }
    return err.detail || err.title || fallback
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return fallback
}
