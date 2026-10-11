import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// All API traffic is intercepted. These checks cannot access or mutate a store backend.
const modulePath = process.env.UI_PLAYWRIGHT_MODULE || process.env.REPORT_PLAYWRIGHT_MODULE
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright')
const base = process.env.UI_TEST_URL || process.env.REPORT_TEST_URL || 'http://127.0.0.1:5175'
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' })
if (process.env.UI_SCREENSHOT_DIR) await mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true })
const READ_PERMISSIONS = ['REPORTS.READ', 'ORDERS.READ', 'PAYMENTS.READ', 'REFUNDS.READ', 'RETURNS.READ', 'DELIVERIES.READ', 'DEBT.READ', 'DEBT.READ_DASHBOARD', 'INVENTORY.READ', 'INVENTORY.READ_ALERTS', 'INVENTORY.READ_MOVEMENTS', 'STOCKTAKES.READ', 'SUPPLIERS.READ', 'GOODS_RECEIPTS.READ', 'PRODUCTS.READ', 'STORE_PRODUCTS.READ', 'CATEGORIES.READ', 'INGREDIENTS.READ', 'AI_MODELS.READ', 'AI_POLICIES.READ', 'DIAGNOSIS.READ', 'STAFF.READ', 'STAFF.READ_GET', 'CUSTOMERS.READ', 'PRICING.READ', 'CUSTOMER_GROUPS.READ', 'CREDIT_TIERS.READ', 'AUDIT.READ', 'PERMISSIONS.MANAGE_ROLES']
const paged = (items = [], totalCount = items.length, query = {}) => ({ items, page: Number(query.page || query.Page || 1), pageSize: Number(query.pageSize || query.PageSize || 10), totalCount, totalPages: Math.max(1, Math.ceil(totalCount / Number(query.pageSize || query.PageSize || 10))) })
const categoryTree = [{ id: 'category-parent', code: 'PARENT', displayOrder: 0, isActive: true, name: 'Danh mục cha', children: [{ id: 'category-child', code: 'CHILD', displayOrder: 0, isActive: true, name: 'Danh mục con', children: [] }] }]
const category = { id: 'category-parent', name: 'Danh mục cha', code: 'CAT', description: 'Mô tả thật từ API', isActive: true }
const lot = { id: 'lot-1', storeProductId: 'store-product', productId: 'product-1', sku: 'SP-API', productName: 'Sản phẩm từ kho API', lotNumber: 'LOT-API', manufacturingDate: '2026-01-01', expiryDate: '2027-12-31', isExpired: false, status: 'ACTIVE', quantityOnHand: 10, quantityReserved: 2, quantityAvailable: 8, averageUnitCost: 12000, totalCostValue: 120000 }
const valuation = { rows: [{ storeProductId: 'store-product', sku: 'SP-API', productName: lot.productName, category: 'Danh mục con', onHandBaseQuantity: 10, averageUnitCost: 12000, stockValue: 120000, expiredValue: 0 }], byCategory: [{ categoryId: 'category-child', name: 'Danh mục con', stockValue: 120000 }], totals: { stockValue: 120000, expiredValue: 0 } }
const salesMetrics = { orderCount: 7, fulfilledValue: 700000, costOfGoods: 400000, grossProfit: 300000, returnValue: 10000, netSales: 690000, averageOrderValue: 100000, grossMarginPercent: 42.86 }
const order = { id: 'order-1', orderNumber: 'ORD-API', source: 'COUNTER', customerType: 'WALK_IN', farmerProfileId: null, customerName: 'Khách từ API', customerPhone: null, customerGroupId: null, priceListId: null, settlementType: 'FULL_PAYMENT', creditTermDays: null, fulfillmentType: 'PICKUP', deliveryAddress: null, status: 'PENDING_CONFIRMATION', subtotalAmount: 250000, totalAmount: 250000, note: null, createdBy: 'owner', createdAt: '2026-10-11T01:00:00Z', confirmedBy: null, confirmedAt: null, pickupCompletedBy: null, pickupCompletedAt: null, completedAt: null, cancelledBy: null, cancelledAt: null, cancelReason: null, version: 1, items: [] }
const aiModel = { id: 'model-1', name: 'Mô hình API', version: '1.0', framework: 'PyTorch', architecture: null, modelStorageUrl: 'https://example.test/model', classLabels: [], metrics: null, status: 'ACTIVE', createdAt: '2026-10-01T00:00:00Z' }
const totalsByStatus = { OUT_FOR_DELIVERY: 31, ASSIGNED: 4, RETRY_PENDING: 2, PARTIALLY_DELIVERED: 3, DELIVERED: 73 }

async function makeSession(role = 'STORE_OWNER', permissions = READ_PERMISSIONS, failAlerts = false) {
  const context = await browser.newContext()
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'summary-fixture-test'))
  const requests = []
  const errors = []
  const unknown = []
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    const query = Object.fromEntries(url.searchParams)
    requests.push({ path, query, method: route.request().method() })
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {})
    if (route.request().method() !== 'GET') return json({ detail: 'This test permits GET only.' }, 405)
    if (path === '/api/auth/me') return json({ id: 'owner', fullName: 'Kiểm thử tổng hợp', role, storeName: 'Cửa hàng kiểm thử', canReviewAi: true, status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ role, permissions })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/catalog/categories') return json(categoryTree)
    if (path === '/api/suppliers') return json(paged([{ id: 'supplier-1', name: 'Nhà cung cấp kiểm thử', code: 'NCC-1', isActive: true }], 1, query))
    if (path === '/api/inventory/lots') return json(paged([lot], 73, query))
    if (path === '/api/inventory/stock-summary') return json(paged([{ storeProductId: lot.storeProductId, sku: lot.sku, productName: lot.productName, baseUnit: 'BOTTLE', onHandBaseQuantity: 10, reservedBaseQuantity: 2, availableBaseQuantity: 8, sellableAvailableBaseQuantity: 8, stockValue: 120000, minStockLevelBase: 2, isLowStock: false, nearestExpiryDate: lot.expiryDate, lotCount: 1 }], 1, query))
    if (path === '/api/inventory/alerts' && failAlerts) return json({ title: 'Unavailable', detail: 'Fixture alerts unavailable' }, 503)
    if (path === '/api/inventory/alerts' || path === '/api/stocktakes') return json(paged([], 0, query))
    if (path === '/api/inventory/stock-movements') return json(paged([{ id: 'movement-1', movementNumber: 'SM-API', movementType: 'STOCK_IN', status: 'POSTED', occurredAt: '2026-10-11T00:00:00Z', itemCount: 1 }], 73, query))
    if (path === '/api/me/notifications') return json(paged([{ id: 'notification-1', notificationType: 'SYSTEM', title: 'Thông báo API', message: 'Nội dung kiểm thử', data: null, status: 'UNREAD', readAt: null, createdAt: '2026-10-11T00:00:00Z' }], 73, query))
    if (path === '/api/reports/inventory-valuation') return json(valuation)
    if (path === '/api/reports/inventory-movement') return json({ fromDate: query.fromDate, toDate: query.toDate, rows: [], totals: { openingValue: 80000, stockIn: 50000, returnIn: 0, adjustmentIn: 0, sale: -10000, adjustmentOut: 0, reversal: 0, closingValue: 120000 } })
    if (path === '/api/reports/sales' || path === '/api/reports/revenue') return json({ ...paged([], 0, query), fromDate: query.fromDate, toDate: query.toDate, groupBy: 'DAY', rows: [], totals: salesMetrics })
    if (path === '/api/reports/revenue-summary') return json({ current: salesMetrics, previous: salesMetrics, netSalesChangePercent: 12.5 })
    if (path === '/api/reports/orders') return json({ rows: [], totals: { orderCount: 7, orderValue: 700000 } })
    if (path === '/api/reports/payments') return json({ rows: [], totals: { paymentCount: 5, receivedAmount: 500000, orderPaymentAmount: 450000, debtRepaymentAmount: 50000, refundedAmount: 10000, netReceivedAmount: 490000 } })
    if (path === '/api/reports/purchases') return json({ rows: [], totals: { receiptCount: 2, purchaseAmount: 200000 } })
    if (path === '/api/reports/returns') return json({ rows: [], totals: { returnCount: 3, returnAmount: 30000, debtAdjustmentAmount: 10000, refundAmount: 20000 } })
    if (path === '/api/reports/refunds') return json({ rows: [], totals: { refundCount: 2, refundedAmount: 20000 } })
    if (path === '/api/reports/credit-exposure') return json({ asOf: '2026-10-11T00:00:00Z', rows: [], totals: { creditLimit: 1000000, outstanding: 100000, reservedCredit: 10000, exposure: 110000, availableCredit: 890000 } })
    if (path === '/api/reports/deliveries') return json({ rows: [], failureReasons: [], incidents: [], totals: { deliveries: 12, attempts: 14, successful: 10, partial: 1, failed: 3, successRate: 10 / 14 } })
    if (path === '/api/debt-entries/dashboard') return json({ totalOutstandingDebt: 150000, totalOverdueDebt: 30000, customersWithDebt: 3, customersWithOverdueDebt: 1, collectedToday: 20000, collectedThisMonth: 60000 })
    if (path === '/api/debt-accounts' || path === '/api/debt-entries' || path === '/api/payments') return json(paged([], 0, query))
    if (path === '/api/orders') return json(paged([{ ...order, status: query.status || order.status }], 73, query))
    if (/^\/api\/orders\/.+\/payments$/.test(path)) return json({ orderId: order.id, orderTotal: 250000, paidAmount: 0, refundedAmount: 0, refundableAmount: 0, payments: [], refunds: [] })
    if (/^\/api\/orders\/.+\/refunds$/.test(path)) return json([])
    if (path === '/api/deliveries') return json(paged([], totalsByStatus[query.status] || 0, query))
    if (path === '/api/categories' || path === '/api/active-ingredients') return json(paged([category], 73, query))
    if (path === '/api/ai-models') return json(paged([aiModel], 1, query))
    if (path === '/api/ai-models/model-1/policies') return json([{ id: 'policy-1', aiModelId: aiModel.id, version: '1.0', minimumConfidence: 0.8, minimumMargin: null, topK: 3, requiresHumanReview: true, status: 'ACTIVE', effectiveFrom: '2026-10-01T00:00:00Z', effectiveTo: null }])
    if (path === '/api/catalog/products') return json(paged([{ id: 'store-product', sku: 'SP-API', name: 'Sản phẩm danh mục API', imageUrl: null, categoryId: 'category-child', categoryName: 'Danh mục con', brandName: null, fromPrice: 25000 }], 73, query))
    if (path === '/api/diagnosis-cases') return json(paged([], 0, query))
    if (['/api/returns', '/api/goods-receipts', '/api/suppliers', '/api/customers', '/api/price-lists', '/api/staff', '/api/brands', '/api/units', '/api/products', '/api/store-products', '/api/customer-groups', '/api/credit-tiers', '/api/audit-logs'].includes(path)) return json(paged([], 0, query))
    unknown.push(path)
    return json({ detail: `Unexpected fixture route: ${path}` }, 404)
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  async function check(path) {
    try {
      await page.goto(base + path)
      await page.locator('.agrisage-kpi-card').first().waitFor()
      await page.waitForFunction(() => document.querySelectorAll('.agrisage-kpi-card').length === 4 && [...document.querySelectorAll('[aria-busy]')].every(element => element.getAttribute('aria-busy') !== 'true') && !document.querySelector('.agrisage-kpi-card .animate-pulse'))
      assert.equal(await page.locator('.agrisage-kpi-card').count(), 4, `${path} must render exactly four summary cards`)
      assert.deepEqual(errors, [], `${path} must not throw in the browser`)
      assert.deepEqual(unknown, [], `${path} must use supported fixture APIs`)
      assert.equal(await page.locator('select:not(.agrisage-select)').count(), 0, `${path}: all dropdowns use the shared popup`)
      assert.equal(await page.locator('.agrisage-filter select').evaluateAll(selects => selects.every(select => {
        const caption = select.closest('.agrisage-filter').querySelector('.agrisage-filter-caption')
        if (!caption) return false
        const field = select.getBoundingClientRect()
        const text = caption.getBoundingClientRect()
        return text.top > field.top && text.bottom < field.top + parseFloat(getComputedStyle(select).paddingTop)
      })), true, `${path}: every filter caption stays inside the field, above its value`)
      assert.equal(await page.locator('table').evaluateAll(tables => tables.every(table => [...table.querySelectorAll('th, td, .font-mono')].every(cell => getComputedStyle(cell).fontFamily === getComputedStyle(document.body).fontFamily))), true, `${path}: table text uses the shared font`)
      assert.equal(await page.locator('.sidebar-link:not(.is-active) .material-symbols-outlined.text-primary').count(), 0, `${path}: inactive navigation icons must not be green`)
      if (['/', '/agent', '/sales', '/delivery'].includes(path)) assert.equal(await page.locator('.sidebar-link.is-active').count(), 1, 'The role overview must be active only on its exact route')
      if (process.env.UI_SCREENSHOT_DIR && ['/agent/inventory', '/agent/orders', '/notifications', '/sales/inventory'].includes(path)) await page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, path.replaceAll('/', '-').slice(1) + '.png'), fullPage: true })
      if (process.env.UI_SCREENSHOT_DIR && path === '/agent/returns') await page.locator('.agrisage-list-toolbar').screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'returns-filter.png') })
      console.log(`PASS ${path}: exactly four cards with scoped data`)
    } catch (error) {
      console.error('Failed route:', path, 'Browser errors:', errors, 'Unexpected APIs:', unknown)
      console.error('API requests:', requests)
      console.error('Visible page:', await page.locator('body').innerText())
      throw error
    }
  }
  return { context, page, requests, errors, check }
}

try {
  const owner = await makeSession()
  try {
    for (const path of ['/agent', '/agent/inventory', '/agent/debts', '/agent/deliveries', '/agent/orders', '/agent/payments', '/agent/returns', '/agent/refunds', '/agent/purchases/receipts', '/agent/purchases/suppliers', '/agent/inventory/movements', '/agent/inventory/stocktake', '/agent/ai-recommendations', '/agent/products', '/agent/staff', '/agent/farmers', '/agent/price-lists', '/agent/credit-config', '/agent/activity-log', '/agent/products/reviews', '/notifications']) await owner.check(path)
    assert.equal(owner.requests.filter(request => request.path === '/api/reports/debt-aging' || request.path === '/api/reports/debt-collections').length, 0, 'The debt list must reuse its four operational dashboard totals rather than fetch a second report row')
    // Follow-up UI corrections: visible inner captions, real dropdown filters and accurate navigation.
    await owner.page.setViewportSize({ width: 1440, height: 960 })
    const toolbar = owner.page.locator('.agrisage-list-toolbar')
    const picture = async name => {
      if (process.env.UI_SCREENSHOT_DIR) await toolbar.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, `${name}.png`) })
    }
    for (const path of ['/agent/orders', '/agent/inventory/movements']) {
      await owner.check(path)
      assert.equal(await toolbar.locator('.agrisage-date-filter').count(), 2)
      for (const label of ['Từ ngày', 'Đến ngày']) {
        assert.equal(await toolbar.locator('.agrisage-date-filter .agrisage-filter-caption').filter({ hasText: label }).isVisible(), true)
        assert.equal(await toolbar.getByLabel(label, { exact: true }).evaluate(input => getComputedStyle(input).paddingTop), '22px')
      }
      await picture(path.endsWith('/orders') ? 'corrected-orders-filter' : 'corrected-movements-filter')
    }
    assert.equal(await toolbar.locator('label.uppercase').count(), 0, 'Stock filters must not duplicate outer headings')
    let request = owner.page.waitForRequest(request => new URL(request.url()).pathname === '/api/inventory/stock-movements' && new URL(request.url()).searchParams.get('type') === 'STOCK_IN')
    await toolbar.getByRole('combobox', { name: 'Loại phiếu kho', exact: true }).selectOption('STOCK_IN')
    await request
    await toolbar.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    assert.equal(await toolbar.getByRole('combobox', { name: 'Loại phiếu kho', exact: true }).inputValue(), '')
    console.log('PASS Date filters show inner captions; stock filter headings are not duplicated and the API filter remains working')

    await owner.check('/agent/purchases/receipts')
    await owner.page.waitForFunction(() => !document.querySelector('#receipt-supplier-filter').disabled)
    const supplier = toolbar.getByLabel('Nhà cung cấp', { exact: true })
    assert.equal(await supplier.evaluate(select => {
      const caption = select.closest('.agrisage-filter').querySelector('.agrisage-filter-caption')
      const field = select.getBoundingClientRect()
      return caption.getBoundingClientRect().top > field.top && caption.getBoundingClientRect().bottom < field.top + parseFloat(getComputedStyle(select).paddingTop)
    }), true, 'Supplier caption must be above the selected value, without overlap')
    request = owner.page.waitForRequest(request => new URL(request.url()).pathname === '/api/goods-receipts' && new URL(request.url()).searchParams.get('supplierId') === 'supplier-1')
    await supplier.selectOption('supplier-1')
    await request
    await picture('corrected-supplier-filter')
    console.log('PASS Supplier filter caption/value do not overlap and the selection reaches the API')

    await owner.check('/agent/refunds')
    assert.equal(await toolbar.getByRole('checkbox').count(), 0)
    assert.equal(await toolbar.getByRole('combobox').count(), 3)
    await toolbar.getByRole('combobox', { name: 'Nguồn hoàn tiền', exact: true }).selectOption('returns')
    request = owner.page.waitForRequest(request => new URL(request.url()).pathname === '/api/returns' && new URL(request.url()).searchParams.get('status') === 'COMPLETED')
    await toolbar.getByRole('combobox', { name: 'Phạm vi hoàn tiền', exact: true }).selectOption('all')
    await request
    const sourceStatus = toolbar.getByRole('combobox', { name: 'Lọc trạng thái nguồn hoàn tiền', exact: true })
    assert.equal(await sourceStatus.getByRole('option', { name: 'Hoàn tất', exact: true }).count(), 1)
    await sourceStatus.selectOption('COMPLETED')
    await toolbar.getByRole('combobox', { name: 'Phạm vi hoàn tiền', exact: true }).selectOption('open')
    assert.equal(await sourceStatus.inputValue(), '')
    assert.equal(await sourceStatus.getByRole('option', { name: 'Hoàn tất', exact: true }).count(), 0)
    await toolbar.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    assert.equal(await toolbar.getByRole('combobox', { name: 'Phạm vi hoàn tiền', exact: true }).inputValue(), 'open')
    await picture('corrected-refunds-filter')
    console.log('PASS Refund source/scope/status dropdowns preserve allowed backend states, reset stale status and remove the checkbox')

    await owner.check('/agent/debts')
    assert.equal(await toolbar.getByRole('checkbox').count(), 0)
    request = owner.page.waitForRequest(request => new URL(request.url()).pathname === '/api/debt-accounts' && new URL(request.url()).searchParams.get('OverdueOnly') === 'true')
    await toolbar.getByRole('combobox', { name: 'Tình trạng quá hạn', exact: true }).selectOption('overdue')
    await request
    await toolbar.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    assert.equal(await toolbar.getByRole('combobox', { name: 'Tình trạng quá hạn', exact: true }).inputValue(), 'all')
    await picture('corrected-debt-filter')
    console.log('PASS Debt dropdown sends the existing overdue parameter and clears consistently')

    const debtTabs = owner.page.getByRole('tablist')
    assert.equal(await debtTabs.evaluate(tabs => getComputedStyle(tabs).overflowY), 'visible', 'Debt tabs must not introduce a vertical scrollbar')
    await debtTabs.getByRole('tab', { name: 'Khoản nợ', exact: true }).click()
    if (process.env.UI_SCREENSHOT_DIR) await debtTabs.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'corrected-debt-tabs.png') })

    await owner.check('/agent/payments')
    const paymentStatus = toolbar.getByRole('combobox', { name: 'Trạng thái đơn hàng', exact: true })
    assert.equal(await toolbar.getByRole('combobox').count(), 2, 'Order payments need status and source filters')
    await paymentStatus.click()
    const popup = owner.page.locator('.agrisage-select-menu')
    await popup.waitFor()
    assert.equal(await paymentStatus.getAttribute('aria-expanded'), 'true')
    assert.equal(await popup.getByRole('option', { selected: true }).innerText(), 'Tất cả trạng thái')
    assert.equal(await paymentStatus.evaluate(select => {
      const caption = select.closest('.agrisage-filter').querySelector('.agrisage-filter-caption').getBoundingClientRect()
      const field = select.getBoundingClientRect()
      return caption.top > field.top && caption.bottom < field.top + parseFloat(getComputedStyle(select).paddingTop)
    }), true, 'Order status label sits inside the field above its value')
    if (process.env.UI_SCREENSHOT_DIR) await owner.page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'dropdown-open-desktop.png') })
    request = owner.page.waitForRequest(request => new URL(request.url()).pathname === '/api/orders' && new URL(request.url()).searchParams.get('status') === 'CONFIRMED')
    await popup.getByRole('option', { name: 'Đã xác nhận', exact: true }).click()
    await request
    assert.equal(await paymentStatus.inputValue(), 'CONFIRMED', 'Custom popup dispatches the native form change')
    assert.equal(await popup.count(), 0)
    await paymentStatus.press('Enter')
    await paymentStatus.press('End')
    await paymentStatus.press('Enter')
    assert.equal(await paymentStatus.inputValue(), 'PARTIALLY_CANCELLED', 'Keyboard selection commits the focused option')
    await paymentStatus.press('Enter')
    await paymentStatus.press('Escape')
    assert.equal(await popup.count(), 0)
    assert.equal(await paymentStatus.inputValue(), 'PARTIALLY_CANCELLED', 'Escape leaves the selected value intact')
    await paymentStatus.click()
    await owner.page.getByRole('heading', { name: 'Tổng hợp thanh toán', exact: true }).click()
    assert.equal(await popup.count(), 0, 'Outside clicks dismiss the popup')
    await toolbar.getByRole('combobox', { name: 'Nguồn đơn hàng', exact: true }).selectOption('COUNTER')
    await toolbar.getByLabel('Từ ngày', { exact: true }).fill('2026-10-01')
    request = owner.page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname === '/api/orders' && url.searchParams.get('source') === 'COUNTER' && url.searchParams.get('fromDate') === '2026-10-01' && url.searchParams.get('toDate') === '2026-10-11' && url.searchParams.get('page') === '1'
    })
    await toolbar.getByLabel('Đến ngày', { exact: true }).fill('2026-10-11')
    await request
    await toolbar.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    assert.equal(await paymentStatus.inputValue(), '')
    assert.equal(await toolbar.getByRole('combobox', { name: 'Nguồn đơn hàng', exact: true }).inputValue(), '')
    assert.equal(await toolbar.getByLabel('Từ ngày', { exact: true }).inputValue(), '')
    assert.equal(await toolbar.getByLabel('Đến ngày', { exact: true }).inputValue(), '')
    await picture('corrected-payments-filter')
    console.log('PASS Shared popup: mouse, keyboard, Escape, outside click, label and payment API filters')

    await owner.check('/agent/credit-config')
    const selectedTab = owner.page.getByRole('tab', { selected: true })
    assert.equal(await selectedTab.evaluate(tab => getComputedStyle(tab).color), 'rgb(255, 255, 255)', 'Credit configuration selected tab is green with white text')
    assert.equal(await selectedTab.evaluate(tab => getComputedStyle(tab).backgroundImage.includes('linear-gradient')), true)
    await owner.page.getByRole('tab', { name: 'Hạng tín dụng', exact: true }).click()
    assert.equal(await owner.page.getByRole('tab', { selected: true }).innerText(), 'Hạng tín dụng')
    await owner.check('/agent/activity-log')
    const advanced = owner.page.locator('.agrisage-advanced-filters')
    await advanced.locator('summary').click()
    assert.equal(await advanced.evaluate(panel => getComputedStyle(panel).backgroundColor), 'rgba(252, 255, 248, 0.6)', 'Advanced audit filters match the glass panel')
    if (process.env.UI_SCREENSHOT_DIR) await advanced.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'corrected-audit-filter.png') })
    console.log('PASS Credit tab colors, audit filter surface, scrollbar-free debt tabs and common table fonts')

    await owner.page.setViewportSize({ width: 390, height: 844 })
    for (const path of ['/agent/orders', '/agent/purchases/receipts', '/agent/refunds', '/agent/inventory/movements', '/agent/debts', '/agent/payments']) {
      await owner.check(path)
      assert.equal(await owner.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path}: filters fit the phone width`)
    }
    await toolbar.getByRole('combobox', { name: 'Trạng thái đơn hàng', exact: true }).click()
    assert.equal(await owner.page.locator('.agrisage-select-menu').evaluate(menu => { const rect = menu.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight }), true, 'Mobile popup fits the viewport')
    if (process.env.UI_SCREENSHOT_DIR) await owner.page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'dropdown-open-mobile.png') })
    await toolbar.getByRole('combobox', { name: 'Trạng thái đơn hàng', exact: true }).press('Escape')
    await picture('corrected-payments-filter-mobile')
    await owner.page.setViewportSize({ width: 1280, height: 720 })
    console.log('PASS Corrected filters fit desktop and mobile; all four roles have exact overview activation')
    for (const [path, placeholder, rows, totalLabel] of [
      ['/agent/inventory/movements', 'Tìm mã, loại phiếu trong trang hiện tại...', 'main table tbody tr', '73 phiếu kho'],
      ['/notifications', 'Tìm trong trang hiện tại...', 'article[data-notification-id]', '73'],
    ]) {
      await owner.page.goto(base + path)
      const search = owner.page.getByPlaceholder(placeholder)
      await search.waitFor()
      await owner.page.locator(rows).first().waitFor()
      const endpoint = path === '/notifications' ? '/api/me/notifications' : '/api/inventory/stock-movements'
      const before = owner.requests.filter(request => request.path === endpoint).length
      await search.fill('không khớp')
      await owner.page.getByText(/Không có .*phù hợp trong trang hiện tại|Không có thông báo khớp từ khóa trên trang này/).waitFor()
      assert.match(await owner.page.locator('main').innerText(), new RegExp(totalLabel))
      assert.equal(owner.requests.filter(request => request.path === endpoint).length, before, 'Current-page search must not send unsupported backend Search')
      await owner.page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
      await owner.page.locator(rows).first().waitFor()
    }
    console.log('PASS Local search preserves server totals and clears consistently for notifications and movements')
    await owner.page.goto(base + '/agent/inventory/reports')
    await owner.page.getByRole('combobox').first().waitFor()
    await owner.page.getByRole('combobox').first().selectOption('category-child')
    await owner.page.waitForFunction(() => document.querySelector('.agrisage-summary-grid')?.getAttribute('aria-busy') === 'false')
    assert.equal(await owner.page.locator('.agrisage-kpi-card').count(), 4)
    assert(owner.requests.some(request => request.path === '/api/reports/inventory-movement' && request.query.categoryId === 'category-child'), 'Child categories must be selectable and forwarded to the report API')
    await owner.page.getByRole('tab', { name: 'Định giá kho', exact: true }).click()
    await owner.page.waitForFunction(() => document.querySelector('.agrisage-summary-grid')?.getAttribute('aria-busy') === 'false')
    assert.equal(await owner.page.locator('.agrisage-kpi-card').count(), 4, 'Valuation must not create one card per category')
    console.log('PASS Child-category filters and both inventory report tabs retain four cards')
  } finally { await owner.context.close() }

  const admin = await makeSession('ADMIN')
  try { for (const path of ['/', '/admin/products/categories', '/admin/products/ingredients', '/admin/ai/models', '/admin/ai/policies', '/admin/accounts', '/admin/articles', '/admin/audit-logs']) await admin.check(path) } finally { await admin.context.close() }

  const sales = await makeSession('SALES_STAFF', READ_PERMISSIONS.filter(code => code !== 'REPORTS.READ'))
  try {
    for (const path of ['/sales', '/sales/products', '/sales/inventory', '/sales/debts']) await sales.check(path)
    assert.equal(sales.requests.filter(request => request.path.startsWith('/api/reports/')).length, 0, 'Report placeholders must not request denied report APIs')
    assert.equal(sales.requests.filter(request => request.path === '/api/catalog/products' && request.query.pageSize === '100').length, 0, 'Inventory must use product names from inventory lots instead of an extra catalog page')
    await sales.page.goto(base + '/sales')
    await sales.page.getByText('ORD-API', { exact: true }).waitFor()
    const summary = sales.page.locator('.agrisage-summary-grid')
    assert.match(await summary.innerText(), /73/, 'Total results must use backend totalCount beyond the visible five orders')
    assert.match(await summary.innerText(), /Trong 5 đơn gần nhất/, 'Page-only metrics must disclose their scope')
    assert(!/mẫu|823\.500|15\.2%/.test(await sales.page.locator('body').innerText()), 'Operational dashboards must not show hard-coded mock values')
    console.log('PASS Permission placeholders, true totals and honest visible-page metrics')
  } finally { await sales.context.close() }

  const driver = await makeSession('DELIVERY_STAFF', ['DELIVERIES.READ'])
  try {
    await driver.check('/delivery')
    const cards = driver.page.locator('.agrisage-kpi-card')
    assert.match(await cards.nth(0).innerText(), /31/, 'Driver count must use totalCount, not the first page size')
    assert.match(await cards.nth(2).innerText(), /5/, 'Retry statuses must be added from true backend totals')
    assert.match(await cards.nth(3).innerText(), /73/, 'Completed trips must include rows beyond the first page')
    await driver.check('/delivery/deliveries')
    console.log('PASS Driver totals include every assigned trip rather than the first API page')
  } finally { await driver.context.close() }

  const unavailable = await makeSession('STORE_OWNER', READ_PERMISSIONS, true)
  try {
    await unavailable.check('/agent/inventory')
    await unavailable.page.getByText('Chưa có số liệu cảnh báo', { exact: true }).waitFor()
    assert.equal(await unavailable.page.locator('.agrisage-kpi-card').getByText('—', { exact: true }).count(), 3, 'Failed alerts must not show fabricated zeros or endless loading dots')
    console.log('PASS Unavailable inventory alerts remain unknown instead of reporting zero')
  } finally { await unavailable.context.close() }
  console.log('PASS Summary consistency suite: all API traffic mocked, no browser errors')
} finally { await browser.close() }
