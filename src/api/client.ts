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

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('agrisage_token')
  const baseUrl = import.meta.env.VITE_API_URL || ''
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  
  if (res.status === 401) {
    localStorage.removeItem('agrisage_token')
    window.location.assign('/login')
    throw new ApiError(401, 'Unauthorized')
  }
  
  if (res.ok) {
    return (res.status === 204 ? undefined : await res.json()) as T
  }
  
  const p = await res.json().catch(() => ({}))
  throw new ApiError(res.status, p.title ?? res.statusText, p.detail, p.errors, p.traceId)
}
