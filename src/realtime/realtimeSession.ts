export interface RealtimeConnection {
  start(): Promise<void>
  stop(): Promise<void>
  on(name: string, callback: (message: { eventId: string; topic: string }) => void): void
  onreconnected(callback: () => void): void
  onclose(callback: () => void): void
}

/** One session per signed-in identity. Only failed connection attempts use a timer; data never polls. */
export function startRealtimeSession(connection: RealtimeConnection, emit: (topic: string) => void) {
  let disposed = false
  let attempts = 0
  let retry: ReturnType<typeof setTimeout> | undefined
  let batch: ReturnType<typeof setTimeout> | undefined
  const seen = new Set<string>()
  const topics = new Set<string>()
  const allowed = new Set(['notifications', 'permissions', 'inventory', 'diagnosis', 'resync'])
  const enqueue = (topic: string) => {
    if (disposed || !allowed.has(topic)) return
    topics.add(topic)
    if (batch !== undefined) return
    batch = setTimeout(() => {
      batch = undefined
      const pending = topics.has('resync') ? ['resync'] : [...topics]
      topics.clear()
      if (!disposed) pending.forEach(emit)
    }, 150)
  }
  const connect = async () => {
    if (disposed) return
    try {
      await connection.start()
      if (disposed) { await connection.stop(); return }
      attempts = 0
      enqueue('resync')
    } catch {
      if (!disposed) retry = setTimeout(() => { void connect() }, Math.min(30_000, 1000 * 2 ** Math.min(attempts++, 5)))
    }
  }
  connection.on('Changed', message => {
    if (!message || typeof message.eventId !== 'string' || !allowed.has(message.topic) || seen.has(message.eventId)) return
    seen.add(message.eventId)
    if (seen.size > 512) seen.delete(seen.values().next().value!)
    enqueue(message.topic)
  })
  connection.onreconnected(() => { attempts = 0; enqueue('resync') })
  connection.onclose(() => { if (!disposed) { enqueue('resync'); void connect() } })
  void connect()
  return () => {
    disposed = true
    clearTimeout(retry)
    clearTimeout(batch)
    topics.clear()
    void connection.stop().catch(() => {})
  }
}
