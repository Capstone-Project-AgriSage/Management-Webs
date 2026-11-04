interface Entry {
  promise: Promise<unknown>
  expiresAt: number
}

/** Session-scoped lookup DTOs only. Each consumer receives its own copy and cancellation. */
export class LookupCache {
  private entries = new Map<string, Entry>()
  private scope: string | undefined
  private revision = 0
  private getScope: () => string
  private maxEntries: number

  constructor(getScope: () => string, maxEntries = 100) {
    this.getScope = getScope
    this.maxEntries = maxEntries
  }

  clear() {
    this.entries.clear()
    this.revision++
  }

  get<T>(key: string, load: () => Promise<T>, ttlMs = 120_000, signal?: AbortSignal | null): Promise<T> {
    signal?.throwIfAborted()
    const scope = this.getScope()
    if (scope !== this.scope) { this.clear(); this.scope = scope }
    const revision = this.revision
    let entry = this.entries.get(key)
    if (!entry || (entry.expiresAt !== 0 && entry.expiresAt <= Date.now())) {
      const next: Entry = { promise: Promise.resolve(), expiresAt: 0 }
      next.promise = Promise.resolve().then(load).then(value => {
        if (scope !== this.getScope()) throw new DOMException('Session changed', 'AbortError')
        if (revision === this.revision) next.expiresAt = Date.now() + ttlMs
        return value
      }).catch(error => {
        if (this.entries.get(key) === next) this.entries.delete(key)
        throw error
      })
      this.entries.delete(key)
      this.entries.set(key, next)
      while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!)
      entry = next
    }
    // Never pass a component's signal to the shared loader: unmounting one consumer must not cancel another.
    const promise = entry.promise.then(value => {
      if (scope !== this.getScope()) throw new DOMException('Session changed', 'AbortError')
      // A focus/resync or write can race the read. Refresh transparently instead of showing an abort error in the form.
      if (revision !== this.revision) return this.get<T>(key, load, ttlMs, signal)
      return structuredClone(value) as T
    })
    if (!signal) return promise
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      signal.addEventListener('abort', abort, { once: true })
      promise.then(value => {
        signal.removeEventListener('abort', abort)
        if (signal.aborted) abort()
        else resolve(value)
      }, error => { signal.removeEventListener('abort', abort); reject(error) })
      if (signal.aborted) abort()
    })
  }
}

export const lookupCache = new LookupCache(() => localStorage.getItem('agrisage_token') || '')

/** Explicit allowlist: prices, inventory, transactions and permission responses always go to the server. */
export function lookupKey(path: string): string | null {
  const [pathname, query = ''] = path.split('?')
  if (!/^\/api\/(catalog\/(categories|brands)|categories(?:\/tree)?|brands|units|active-ingredients|diseases|me\/advisory\/problems)$/.test(pathname)) return null
  const params = new URLSearchParams(query)
  params.sort()
  return `${pathname}?${params.toString()}`
}

export function invalidateLookupWrite(path: string) {
  if (/^\/api\/(categories|brands|units|active-ingredients|products|store-products|diseases|disease-treatments|auth)(\/|\?|$)/.test(path)) lookupCache.clear()
}

export function installLookupCacheInvalidation() {
  const clear = () => lookupCache.clear()
  const visible = () => { if (!document.hidden) clear() }
  const realtime = (event: Event) => {
    const topic = (event as CustomEvent<{ topic: string }>).detail?.topic
    if (topic === 'resync' || topic === 'permissions' || topic === 'diagnosis') clear()
  }
  const events = ['focus', 'online', 'storage', 'agrisage-permissions-changed', 'permissions:changed']
  events.forEach(event => window.addEventListener(event, clear))
  window.addEventListener('agrisage-realtime-change', realtime)
  document.addEventListener('visibilitychange', visible)
  return () => {
    events.forEach(event => window.removeEventListener(event, clear))
    window.removeEventListener('agrisage-realtime-change', realtime)
    document.removeEventListener('visibilitychange', visible)
  }
}
