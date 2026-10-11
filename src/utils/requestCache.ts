interface Entry {
  promise: Promise<unknown>
  signal?: AbortSignal
  expiresAt: number
}

/** Short-lived, component-owned cache. Writes clear it; failed/aborted reads are never reused. */
export class RequestCache {
  private entries = new Map<string, Entry>()
  private ttlMs: number
  private maxEntries: number

  constructor(ttlMs = 30_000, maxEntries = 100) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
  }

  clear() {
    this.entries.clear()
  }

  get<T>(key: string, load: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted()
    const existing = this.entries.get(key)
    if (existing && !existing.signal?.aborted && (existing.expiresAt > Date.now()
      || (existing.expiresAt === 0 && existing.signal === signal))) {
      return existing.promise as Promise<T>
    }
    const entry: Entry = { promise: Promise.resolve(), signal, expiresAt: 0 }
    entry.promise = Promise.resolve().then(() => {
      signal?.throwIfAborted()
      return load()
    }).then(value => {
      signal?.throwIfAborted()
      entry.signal = undefined
      entry.expiresAt = Date.now() + this.ttlMs
      return value
    }).catch(error => {
      if (this.entries.get(key) === entry) this.entries.delete(key)
      throw error
    })
    this.entries.delete(key)
    this.entries.set(key, entry)
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!)
    return entry.promise as Promise<T>
  }
}
