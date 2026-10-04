export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
    public errors?: Record<string, string[]>,
    public traceId?: string
  ) {
    super(detail ?? title)
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
