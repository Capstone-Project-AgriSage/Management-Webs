import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// The owner's dashboard adds three panels: best sellers (with units sold and a warning before they run out), lots expiring
// in the next 30 days, and the customers who buy most. Every API request is intercepted; no live store is read or written.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const failures = []
let checks = 0
const pass = message => { checks++; console.log('PASS ' + message) }

const metrics = (netSales, orderCount = 1) => ({ orderCount, fulfilledValue: netSales, costOfGoods: netSales * .6, grossProfit: netSales * .4, returnValue: 0, netSales, averageOrderValue: netSales / orderCount, grossMarginPercent: 40 })
const products = [['sp-tilt', 'Tilt Super 300EC', 2400000, 12], ['sp-ure', 'Đạm Phú Mỹ', 1650000, 9], ['sp-chess', 'Chess 50WG', 320000, 4]]
const customers = [['farmer-1', 'Nguyễn Văn An', 1800000, 5], ['WALK_IN', 'Khách lẻ', 900000, 7]]
const vnToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const addDays = (iso, days) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
const dmy = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

async function session(mode = 'normal') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'dashboard-panels'))
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
    const empty = mode === 'empty'
    if (request.method() !== 'GET') { failures.push(`Unexpected write ${request.method()} ${path}`); return route.abort() }
    if (path === '/api/auth/me') return json({ id: 'owner', fullName: 'Chủ cửa hàng', role: 'STORE_OWNER', status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ permissions: ['REPORTS.READ', 'ORDERS.READ', 'PAYMENTS.READ', 'DEBT.READ', 'DEBT.READ_DASHBOARD', 'INVENTORY.READ', 'CUSTOMERS.READ', 'DELIVERIES.READ', 'RETURNS.READ'] })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/reports/revenue') {
      const by = query.groupBy
      const list = empty ? [] : by === 'PRODUCT' ? products : by === 'CUSTOMER' ? customers : []
      const rows = list.map(([key, label, net, orders]) => ({ key, label, ...metrics(net, orders) }))
      const total = rows.reduce((sum, row) => sum + row.netSales, 0)
      return json({ fromDate: query.fromDate, toDate: query.toDate, groupBy: by, rows, page: 1, pageSize: Number(query.pageSize || 20), totalCount: rows.length, totalPages: 1, totals: metrics(total || 0, 1) })
    }
    if (path === '/api/reports/inventory-turnover') return json({
      items: empty ? [] : [
        { storeProductId: 'sp-tilt', sku: 'TILT', productName: 'Tilt Super 300EC', baseUnit: 'BOTTLE', soldBaseQuantity: 30, onHandBaseQuantity: 4, sellableBaseQuantity: 4, averageDailySales: 1, daysOfStock: 4, lastSaleDate: vnToday, velocity: 'FAST', dataStatus: 'OK' },
        { storeProductId: 'sp-ure', sku: 'URE', productName: 'Đạm Phú Mỹ', baseUnit: 'KG', soldBaseQuantity: 120, onHandBaseQuantity: 2000, sellableBaseQuantity: 2000, averageDailySales: 4, daysOfStock: 500, lastSaleDate: vnToday, velocity: 'SLOW', dataStatus: 'OK' },
        { storeProductId: 'sp-chess', sku: 'CHESS', productName: 'Chess 50WG', baseUnit: 'PACK', soldBaseQuantity: 10, onHandBaseQuantity: 0, sellableBaseQuantity: 0, averageDailySales: .3, daysOfStock: 0, lastSaleDate: vnToday, velocity: 'FAST', dataStatus: 'OK' },
      ], page: 1, pageSize: 100, totalCount: 3, totalPages: 1, summary: { products: 3, fast: 2, slow: 1, noSales: 0 }, fromDate: addDays(vnToday, -30), toDate: addDays(vnToday, -1),
    })
    if (path === '/api/inventory/expiry-risk') return json({
      items: empty ? [] : [
        { inventoryLotId: 'lot-1', storeProductId: 'sp-beam', sku: 'BEAM', productName: 'Beam 75WP', baseUnit: 'PACK', lotNumber: 'BM2411-07', expiryDate: addDays(vnToday, -2), lotStatus: 'ACTIVE', onHandBaseQuantity: 6, reservedBaseQuantity: 0, atRiskBaseQuantity: 6, atRiskValue: 180000, dataStatus: 'OK' },
        { inventoryLotId: 'lot-2', storeProductId: 'sp-tilt', sku: 'TILT', productName: 'Tilt Super 300EC', baseUnit: 'BOTTLE', lotNumber: 'TS2411-09', expiryDate: addDays(vnToday, 3), lotStatus: 'ACTIVE', onHandBaseQuantity: 4, reservedBaseQuantity: 0, atRiskBaseQuantity: 2, atRiskValue: 170000, dataStatus: 'OK' },
      ], page: 1, pageSize: 3, totalCount: empty ? 0 : 5, totalPages: 1, summary: { lots: empty ? 0 : 5, knownRiskLots: 2, unknownRiskLots: 0, knownRiskValue: empty ? 0 : 350000 }, withinDays: 30,
    })
    // The other dashboard reports and tiles: real shapes with nothing in them.
    if (path === '/api/reports/revenue-summary') return json({ current: metrics(0), previous: metrics(0), netSalesChangePercent: null })
    if (path === '/api/reports/sales') return json({ rows: [], totals: metrics(0), page: 1, pageSize: 20, totalCount: 0, totalPages: 0 })
    if (path === '/api/reports/orders') return json({ rows: [], totals: { orderCount: 0, orderValue: 0 } })
    if (path === '/api/reports/payments') return json({ rows: [], totals: { paymentCount: 0, receivedAmount: 0, orderPaymentAmount: 0, debtRepaymentAmount: 0, refundedAmount: 0, netReceivedAmount: 0 } })
    if (path === '/api/reports/debt-aging') return json({ asOf: vnToday, rows: [], totals: { notDue: 0, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0, total: 0 } })
    if (path === '/api/reports/debt-by-customer-group') return json({ rows: [] })
    if (path === '/api/inventory/replenishment/products' || path === '/api/inventory/replenishment/urgent') return json({ ...paged([]), summary: { totalProducts: 0, outOfStock: 0, highPriority: 0, needsConfiguration: 0, insufficientHistory: 0, seasonalProducts: 0 }, generatedAt: new Date().toISOString(), fromDate: vnToday, toDate: vnToday, horizonDays: 30 })
    return json(paged([]))
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(`Page error: ${error.message}`))
  return { context, page, state }
}

try {
  const { context, page, state } = await session()
  await page.goto(`${base}/agent`)
  const best = page.getByRole('region', { name: 'Sản phẩm bán chạy', exact: true })
  await best.getByText('Tilt Super 300EC').first().waitFor()

  // Best sellers: ranked by the period's net sales, with units sold and a stock warning from the sales pace.
  const items = best.getByRole('listitem')
  assert.equal(await items.count(), 3)
  assert.match(await items.nth(0).innerText(), /Tilt Super 300EC[\s\S]*Sắp hết · 4 ngày[\s\S]*12 đơn[\s\S]*30 chai/)
  assert.match(await items.nth(1).innerText(), /Đạm Phú Mỹ[\s\S]*9 đơn[\s\S]*120 kg/)
  assert.doesNotMatch(await items.nth(1).innerText(), /Sắp hết|Hết hàng/, 'plenty in stock: no warning')
  assert.match(await items.nth(2).innerText(), /Chess 50WG[\s\S]*Hết hàng/)
  assert.match(await best.innerText(), /2 sắp hết hàng/)
  assert.equal(await best.getByRole('link', { name: 'Xem chi tiết: Sản phẩm bán chạy' }).getAttribute('href'), '/agent/inventory/reports/planning')
  const revenueBy = by => state.requests.filter(request => request.path === '/api/reports/revenue' && request.query.groupBy === by)
  assert.equal(revenueBy('PRODUCT').at(-1).query.pageSize, '10')
  const pace = state.requests.filter(request => request.path === '/api/reports/inventory-turnover').at(-1)
  assert.ok(Number(pace.query.historyDays) >= 14 && Number(pace.query.historyDays) <= 365, 'the pace uses 14 to 365 days, as the API requires')
  pass('Best sellers show sales, units sold, low-stock and out-of-stock warnings, and link to the planning report')

  // Expiring lots: the next 30 days, nearest first, an expired lot called out.
  const expiry = page.getByRole('region', { name: 'Lô sắp hết hạn (30 ngày tới)', exact: true })
  await expiry.getByText('Beam 75WP').waitFor()
  assert.match(await expiry.innerText(), /5 lô/)
  assert.match(await expiry.innerText(), /350K/)
  assert.match(await expiry.innerText(), new RegExp(`Hết hạn ${dmy(addDays(vnToday, -2)).slice(0, 5)}`))
  assert.match(await expiry.innerText(), /TS2411-09[\s\S]*còn 3 ngày/)
  assert.equal(await expiry.getByRole('link').getAttribute('href'), '/agent/inventory/reports/planning?tab=expiry')
  const expiryRequest = state.requests.filter(request => request.path === '/api/inventory/expiry-risk').at(-1)
  assert.equal(expiryRequest.query.withinDays, '30')
  pass('Expiring lots show the count, the value at risk and the nearest lots, and link to the expiry tab')

  // Top customers: registered farmers and walk-in sales, with their share of the period's revenue.
  const buyers = page.getByRole('region', { name: 'Khách hàng mua nhiều', exact: true })
  await buyers.getByText('Nguyễn Văn An').first().waitFor()
  assert.match(await buyers.innerText(), /67%[\s\S]*doanh thu từ[\s\S]*Nguyễn Văn An/)
  assert.match(await buyers.innerText(), /Khách lẻ \(không đăng ký\)[\s\S]*7 đơn/)
  assert.equal(await buyers.getByRole('link').getAttribute('href'), '/agent/farmers')
  pass('Top customers show the leader\'s share, walk-in sales and link to the customer list')

  // The expiry link opens the planning report on its expiry tab.
  await expiry.getByRole('link').click()
  await page.getByRole('tab', { name: 'Rủi ro hạn dùng' }).waitFor()
  assert.equal(await page.getByRole('tab', { name: 'Rủi ro hạn dùng' }).getAttribute('aria-selected'), 'true')
  pass('?tab=expiry opens the expiry risk tab')
  await context.close()

  // Nothing sold, nothing expiring: each panel says so instead of drawing an empty list.
  const quiet = await session('empty')
  await quiet.page.goto(`${base}/agent`)
  await quiet.page.getByText('Chưa có sản phẩm bán ra trong kỳ này.').waitFor()
  await quiet.page.getByText('Không có lô nào hết hạn trong 30 ngày tới.').waitFor()
  await quiet.page.getByText('Chưa có khách mua trong kỳ này.').waitFor()
  pass('Empty periods show a plain message in each new panel')
  await quiet.context.close()
} catch (error) {
  failures.push(error.stack || String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Dashboard panel checks passed (${checks})`)
