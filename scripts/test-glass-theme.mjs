import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// Every API request is intercepted; this suite never reads or writes a live store.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const output = process.env.UI_SCREENSHOT_DIR || 'artifacts/glass-theme'
await mkdir(output, { recursive: true })
const permissions = ['REPORTS.READ', 'ORDERS.READ', 'ORDERS.CREATE', 'PAYMENTS.READ', 'RETURNS.READ', 'REFUNDS.READ', 'DELIVERIES.READ', 'DEBT.READ', 'DEBT.READ_DASHBOARD', 'INVENTORY.READ', 'INVENTORY.READ_MOVEMENTS', 'STOCKTAKES.READ', 'SUPPLIERS.READ', 'GOODS_RECEIPTS.READ', 'PRODUCTS.READ', 'STORE_PRODUCTS.READ', 'CUSTOMERS.READ', 'PRICING.READ', 'CUSTOMER_GROUPS.READ', 'CREDIT_TIERS.READ', 'DIAGNOSIS.READ', 'AUDIT.READ', 'STAFF.READ', 'STAFF.READ_GET', 'STAFF.CREATE']
const statuses = ['PENDING_CONFIRMATION', 'COMPLETED', 'CONFIRMED', 'READY_FOR_FULFILLMENT', 'CANCELLED']
const orders = statuses.map((status, index) => ({ id: `order-${index}`, orderNumber: `OD-20261009-00${10 - index}`, status, customerName: ['Nguyễn Văn An', 'Nguyễn Văn Hùng', 'Khánh Lê', 'Trần Thanh Mai', 'Nguyễn Minh Tuấn'][index], customerPhone: '0901234567', totalAmount: [115000, 780000, 64000, 1560000, 780000][index], createdAt: '2026-10-09T10:27:00Z', source: 'COUNTER', settlementType: index === 2 ? 'CREDIT' : 'FULL_PAYMENT', customerType: 'REGISTERED', fulfillmentType: 'PICKUP', items: [], version: 1 }))
const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']
const net = [115000, 230000, 0, 700000, 540000]
const rows = days.map((key, index) => ({ key, label: key, orderCount: 1, fulfilledValue: net[index], costOfGoods: net[index] * .6, grossProfit: net[index] * .4, returnValue: 0, netSales: net[index], averageOrderValue: net[index], grossMarginPercent: 40 }))
const totals = { orderCount: 5, fulfilledValue: 1585000, costOfGoods: 951000, grossProfit: 634000, returnValue: 0, netSales: 1585000, averageOrderValue: 317000, grossMarginPercent: 40 }
let checks = 0
const pass = message => { checks++; console.log('PASS ' + message) }

async function session(width = 1440, authenticated = true) {
  const context = await browser.newContext({ viewport: { width, height: width < 640 ? 844 : 1000 } })
  if (authenticated) await context.addInitScript(() => localStorage.setItem('agrisage_token', 'glass-ui-fixture'))
  const state = { mode: 'normal', requests: [], errors: [], unknown: [] }
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    state.requests.push({ path, method: request.method(), query: Object.fromEntries(url.searchParams) })
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {})
    if (request.method() !== 'GET') { state.unknown.push(`${request.method()} ${path}`); return route.abort() }
    if (path === '/api/auth/me') return json({ id: 'owner', fullName: 'Triệu Phú Thịnh', role: 'STORE_OWNER', status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ permissions })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/orders') {
      const page = Number(url.searchParams.get('page') || 1)
      const status = url.searchParams.get('status')
      const filtered = orders.filter(order => !status || order.status === status)
      return json({ items: page === 1 ? filtered : [{ ...orders[0], orderNumber: 'OD-PAGE-2' }], page, pageSize: 10, totalCount: status ? filtered.length : 25, totalPages: status ? 1 : 3 })
    }
    if (/^\/api\/orders\/order-\d\/payments$/.test(path)) {
      const paidAmount = path.includes('order-1/') ? 100000 : path.includes('order-3/') ? 50000 : 0
      return json({ orderTotal: 100000, paidAmount, refundedAmount: 0, remainingToPay: 100000 - paidAmount, payments: [], refunds: [] })
    }
    if (path === '/api/reports/orders') {
      const by = url.searchParams.get('groupBy')
      const grouped = by === 'SOURCE' ? [['COUNTER', 3], ['FARMER_WEB', 2]] : by === 'STATUS' ? [['COMPLETED', 3], ['PENDING_CONFIRMATION', 1], ['CANCELLED', 1]] : null
      if (grouped) return json({ rows: grouped.map(([key, orderCount]) => ({ key, label: key, orderCount, orderValue: orderCount * 100000 })), totals: { orderCount: 5, orderValue: 500000 } })
      return json({ rows: rows.map(row => ({ key: row.key, label: row.key, orderCount: 1, orderValue: row.fulfilledValue })), totals: { orderCount: 5, orderValue: totals.fulfilledValue } })
    }
    if (path === '/api/reports/payments') return json({ rows: [{ key: 'CASH', label: 'CASH', paymentCount: 3, receivedAmount: 900000 }, { key: 'PAY_OS', label: 'PAY_OS', paymentCount: 2, receivedAmount: 300000 }], totals: { paymentCount: 5, receivedAmount: 1200000, orderPaymentAmount: 1100000, debtRepaymentAmount: 100000, refundedAmount: 0, netReceivedAmount: 1200000 } })
    if (path === '/api/reports/debt-aging') return json({ asOf: '2026-10-17', rows: [], totals: { notDue: 700000, days1To30: 200000, days31To60: 0, days61To90: 0, over90: 0, total: 900000 } })
    if (path === '/api/reports/debt-by-customer-group') return json({ rows: [{ customerGroup: { id: 'group-1', code: 'VIP', name: 'Khách VIP' }, customersWithDebt: 2, outstanding: 900000, overdueAmount: 200000, totalCreditLimit: 5000000, utilization: 0.18 }] })
    if (path === '/api/deliveries' || path === '/api/diagnosis-cases' || path === '/api/inventory/alerts') return json({ items: [], page: 1, pageSize: 1, totalCount: 2, totalPages: 2 })
    if (path === '/api/reports/sales' || path === '/api/reports/revenue') {
      const series = state.mode === 'empty' ? [] : state.mode === 'flat' ? rows.map(row => ({ ...row, netSales: 0, grossProfit: 0, averageOrderValue: 0 })) : state.mode === 'negative' ? rows.map((row, index) => ({ ...row, netSales: -net[index], grossProfit: -net[index] })) : rows
      return json({ rows: series, totals, page: 1, pageSize: 20, totalCount: state.mode === 'partial' ? 31 : series.length, totalPages: 1 })
    }
    if (path === '/api/reports/revenue-summary') return json({ current: totals, previous: totals, netSalesChangePercent: null })
    if (path === '/api/staff') return json({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 1 })
    state.unknown.push(path)
    return route.abort()
  })
  const page = await context.newPage()
  page.on('pageerror', error => state.errors.push(error.message))
  return { context, page, state }
}
async function settled(page, kind = 'list') {
  if (kind === 'dashboard') {
    await page.getByText('Đơn hàng gần đây', { exact: true }).first().waitFor()
    await page.waitForLoadState('networkidle')
    await page.waitForFunction(() => !document.querySelector('main .animate-pulse') && [...document.querySelectorAll('main [aria-busy]')].every(element => element.getAttribute('aria-busy') !== 'true'))
    return
  }
  await page.locator('.agrisage-kpi-card').first().waitFor()
  await page.waitForFunction(() => !document.querySelector('.agrisage-kpi-card .animate-pulse') && [...document.querySelectorAll('[aria-busy]')].every(element => element.getAttribute('aria-busy') !== 'true'))
}
async function picture(page, name) { await page.screenshot({ path: join(output, name + '.png') }) }

try {
  const desktop = await session()
  const { page, state } = desktop
  await page.goto(base + '/agent')
  await settled(page, 'dashboard')
  assert.equal(await page.locator('.agrisage-kpi-card').count(), 0, 'The dashboard draws its own strip and panels, not the list summary cards')
  for (const name of ['Việc cần xử lý', 'Kết quả kinh doanh', 'Doanh thu thuần theo ngày', 'Nhóm sản phẩm bán chạy', 'Kênh bán hàng', 'Phương thức thanh toán', 'Tỷ lệ hoàn thành đơn', 'Công nợ phải thu', 'Công nợ theo nhóm khách', 'Đơn hàng gần đây']) await page.getByText(name, { exact: true }).first().waitFor()
  assert((await page.locator('main .recharts-surface').count()) >= 1, 'The revenue chart is drawn')
  const reportCalls = state.requests.filter(request => request.path.startsWith('/api/reports/')).map(request => request.path + ':' + (request.query.groupBy ?? ''))
  for (const expected of ['/api/reports/revenue-summary:', '/api/reports/revenue:DAY', '/api/reports/revenue:CATEGORY', '/api/reports/payments:METHOD', '/api/reports/orders:SOURCE', '/api/reports/orders:STATUS', '/api/reports/debt-aging:', '/api/reports/debt-by-customer-group:']) assert(reportCalls.includes(expected), `The dashboard must read ${expected}`)
  const surface = await page.locator('body').evaluate(element => [getComputedStyle(element).backgroundImage, getComputedStyle(element).backgroundColor])
  assert.deepEqual(surface, ['none', 'rgb(255, 255, 255)'], 'White theme: no gradient or image behind the page')
  for (const selector of ['.management-shell', '.management-sidebar', '.management-topbar']) assert.equal(await page.locator(selector).first().evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)', `${selector} is white`)
  const background = surface[0]
  await picture(page, 'dashboard-desktop')
  pass('Dashboard: strip and report panels from the report APIs, white shell, sidebar and top bar')

  for (const mode of ['partial', 'empty', 'flat', 'negative']) {
    state.mode = mode
    await page.reload()
    await settled(page, 'dashboard')
    assert.equal(await page.locator('.agrisage-kpi-card').count(), 0)
    assert.doesNotMatch(await page.locator('main').innerText(), /NaN|undefined|Infinity/, `${mode} report data must not leak NaN into the dashboard`)
  }
  assert.deepEqual(state.errors, [])
  state.mode = 'normal'
  pass('Dashboard renders without errors for partial, empty, flat and negative report data')

  await page.goto(base + '/agent/orders')
  await settled(page)
  await page.locator('table tbody tr').filter({ hasText: orders[0].orderNumber }).waitFor()
  assert.equal(await page.locator('.agrisage-list-toolbar').evaluate(element => getComputedStyle(element).backdropFilter), 'none', 'White theme: no blur behind the toolbar')
  assert.equal(await page.locator('.agrisage-list-toolbar').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)')
  assert.equal(await page.locator('table').evaluate(element => getComputedStyle(element).borderCollapse), 'separate')
  assert.equal(await page.locator('table td').first().evaluate(element => getComputedStyle(element).borderTopLeftRadius), '14px')
  for (const [label, tone] of [['Chờ xác nhận', 'warning'], ['Hoàn thành', 'success'], ['Sẵn sàng giao', 'info'], ['Mua chịu', 'credit'], ['Chưa thanh toán', 'neutral'], ['Đã thanh toán', 'success'], ['Thanh toán 1 phần', 'warning']]) {
    assert.equal(await page.locator('.agrisage-status-badge').filter({ hasText: label }).first().getAttribute('data-tone'), tone)
  }
  assert.equal(await page.locator('.agrisage-status-badge').filter({ hasText: 'Đã xác nhận' }).locator('.lucide-truck').count(), 0, 'Confirmation must not imply delivery')
  assert.equal(await page.locator('.agrisage-status-badge').filter({ hasText: 'Sẵn sàng giao' }).locator('.lucide-truck').count(), 1)
  await picture(page, 'orders-desktop')
  await page.getByRole('button', { name: 'Trang 2', exact: true }).click()
  await page.getByText('OD-PAGE-2', { exact: true }).waitFor()
  await page.getByRole('combobox', { name: 'Trạng thái đơn hàng' }).selectOption('COMPLETED')
  await page.getByText(orders[1].orderNumber, { exact: true }).waitFor()
  assert.equal(state.requests.filter(request => request.path === '/api/orders').at(-1).query.page, '1')
  assert.equal(state.requests.filter(request => request.path === '/api/orders').at(-1).query.status, 'COMPLETED')
  pass('Order list: white toolbar, rounded rows, semantic badges, pagination and filter reset')

  const cdp = await desktop.context.newCDPSession(page)
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches), true)
  assert.equal(await page.locator('.agrisage-list-toolbar').evaluate(element => getComputedStyle(element).backdropFilter), 'none')
  assert.equal(await page.locator('table').evaluate(element => getComputedStyle(element.closest('.bg-surface-container-lowest')).backdropFilter), 'none')
  assert.equal(await page.locator('.agrisage-kpi-card').first().evaluate(element => getComputedStyle(element).transitionDuration), '0s')
  await cdp.send('Emulation.setEmulatedMedia', { features: [] })
  await cdp.detach()
  pass('Accessibility preferences: opaque panes and no motion when requested')

  await page.goto(base + '/agent/staff')
  await settled(page)
  await page.getByRole('button', { name: 'Thêm nhân viên', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  assert.equal(await page.getByRole('dialog').evaluate(element => getComputedStyle(element).borderRadius), '22px')
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
  const nameField = page.getByRole('dialog').getByLabel('Họ và tên *', { exact: true })
  await nameField.evaluate(element => element.setAttribute('aria-invalid', 'true'))
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[role=dialog] [aria-invalid=true]')).borderColor === 'rgb(186, 26, 26)')
  assert.equal(await nameField.evaluate(element => getComputedStyle(element).borderColor), 'rgb(186, 26, 26)', 'Validation border must remain visible above the theme')
  await nameField.evaluate(element => element.removeAttribute('aria-invalid'))
  await picture(page, 'staff-modal-desktop')
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  pass('Modal: rounded white panel, scroll lock, Escape dismissal')
  assert.deepEqual(state.errors, [])
  assert.deepEqual(state.unknown, [])
  await desktop.context.close()

  for (const width of [1024, 768, 390]) {
    const mobile = await session(width)
    await mobile.page.goto(base + '/agent/orders')
    await settled(mobile.page)
    assert.equal(await mobile.page.locator('body').evaluate(element => getComputedStyle(element).backgroundImage), background, 'Same white background on every screen size')
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px: no page overflow`)
    await mobile.page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    if (width < 1024) {
      const opener = mobile.page.getByRole('button', { name: 'Mở menu điều hướng', exact: true })
      await opener.click()
      assert.equal(await opener.getAttribute('aria-expanded'), 'true')
      await mobile.page.keyboard.press('Escape')
      assert.equal(await opener.getAttribute('aria-expanded'), 'false')
    }
    if (width === 390) {
      const cards = await mobile.page.locator('.agrisage-kpi-card').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top))
      assert.equal(cards[0], cards[1], 'Phone summaries form two columns')
      assert.equal(cards[2], cards[3])
      assert.ok(cards[2] > cards[0])
    }
    await mobile.page.evaluate(() => scrollTo(0, 0))
    await picture(mobile.page, `orders-${width}`)
    assert.deepEqual(mobile.state.errors, [])
    assert.deepEqual(mobile.state.unknown, [])
    await mobile.context.close()
    pass(`Responsive ${width}px: visible filters, contained table, working drawer`)
  }
  const auth = await session(390, false)
  for (const path of ['/login', '/forgot-password', '/reset-password?token=fixture-token']) {
    await auth.page.goto(base + path)
    await auth.page.locator('.agrisage-auth').waitFor()
    assert.equal(await auth.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  }
  await auth.page.goto(base + '/login')
  await picture(auth.page, 'login-mobile')
  assert.deepEqual(auth.state.errors, [])
  assert.deepEqual(auth.state.unknown, [])
  await auth.context.close()
  pass('Login and password forms: shared theme without mobile overflow')
} finally { await browser.close() }
console.log(`Glass theme: ${checks} groups passed; all APIs intercepted`)
