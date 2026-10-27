import assert from 'node:assert/strict'
import test from 'node:test'
import { startRealtimeSession } from '../src/realtime/realtimeSession.ts'

class Connection {
  starts = 0
  stops = 0
  failures = 0
  on(_name, callback) { this.changed = callback }
  onreconnected(callback) { this.reconnected = callback }
  onclose(callback) { this.closed = callback }
  async start() { this.starts++; if (this.failures-- > 0) throw new Error('offline') }
  async stop() { this.stops++ }
}
const tick = () => Promise.resolve()

test('events are batched/deduplicated, reconnect repairs missed data, disposal stops delivery', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const connection = new Connection()
  const events = []
  const dispose = startRealtimeSession(connection, topic => events.push(topic))
  await tick(); context.mock.timers.tick(150)
  assert.deepEqual(events.splice(0), ['resync'])
  connection.changed({ eventId: '1', topic: 'notifications' })
  connection.changed({ eventId: '1', topic: 'notifications' })
  connection.changed({ eventId: '2', topic: 'notifications' })
  connection.changed({ eventId: '3', topic: 'inventory' })
  context.mock.timers.tick(150)
  assert.deepEqual(events.splice(0), ['notifications', 'inventory'])
  connection.reconnected(); context.mock.timers.tick(150)
  assert.deepEqual(events.splice(0), ['resync'])
  context.mock.timers.tick(300_000)
  assert.deepEqual(events, [])
  assert.equal(connection.starts, 1)
  dispose()
  connection.changed({ eventId: '4', topic: 'permissions' })
  context.mock.timers.tick(1000)
  assert.deepEqual(events, [])
  assert.equal(connection.stops, 1)
})

test('initial connection failure retries with backoff and does not reconnect after logout', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const connection = new Connection()
  connection.failures = 2
  const events = []
  const dispose = startRealtimeSession(connection, topic => events.push(topic))
  await tick(); context.mock.timers.tick(999)
  assert.equal(connection.starts, 1)
  context.mock.timers.tick(1); await tick()
  assert.equal(connection.starts, 2)
  context.mock.timers.tick(2000); await tick()
  assert.equal(connection.starts, 3)
  context.mock.timers.tick(150)
  assert.deepEqual(events, ['resync'])
  dispose(); connection.closed(); context.mock.timers.tick(300_000)
  assert.equal(connection.starts, 3)
})
