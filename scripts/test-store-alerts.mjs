import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Store alerts (features/alerts): every /api request is faked and audio, Web Audio, speech and Windows notifications
// are stubbed, so the checks are exact and nothing plays on the test machine.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5174'
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const NOW = Date.parse('2026-11-19T03:00:00Z')
let checks = 0
const pass = name => { checks++; console.log('PASS ' + name) }
const shots = process.env.UI_SCREENSHOT_DIR
if (shots) await mkdir(shots, { recursive: true })
const shot = (page, name) => shots ? page.screenshot({ path: join(shots, name) }) : undefined

const FARMER_USER = 'farmer-user'
const order = (id, number, name, total, extra = {}) => ({
  id, orderNumber: number, source: 'FARMER_MOBILE', customerType: 'REGISTERED', farmerProfileId: 'farmer-1', customerName: name,
  customerPhone: '0912345678', customerGroupId: null, priceListId: null, settlementType: 'CREDIT', creditTermDays: 30,
  fulfillmentType: 'PICKUP', deliveryAddress: null, status: 'PENDING_CONFIRMATION', subtotalAmount: total, totalAmount: total,
  note: null, createdBy: FARMER_USER, createdAt: new Date(NOW).toISOString(), confirmedBy: null, confirmedAt: null,
  pickupCompletedBy: null, pickupCompletedAt: null, completedAt: null, cancelledBy: null, cancelledAt: null, cancelReason: null,
  version: 1, items: [], ...extra,
})
const payment = (id, method, amount, orderNumber) => ({
  id, paymentNumber: 'PM-' + id, paymentContext: 'ORDER_PAYMENT', paymentMethod: method, amount, status: 'PAID', payerName: 'Nguyễn Văn A',
  confirmedAt: new Date(NOW).toISOString(), initiatedAt: new Date(NOW).toISOString(), currency: 'VND', payerFarmerProfileId: 'farmer-1',
  confirmationSource: method === 'PAYOS' ? 'PAYOS_WEBHOOK' : 'STAFF', confirmedBy: null, checkoutUrl: null, providerOrderCode: null,
  failedAt: null, cancelledAt: null, note: null, unallocatedAmount: 0,
  allocations: [{ id: 'al-' + id, allocationType: 'ORDER', orderId: 'order-1', orderNumber, debtEntryId: null, entryNumber: null,
    allocatedAmount: amount, prepaymentConsumedAmount: 0, status: 'ACTIVE', allocatedAt: new Date(NOW).toISOString() }],
})
const note = (id, type, title, data, at = NOW) => ({
  id, notificationType: type, title, message: '', data, status: 'UNREAD', readAt: null, createdAt: new Date(at).toISOString(),
})
const placed = (id, orderId, at) => note(id, 'ORDER_PLACED', 'Đơn hàng mới chờ xác nhận', { entityType: 'ORDER', entityId: orderId, orderId }, at)

async function fixture({ role = 'SALES_STAFF', path = '/sales/orders', hidden = false, blockPlay = false, settings = null, context: shared = null } = {}) {
  const context = shared ?? await browser.newContext({ viewport: { width: 1366, height: 860 } })
  if (!shared) {
    await context.clock.install({ time: NOW })
    await context.addInitScript(([hiddenTab, blocked, stored]) => {
      localStorage.setItem('agrisage_token', 'store-alert-test')
      if (stored) localStorage.setItem('agrisage_store_alert_settings', JSON.stringify(stored))
      window.__sounds = []
      window.__chimes = 0
      window.__desktop = []
      window.__blockPlay = blocked
      HTMLMediaElement.prototype.play = function () {
        if (window.__blockPlay && !this.muted) return Promise.reject(new DOMException('blocked', 'NotAllowedError'))
        window.__sounds.push(this.muted ? 'unlock' : new URL(this.src).pathname)
        queueMicrotask(() => this.dispatchEvent(new Event('ended')))
        return Promise.resolve()
      }
      HTMLMediaElement.prototype.pause = function () {}
      window.AudioContext = class {
        constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {} }
        resume() { return Promise.resolve() }
        createOscillator() { return { frequency: { value: 0 }, type: 'sine', connect: node => node, start: () => { window.__chimes++ }, stop() {} } }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: node => node } }
      }
      window.Notification = class {
        static permission = 'granted'
        static requestPermission() { return Promise.resolve('granted') }
        constructor(title, options) { window.__desktop.push({ title, ...options }) }
        close() {}
      }
      if (hiddenTab) {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      }
    }, [hidden, blockPlay, settings])
  }
  const state = shared?.__state ?? { notifications: [], orders: {}, payments: {}, returns: {}, pending: 0, requests: [] }
  context.__state = state
  if (!shared) await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const p = url.pathname
    if (!p.startsWith('/api/')) return route.continue()
    state.requests.push(`${request.method()} ${p}${url.search}`)
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    const paged = items => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: items.length ? 1 : 0 })
    if (p === '/api/auth/me') return json({ id: 'user-' + role, fullName: 'Người kiểm thử', role, status: 'ACTIVE' })
    if (p === '/api/me/permissions') return json({ role, storeId: 'store', roleVersion: 1, memberVersion: 1, permissions: ['ORDERS.READ', 'ORDERS.CONFIRM', 'PAYMENTS.READ', 'RETURNS.READ'] })
    if (p.startsWith('/api/realtime/')) return json({ title: 'Not available in the test' }, 404)
    if (p === '/api/me/notifications/unread-count') return json({ count: state.notifications.filter(n => n.status === 'UNREAD').length })
    if (p === '/api/me/notifications') return json(paged(state.notifications.filter(n => !url.searchParams.get('status') || n.status === url.searchParams.get('status'))))
    const read = p.match(/^\/api\/me\/notifications\/([^/]+)\/read$/)
    if (read && request.method() === 'POST') {
      const item = state.notifications.find(n => n.id === read[1])
      if (item) item.status = 'READ'
      return route.fulfill({ status: 204 })
    }
    if (p === '/api/orders') {
      if (url.searchParams.get('status') === 'PENDING_CONFIRMATION' && url.searchParams.get('source'))
        return json({ ...paged([]), totalCount: url.searchParams.get('source') === 'FARMER_MOBILE' ? state.pending : 0 })
      return json(paged(Object.values(state.orders)))
    }
    const orderPayments = p.match(/^\/api\/orders\/([^/]+)\/payments$/)
    if (orderPayments) return json({ payments: [], paidAmount: 0, remainingToPay: state.orders[orderPayments[1]]?.totalAmount ?? 0 })
    const single = p.match(/^\/api\/orders\/([^/]+)$/)
    if (single) return state.orders[single[1]] ? json(state.orders[single[1]]) : json({ title: 'Not found' }, 404)
    const onePayment = p.match(/^\/api\/payments\/([^/]+)$/)
    if (onePayment) return state.payments[onePayment[1]] ? json(state.payments[onePayment[1]]) : json({ title: 'Not found' }, 404)
    const oneReturn = p.match(/^\/api\/returns\/([^/]+)$/)
    if (oneReturn) return state.returns[oneReturn[1]] ? json(state.returns[oneReturn[1]]) : json({ title: 'Not found' }, 404)
    return json(paged([]))
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base + path)
  return { context, page, state, errors }
}

const realtime = page => page.evaluate(() => window.dispatchEvent(new CustomEvent('agrisage-realtime-change', { detail: { topic: 'notifications' } })))
const sounds = page => page.evaluate(() => window.__sounds.filter(s => s !== 'unlock'))
const cards = page => page.getByRole('region', { name: 'Thông báo cửa hàng' })
const control = page => page.getByRole('button', { name: /Âm thanh thông báo/ })

try {
  // 1. Realtime signal → one "Có đơn hàng mới" with the order's number, customer and total; the list reloads.
  const staff = await fixture()
  await control(staff.page).waitFor()
  await staff.page.waitForTimeout(300)
  assert.deepEqual(await sounds(staff.page), [])
  const listLoads = () => staff.state.requests.filter(r => r === 'GET /api/orders?page=1&pageSize=10').length
  const loadsBefore = listLoads()
  staff.state.orders['order-1'] = order('order-1', 'DH-0012', 'Nguyễn Văn A', 350000)
  staff.state.notifications.push(placed('n-1', 'order-1'))
  await realtime(staff.page)
  await cards(staff.page).getByText('DH-0012 · Nguyễn Văn A', { exact: true }).waitFor()
  await cards(staff.page).getByText('350.000 đ', { exact: true }).waitFor()
  assert.deepEqual(await sounds(staff.page), ['/sounds/new-order.mp3'])
  await shot(staff.page, 'store-alert-new-order.png')
  await staff.page.waitForTimeout(200)
  assert(listLoads() > loadsBefore)
  pass('A new online order plays "Có đơn hàng mới" once, shows its number, customer and total, and reloads the order list')

  // 2. The same notification again (signal or poll) does not ring or add a second card.
  await realtime(staff.page)
  await staff.context.clock.runFor(46_000)
  await staff.page.waitForTimeout(300)
  assert.equal((await sounds(staff.page)).length, 1)
  assert.equal(await cards(staff.page).getByRole('alert').count(), 1)
  pass('The same notification is announced once, whatever signal or poll arrives later')

  // 3. "Xem & xác nhận" opens the order and marks the notification read.
  await cards(staff.page).getByRole('button', { name: 'Xem & xác nhận' }).click()
  await staff.page.getByText('DH-0012').first().waitFor()
  assert(staff.state.requests.includes('POST /api/me/notifications/n-1/read'))
  assert(staff.state.requests.includes('GET /api/orders/order-1'))
  assert.equal(await cards(staff.page).count(), 0)
  // Cards stay under an open detail popup (they must not cover its buttons): close it before the next alerts.
  await staff.page.getByRole('dialog').waitFor()
  await staff.page.keyboard.press('Escape')
  await staff.page.getByRole('dialog').waitFor({ state: 'hidden' })
  pass('"Xem & xác nhận" opens the order detail and marks its notification read')

  // 4. Online orders still waiting: "Còn đơn hàng chưa xác nhận" every two minutes; nothing when none waits.
  staff.state.pending = 1
  await staff.context.clock.runFor(121_000)
  await staff.page.waitForFunction(() => window.__sounds.includes('/sounds/order-pending.mp3'))
  const reminders = async () => (await sounds(staff.page)).filter(s => s === '/sounds/order-pending.mp3').length
  assert.equal(await reminders(), 1)
  staff.state.pending = 0
  await staff.context.clock.runFor(121_000)
  await staff.page.waitForTimeout(300)
  assert.equal(await reminders(), 1)
  pass('An online order still waiting plays "Còn đơn hàng chưa xác nhận" after two minutes, and nothing when none waits')

  // 5. payOS payment → "Khách đã thanh toán"; a cash payment the staff recorded themselves → nothing.
  staff.state.payments['pay-online'] = payment('pay-online', 'PAYOS', 350000, 'DH-0012')
  staff.state.payments['pay-cash'] = payment('pay-cash', 'CASH', 50000, 'DH-0012')
  staff.state.notifications.push(
    note('n-cash', 'PAYMENT_CONFIRMED', 'Đã xác nhận thanh toán', { entityType: 'PAYMENT', entityId: 'pay-cash', orderId: 'order-1' }),
    note('n-paid', 'PAYMENT_CONFIRMED', 'Đã xác nhận thanh toán', { entityType: 'PAYMENT', entityId: 'pay-online', orderId: 'order-1' }))
  await realtime(staff.page)
  const paid = cards(staff.page).getByRole('alert').filter({ hasText: 'Khách đã thanh toán' })
  await paid.getByText('DH-0012 · Nguyễn Văn A').waitFor()
  await paid.getByRole('button', { name: 'Xem đơn' }).waitFor()
  assert.equal((await sounds(staff.page)).filter(s => s === '/sounds/payment-received.mp3').length, 1)
  assert.equal(await cards(staff.page).getByRole('alert').count(), 1)
  pass('A payOS payment plays "Khách đã thanh toán"; a cash payment recorded by staff stays silent')

  // 6. The Farmer cancels their order → "Khách đã huỷ đơn"; a cancellation by staff → nothing.
  staff.state.orders['order-2'] = order('order-2', 'DH-0013', 'Trần Thị B', 120000, { status: 'CANCELLED', cancelledBy: FARMER_USER, cancelledAt: new Date(NOW).toISOString() })
  staff.state.orders['order-3'] = order('order-3', 'DH-0014', 'Lê Văn C', 90000, { status: 'CANCELLED', cancelledBy: 'user-SALES_STAFF', cancelledAt: new Date(NOW).toISOString() })
  const order1Reads = () => staff.state.requests.filter(r => r === 'GET /api/orders/order-1').length
  const order1Before = order1Reads()
  staff.state.notifications.push(
    note('n-staff-cancel', 'ORDER_STATUS_CHANGED', 'Đơn hàng đã được hủy', { entityType: 'ORDER', entityId: 'order-3', orderId: 'order-3' }),
    note('n-confirmed', 'ORDER_STATUS_CHANGED', 'Đơn hàng đã được xác nhận', { entityType: 'ORDER', entityId: 'order-1', orderId: 'order-1' }),
    note('n-farmer-cancel', 'ORDER_STATUS_CHANGED', 'Đơn hàng đã được hủy', { entityType: 'ORDER', entityId: 'order-2', orderId: 'order-2' }))
  await realtime(staff.page)
  const cancelled = cards(staff.page).getByRole('alert').filter({ hasText: 'Khách đã huỷ đơn' })
  await cancelled.getByText('DH-0013 · Trần Thị B').waitFor()
  assert.equal((await sounds(staff.page)).filter(s => s === '/sounds/order-cancelled.mp3').length, 1)
  assert.equal(await cards(staff.page).getByText('DH-0014', { exact: false }).count(), 0)
  // "Đơn hàng đã được xác nhận" is not a cancellation: the order is not even read.
  assert.equal(order1Reads(), order1Before)
  pass('An order cancelled by its Farmer plays "Khách đã huỷ đơn"; staff cancellations and other status changes stay silent')

  // 7. A return request → "Có yêu cầu trả hàng"; its button opens the request.
  staff.state.returns['ret-1'] = { id: 'ret-1', storeId: 'store', returnNumber: 'TH-0001', orderId: 'order-1', orderNumber: 'DH-0012', farmerProfileId: 'farmer-1', customerName: 'Nguyễn Văn A', status: 'REQUESTED', requestedBy: FARMER_USER, requestedAt: new Date(NOW).toISOString(), approvedBy: null, approvedAt: null, receivedBy: null, receivedAt: null, inspectedBy: null, inspectedAt: null, completedAt: null, cancelledBy: null, cancelledAt: null, cancelReason: null, reasonSummary: 'Hàng lỗi', note: null, totalReturnAmount: 70000, totalDebtAdjustment: 0, totalRefundAmount: 70000, items: [], refunds: [] }
  staff.state.notifications.push(note('n-ret', 'RETURN_REQUESTED', 'Có yêu cầu trả hàng mới', { entityType: 'SALES_RETURN', entityId: 'ret-1', orderId: 'order-1' }))
  await realtime(staff.page)
  const returned = cards(staff.page).getByRole('alert').filter({ hasText: 'Có yêu cầu trả hàng' })
  await returned.getByText('TH-0001 · Nguyễn Văn A').waitFor()
  assert.equal((await sounds(staff.page)).filter(s => s === '/sounds/return-requested.mp3').length, 1)
  await returned.getByRole('button', { name: 'Xem yêu cầu' }).click()
  await staff.page.waitForURL(url => url.pathname === '/sales/returns/ret-1')
  pass('A return request plays "Có yêu cầu trả hàng" and its button opens the request')

  // 8. A second tab of the same computer shows the card but does not ring a second time.
  const second = await fixture({ context: staff.context })
  await control(second.page).waitFor()
  staff.state.orders['order-4'] = order('order-4', 'DH-0015', 'Phạm D', 60000)
  staff.state.notifications.push(placed('n-4', 'order-4'))
  const before = (await sounds(staff.page)).length
  await Promise.all([realtime(staff.page), realtime(second.page)])
  await cards(staff.page).getByText('DH-0015 · Phạm D').waitFor()
  await cards(second.page).getByText('DH-0015 · Phạm D').waitFor()
  assert.equal((await sounds(staff.page)).length - before + (await sounds(second.page)).length, 1)
  assert.deepEqual([...staff.errors, ...second.errors], [])
  await staff.context.close()
  pass('Two open tabs both show the alert but only one plays the sound')

  // 9. Two alerts at once play one after the other.
  const both = await fixture({ path: '/sales/payments' })
  await control(both.page).waitFor()
  both.state.orders['order-5'] = order('order-5', 'DH-0016', 'Võ E', 75000)
  both.state.payments['pay-5'] = payment('pay-5', 'PAYOS', 75000, 'DH-0016')
  both.state.notifications.push(placed('n-5', 'order-5'),
    note('n-6', 'PAYMENT_CONFIRMED', 'Đã xác nhận thanh toán', { entityType: 'PAYMENT', entityId: 'pay-5', orderId: 'order-5' }))
  await realtime(both.page)
  await both.page.waitForFunction(() => window.__sounds.filter(s => s !== 'unlock').length === 2)
  assert.deepEqual([...(await sounds(both.page))].sort(), ['/sounds/new-order.mp3', '/sounds/payment-received.mp3'])
  await both.context.close()
  pass('Two alerts arriving together play both recordings, one after the other')

  // 10. A hidden tab rings, shows a Windows notification and blinks its title.
  const hidden = await fixture({ hidden: true, settings: { desktop: true } })
  await control(hidden.page).waitFor()
  hidden.state.orders['order-7'] = order('order-7', 'DH-0017', 'Lê Văn C', 90000)
  hidden.state.notifications.push(placed('n-7', 'order-7'))
  await realtime(hidden.page)
  await hidden.page.waitForFunction(() => window.__desktop.length === 1)
  const desktop = await hidden.page.evaluate(() => window.__desktop[0])
  assert.equal(desktop.title, 'Có đơn hàng mới')
  assert.equal(desktop.body, 'DH-0017 · Lê Văn C · 90.000 đ')
  assert.deepEqual(await sounds(hidden.page), ['/sounds/new-order.mp3'])
  await hidden.context.clock.runFor(1_100)
  await hidden.page.waitForFunction(() => document.title === '(1) Có đơn hàng mới')
  await hidden.context.close()
  pass('In a background tab the alert rings, shows a Windows notification and blinks the tab title')

  // 11. Sound blocked by the browser: a prompt, which a click removes.
  const blocked = await fixture({ blockPlay: true })
  await control(blocked.page).waitFor()
  blocked.state.orders['order-8'] = order('order-8', 'DH-0018', 'Phạm D', 50000)
  blocked.state.notifications.push(placed('n-8', 'order-8'))
  await realtime(blocked.page)
  const prompt = blocked.page.getByRole('alert').filter({ hasText: 'Trình duyệt đang chặn âm thanh thông báo của cửa hàng.' })
  await prompt.waitFor()
  await cards(blocked.page).getByText('DH-0018 · Phạm D').waitFor()
  await blocked.page.evaluate(() => { window.__blockPlay = false })
  await prompt.getByRole('button', { name: 'Bật âm thanh' }).click()
  await prompt.waitFor({ state: 'detached' })
  await blocked.context.close()
  pass('When the browser blocks sound the card still shows and a "Bật âm thanh" prompt unlocks it')

  // 12. One sound switched off: its card shows, nothing plays; the others still play; the choice is kept.
  const quiet = await fixture()
  await control(quiet.page).click()
  const dialog = quiet.page.getByRole('dialog', { name: 'Cài đặt âm thanh thông báo' })
  await shot(quiet.page, 'store-alert-settings.png')
  await dialog.getByRole('button', { name: 'Nghe thử: Khách đã huỷ đơn' }).click()
  assert.deepEqual(await sounds(quiet.page), ['/sounds/order-cancelled.mp3'])
  await dialog.getByRole('checkbox', { name: /Khi có đơn hàng mới/ }).uncheck()
  await quiet.page.keyboard.press('Escape')
  quiet.state.orders['order-9'] = order('order-9', 'DH-0019', 'Võ E', 75000)
  quiet.state.notifications.push(placed('n-9', 'order-9'))
  await realtime(quiet.page)
  await cards(quiet.page).getByText('DH-0019 · Võ E').waitFor()
  assert.deepEqual(await sounds(quiet.page), ['/sounds/order-cancelled.mp3'])
  const stored = JSON.parse(await quiet.page.evaluate(() => localStorage.getItem('agrisage_store_alert_settings')))
  assert.equal(stored.sounds.newOrder, false)
  assert.equal(stored.sounds.paid, true)
  await quiet.context.close()
  pass('Each sound has its own switch and test button; a sound switched off stays silent and the choice is remembered')

  // 13. Old unread notifications (older than 12 hours) are not announced; the owner gets alerts too.
  const owner = await fixture({ role: 'STORE_OWNER', path: '/agent/orders' })
  owner.state.orders['order-10'] = order('order-10', 'DH-0001', 'Cũ', 10000)
  owner.state.notifications.push(placed('n-10', 'order-10', NOW - 13 * 3600_000))
  await control(owner.page).waitFor()
  await realtime(owner.page)
  await owner.page.waitForTimeout(400)
  assert.equal(await cards(owner.page).count(), 0)
  assert.deepEqual(await sounds(owner.page), [])
  await owner.context.close()
  pass('The store owner has the alerts, and notifications older than 12 hours are not announced again')

  // 14. Admins have no alert control and no alert polling.
  const admin = await fixture({ role: 'ADMIN', path: '/admin' })
  await admin.page.waitForTimeout(600)
  assert.equal(await control(admin.page).count(), 0)
  assert.equal(admin.state.requests.filter(r => r.startsWith('GET /api/me/notifications?')).length, 0)
  await admin.context.close()
  pass('Admins get neither the alert control nor the alert polling')

  console.log(`${checks} store alert browser checks passed`)
} finally {
  await browser.close()
}
