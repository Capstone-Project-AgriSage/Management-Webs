import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// Browser contract tests use intercepted responses, never live store writes.
const { chromium } = await import(process.env.REPORT_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.REPORT_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.REPORT_BROWSER_CHANNEL })
const base = process.env.REPORT_TEST_URL || 'http://127.0.0.1:5174'
if (process.env.REPORT_SCREENSHOT_DIR) await mkdir(process.env.REPORT_SCREENSHOT_DIR, { recursive: true })
const pages = [
  ['/agent/orders', 'Tổng hợp đơn hàng', ['orders']],
  ['/agent/payments', 'Tổng hợp thanh toán', ['payments']],
  ['/agent/purchases/receipts', 'Tổng hợp nhập hàng', ['purchases']],
  ['/agent/returns', 'Tổng hợp trả hàng', ['returns']],
  ['/agent/refunds', 'Tổng hợp hoàn tiền', ['refunds']],
  ['/agent/deliveries', 'Tổng hợp giao hàng', ['deliveries']],
  ['/agent/debts', 'Tổng hợp công nợ', ['debt-aging', 'debt-collections', 'debt-by-customer-group']],
  ['/agent/credit-config', 'Mức sử dụng tín dụng', ['credit-exposure']],
  ['/agent/inventory', 'Tổng hợp xuất nhập tồn', ['inventory-movement', 'inventory-valuation']],
  ['/agent/products', 'Giá trị tồn kho', ['inventory-valuation']],
  ['/agent/inventory/movements', 'Tổng hợp xuất nhập tồn', ['inventory-movement']],
  ['/agent', 'Doanh thu và bán hàng', ['sales', 'revenue', 'revenue-summary']],
]
const businessCodes = ['ORDERS.READ', 'PAYMENTS.READ', 'GOODS_RECEIPTS.READ', 'SUPPLIERS.READ', 'RETURNS.READ', 'REFUNDS.READ', 'DELIVERIES.READ', 'DEBT.READ', 'CUSTOMER_GROUPS.READ', 'CREDIT_TIERS.READ', 'INVENTORY.READ', 'STAFF.READ', 'STORE_PRODUCTS.READ', 'PRODUCTS.READ']
const metrics = { orderCount: 3, fulfilledValue: 3000000, costOfGoods: 2000000, grossProfit: 1000000, returnValue: 100000, netSales: 2900000, averageOrderValue: 1000000, grossMarginPercent: 33.33 }
const operational = {
  sales: metrics,
  orders: { orderCount: 3, orderValue: 3000000 },
  payments: { paymentCount: 3, receivedAmount: 3000000, orderPaymentAmount: 2000000, debtRepaymentAmount: 1000000, refundedAmount: 100000, netReceivedAmount: 2900000 },
  purchases: { receiptCount: 2, purchaseAmount: 1500000 },
  returns: { returnCount: 1, returnAmount: 100000, debtAdjustmentAmount: 50000, refundAmount: 50000 },
  refunds: { refundCount: 1, refundedAmount: 50000 },
}
const credit = { creditLimit: 5000000, outstanding: 1000000, reservedCredit: 500000, exposure: 1500000, availableCredit: 3500000 }
const aging = { notDue: 1000000, days1To30: 500000, days31To60: 0, days61To90: 0, over90: 0, total: 1500000 }
let checks = 0
const pass = name => { checks++; console.log('PASS ' + name) }

async function fixture(role = 'STORE_OWNER', withReports = true, path = '/agent/orders', viewport = { width: 1440, height: 950 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'inline-report-browser-test'))
  const state = { codes: [...businessCodes, ...(withReports ? ['REPORTS.READ'] : [])], requests: [], mode: 'normal', delayFrom: '' }
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    state.requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), method: request.method() })
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    const list = { items: [], page: 1, pageSize: 10, totalCount: 121, totalPages: 13 }
    if (url.pathname === '/api/auth/me') return json({ id: 'test-user', fullName: 'Người kiểm thử', name: 'Người kiểm thử', initials: 'KT', role, status: 'ACTIVE' })
    if (url.pathname === '/api/me/permissions') return json({ role, storeId: 'test-store', roleVersion: 1, memberVersion: 1, permissions: state.codes })
    if (url.pathname.endsWith('/unread-count')) return json({ count: 0 })
    if (url.pathname === '/api/store-products') return json({ ...list, totalPages: 1 })
    if (url.pathname === '/api/products' && url.searchParams.get('Search')) return json({ ...list, totalCount: 4, totalPages: 1 })
    if (url.pathname === '/api/inventory/stock-movements' && url.searchParams.get('type')) return json({ ...list, totalCount: 9, totalPages: 1 })
    if (url.pathname === '/api/orders' && url.searchParams.get('status') === 'CANCELLED') return json({ ...list, totalCount: 0, totalPages: 0 })
    if (!url.pathname.startsWith('/api/reports/')) return json(list)
    const report = url.pathname.split('/').at(-1)
    if (state.mode === 'error') return json({ title: 'Unavailable', detail: 'Không tải được số liệu kiểm thử' }, 503)
    const period = { fromDate: url.searchParams.get('fromDate'), toDate: url.searchParams.get('toDate'), groupBy: url.searchParams.get('groupBy') || 'DAY' }
    if (report === 'orders' && period.fromDate === state.delayFrom) await new Promise(resolve => setTimeout(resolve, 650))
    if (operational[report]) {
      const totals = state.mode === 'empty' ? Object.fromEntries(Object.keys(operational[report]).map(key => [key, 0])) : { ...operational[report] }
      if (report === 'orders' && period.fromDate === '2026-10-02') totals.orderValue = 7000000
      return json({ ...period, rows: [], totals })
    }
    if (report === 'revenue') return json({ ...period, rows: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, totals: metrics })
    if (report === 'revenue-summary') return json({ ...period, current: metrics, previousFromDate: '2026-09-01', previousToDate: '2026-09-10', previous: metrics, netSalesChangePercent: null })
    if (report === 'credit-exposure') return json({ asOf: '2026-10-10T03:00:00Z', rows: [], totals: credit })
    if (report === 'inventory-movement') return json({ ...period, rows: [], totals: { openingValue: 1000000, stockIn: 500000, returnIn: 0, adjustmentIn: 0, sale: -200000, adjustmentOut: 0, reversal: 0, closingValue: 1300000 } })
    if (report === 'inventory-valuation') return json({ rows: [], byCategory: [], totals: { stockValue: 1300000, expiredValue: 0 } })
    if (report === 'deliveries') return json({ ...period, rows: [], failureReasons: [], incidents: [], totals: { deliveries: 4, attempts: 5, successful: 3, partial: 1, failed: 1, successRate: 0.6 } })
    if (report === 'debt-aging') return json({ asOf: url.searchParams.get('asOf'), rows: [], totals: aging })
    if (report === 'debt-collections') return json({ ...period, rows: [], totals: { key: '', label: '', paymentCount: 2, collectedAmount: 250000 } })
    if (report === 'debt-by-customer-group') return json({ rows: [{ customerGroup: null, customersWithDebt: 1, outstanding: 1500000, overdueAmount: 500000, totalCreditLimit: 5000000, utilization: 0.3 }] })
    throw new Error('Unexpected report: ' + report)
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base + path)
  return { context, page, state, errors }
}
async function ready(page, title) {
  const section = page.getByRole('region', { name: title, exact: true })
  await section.waitFor()
  await section.getByRole('button', { name: `Làm mới ${title.toLowerCase()}`, exact: true }).waitFor()
  await page.waitForFunction(title => {
    const section = document.querySelector(`section[aria-label="${title}"]`)
    return section && section.querySelector('button')?.disabled === false
  }, title)
  return section
}
async function noReportMenu(page) {
  assert.equal(await page.locator('aside a[href*="/reports"]').count(), 0)
  assert.equal(await page.locator('aside').getByText('Báo cáo', { exact: true }).count(), 0)
}

try {
  const owner = await fixture()
  const orders = await ready(owner.page, 'Tổng hợp đơn hàng')
  await orders.getByText(/121\s*đơn hàng/).waitFor()
  assert.equal(await orders.getByRole('heading', { name: 'Kết quả tìm kiếm', exact: true }).count(), 1)
  assert.equal(await orders.getByText('3.000.000 đ', { exact: true }).count(), 1)
  assert.equal(await orders.getByText(/Độc lập với tìm kiếm và phân trang danh sách/).count(), 1)
  await noReportMenu(owner.page)
  if (process.env.REPORT_SCREENSHOT_DIR) await owner.page.screenshot({ path: join(process.env.REPORT_SCREENSHOT_DIR, 'inline-orders-desktop.png'), fullPage: true })
  pass('Order report cards sit beside the preserved search-result card, with explicit period and scope')

  for (const [path, title, endpoints] of pages) {
    await owner.page.goto(base + path)
    await ready(owner.page, title)
    for (const endpoint of endpoints) assert(owner.state.requests.some(request => request.path === '/api/reports/' + endpoint), endpoint)
    await noReportMenu(owner.page)
  }
  assert.equal(new Set(owner.state.requests.filter(request => request.path.startsWith('/api/reports/')).map(request => request.path)).size, 15)
  assert(owner.state.requests.every(request => request.method === 'GET'))
  assert.deepEqual(owner.errors, [])
  pass('All 15 reporting APIs are integrated into their business pages, with no report sidebar items')

  await owner.page.goto(base + '/agent/products')
  const products = await ready(owner.page, 'Giá trị tồn kho')
  await products.getByText(/121\s*sản phẩm/).waitFor()
  assert.equal(await products.getByText('1.300.000 đ', { exact: true }).count(), 1)
  const productReports = owner.state.requests.filter(request => request.path === '/api/reports/inventory-valuation').length
  await owner.page.getByPlaceholder('Tìm theo tên hoặc mã SKU...').fill('lúa')
  await products.getByText(/4\s*sản phẩm/).waitFor()
  assert.equal(owner.state.requests.filter(request => request.path === '/api/reports/inventory-valuation').length, productReports)
  if (process.env.REPORT_SCREENSHOT_DIR) await owner.page.screenshot({ path: join(process.env.REPORT_SCREENSHOT_DIR, 'inline-products-desktop.png'), fullPage: true })
  pass('Products displays the filtered result count beside current inventory values; searching does not refetch totals')

  await owner.page.goto(base + '/agent/inventory/movements')
  const movements = await ready(owner.page, 'Tổng hợp xuất nhập tồn')
  await movements.getByText(/121\s*phiếu kho/).waitFor()
  const movementReports = owner.state.requests.filter(request => request.path === '/api/reports/inventory-movement').length
  await owner.page.locator('main select').selectOption('SALE')
  await movements.getByText(/9\s*phiếu kho/).waitFor()
  assert.equal(owner.state.requests.filter(request => request.path === '/api/reports/inventory-movement').length, movementReports)
  await owner.page.getByLabel('Tổng hợp xuất nhập tồn: từ ngày').fill('2026-10-02')
  await ready(owner.page, 'Tổng hợp xuất nhập tồn')
  await owner.page.waitForFunction(() => document.getElementById('mv-from')?.value === '2026-10-02')
  assert.equal(owner.state.requests.filter(request => request.path === '/api/reports/inventory-movement').at(-1).query.fromDate, '2026-10-02')
  const movementList = owner.state.requests.filter(request => request.path === '/api/inventory/stock-movements').at(-1)
  assert.equal(movementList.query.fromDate, '2026-10-02')
  assert.equal(movementList.query.page, '1')
  if (process.env.REPORT_SCREENSHOT_DIR) await owner.page.screenshot({ path: join(process.env.REPORT_SCREENSHOT_DIR, 'inline-movements-desktop.png'), fullPage: true })
  pass('Stock movements preserves the type-filtered count and shares period changes with the list')

  for (const [path, unit] of [['/agent/products', 'sản phẩm'], ['/agent/inventory/movements', 'phiếu kho']]) {
    const limited = await fixture('STORE_OWNER', false, path)
    await limited.page.getByText(new RegExp(`121\\s*${unit}`)).first().waitFor()
    assert.equal(limited.state.requests.filter(request => request.path.startsWith('/api/reports/')).length, 0)
    assert.deepEqual(limited.errors, [])
    await limited.context.close()
  }
  pass('Products and stock movements show search results without requesting reports when REPORTS.READ is absent')

  await owner.page.goto(base + '/agent/orders')
  await ready(owner.page, 'Tổng hợp đơn hàng')
  await owner.page.getByLabel('Tổng hợp đơn hàng: từ ngày').fill('2026-10-02')
  await ready(owner.page, 'Tổng hợp đơn hàng')
  await owner.page.getByRole('region', { name: 'Tổng hợp đơn hàng' }).getByText('7.000.000 đ', { exact: true }).waitFor()
  const last = name => owner.state.requests.filter(request => request.path === '/api/' + name).at(-1)
  assert.equal(last('reports/orders').query.fromDate, '2026-10-02')
  await owner.page.waitForFunction(() => document.querySelector('input[placeholder="Tìm theo mã đơn, SĐT..."]') != null)
  for (let i = 0; i < 40 && last('orders').query.fromDate !== '2026-10-02'; i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(last('orders').query.fromDate, '2026-10-02')
  assert.equal(last('orders').query.page, '1')
  pass('Order dates update the API summary and business-list date filter together')

  owner.state.delayFrom = '2026-10-03'
  await owner.page.getByLabel('Tổng hợp đơn hàng: từ ngày').fill('2026-10-03')
  await owner.page.getByLabel('Tổng hợp đơn hàng: từ ngày').fill('2026-10-02')
  await ready(owner.page, 'Tổng hợp đơn hàng')
  await new Promise(resolve => setTimeout(resolve, 800))
  assert.equal(await owner.page.getByRole('region', { name: 'Tổng hợp đơn hàng' }).getByText('7.000.000 đ', { exact: true }).count(), 1)
  pass('Changing dates cancels stale requests so late totals cannot overwrite current cards')

  const before = owner.state.requests.filter(request => request.path === '/api/reports/orders').length
  await owner.page.getByLabel('Tổng hợp đơn hàng: từ ngày').fill('2020-01-01')
  await owner.page.getByRole('alert').filter({ hasText: 'Khoảng thời gian tối đa 366 ngày.' }).waitFor()
  assert.equal(owner.state.requests.filter(request => request.path === '/api/reports/orders').length, before)
  assert.equal(await owner.page.getByText('7.000.000 đ', { exact: true }).count(), 0)
  await owner.page.getByRole('heading', { name: 'Kết quả tìm kiếm', exact: true }).waitFor()
  pass('Invalid report periods block report requests and hide stale totals while keeping the list/search card')

  await owner.page.goto(base + '/agent/payments')
  const payments = await ready(owner.page, 'Tổng hợp thanh toán')
  assert.equal(await payments.getByText('2.900.000 đ', { exact: true }).count(), 1)
  owner.state.mode = 'error'
  await payments.getByRole('button').click()
  await payments.getByRole('alert').filter({ hasText: 'Không tải được số liệu kiểm thử' }).waitFor()
  assert.equal(await payments.getByText('2.900.000 đ', { exact: true }).count(), 0)
  await owner.page.getByRole('table').waitFor()
  owner.state.mode = 'empty'
  await payments.getByRole('button').click()
  await ready(owner.page, 'Tổng hợp thanh toán')
  assert.equal(await payments.getByText('0 đ', { exact: true }).count(), 3)
  owner.state.mode = 'normal'
  pass('Report errors do not break business lists, and empty periods display real zero totals')
  assert.deepEqual(owner.errors, [])
  await owner.context.close()

  const denied = await fixture('SALES_STAFF', false, '/sales/orders')
  await denied.page.getByRole('heading', { name: 'Kết quả tìm kiếm', exact: true }).waitFor()
  assert.equal(await denied.page.getByRole('region', { name: 'Tổng hợp đơn hàng' }).count(), 0)
  assert.equal(denied.state.requests.filter(request => request.path.startsWith('/api/reports/')).length, 0)
  await noReportMenu(denied.page)
  await denied.context.close()
  pass('Staff without REPORTS.READ retain business pages/search results and never request report data')

  const delegated = await fixture('SALES_STAFF', true, '/sales/orders')
  await ready(delegated.page, 'Tổng hợp đơn hàng')
  await noReportMenu(delegated.page)
  await delegated.context.close()
  pass('Delegated sales staff see report cards inside the existing sales menu')

  const admin = await fixture('ADMIN', true, '/admin/credit-config')
  const creditSection = await ready(admin.page, 'Mức sử dụng tín dụng')
  assert.equal(await creditSection.getByText('3.500.000 đ', { exact: true }).count(), 1)
  await noReportMenu(admin.page)
  assert.deepEqual(admin.errors, [])
  await admin.context.close()
  pass('Admin credit metrics are embedded in the existing credit-configuration page')

  const mobile = await fixture('STORE_OWNER', true, '/agent/orders', { width: 390, height: 844 })
  await ready(mobile.page, 'Tổng hợp đơn hàng')
  assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  await noReportMenu(mobile.page)
  if (process.env.REPORT_SCREENSHOT_DIR) await mobile.page.screenshot({ path: join(process.env.REPORT_SCREENSHOT_DIR, 'inline-orders-mobile.png'), fullPage: true })
  assert.deepEqual(mobile.errors, [])
  await mobile.context.close()
  pass('Embedded cards remain readable on mobile without horizontal page overflow')
  console.log(`${checks} embedded-report browser checks passed`)
} finally { await browser.close() }
