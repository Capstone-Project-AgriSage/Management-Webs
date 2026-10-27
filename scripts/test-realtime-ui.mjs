import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5187'
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const sockets = []
const state = { unread: 0, movements: [], diagnoses: [], codes: ['INVENTORY.READ', 'DIAGNOSIS.READ'], permissionReads: 0, notificationReads: 0 }
const paged = items => ({ items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1 })
const errors = []
await context.addInitScript(() => localStorage.setItem('agrisage_token', 'realtime-ui-test'))
await context.routeWebSocket('**/api/realtime**', socket => {
  sockets.push(socket)
  socket.onMessage(message => {
    for (const part of String(message).split('\u001e').filter(Boolean)) {
      const frame = JSON.parse(part)
      if (frame.protocol) socket.send('{}\u001e')
      else if (frame.type === 6) socket.send('{"type":6}\u001e')
    }
  })
})
await context.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname
  if (!path.startsWith('/api/')) return route.continue()
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  if (path === '/api/realtime/negotiate') return json({ negotiateVersion: 1, connectionId: 'test', connectionToken: 'test', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text'] }] })
  if (path === '/api/auth/me') return json({ id: '00000000-0000-4000-8000-000000000001', fullName: 'Owner', role: 'STORE_OWNER', status: 'ACTIVE' })
  if (path === '/api/me/permissions') { state.permissionReads++; return json({ role: 'STORE_OWNER', storeId: 'store-1', roleVersion: 1, permissions: state.codes }) }
  if (path.endsWith('/unread-count')) { state.notificationReads++; return json({ count: state.unread }) }
  if (path === '/api/inventory/stock-movements') return json(paged(state.movements))
  if (path === '/api/diagnosis-cases') return json(paged(state.diagnoses))
  return json(paged([]))
})
const send = topic => sockets.at(-1).send(JSON.stringify({ type: 1, target: 'Changed', arguments: [{ eventId: crypto.randomUUID(), topic }] }) + '\u001e')
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
try {
  await page.goto(base + '/agent/inventory/movements')
  await page.getByText('Không có phiếu kho nào.', { exact: true }).waitFor()
  await page.waitForTimeout(350) // initial connection snapshot has completed
  assert(sockets.length >= 1)
  state.movements = [{ id: 'm1', movementNumber: 'SM-REALTIME', movementType: 'STOCK_IN', status: 'POSTED', occurredAt: '2026-10-27T03:00:00Z', itemCount: 1 }]
  state.unread = 1
  send('inventory'); send('notifications')
  await page.getByText('SM-REALTIME', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Thông báo, 1 chưa đọc', exact: true }).waitFor()
  console.log('PASS inventory ledger and notification badge update from real SignalR client callbacks')
  const before = sockets.length
  state.unread = 2 // no event: reconnect must recover this change through REST
  sockets.at(-1).close()
  await page.getByRole('button', { name: 'Thông báo, 2 chưa đọc', exact: true }).waitFor()
  assert(sockets.length > before)
  console.log('PASS disconnect/reconnect resynchronizes missed changes without reloading')
  state.codes = ['DIAGNOSIS.READ']
  send('permissions')
  await page.getByRole('alert').filter({ hasText: 'Không có quyền truy cập chức năng này' }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Thẻ kho', exact: true }).count(), 0)
  console.log('PASS revoked permission immediately removes access and navigation')
  await page.goto(base + '/agent/ai-recommendations')
  await page.waitForTimeout(350)
  state.diagnoses = [{ id: 'd1', caseNumber: 'DG-REALTIME', status: 'AI_COMPLETED', submittedAt: '2026-10-27T03:00:00Z', farmerName: 'Farmer', farmerPhone: '0900000000', predictedClassLabel: 'LEAF_BLAST', confidence: 0.9, passedPolicy: true }]
  send('diagnosis')
  await page.getByText('DG-REALTIME', { exact: true }).waitFor()
  console.log('PASS diagnosis results refresh without a page reload')
  await page.clock.install()
  const reads = { permissions: state.permissionReads, notifications: state.notificationReads }
  await page.clock.runFor(31_000)
  assert.equal(state.permissionReads, reads.permissions)
  assert.equal(state.notificationReads, reads.notifications)
  assert.deepEqual(errors, [])
  console.log('PASS idle UI makes no 15s/30s permission or notification polling requests')
} finally { await context.close(); await browser.close() }
