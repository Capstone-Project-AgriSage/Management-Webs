import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// Intercept all APIs; never write to the live store.
const { chromium } = await import(process.env.REPORT_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.REPORT_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.REPORT_BROWSER_CHANNEL })
const base = process.env.REPORT_TEST_URL || 'http://127.0.0.1:5174'
const date = '2026-10-10T03:00:00Z'
const stocktakes = ['IN_PROGRESS', 'COMPLETED', 'DRAFT'].map((status, index) => ({ id: 'stock-' + index, stocktakeNumber: 'KK-' + index, status, lineCount: 5, countedCount: 3, differenceCount: index + 1, createdAt: date, completedAt: null }))
const suppliers = [true, false, true].map((isActive, index) => ({ id: 'supplier-' + index, code: 'NCC-' + index, name: 'Nhà cung cấp ' + index, isActive, phoneNumber: index === 2 ? null : '0900000000' }))
const prices = ['DRAFT', 'ACTIVE', 'INACTIVE'].map((status, index) => ({ id: 'price-' + index, code: 'BG-' + index, name: 'Bảng giá ' + index, status, effectiveFrom: date, effectiveTo: null, isWalkInDefault: status === 'ACTIVE', groups: [], itemCount: 1 }))
const customers = [300000, 900000, 0].map((currentDebt, index) => ({ id: 'customer-' + index, fullName: 'Khách ' + index, status: 'ACTIVE', currentDebt, totalOrders: 1, totalPurchaseAmount: 1000000, availableCredit: 500000, creditLimit: 1000000, allowCreditPurchase: index !== 2, debtSummary: { overdueDebt: [200000, 50000, 0][index] } }))
const staff = ['SALES_STAFF', 'DELIVERY_STAFF', 'SALES_STAFF'].map((role, index) => ({ id: 'staff-' + index, fullName: 'Nhân viên ' + index, role, status: index === 2 ? 'INACTIVE' : 'ACTIVE', memberStatus: 'ACTIVE', email: 'test@example.test' }))
const logs = ['SUCCESS', 'FAILURE', 'SUCCESS'].map((status, index) => ({ id: 'log-' + index, actorUserId: index === 2 ? null : 'actor-1', actorName: 'Người kiểm thử', actorRole: 'STORE_OWNER', status, action: status === 'FAILURE' ? 'AUTH_LOGIN_FAILED' : 'ORDER_CREATED', entityType: 'ORDER', entityId: null, oldValues: null, newValues: null, occurredAt: date }))
const cases = [
  { path: '/agent/inventory/stocktake', api: '/api/stocktakes', title: 'Tổng hợp kiểm kê kho', unit: 'phiếu kiểm kê', items: stocktakes, metrics: [['Đang kiểm kê', '1'], ['Kiểm kê hoàn tất', '1'], ['Dòng kiểm kê chênh lệch', '6']], filter: 'COMPLETED' },
  { path: '/agent/purchases/suppliers', api: '/api/suppliers', title: 'Tổng hợp nhà cung cấp', unit: 'nhà cung cấp', items: suppliers, metrics: [['Đang hợp tác', '2'], ['Ngừng hợp tác', '1'], ['Có thông tin liên hệ', '2']], filter: 'false' },
  { path: '/agent/price-lists', api: '/api/price-lists', title: 'Tổng hợp bảng giá', unit: 'bảng giá', items: prices, metrics: [['Bảng giá nháp', '1'], ['Đang áp dụng', '1'], ['Ngưng áp dụng', '1']], filter: 'ACTIVE' },
  { path: '/agent/farmers', api: '/api/customers', title: 'Tổng hợp khách hàng', unit: 'khách hàng', items: customers, metrics: [['Dư nợ khách hàng', '1.200.000 đ'], ['Nợ quá hạn', '250.000 đ'], ['Khách được mua chịu', '2']] },
  { path: '/agent/staff', api: '/api/staff', title: 'Tổng hợp nhân sự', unit: 'nhân viên', items: staff, metrics: [['Đang làm việc', '2'], ['Ngừng hoạt động', '1'], ['Nhân viên bán hàng', '2']] },
  { path: '/agent/activity-log', api: '/api/audit-logs', title: 'Tổng hợp nhật ký đại lý', unit: 'nhật ký', items: logs, metrics: [['Thao tác thành công', '2'], ['Thao tác thất bại', '1'], ['Người thực hiện', '1']] },
]
let checks = 0
const pass = name => { checks++; console.log('PASS ' + name) }
const metricValue = (region, label) => region.getByRole('heading', { name: label, exact: true }).locator('..').locator('p').first()
async function fixture(test, mode = 'normal', viewport = { width: 1440, height: 950 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'list-report-test'))
  const state = { mode, requests: [] }
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    state.requests.push({ path: url.pathname, method: request.method(), query: Object.fromEntries(url.searchParams) })
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {})
    if (url.pathname === '/api/auth/me') return json({ id: 'owner-test', fullName: 'Owner Test', role: 'STORE_OWNER', status: 'ACTIVE' })
    // No REPORTS.READ grant: summaries use only data already permitted by each list's READ permission.
    if (url.pathname === '/api/me/permissions') return json({ permissions: ['STOCKTAKES.READ', 'SUPPLIERS.READ', 'PRICING.READ', 'CUSTOMERS.READ', 'STAFF.READ_GET', 'AUDIT.READ'] })
    if (url.pathname.endsWith('/unread-count')) return json({ count: 0 })
    if (url.pathname !== test.api) return json({ items: [], totalCount: 0, totalPages: 0 })
    if (state.mode === 'error') return json({ title: 'Unavailable', detail: 'Lỗi danh sách kiểm thử' }, 503)
    const query = Object.fromEntries([...url.searchParams].map(([key, value]) => [key.toLowerCase(), value]))
    if (query.iswalkindefault) return json({ items: [prices[1]], totalCount: 1, totalPages: 1 })
    await new Promise(resolve => setTimeout(resolve, 80))
    const filtered = !!query.status || query.isactive !== undefined
    const items = state.mode === 'empty' ? [] : state.mode === 'missing-debt' ? test.items.map(item => ({ ...item, debtSummary: null })) : query.page === '2' ? [test.items.at(-1)] : filtered ? [test.items[1]] : test.items
    return json({ items, totalCount: state.mode === 'empty' ? 0 : filtered ? 7 : 31, totalPages: state.mode === 'empty' ? 0 : filtered ? 1 : 3, page: Number(query.page || 1), pageSize: Number(query.pagesize || 15) })
  })
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base + test.path)
  const region = page.getByRole('region', { name: test.title, exact: true })
  return { context, page, region, state, errors }
}
try {
  for (const test of cases) {
    const f = await fixture(test)
    await f.region.getByText(new RegExp(`31\\s*${test.unit}`)).waitFor()
    for (const [label, value] of test.metrics) assert.equal((await metricValue(f.region, label).innerText()).trim(), value)
    assert.equal(await f.region.getByText('Trên trang đang hiển thị', { exact: true }).count(), 3)
    assert.equal(f.state.requests.filter(r => r.path.startsWith('/api/reports/')).length, 0)
    assert(f.state.requests.every(r => r.method === 'GET'))
    const nextResponse = f.page.waitForResponse(response => new URL(response.url()).pathname === test.api && [...new URL(response.url()).searchParams].some(([key, value]) => key.toLowerCase() === 'page' && value === '2'))
    await f.page.getByRole('button', { name: 'Trang 2', exact: true }).click()
    await nextResponse
    await f.page.waitForFunction(title => document.querySelector(`section[aria-label="${title}"] [aria-busy]`)?.getAttribute('aria-busy') === 'false', test.title)
    await f.region.getByText(new RegExp(`31\\s*${test.unit}`)).waitFor()
    if (test.title === 'Tổng hợp kiểm kê kho') assert.equal((await metricValue(f.region, 'Dòng kiểm kê chênh lệch').innerText()).trim(), '3')
    if (test.filter) {
      await f.page.locator('main select').first().selectOption(test.filter)
      await f.region.getByText(new RegExp(`7\\s*${test.unit}`)).waitFor()
    }
    assert.deepEqual(f.errors, [])
    await f.context.close()
    pass(test.title + ': API total, visible-page metrics and pagination/filter scope')
  }
  const empty = await fixture(cases[3], 'empty')
  await empty.region.getByText(/0\s*khách hàng/).waitFor()
  assert.equal((await metricValue(empty.region, 'Dư nợ khách hàng').innerText()).trim(), '0 đ')
  await empty.context.close()
  pass('An empty list shows real zero values')
  const incomplete = await fixture(cases[3], 'missing-debt')
  await incomplete.region.getByText(/31\s*khách hàng/).waitFor()
  assert.equal((await metricValue(incomplete.region, 'Nợ quá hạn').innerText()).trim(), '—')
  assert.equal((await metricValue(incomplete.region, 'Dư nợ khách hàng').innerText()).trim(), '1.200.000 đ')
  incomplete.state.mode = 'error'
  await incomplete.page.getByLabel('Lọc trạng thái', { exact: true }).selectOption('INACTIVE')
  await incomplete.page.getByRole('alert').filter({ hasText: 'Lỗi danh sách kiểm thử' }).waitFor()
  assert.equal(await incomplete.region.getByText('—', { exact: true }).count(), 4)
  await incomplete.context.close()
  pass('Missing debt details remain unavailable; a failed filter request hides previous summary totals')
  const failed = await fixture(cases[5], 'error')
  await failed.page.getByRole('alert').filter({ hasText: 'Lỗi danh sách kiểm thử' }).waitFor()
  assert.equal(await failed.region.getByText('—', { exact: true }).count(), 4)
  await failed.context.close()
  pass('A failed API shows unavailable values instead of fabricated zero totals')
  const mobile = await fixture(cases[0], 'normal', { width: 390, height: 844 })
  await mobile.region.getByText(/31\s*phiếu kiểm kê/).waitFor()
  assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.deepEqual(mobile.errors, [])
  await mobile.context.close()
  pass('List report cards fit the mobile viewport')
  console.log(`${checks} list-report browser checks passed (intercepted APIs)`)
} finally { await browser.close() }
