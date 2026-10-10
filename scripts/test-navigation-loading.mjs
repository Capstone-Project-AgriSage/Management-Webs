import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// All API traffic is intercepted; slow responses exercise navigation without live store writes.
const { chromium } = await import(process.env.REPORT_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.REPORT_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.REPORT_BROWSER_CHANNEL })
const base = process.env.REPORT_TEST_URL || 'http://127.0.0.1:5174'
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
await context.addInitScript(() => localStorage.setItem('agrisage_token', 'navigation-test'))
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve }); return { promise, release } }
const state = { requests: [], reports: deferred(), summaries: null, failWrite: false, received: 3000000 }
const errors = []
let checks = 0
const pass = name => { checks++; console.log('PASS ' + name) }
const count = path => state.requests.filter(request => request.path === path).length
const order = (id, name) => ({ id, orderNumber: name, customerName: 'Khách ' + name, customerType: 'WALK_IN', status: 'COMPLETED', source: 'COUNTER', settlementType: 'FULL_PAYMENT', fulfillmentType: 'PICKUP', subtotalAmount: 1000000, totalAmount: 1000000, createdAt: '2026-10-10T03:00:00Z', items: [] })
await context.route('**/api/**', async route => {
  const request = route.request()
  const url = new URL(request.url())
  if (!url.pathname.startsWith('/api/')) return route.continue()
  state.requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), time: Date.now(), method: request.method() })
  const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {})
  if (url.pathname === '/api/auth/me') return json({ id: 'test-user', fullName: 'Test', role: 'STORE_OWNER', status: 'ACTIVE' })
  if (url.pathname === '/api/me/permissions') return json({ permissions: ['ORDERS.READ', 'PAYMENTS.READ', 'REPORTS.READ'] })
  if (url.pathname.endsWith('/unread-count')) return json({ count: 0 })
  if (url.pathname.startsWith('/api/reports/')) {
    const gate = state.reports
    if (gate) await gate.promise
    return json({ totals: url.pathname.endsWith('/orders') ? { orderCount: 20, orderValue: 5000000 } : { receivedAmount: state.received, refundedAmount: 0, netReceivedAmount: state.received } })
  }
  if (url.pathname === '/api/payments/cash') return json(state.failWrite ? { title: 'Unavailable' } : {}, state.failWrite ? 503 : 200)
  if (/\/orders\/[^/]+\/payments$/.test(url.pathname)) {
    const gate = state.summaries
    if (gate) await gate.promise
    return json({ orderTotal: 1000000, paidAmount: 1000000, remainingToPay: 0, payments: [], refunds: [] })
  }
  if (url.pathname === '/api/orders') {
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')
    await wait(status === 'CONFIRMED' ? 650 : 50)
    const name = status === 'CONFIRMED' ? 'OLD-RESPONSE' : status === 'COMPLETED' ? 'CURRENT-RESPONSE' : search ? 'SEARCH-RESULT' : 'VISIBLE-ORDER'
    return json({ items: [order(name, name)], totalCount: status === 'CONFIRMED' ? 99 : 20, totalPages: 2, page: Number(url.searchParams.get('page') || 1), pageSize: 10 })
  }
  return json({ items: [], totalCount: 0, totalPages: 0 })
})
const page = await context.newPage()
page.setDefaultTimeout(8000)
page.setDefaultNavigationTimeout(15000)
page.on('pageerror', error => errors.push(error.message))
const section = title => page.getByRole('region', { name: title, exact: true })
const loaded = async title => {
  await page.waitForFunction(title => document.querySelector(`section[aria-label="${title}"] button`)?.disabled === false, title)
}
try {
  await page.goto(base + '/agent/orders')
  const orders = section('Tổng hợp đơn hàng')
  await orders.getByRole('status').filter({ hasText: 'Đang tải' }).waitFor()
  await page.getByRole('table').getByText('VISIBLE-ORDER', { exact: true }).waitFor()
  const initial = await orders.boundingBox()
  const tableBefore = await page.getByRole('table').boundingBox()
  assert.equal(count('/api/orders'), 1)
  assert.equal(count('/api/reports/orders'), 1)
  const listStart = state.requests.find(r => r.path === '/api/orders').time
  const reportStart = state.requests.find(r => r.path === '/api/reports/orders').time
  assert(Math.abs(listStart - reportStart) < 200, 'Navigation must not add the old 300 ms list delay')
  pass('Navigation starts list and report together; list is usable while the report is still pending')
  state.reports.release(); state.reports = null
  await loaded('Tổng hợp đơn hàng')
  assert(Math.abs((await orders.boundingBox()).height - initial.height) < 1)
  assert(Math.abs((await page.getByRole('table').boundingBox()).y - tableBefore.y) < 1)
  pass('Report loading does not move the table or change the summary section height')
  await page.getByRole('button', { name: 'Trang 2', exact: true }).click()
  await page.waitForResponse(response => new URL(response.url()).pathname === '/api/orders' && new URL(response.url()).searchParams.get('page') === '2')
  const beforeSearch = count('/api/orders')
  await page.getByPlaceholder('Tìm theo mã đơn, SĐT...').fill('abc')
  await page.getByPlaceholder('Tìm theo mã đơn, SĐT...').fill('abcd')
  await page.getByRole('table').getByText('SEARCH-RESULT', { exact: true }).waitFor()
  assert.equal(count('/api/orders'), beforeSearch + 1)
  assert.equal(count('/api/reports/orders'), 1)
  pass('Typing from page 2 sends one debounced search; pagination/search never refetch store totals')
  const beforePermission = count('/api/orders')
  const permissionsResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/me/permissions')
  await page.evaluate(() => window.dispatchEvent(new Event('agrisage-permissions-changed')))
  await permissionsResponse
  await wait(100)
  assert.equal(count('/api/orders'), beforePermission)
  assert.equal(count('/api/reports/orders'), 1)
  pass('Refreshing unchanged permissions does not trigger business or report requests')
  const selects = page.locator('main select')
  const oldRequest = page.waitForRequest(request => new URL(request.url()).searchParams.get('status') === 'CONFIRMED')
  await selects.first().selectOption('CONFIRMED'); await oldRequest
  await selects.first().selectOption('COMPLETED')
  await page.getByRole('table').getByText('CURRENT-RESPONSE', { exact: true }).waitFor()
  await wait(700)
  assert.equal(await page.getByRole('table').getByText('OLD-RESPONSE', { exact: true }).count(), 0)
  pass('A superseded slow order response cannot replace the current filter results')
  state.reports = deferred(); state.summaries = deferred()
  await page.locator('aside a[href="/agent/payments"]').click()
  const payments = section('Tổng hợp thanh toán')
  await page.getByRole('table').getByText('VISIBLE-ORDER', { exact: true }).waitFor()
  assert.equal(await page.getByRole('table').getByText('Đang tải dữ liệu...', { exact: true }).count(), 0)
  await page.getByRole('table').getByText('Đang tải...', { exact: true }).waitFor()
  assert.equal(count('/api/reports/payments'), 1)
  state.summaries.release(); state.summaries = null
  await page.getByRole('table').getByText('Đã thanh toán đủ', { exact: true }).waitFor()
  state.reports.release(); state.reports = null
  await loaded('Tổng hợp thanh toán')
  assert.equal(count('/api/reports/payments'), 1)
  pass('Payments displays orders before payment summaries finish, without loading the report twice')
  await page.setViewportSize({ width: 390, height: 844 })
  const mobileHeight = (await payments.boundingBox()).height
  state.reports = deferred()
  await payments.getByRole('button').click()
  assert(Math.abs((await payments.boundingBox()).height - mobileHeight) < 1)
  state.reports.release(); state.reports = null
  await loaded('Tổng hợp thanh toán')
  assert(Math.abs((await payments.boundingBox()).height - mobileHeight) < 1)
  pass('Mobile report refresh preserves card layout while showing loading placeholders')
  const beforeWrite = count('/api/reports/payments')
  state.received = 4000000
  await page.evaluate(async () => { const { paymentsApi } = await import('/src/api/paymentsApi.ts'); await paymentsApi.createCashPayment({ paymentContext: 'ORDER_PAYMENT', orderId: 'test', amount: 1000000 }) })
  await payments.getByText('4.000.000 đ', { exact: true }).first().waitFor()
  assert.equal(count('/api/reports/payments'), beforeWrite + 1)
  state.failWrite = true
  await page.evaluate(async () => { const { paymentsApi } = await import('/src/api/paymentsApi.ts'); await paymentsApi.createCashPayment({ paymentContext: 'ORDER_PAYMENT', orderId: 'test', amount: 1 }).catch(() => {}) })
  assert.equal(count('/api/reports/payments'), beforeWrite + 1)
  pass('A successful business write refreshes totals once; a failed write does not')
  assert.deepEqual(errors, [])
  console.log(`${checks} navigation/loading browser checks passed (mock API, not live latency)`)
} catch (error) {
  console.error('Page errors:', errors)
  console.error('Observed requests:', state.requests)
  console.error((await page.locator('main').innerText().catch(() => '')).slice(0, 1500))
  throw error
} finally { state.reports?.release(); state.summaries?.release(); await browser.close() }
