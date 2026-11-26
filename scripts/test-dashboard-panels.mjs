import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// The owner's dashboard (2026-11-27): one line of what is waiting, then tabs. "Tổng quan" holds four figures, one trend chart
// (revenue or delivered orders) beside the best sellers, and the recent orders; the other panels sit in a tab by topic
// (Bán hàng, Công nợ, Kho hàng, Tư vấn & AI) and load the first time their tab opens. Every API request is intercepted; no
// live store is read or written.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const failures = []
const screenshotDir = process.env.DASHBOARD_SCREENSHOT_DIR
if (screenshotDir) await mkdir(screenshotDir, { recursive: true })
let checks = 0
const pass = message => { checks++; console.log('PASS ' + message) }

const metrics = (netSales, orderCount = 1) => ({ orderCount, fulfilledValue: netSales, costOfGoods: netSales * .6, grossProfit: netSales * .4, returnValue: 0, netSales, averageOrderValue: orderCount ? netSales / orderCount : 0, grossMarginPercent: netSales ? 40 : null })
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
    if (path === '/api/me/permissions') return json({ permissions: ['REPORTS.READ', 'ORDERS.READ', 'PAYMENTS.READ', 'DEBT.READ', 'DEBT.READ_DASHBOARD', 'INVENTORY.READ', 'CUSTOMERS.READ', 'DELIVERIES.READ', 'RETURNS.READ'].filter(code => mode !== 'denied' || code !== 'REPORTS.READ') })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/inventory/alerts' && mode === 'failed') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Không tải được cảnh báo kho.' }) })
    if (path === '/api/reports/revenue') {
      const by = query.groupBy
      const list = empty ? [] : by === 'PRODUCT' ? products : by === 'CUSTOMER' ? customers : by === 'DAY' ? [1200000, 1500000, 900000, 2400000, 1800000, 2100000, 2100000].map((value, index) => [addDays(vnToday, index - 6), addDays(vnToday, index - 6), value, 3]) : []
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
    // The manager's money and advice rows (2026-11-23).
    if (path === '/api/reports/inventory-valuation') return json({ rows: [], byCategory: empty ? [] : [{ categoryId: 'cat-fungi', name: 'Thuốc trừ bệnh', stockValue: 30000000 }, { categoryId: 'cat-fert', name: 'Phân bón', stockValue: 15000000 }], totals: { stockValue: empty ? 0 : 45000000, expiredValue: empty ? 0 : 1200000 } })
    if (path === '/api/reports/purchases') return json({ fromDate: query.fromDate, toDate: query.toDate, groupBy: query.groupBy, rows: empty ? [] : [{ key: 'sup-1', label: 'Công ty Lộc Trời', receiptCount: 3, purchaseAmount: 6000000 }, { key: 'sup-2', label: 'Đại lý Phú Mỹ', receiptCount: 1, purchaseAmount: 2000000 }], totals: { receiptCount: empty ? 0 : 4, purchaseAmount: empty ? 0 : 8000000 } })
    if (path === '/api/reports/credit-exposure') return json({ asOf: new Date().toISOString(), rows: [], totals: empty ? { creditLimit: 0, outstanding: 0, reservedCredit: 0, exposure: 0, availableCredit: 0 } : { creditLimit: 40000000, outstanding: 10000000, reservedCredit: 2000000, exposure: 12000000, availableCredit: 28000000 } })
    if (path === '/api/debt-entries/dashboard') return json({ totalOutstandingDebt: 10000000, totalOverdueDebt: 3000000, collectedToday: 500000, collectedThisMonth: 3500000, customersWithDebt: 4, customersWithOverdueDebt: 2, topDebtors: [], recentDebtPayments: [], overdueDebts: [], dueSoonAmount: empty ? 0 : 1500000,
      followUp: empty ? { windowDays: 7, overdueCustomerCount: 0, notContactedCount: 0, brokenPromiseCount: 0 } : { windowDays: 7, overdueCustomerCount: 5, notContactedCount: 2, brokenPromiseCount: 1 },
      creditLimitAlertCount: empty ? 0 : 2, creditLimitAlerts: empty ? [] : [
        { farmerProfileId: 'farmer-b', fullName: 'Trần Thị Bình', phoneNumber: null, creditLimit: 5000000, usedCredit: 5000000, availableCredit: 0, state: 'AT_LIMIT' },
        { farmerProfileId: 'farmer-c', fullName: 'Lê Văn Cường', phoneNumber: null, creditLimit: 4000000, usedCredit: 3600000, availableCredit: 400000, state: 'NEAR_LIMIT' },
      ] })
    if (path === '/api/reports/debt-collections') return json({ fromDate: query.fromDate, toDate: query.toDate, groupBy: query.groupBy, rows: empty ? [] : [{ key: 'CASH', label: 'CASH', paymentCount: 3, collectedAmount: 2000000 }, { key: 'PAY_OS', label: 'PAY_OS', paymentCount: 1, collectedAmount: 1000000 }], totals: { key: null, label: null, paymentCount: empty ? 0 : 4, collectedAmount: empty ? 0 : 3000000 } })
    if (path === '/api/reports/advisory-diagnosis') return json({ fromDate: query.fromDate, toDate: query.toDate, attributionDays: 7,
      advisory: empty ? { sessionCount: 0, farmerCount: 0, textSessionCount: 0, diagnosisSessionCount: 0, sessionsWithProducts: 0, estimatedValue: 0, convertedSessions: 0, conversionPercent: null, convertedOrderValue: 0 }
        : { sessionCount: 20, farmerCount: 12, textSessionCount: 14, diagnosisSessionCount: 6, sessionsWithProducts: 16, estimatedValue: 9600000, convertedSessions: 4, conversionPercent: 25, convertedOrderValue: 2300000 },
      topProblems: empty ? [] : [{ diseaseId: 'd-blast', code: 'LEAF_BLAST', name: 'Đạo ôn lá', cropType: 'RICE', sessionCount: 9 }, { diseaseId: 'd-root', code: 'DURIAN_ROOT_ROT', name: 'Thối rễ Phytophthora', cropType: 'DURIAN', sessionCount: 4 }],
      diagnosis: { caseCount: empty ? 0 : 11, byCrop: empty ? [] : [
        { cropType: 'RICE', cropName: 'Lúa', caseCount: 8, confidentCount: 5, uncertainCount: 2, verifiedCount: 0, noResultCount: 1 },
        { cropType: 'DURIAN', cropName: 'Sầu riêng', caseCount: 3, confidentCount: 1, uncertainCount: 1, verifiedCount: 0, noResultCount: 1 },
      ] } })
    // The other dashboard reports and tiles: real shapes with nothing in them.
    if (path === '/api/reports/revenue-summary') return json({ current: metrics(empty ? 0 : 12000000, empty ? 0 : 24), previous: metrics(empty ? 0 : 10000000, empty ? 0 : 20), netSalesChangePercent: empty ? null : 20 })
    if (path === '/api/reports/sales') {
      if (mode === 'failed') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Báo cáo lãi gộp tạm thời không có.' }) })
      return json({ rows: [], totals: metrics(empty ? 0 : 12000000), page: 1, pageSize: 20, totalCount: 0, totalPages: 0 })
    }
    if (path === '/api/reports/orders') return json({ rows: [], totals: { orderCount: 0, orderValue: 0 } })
    if (path === '/api/reports/payments') return json({ rows: [], totals: { paymentCount: 0, receivedAmount: 0, orderPaymentAmount: 0, debtRepaymentAmount: 0, refundedAmount: 0, netReceivedAmount: 0 } })
    if (path === '/api/reports/debt-aging') return json({ asOf: vnToday, rows: [], totals: { notDue: empty ? 0 : 7000000, days1To30: empty ? 0 : 2000000, days31To60: empty ? 0 : 1000000, days61To90: 0, over90: 0, total: empty ? 0 : 10000000 } })
    if (path === '/api/reports/debt-by-customer-group') return json({ rows: [] })
    if (path === '/api/inventory/replenishment/products' || path === '/api/inventory/replenishment/urgent') return json({ ...paged([]), summary: { totalProducts: 0, outOfStock: 0, highPriority: 0, needsConfiguration: 0, insufficientHistory: 0, seasonalProducts: 0 }, generatedAt: new Date().toISOString(), fromDate: vnToday, toDate: vnToday, horizonDays: 30 })
    return json(paged([]))
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(`Page error: ${error.message}`))
  return { context, page, state }
}

const TAB_NAMES = ['Tổng quan', 'Bán hàng', 'Công nợ', 'Kho hàng', 'Tư vấn & AI']
// The router applies the new ?tab= in a transition, so the tab is selected a moment after the click.
const tabSelected = (page, name) => page.waitForFunction(label => [...document.querySelectorAll('[role="tab"]')].some(tab => tab.textContent === label && tab.getAttribute('aria-selected') === 'true'), name, { timeout: 5000 })
async function openTab(page, name) {
  await page.getByRole('tab', { name, exact: true }).click()
  await tabSelected(page, name)
  return page.getByRole('tabpanel', { name, exact: true })
}

try {
  const { context, page, state } = await session()
  await page.goto(`${base}/agent`)
  const best = page.getByRole('region', { name: 'Sản phẩm bán chạy', exact: true })
  await best.getByText('Tilt Super 300EC').first().waitFor()
  const stats = page.getByRole('region', { name: 'Chỉ số chính', exact: true })
  await stats.getByText('Quá hạn 3.000.000 đ').waitFor()
  // Nothing scrolled yet: the figures, the trend and the best sellers start on a laptop's first screen.
  assert.ok((await best.boundingBox()).y < 900, `The best sellers start on the first screen (top ${Math.round((await best.boundingBox()).y)}px)`)
  assert.equal(await stats.getByRole('heading').count(), 4, 'Four figures, read left to right')
  assert.match(await stats.innerText(), /Doanh thu thuần[\s\S]*12\.000\.000 đ[\s\S]*\+20%[\s\S]*Lãi gộp[\s\S]*4\.800\.000 đ[\s\S]*Tiền thực thu[\s\S]*Nợ phải thu[\s\S]*Hiện tại[\s\S]*10\.000\.000 đ[\s\S]*Quá hạn 3\.000\.000 đ/)
  // What is waiting: only the overdue debt here; queues with nothing in them are left out.
  const todo = page.getByRole('region', { name: 'Việc cần xử lý', exact: true })
  await todo.getByRole('link', { name: /^Nợ quá hạn: 3\.000\.000 đ/ }).waitFor()
  assert.equal(await todo.getByRole('link').count(), 1, 'Queues with nothing waiting are not drawn')
  assert.deepEqual(await page.getByRole('tab').allInnerTexts(), TAB_NAMES)
  assert.equal(await page.getByRole('tab', { name: 'Tổng quan', exact: true }).getAttribute('aria-selected'), 'true')
  assert.equal(await page.locator('details').count(), 0, 'Nothing is folded away: the topics are tabs')
  assert.equal(await page.getByRole('region', { name: 'Kênh bán hàng', exact: true }).count(), 0, 'Sales channels wait in their tab')
  const recent = page.getByRole('region', { name: 'Đơn hàng gần đây', exact: true })
  await recent.waitFor()
  await page.waitForLoadState('networkidle')
  // The recent orders end the page: nothing hidden (such as the chart's screen-reader table) stretches it further.
  const { pageBottom, lastBottom, tallHidden } = await recent.evaluate(section => ({
    pageBottom: document.documentElement.scrollHeight, lastBottom: Math.max(innerHeight, section.getBoundingClientRect().bottom + scrollY + 80),
    // Only text hidden right now ("sm:not-sr-only" shows it again on wider screens).
    tallHidden: [...document.querySelectorAll('main .sr-only')].filter(hidden => getComputedStyle(hidden).position === 'absolute' && hidden.getBoundingClientRect().height > 1).length,
  }))
  assert.equal(tallHidden, 0, 'Screen-reader text takes no room (a table ignores sr-only\'s 1px height)')
  assert.ok(pageBottom <= lastBottom, `No blank space below the recent orders (page ${pageBottom}px, allowed ${Math.round(lastBottom)}px)`)
  const later = ['/api/reports/orders', '/api/reports/credit-exposure', '/api/reports/inventory-valuation', '/api/debt-entries/dashboard', '/api/reports/purchases', '/api/reports/debt-collections', '/api/reports/advisory-diagnosis', '/api/inventory/expiry-risk', '/api/reports/debt-by-customer-group']
  assert.deepEqual(later.filter(path => state.requests.some(request => request.path === path)), [], 'Arriving asks for the overview only')
  assert.deepEqual([...new Set(state.requests.filter(request => request.path === '/api/reports/revenue').map(request => request.query.groupBy))].sort(), ['DAY', 'PRODUCT'])
  pass('The owner first sees what is waiting, four figures, the trend, best sellers and recent orders; other topics wait in tabs')

  // One chart for the days of the period: revenue, or delivered orders on their own scale (never two axes).
  const revenueTrend = page.getByRole('region', { name: 'Doanh thu thuần theo ngày', exact: true })
  await revenueTrend.getByRole('button', { name: 'Số đơn', exact: true }).click()
  const ordersTrend = page.getByRole('region', { name: 'Đơn giao theo ngày', exact: true })
  await ordersTrend.waitFor()
  assert.equal(await ordersTrend.getByRole('button', { name: 'Số đơn', exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await ordersTrend.getByRole('link', { name: 'Xem chi tiết: Đơn giao theo ngày' }).getAttribute('href'), '/agent/orders')
  assert.match(await ordersTrend.innerText(), /Cao nhất[\s\S]*3 đơn/)
  assert.equal(await page.locator('main .recharts-surface').count(), 1, 'Still a single chart')
  await ordersTrend.getByRole('button', { name: 'Doanh thu', exact: true }).click()
  await revenueTrend.waitFor()
  pass('The trend switches between revenue and delivered orders in one chart')

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

  // Stock tab: what is in stock today first, then the period's purchases, each under its own heading.
  const stockTab = await openTab(page, 'Kho hàng')
  assert.match(page.url(), /\?tab=stock$/, 'The open tab is kept in the address')
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

  // Stock and purchases: the money in stock now (with what has expired) and the period's purchases by supplier.
  const stock = page.getByRole('region', { name: 'Giá trị tồn kho', exact: true })
  await stock.getByText('Thuốc trừ bệnh').waitFor()
  assert.match(await stock.innerText(), /45\.000\.000 đ[\s\S]*Không theo kỳ báo cáo[\s\S]*Trong đó đã hết hạn 1\.200\.000 đ/)
  assert.match(await stock.innerText(), /Thuốc trừ bệnh[\s\S]*30 tr[\s\S]*67%/)
  assert.equal(await stock.getByRole('link').getAttribute('href'), '/agent/inventory/reports')
  const bought = page.getByRole('region', { name: 'Nhập hàng trong kỳ', exact: true })
  await bought.getByText('Công ty Lộc Trời').waitFor()
  assert.match(await bought.innerText(), /8\.000\.000 đ[\s\S]*4 phiếu nhập đã xác nhận/)
  assert.match(await bought.innerText(), /Công ty Lộc Trời[\s\S]*6 tr[\s\S]*75%[\s\S]*3 phiếu/)
  assert.match(await bought.innerText(), /Tiền nhập bằng 67% doanh thu thuần cùng kỳ/)
  assert.equal(await bought.getByRole('link').getAttribute('href'), '/agent/purchases/receipts')
  assert.equal(state.requests.filter(request => request.path === '/api/reports/purchases').at(-1).query.groupBy, 'SUPPLIER')
  assert.match(await stockTab.innerText(), /Hiện tại[\s\S]*Giá trị tồn kho[\s\S]*Lô sắp hết hạn[\s\S]*Trong kỳ[\s\S]*Nhập hàng trong kỳ/)
  pass('Stock value names expired stock and the largest groups; purchases show suppliers and the share of net sales')

  // Debt tab: receivables by age, credit, reminders and groups as of today, then the period's collections.
  const debtTab = await openTab(page, 'Công nợ')
  const debt = page.getByRole('region', { name: 'Công nợ phải thu', exact: true })
  await debt.getByText('Tổng phải thu').waitFor()
  assert.match(await debt.innerText(), /3\.000\.000 đ[\s\S]*đã quá hạn[\s\S]*Tổng phải thu[\s\S]*10\.000\.000 đ/)
  assert.match(await debt.innerText(), /Không theo kỳ báo cáo/)
  // Credit and collections: how much of the credit limits is used, who is at the limit, what came back in the period.
  const credit = page.getByRole('region', { name: 'Hạn mức tín dụng', exact: true })
  await credit.getByText('Trần Thị Bình').waitFor()
  assert.match(await credit.innerText(), /30%[\s\S]*tổng hạn mức đang dùng/)
  assert.match(await credit.innerText(), /Dư nợ[\s\S]*10\.000\.000 đ[\s\S]*Giữ chỗ cho đơn chưa giao[\s\S]*2\.000\.000 đ[\s\S]*Còn được mua chịu[\s\S]*28\.000\.000 đ/)
  assert.match(await credit.innerText(), /2 khách gần hoặc chạm hạn mức[\s\S]*Trần Thị Bình[\s\S]*Chạm hạn mức[\s\S]*Lê Văn Cường[\s\S]*Gần hạn mức · còn 400K/)
  assert.match(await credit.innerText(), /Sắp đến hạn thu 1\.500\.000 đ/)
  assert.match(await credit.getByRole('img').getAttribute('aria-label'), /Đã dùng 12\.000\.000 đ trên tổng hạn mức 40\.000\.000 đ/)
  const collected = page.getByRole('region', { name: 'Thu nợ trong kỳ', exact: true })
  await collected.getByText('Tiền mặt').waitFor()
  assert.match(await collected.innerText(), /3\.000\.000 đ[\s\S]*4 lần thu/)
  assert.match(await collected.innerText(), /Tiền mặt[\s\S]*3[\s\S]*lần[\s\S]*2\.000\.000 đ[\s\S]*payOS[\s\S]*1[\s\S]*lần[\s\S]*1\.000\.000 đ/)
  assert.match(await collected.innerText(), /Hôm nay thu 500\.000 đ[\s\S]*Tháng này 3\.500\.000 đ/)
  assert.equal(state.requests.filter(request => request.path === '/api/reports/debt-collections').at(-1).query.groupBy, 'METHOD')
  pass('Credit shows the limit used, near-limit customers and dues; collections split by method')

  // Reminders made outside the system (F3.23): overdue customers nobody reminded this week, and passed promises.
  const reminders = page.getByRole('region', { name: 'Theo dõi nhắc nợ', exact: true })
  await reminders.getByText('Khách đang quá hạn').waitFor()
  assert.match(await reminders.innerText(), /2 khách[\s\S]*quá hạn mà chưa được nhắc trong 7 ngày[\s\S]*Không theo kỳ báo cáo/)
  assert.match(await reminders.innerText(), /Khách đang quá hạn[\s\S]*5[\s\S]*Lỡ hẹn, chưa nhắc lại[\s\S]*1/)
  assert.match(await reminders.innerText(), /Không tính khoản đang tranh chấp/)
  assert.match(await reminders.innerText(), /Đã nhắc trong 7 ngày: 3\/5 khách/)
  assert.equal(await reminders.getByRole('link').getAttribute('href'), '/agent/debts')
  assert.match(await debtTab.innerText(), /Hiện tại[\s\S]*Công nợ phải thu[\s\S]*Theo dõi nhắc nợ[\s\S]*Trong kỳ[\s\S]*Thu nợ trong kỳ/)
  pass('The reminder panel shows overdue customers not reminded in 7 days and broken promises, from the debt dashboard')

  // Advice and photo diagnosis: the funnel to an order within 7 days, the problems asked about most, results per crop.
  await openTab(page, 'Tư vấn & AI')
  const advice = page.getByRole('region', { name: 'Tư vấn ra đơn', exact: true })
  await advice.getByText('Đạo ôn lá').waitFor()
  assert.match(await advice.innerText(), /25%[\s\S]*lượt tư vấn có gợi ý đã ra đơn/)
  assert.match(await advice.innerText(), /Lượt tư vấn[\s\S]*20[\s\S]*12 nông dân[\s\S]*Có gợi ý sản phẩm[\s\S]*16[\s\S]*ước tính 9,6 tr[\s\S]*Ra đơn trong 7 ngày[\s\S]*4[\s\S]*đơn 2,3 tr/)
  assert.match(await advice.innerText(), /Gõ tìm 14 lượt · Từ ảnh chẩn đoán 6 lượt/)
  assert.match(await advice.innerText(), /Đạo ôn lá[\s\S]*Lúa[\s\S]*9 lượt[\s\S]*Thối rễ Phytophthora[\s\S]*Sầu riêng[\s\S]*4 lượt/)
  assert.match(await advice.innerText(), /Đây là cách ước tính/)
  assert.equal(await advice.getByRole('link').getAttribute('href'), '/agent/advisory-sessions')
  const diagnosis = page.getByRole('region', { name: 'Chẩn đoán ảnh theo cây', exact: true })
  assert.match(await diagnosis.innerText(), /11 ca[\s\S]*Lúa[\s\S]*8 ca · 5 chắc chắn[\s\S]*Sầu riêng[\s\S]*3 ca · 1 chắc chắn/)
  assert.equal(await diagnosis.getByRole('img', { name: 'Lúa: Chắc chắn 5, Chưa chắc 2, Chưa có kết quả 1' }).count(), 1)
  assert.equal(await diagnosis.getByRole('link').getAttribute('href'), '/agent/ai-recommendations')
  assert.equal(state.requests.filter(request => request.path === '/api/reports/advisory-diagnosis').length, 1, 'One request feeds both advice panels')
  pass('Advice shows the 7-day conversion as an estimate with top problems; diagnosis shows certainty per crop')

  // Sales tab: the period's order figures, then where orders come from, how they are paid, how many finish, what and who.
  const salesTab = await openTab(page, 'Bán hàng')
  const orderFigures = page.getByRole('region', { name: 'Đơn hàng trong kỳ', exact: true })
  await orderFigures.getByText('24 đơn').waitFor()
  assert.match(await orderFigures.innerText(), /Đơn giao thành công[\s\S]*24 đơn[\s\S]*\+20%[\s\S]*Giá trị đơn trung bình[\s\S]*500\.000 đ[\s\S]*Hàng trả lại/)
  for (const name of ['Kênh bán hàng', 'Phương thức thanh toán', 'Tỷ lệ hoàn thành đơn', 'Nhóm sản phẩm bán chạy']) await salesTab.getByRole('region', { name, exact: true }).waitFor()
  // Top customers: registered farmers and walk-in sales, with their share of the period's revenue.
  const buyers = page.getByRole('region', { name: 'Khách hàng mua nhiều', exact: true })
  await buyers.getByText('Nguyễn Văn An').first().waitFor()
  assert.match(await buyers.innerText(), /67%[\s\S]*doanh thu từ[\s\S]*Nguyễn Văn An/)
  assert.match(await buyers.innerText(), /Khách lẻ \(không đăng ký\)[\s\S]*7 đơn/)
  assert.equal(await buyers.getByRole('link').getAttribute('href'), '/agent/farmers')
  pass('The sales tab shows the order figures, channels, payments, completion, product groups and top customers')

  // A tab opened once stays loaded: going back shows it at once, without asking again. Arrow keys move between tabs.
  const asks = path => state.requests.filter(request => request.path === path).length
  const kept = ['/api/reports/credit-exposure', '/api/debt-entries/dashboard', '/api/reports/advisory-diagnosis', '/api/reports/orders', '/api/inventory/expiry-risk']
  const askedBefore = kept.map(asks)
  for (const name of ['Tổng quan', 'Công nợ', 'Tư vấn & AI', 'Kho hàng', 'Bán hàng']) await openTab(page, name)
  assert.deepEqual(kept.map(asks), askedBefore, 'Reopening a tab asks for nothing new')
  await page.getByRole('tab', { name: 'Bán hàng', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await tabSelected(page, 'Công nợ')
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Công nợ')
  await page.keyboard.press('Home')
  await tabSelected(page, 'Tổng quan')
  await page.keyboard.press('ArrowLeft')
  await tabSelected(page, 'Tư vấn & AI')
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Tư vấn & AI')
  assert.equal(await page.getByRole('tab', { selected: true }).count(), 1)
  pass('Opened tabs stay loaded and the arrow, Home and End keys move between tabs')

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const [index, name] of TAB_NAMES.entries()) {
      await openTab(page, name)
      // Recharts applies ResizeObserver measurements asynchronously after a viewport change.
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1, null, { timeout: 5000 })
      if (screenshotDir && (index === 0 || width === 1440 || width === 390)) await page.screenshot({ path: join(screenshotDir, `manager-${index === 0 ? '' : `tab${index}-`}${width}.png`), fullPage: true })
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('main *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1 && !element.closest('[class*="overflow-x"]')).slice(0, 8).map(element => ({ tag: element.tagName, cls: String(element.className), text: element.textContent.slice(0, 50), width: element.getBoundingClientRect().width })) }))
      assert.ok(overflow.width <= width + 1, `No document overflow at ${width}px on ${name}: ${JSON.stringify(overflow)}`)
    }
    // The card clips what does not fit, so check that every waiting queue (and the refresh) is inside it, not cut off.
    const clipped = await todo.evaluate(card => {
      const box = card.getBoundingClientRect()
      return [...card.querySelectorAll('a, button')].filter(element => { const r = element.getBoundingClientRect(); return r.left < box.left - 1 || r.right > box.right + 1 }).map(element => element.textContent)
    })
    assert.deepEqual(clipped, [], `Nothing in "Việc cần xử lý" is cut off at ${width}px`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await openTab(page, 'Tổng quan')
  const debtCalls = state.requests.filter(request => request.path === '/api/reports/debt-aging').length
  const currentCalls = ['/api/reports/credit-exposure', '/api/reports/inventory-valuation', '/api/debt-entries/dashboard'].map(path => state.requests.filter(request => request.path === path).length)
  await page.getByRole('button', { name: '7 ngày', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('main .animate-pulse'))
  assert.equal(state.requests.filter(request => request.path === '/api/reports/debt-aging').length, debtCalls, 'Changing the period does not refetch current debt')
  assert.ok(state.requests.some(request => request.path === '/api/reports/revenue-summary' && request.query.fromDate === addDays(vnToday, -6)))
  // The charts queue their requests (at most three at once) and keep the last figures while reloading, so wait for each one.
  const asked = path => state.requests.some(request => request.path === path && request.query.fromDate === addDays(vnToday, -6) && request.query.toDate === vnToday)
  for (const path of ['/api/reports/advisory-diagnosis', '/api/reports/purchases', '/api/reports/debt-collections']) {
    for (let waited = 0; !asked(path) && waited < 10000; waited += 100) await page.waitForTimeout(100)
    assert.ok(asked(path), `${path} follows the period`)
  }
  assert.deepEqual(['/api/reports/credit-exposure', '/api/reports/inventory-valuation', '/api/debt-entries/dashboard'].map(path => state.requests.filter(request => request.path === path).length), currentCalls, 'Current stock and credit are not refetched for a new period')
  await openTab(page, 'Công nợ')
  assert.match(await debt.innerText(), /3\.000\.000 đ/)
  pass('Responsive layout has no page overflow on any tab; date filters update period reports and preserve current debt')

  // The expiry link opens the planning report on its expiry tab.
  await openTab(page, 'Kho hàng')
  await expiry.getByRole('link').click()
  await page.getByRole('tab', { name: 'Rủi ro hạn dùng' }).waitFor()
  assert.equal(await page.getByRole('tab', { name: 'Rủi ro hạn dùng' }).getAttribute('aria-selected'), 'true')
  pass('?tab=expiry opens the expiry risk tab')

  // An address with ?tab= opens that tab, and only its reports (plus the overview's figures it shares) are asked for.
  state.requests.length = 0
  await page.goto(`${base}/agent?tab=debt`)
  await page.getByRole('region', { name: 'Hạn mức tín dụng', exact: true }).getByText('Trần Thị Bình').waitFor()
  assert.equal(await page.getByRole('tab', { name: 'Công nợ', exact: true }).getAttribute('aria-selected'), 'true')
  await page.waitForLoadState('networkidle')
  assert.equal(state.requests.filter(request => request.path === '/api/reports/advisory-diagnosis' || request.path === '/api/reports/orders').length, 0, 'Tabs not opened are not asked for')
  pass('?tab=debt opens the debt tab and loads only what it shows')
  await context.close()

  // Nothing sold, nothing expiring, nothing waiting: each panel says so in one short line instead of drawing an empty list.
  const quiet = await session('empty')
  await quiet.page.goto(`${base}/agent`)
  const nothingSold = quiet.page.getByText('Chưa có sản phẩm bán ra trong kỳ này.')
  await nothingSold.waitFor()
  assert.ok((await nothingSold.boundingBox()).height < 48, 'An empty panel says so in one short line')
  await quiet.page.getByRole('region', { name: 'Việc cần xử lý', exact: true }).getByText(/Không có đơn, chuyến giao, cảnh báo kho hay nợ quá hạn nào đang chờ/).waitFor()
  for (const [tab, texts] of [
    ['Kho hàng', ['Không có lô nào hết hạn trong 30 ngày tới.', 'Kho chưa có hàng.', 'Chưa nhập hàng trong kỳ này.']],
    ['Công nợ', ['Chưa có khách nào được cấp hạn mức.', 'Chưa thu nợ khoản nào trong kỳ này.']],
    ['Tư vấn & AI', ['Chưa có lượt tư vấn nào trong kỳ này.', 'Chưa có ca chẩn đoán ảnh nào trong kỳ này.']],
    ['Bán hàng', ['Chưa có khách mua trong kỳ này.']],
  ]) {
    await openTab(quiet.page, tab)
    for (const text of texts) await quiet.page.getByText(text, { exact: true }).waitFor()
  }
  pass('Empty periods show a plain message in each panel, and a clear queue says nothing is waiting')
  await quiet.context.close()

  const failed = await session('failed')
  await failed.page.goto(`${base}/agent`)
  await failed.page.getByRole('region', { name: 'Chỉ số chính' }).getByRole('alert').waitFor()
  await failed.page.getByText('Một số mục chưa tải được.', { exact: false }).waitFor()
  assert.match(await failed.page.getByRole('link', { name: /Cảnh báo kho:/ }).innerText(), /—/)
  assert.match(await failed.page.getByRole('region', { name: 'Chỉ số chính' }).innerText(), /12\.000\.000 đ/)
  assert.equal(await failed.page.getByRole('heading', { name: 'Lãi gộp', exact: true }).locator('..').locator('.animate-pulse').count(), 0)
  pass('An unavailable profit report shows an error without hiding revenue or leaving a perpetual loading state')
  await failed.context.close()

  const denied = await session('denied')
  await denied.page.goto(`${base}/agent`)
  await denied.page.getByText('Cần quyền xem báo cáo').first().waitFor()
  assert.equal(denied.state.requests.filter(request => request.path.startsWith('/api/reports/')).length, 0)
  pass('Without report permission, the manager dashboard does not request reports')
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
console.log(`Dashboard panel checks passed (${checks})`)
