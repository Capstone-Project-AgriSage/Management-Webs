import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// The sales staff dashboard (2026-11-23): today's counter figures and "my results" for the chosen period, from
// GET /api/reports/counter-sales-today and GET /api/reports/my-sales (both COUNTER_SALES.SELL). The seller never sees cost of
// goods or profit, and asks for no other report. Every API request is intercepted; no live store is read or written.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const failures = []
const screenshotDir = process.env.DASHBOARD_SCREENSHOT_DIR
if (screenshotDir) await mkdir(screenshotDir, { recursive: true })
let checks = 0
const pass = message => { checks++; console.log('PASS ' + message) }

const vnToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const addDays = (iso, days) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
const order = { id: 'order-1', orderNumber: 'ORD-STAFF-1', source: 'COUNTER', customerType: 'WALK_IN', farmerProfileId: null, customerName: 'Khách lẻ', customerPhone: null, status: 'COMPLETED', settlementType: 'FULL_PAYMENT', fulfillmentType: 'PICKUP', totalAmount: 1400000, createdAt: new Date().toISOString() }
const mine = query => ({ fromDate: query.fromDate, toDate: query.toDate,
  orders: { createdCount: 5, completedCount: 3, cancelledCount: 1, openCount: 1 },
  sales: { orderCount: 3, fulfilledValue: 4200000, returnValue: 200000, netSales: 4000000, averageOrderValue: 1400000 },
  payments: { paymentCount: 4, receivedAmount: 3800000, orderPaymentAmount: 3300000, debtRepaymentAmount: 500000 } })

async function session(mode = 'normal') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'sales-dashboard'))
  const state = { requests: [] }
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/realtime/negotiate') return route.abort()
    const query = Object.fromEntries(url.searchParams)
    state.requests.push({ path, query })
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {})
    const paged = (items = []) => ({ items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1 })
    if (request.method() !== 'GET') { failures.push(`Unexpected write ${request.method()} ${path}`); return route.abort() }
    if (path === '/api/auth/me') return json({ id: 'seller', fullName: 'Nhân viên bán hàng', role: 'SALES_STAFF', status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ permissions: ['ORDERS.READ', 'PAYMENTS.READ', 'DEBT.READ', 'INVENTORY.READ', 'CUSTOMERS.READ', ...(mode === 'denied' ? [] : ['COUNTER_SALES.SELL'])] })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/reports/counter-sales-today') return json({ date: vnToday, asOf: new Date().toISOString(), paidSalesRevenue: 3000000, completedOrderCount: 2, receivedAmount: 3500000, creditSalesAmount: 1000000 })
    if (path === '/api/reports/my-sales') {
      if (mode === 'failed') return route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Báo cáo của bạn tạm thời không có.', status: 503 }) })
      return json(mine(query))
    }
    if (path === '/api/orders') return json({ ...paged([order]), totalCount: 5 })
    return json(paged([]))
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(`Page error: ${error.message}`))
  return { context, page, state }
}

try {
  const { context, page, state } = await session()
  await page.goto(`${base}/sales`)
  const counter = page.getByRole('region', { name: 'Báo cáo bán tại quầy hôm nay', exact: true })
  await counter.getByText('3.000.000 đ').waitFor()
  assert.match(await counter.innerText(), /Doanh thu hôm nay[\s\S]*3\.000\.000 đ[\s\S]*Đơn hàng hoàn thành[\s\S]*2[\s\S]*Tiền đã thu[\s\S]*3\.500\.000 đ[\s\S]*Công nợ phát sinh[\s\S]*1\.000\.000 đ/)
  pass("Today's counter figures come first")

  const results = page.getByRole('region', { name: 'Kết quả của tôi trong kỳ', exact: true })
  await results.getByText('4.000.000 đ').waitFor()
  const text = (await results.innerText()).replace(/\s+/g, ' ')
  assert.match(text, /Đơn tôi tạo 5 đơn 3 hoàn thành · 1 đang xử lý · 1 đã hủy/)
  assert.match(text, /Doanh số của tôi 4\.000\.000 đ 3 đơn đã giao · trả lại 200\.000 đ/)
  assert.match(text, /Tiền tôi đã thu 3\.800\.000 đ 4 lần thu · gồm thu nợ 500\.000 đ/)
  assert.match(text, /Giá trị đơn trung bình 1\.400\.000 đ/)
  const main = await page.locator('main').innerText()
  assert.doesNotMatch(main, /Lãi gộp|Giá vốn|lợi nhuận/i, 'A seller never sees cost or profit')
  assert.equal(await page.locator('section[aria-label="Đơn hàng trong kỳ"]').count(), 0, 'The count strip is replaced')
  assert.equal(await page.locator('.agrisage-kpi-card').count(), 0, 'A dashboard uses strips and panels, not list summary cards')
  pass('My results show my orders, my net sales and the money I took, without cost or profit')

  const reportCalls = state.requests.filter(request => request.path.startsWith('/api/reports/'))
  assert.deepEqual([...new Set(reportCalls.map(request => request.path))].sort(), ['/api/reports/counter-sales-today', '/api/reports/my-sales'])
  const first = state.requests.find(request => request.path === '/api/reports/my-sales')
  assert.deepEqual([first.query.fromDate, first.query.toDate], [vnToday, vnToday], 'The staff period starts on today')
  assert.ok(!reportCalls.some(request => 'staffUserId' in request.query || 'userId' in request.query), 'The user comes from the token, never the query')
  pass('Only the two counter-sales reports are asked for, for today, without a user id')

  // One period filter drives my results and the order list, as on the owner's dashboard.
  await page.getByRole('button', { name: '7 ngày', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('main .animate-pulse'))
  const week = addDays(vnToday, -6)
  assert.ok(state.requests.some(request => request.path === '/api/reports/my-sales' && request.query.fromDate === week && request.query.toDate === vnToday))
  assert.ok(state.requests.some(request => request.path === '/api/orders' && request.query.fromDate === week))
  assert.equal(await page.getByRole('region', { name: 'Đơn hàng gần đây' }).getByLabel('Từ ngày').count(), 0, 'The order list has no second date filter')
  pass('Changing the period reloads my results and the order list together')

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1, null, { timeout: 5000 })
    if (screenshotDir) await page.screenshot({ path: join(screenshotDir, `sales-${width}.png`), fullPage: true })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(overflow <= width + 1, `No document overflow at ${width}px (${overflow})`)
  }
  pass('No page overflow from 1440 to 320 px')
  await context.close()

  const failed = await session('failed')
  await failed.page.goto(`${base}/sales`)
  await failed.page.getByText('Báo cáo của bạn tạm thời không có.').waitFor()
  assert.match((await failed.page.getByRole('region', { name: 'Kết quả của tôi trong kỳ' }).innerText()).replace(/\s+/g, ' '), /Đơn tôi tạo — /)
  await failed.page.getByRole('region', { name: 'Báo cáo bán tại quầy hôm nay' }).getByText('3.000.000 đ').waitFor()
  pass('A failed "my results" report shows its error and dashes, and today\'s counter still loads')
  await failed.context.close()

  const denied = await session('denied')
  await denied.page.goto(`${base}/sales`)
  await denied.page.getByText('Cần quyền bán tại quầy để xem kết quả của bạn.').waitFor()
  await denied.page.getByText('Cần quyền bán tại quầy để xem số liệu quầy hôm nay.').waitFor()
  await denied.page.getByText('ORD-STAFF-1').waitFor()
  assert.equal(denied.state.requests.filter(request => request.path.startsWith('/api/reports/')).length, 0)
  pass('Without COUNTER_SALES.SELL the seller sees placeholders, the order list, and no report request')
  await denied.context.close()
} catch (error) {
  failures.push(error.stack || String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Sales dashboard checks passed (${checks})`)
