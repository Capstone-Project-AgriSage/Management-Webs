import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

// Every HTTP request is intercepted. No real backend data is read or changed.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5173'
const codes = [...new Set([...fs.readFileSync('src/components/auth/PermissionRoute.tsx', 'utf8').matchAll(/'([A-Z_]+\.[A-Z_]+)'/g)].map(match => match[1]))].filter(code => code !== 'REPORTS.READ')
codes.push('PRICING.CREATE')
codes.push('CATEGORIES.CREATE', 'CATEGORIES.UPDATE', 'INGREDIENTS.CREATE', 'AI_MODELS.READ', 'AI_POLICIES.READ')
const date = '2026-10-10T03:00:00Z'
const item = index => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, code: `KT-${index}`, name: `Bản ghi ${index}`, fullName: `Bản ghi ${index}`, sku: `SKU-${index}`,
  productName: `Bản ghi ${index}`, productCode: `SKU-${index}`, phoneNumber: '0900000000', email: 'test@example.test', status: 'ACTIVE', memberStatus: 'ACTIVE', role: 'SALES_STAFF',
  isActive: true, isSellable: true, packagings: [], images: [], groups: [], category: null, baseUnit: { name: 'kg' },
  effectiveFrom: date, effectiveTo: null, isWalkInDefault: true, itemCount: 1, totalAmount: 100000, subtotalAmount: 100000, createdAt: date, receivedAt: date, requestedAt: date,
  currentDebt: 0, totalPurchaseAmount: 0, totalOrders: 0, availableCredit: 0, creditLimit: 0, debtSummary: { overdueDebt: 0 },
  orderNumber: `DH-${index}`, customerName: `Bản ghi ${index}`, customerType: 'WALK_IN', settlementType: 'FULL_PAYMENT', fulfillmentType: 'PICKUP', source: 'COUNTER', items: [],
  receiptNumber: `PN-${index}`, supplierName: 'Nhà cung cấp kiểm thử', returnNumber: `TH-${index}`, lineCount: 1, countedCount: 0, differenceCount: 0, stocktakeNumber: `KK-${index}`,
  deliveryNumber: `GH-${index}`, recipientName: `Bản ghi ${index}`, province: 'Đồng Tháp', assignedTo: null, scheduledAt: date,
  notificationType: 'ORDER_PLACED', title: `Bản ghi ${index}`, message: 'Thông báo kiểm thử', data: null,
  action: 'ORDER_CREATED', entityType: 'ORDER', actorName: `Bản ghi ${index}`, actorRole: 'STORE_OWNER', occurredAt: date, priority: index + 1,
  storeProductId: `product-${index}`, quantityOnHand: 10, quantityReserved: 0, quantityAvailable: 10, onHandBaseQuantity: 10, reservedBaseQuantity: 0, availableBaseQuantity: 10,
  totalStockValue: 100000, stockValue: 100000, lowStockThreshold: 1, baseUnitName: 'kg', lotCount: 1,
  sellableAvailableBaseQuantity: 10,
})
const cases = [
  ['/agent/price-lists', '/api/price-lists', 'DRAFT'], ['/agent/farmers', '/api/customers', 'ACTIVE'], ['/agent/products', '/api/products', 'ACTIVE'],
  ['/agent/purchases/suppliers', '/api/suppliers', 'ACTIVE'], ['/agent/purchases/receipts', '/api/goods-receipts', 'DRAFT'],
  ['/agent/returns', '/api/returns', 'REQUESTED'], ['/agent/inventory/stocktake', '/api/stocktakes', 'DRAFT'], ['/agent/staff', '/api/staff', 'ACTIVE'],
  ['/agent/deliveries', '/api/deliveries', 'DELIVERED'], ['/agent/orders', '/api/orders', 'COMPLETED'], ['/agent/payments', '/api/orders', 'COMPLETED'],
  ['/agent/inventory', '/api/inventory/stock-summary', 'ACTIVE'],
  ['/notifications', '/api/me/notifications', 'UNREAD'],
  ['/delivery/deliveries', '/api/deliveries', 'OUT_FOR_DELIVERY', 'DELIVERY_STAFF'],
  ['/agent/credit-config', '/api/customer-groups', 'ACTIVE'], ['/agent/activity-log', '/api/audit-logs', 'SUCCESS'],
  ['/admin/products/categories', '/api/categories', 'ACTIVE', 'ADMIN'], ['/admin/products/ingredients', '/api/active-ingredients', 'ACTIVE', 'ADMIN'], ['/admin/ai/models', '/api/ai-models', 'DRAFT', 'ADMIN'],
]
let checks = 0
const pass = message => { checks++; console.log('PASS ' + message) }
async function fixture(path, endpoint, status, width = 1440, role = 'STORE_OWNER') {
  const context = await browser.newContext({ viewport: { width, height: 960 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'pagination.test.jwt'))
  const state = { requests: [] }, errors = []
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const query = Object.fromEntries([...url.searchParams].map(([key, value]) => [key.toLowerCase(), value]))
    state.requests.push({ path: url.pathname, query, method: route.request().method(), body: route.request().postData() ? JSON.parse(route.request().postData()) : null })
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {})
    if (url.pathname === '/api/auth/me') return json({ id: 'owner', fullName: 'Người kiểm thử', role, status: 'ACTIVE', canReviewAi: true })
    if (url.pathname === '/api/me/permissions') return json({ permissions: path.endsWith('/reports') ? [...codes, 'REPORTS.READ'] : codes })
    if (url.pathname.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/admin/ai/policies' && url.pathname === '/api/ai-models') return json({ items: [{ ...item(0), version: 'v1' }], page: 1, pageSize: 10, totalCount: 1, totalPages: 1 })
    if (path === '/admin/ai/policies' && url.pathname.endsWith('/policies')) return json(Array.from({ length: 21 }, (_, i) => ({ id: `policy-${i}`, version: `v${i}`, minimumConfidence: 0.8, topK: 3, status: 'DRAFT', effectiveFrom: date })))
    if (path.endsWith('/reports') && url.pathname.startsWith('/api/reports/')) {
      const zeroAmount = { quantity: 0, value: 0 }
      const rows = Array.from({ length: 21 }, (_, i) => ({ ...item(i), farmerProfileId: `farmer-${i}`, baseUnit: 'kg', openingQuantity: 1, openingValue: 1000, closingQuantity: 1, closingValue: 1000,
        stockIn: zeroAmount, returnIn: zeroAmount, adjustmentIn: zeroAmount, sale: zeroAmount, adjustmentOut: zeroAmount, reversal: zeroAmount,
        total: 1000, notDue: 1000, days1To30: 0, days31To60: 0, days61To90: 0, days91To180: 0, over90: 0,
        key: `2026-10-${String(i + 1).padStart(2, '0')}`, collectedAmount: 1000, paymentCount: 1, customerGroup: { id: `group-${i}`, name: `Nhóm ${i}` }, customersWithDebt: 1, outstanding: 1000, overdueAmount: 0, totalCreditLimit: 10000, utilization: 0.1,
      }))
      const totals = { stockValue: 21000, expiredValue: 0, openingValue: 21000, closingValue: 21000, stockIn: 0, returnIn: 0, adjustmentIn: 0, sale: 0, adjustmentOut: 0, reversal: 0,
        total: 21000, notDue: 21000, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0, collectedAmount: 21000, paymentCount: 21,
        deliveries: 0, attempts: 0, successful: 0, partial: 0, failed: 0, successRate: 0,
      }
      return json({ rows: url.pathname.endsWith('/deliveries') ? [] : rows, totals, byCategory: [], failureReasons: [], incidents: [] })
    }
    if (url.pathname.endsWith('valuation')) return json({ totals: { stockValue: 0, expiredValue: 0 }, rows: [], byCategory: [] })
    if (url.pathname === endpoint) {
      if (route.request().method() === 'POST' || route.request().method() === 'PUT') return json({ ...JSON.parse(route.request().postData()), id: 'created', isActive: true })
      const rows = Array.from({ length: 121 }, (_, index) => ({ ...item(index), status: query.status || status, ...(endpoint === '/api/categories' ? { parentId: '00000000-0000-4000-8000-000000009999', displayOrder: index } : {}), ...(endpoint === '/api/inventory/stock-summary' ? { baseUnit: 'kg' } : {}), ...(path === '/agent/refunds' ? { createdAt: new Date(Date.parse(date) - index * 1000).toISOString(), id: `${query.status}-${index}` } : {}) }))
      const filtered = query.search ? rows.filter(row => row.name.includes(query.search) || row.orderNumber.includes(query.search)) : rows
      const page = Number(query.page || 1), pageSize = Number(query.pagesize || 10)
      return json({ items: filtered.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) })
    }
    if (url.pathname.endsWith('/refunds')) return json([{ id: 'refund', amount: 10000, status: 'PENDING' }])
    if (url.pathname.endsWith('/payments')) return json({ orderTotal: 100000, paidAmount: 100000, remainingToPay: 0, payments: [], refunds: [] })
    return json({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base + path)
  try { await page.locator('.agrisage-list-toolbar').first().waitFor() }
  catch (error) { console.log({ path, url: page.url(), errors, requests: state.requests, body: await page.locator('body').innerText() }); throw error }
  return { context, page, state, errors }
}
try {
  for (const [path, endpoint, status, role] of process.env.UI_REPORT_ONLY ? [] : process.env.UI_ADMIN_ONLY ? cases.filter(entry => entry[0].startsWith('/admin/')) : cases) {
    const f = await fixture(path, endpoint, status, 1440, role)
    await f.page.getByRole('button', { name: 'Trang 2', exact: true }).waitFor()
    const reads = () => f.state.requests.filter(request => request.path === endpoint && request.query.pagesize !== '1')
    assert(reads().some(request => request.query.pagesize === '10'))
    const rows = f.page.locator(path === '/notifications' ? 'article[data-notification-id]' : path.startsWith('/delivery/') ? 'main a[href^="/delivery/deliveries/"]' : 'main table tbody > tr')
    assert.equal(await rows.count(), 10, path + ': first page must have 10 rows')
    await f.page.getByRole('button', { name: 'Trang 2', exact: true }).click()
    await f.page.waitForFunction(() => document.querySelector('[aria-label="Trang 2"]')?.getAttribute('aria-current') === 'page')
    await f.page.waitForTimeout(500)
    assert(reads().some(request => request.query.page === '2' && request.query.pagesize === '10'))
    const search = f.page.locator('.agrisage-list-toolbar input[type="text"]').first()
    if (path === '/notifications') {
      await f.page.getByLabel('Lọc thông báo', { exact: true }).selectOption('UNREAD')
      await f.page.waitForTimeout(500)
      assert(reads().some(request => request.query.page === '1' && request.query.status === 'UNREAD' && request.query.pagesize === '10'))
    } else {
      await search.fill(path.includes('orders') || path.includes('payments') ? 'DH-120' : 'Bản ghi 120')
      if (path.includes('activity-log')) await f.page.getByRole('button', { name: 'Lọc', exact: true }).click()
      await f.page.waitForTimeout(750)
      if (path === '/admin/ai/models') assert(reads().some(request => request.query.page === '13' && request.query.pagesize === '10'))
      else assert(reads().some(request => request.query.page === '1' && request.query.search?.includes('120') && request.query.pagesize === '10'))
      assert.equal(await rows.count(), 1, path + ': server search must reach record 121')
    }
    await f.page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    await f.page.waitForTimeout(750)
    if (path !== '/notifications') assert.equal(await search.inputValue(), '')
    assert.equal(await rows.count(), 10)
    assert.deepEqual(f.errors, [])
    pass(path + ': API page size 10, page 2, search beyond 100, clear returns to page 1')
    if (path === '/agent/price-lists') {
      fs.mkdirSync('artifacts/pagination-filters', { recursive: true })
      await f.page.locator('.agrisage-list-toolbar').screenshot({ path: 'artifacts/pagination-filters/toolbar-1440.png' })
    }
    await f.context.close()
  }
  for (const width of process.env.UI_REPORT_ONLY || process.env.UI_ADMIN_ONLY ? [] : [1024, 768, 375]) {
    const f = await fixture('/agent/price-lists', '/api/price-lists', 'DRAFT', width)
    await f.page.getByRole('button', { name: 'Trang 2', exact: true }).waitFor()
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.equal(await f.page.getByRole('button', { name: 'Xóa lọc', exact: true }).isVisible(), true)
    assert.deepEqual(f.errors, [])
    if (width === 375) await f.page.screenshot({ path: 'artifacts/pagination-filters/price-lists-375.png', fullPage: true })
    pass('Shared toolbar and pagination at ' + width + 'px')
    await f.context.close()
  }
  if (!process.env.UI_REPORT_ONLY && !process.env.UI_ADMIN_ONLY) {
    const f = await fixture('/agent/counter-sales', '/api/catalog/products', 'ACTIVE')
    await f.page.getByRole('button', { name: 'Trang 2', exact: true }).waitFor()
    const products = f.page.locator('main .cursor-pointer').filter({ hasText: 'Bản ghi' })
    assert.equal(await products.count(), 10)
    await f.page.getByRole('button', { name: 'Trang 2', exact: true }).click()
    await f.page.waitForTimeout(600)
    assert(f.state.requests.some(r => r.path === '/api/catalog/products' && r.query.page === '2' && r.query.pagesize === '10'))
    await f.page.locator('.agrisage-list-toolbar input').fill('Bản ghi 120')
    await f.page.waitForTimeout(750)
    assert.equal(await products.count(), 1)
    await f.page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    await f.page.waitForTimeout(750)
    assert.equal(await products.count(), 10)
    assert.deepEqual(f.errors, [])
    pass('Counter sale product catalog: API 10, page 2, server search and clear')
    await f.context.close()
  }
  if (!process.env.UI_REPORT_ONLY && !process.env.UI_ADMIN_ONLY) {
    const f = await fixture('/agent/refunds', '/api/orders', 'CANCELLED')
    await f.page.getByRole('button', { name: 'Trang 2', exact: true }).waitFor()
    assert.equal(await f.page.locator('main table tbody > tr').count(), 10)
    await f.page.getByRole('button', { name: 'Trang 2', exact: true }).click()
    await f.page.waitForTimeout(700)
    assert(f.state.requests.some(r => r.path === '/api/orders' && r.query.page === '2' && r.query.pagesize === '10'))
    await f.page.locator('.agrisage-list-toolbar input[type="text"]').fill('DH-120')
    await f.page.waitForTimeout(750)
    assert.equal(await f.page.locator('main table tbody > tr').count(), 2)
    await f.page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    await f.page.waitForTimeout(750)
    assert.equal(await f.page.locator('main table tbody > tr').count(), 10)
    assert.deepEqual(f.errors, [])
    pass('Refund source lists: API 10, merged page 2, server search and clear')
    await f.context.close()
  }
  for (const path of process.env.UI_REPORT_ONLY || process.env.UI_ADMIN_ONLY ? [] : ['/admin/accounts', '/admin/articles']) {
    const f = await fixture(path, '/api/unused-mock-list', 'ACTIVE', 1440, 'ADMIN')
    const count = await f.page.locator('main table tbody > tr').count()
    assert(count <= 10)
    const search = f.page.locator('.agrisage-list-toolbar input').first()
    await search.fill('Không tồn tại trong dữ liệu kiểm thử')
    await f.page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    assert.equal(await search.inputValue(), '')
    assert.deepEqual(f.errors, [])
    pass(path + ': mock list max 10 rows, shared toolbar and clear')
    await f.context.close()
  }
  if (!process.env.UI_REPORT_ONLY) {
    const f = await fixture('/admin/ai/policies', '/api/unused-policies', 'ACTIVE', 1440, 'ADMIN')
    await f.page.getByRole('button', { name: 'Trang 2', exact: true }).waitFor()
    assert.equal(await f.page.locator('main table tbody > tr').count(), 10)
    await f.page.getByRole('button', { name: 'Trang 2', exact: true }).click()
    await f.page.locator('.agrisage-list-toolbar input[type="text"]').fill('v20')
    await f.page.waitForTimeout(200)
    assert.equal(await f.page.locator('main table tbody > tr').count(), 1)
    await f.page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    assert.equal(await f.page.locator('main table tbody > tr').count(), 10)
    assert(f.state.requests.some(r => r.path.endsWith('/policies')))
    assert.deepEqual(f.errors, [])
    pass('AI policies: real per-model API, local 10-row paging and filters')
    await f.context.close()
  }
  if (!process.env.UI_REPORT_ONLY) {
    const f = await fixture('/admin/products/categories', '/api/categories', 'ACTIVE', 1440, 'ADMIN')
    await f.page.getByRole('button', { name: 'Trang 2', exact: true }).waitFor()
    await f.page.getByRole('button', { name: '+ Thêm danh mục', exact: true }).click()
    await f.page.getByLabel(/^Tên/).fill('Danh mục API')
    await f.page.getByLabel(/^Mã/).fill('DM-API')
    await f.page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await f.page.waitForTimeout(300)
    assert.deepEqual(f.state.requests.find(r => r.path === '/api/categories' && r.method === 'POST').body, { name: 'Danh mục API', code: 'DM-API', description: null, displayOrder: 0, parentId: null })
    await f.page.getByRole('button', { name: 'Sửa', exact: true }).first().click()
    await f.page.getByLabel(/^Tên/).fill('Danh mục sửa')
    const updating = f.page.waitForRequest(r => r.method() === 'PUT')
    await f.page.getByRole('button', { name: 'Lưu', exact: true }).click()
    const request = await updating
    assert.equal(request.postDataJSON().parentId, '00000000-0000-4000-8000-000000009999')
    assert.equal(request.postDataJSON().displayOrder, 0)
    assert.equal(request.postDataJSON().code, undefined)
    pass('Category API create/update contracts: required code, immutable code and existing parent preserved')
    await f.context.close()
  }
  for (const path of process.env.UI_ADMIN_ONLY ? [] : ['/agent/inventory/reports', '/agent/debts/reports', '/agent/deliveries/reports']) {
    const f = await fixture(path, '/api/unused-report', 'ACTIVE')
    if (!path.includes('/deliveries/')) {
      const table = f.page.locator('main table').first()
      await f.page.getByRole('button', { name: 'Trang 2', exact: true }).first().waitFor()
      assert.equal(await table.locator('tbody > tr').filter({ hasText: 'Bản ghi' }).count(), 10)
      await f.page.getByRole('button', { name: 'Trang 2', exact: true }).first().click()
      await f.page.waitForTimeout(200)
      assert.equal(await table.locator('tbody > tr').filter({ hasText: 'Bản ghi' }).count(), 10)
      await f.page.getByRole('button', { name: 'Trang 3', exact: true }).first().click()
      await f.page.waitForTimeout(200)
      assert.equal(await table.locator('tbody > tr').filter({ hasText: 'Bản ghi' }).count(), 1)
    } else {
      await f.page.getByLabel('Gộp báo cáo theo').selectOption('DAY')
      await f.page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
      await f.page.waitForTimeout(300)
      assert.equal(await f.page.getByLabel('Gộp báo cáo theo').inputValue(), 'STAFF')
    }
    assert.deepEqual(f.errors, [])
    pass(path + ': shared filters and report table pagination where applicable')
    await f.context.close()
  }
  // The merge algorithm must produce globally ordered pages, including records after the old fixed limits.
  const source = fs.readFileSync('src/utils/mergePagedLists.ts', 'utf8').replace(/^import .*\n/gm, '')
  const compiled = ts.transpileModule('const LIST_PAGE_SIZE = 10;\n' + source.replace('export async function', 'async function'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const merge = new Function(compiled + '\nreturn mergePagedLists')()
  const requests = []
  const datasets = [Array.from({ length: 131 }, (_, i) => i * 2), Array.from({ length: 125 }, (_, i) => i * 2 + 1)]
  const sources = datasets.map((items, index) => async page => {
    requests.push({ index, page })
    return { items: items.slice((page - 1) * 10, page * 10), page, pageSize: 10, totalCount: items.length, totalPages: Math.ceil(items.length / 10) }
  })
  assert.deepEqual((await merge(sources, 2, (a, b) => a - b)).items, Array.from({ length: 10 }, (_, i) => i + 10))
  assert.deepEqual((await merge(sources, 13, (a, b) => a - b)).items, Array.from({ length: 10 }, (_, i) => i + 120))
  assert.equal((await merge(sources, 999, (a, b) => a - b)).page, 26)
  assert.deepEqual((await merge([], 1, (a, b) => a - b)).items, [])
  pass('Merged API pagination: correct ordering, records beyond 100, last page clamp, empty sources')
} finally { await browser.close() }
console.log(`Pagination and filters: ${checks} checks passed`)
