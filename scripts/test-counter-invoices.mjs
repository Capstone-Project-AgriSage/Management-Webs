import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// All API traffic is mocked; no sale is sent to a real store backend.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const errors = []
const permissions = ['COUNTER_SALES.SELL', 'COUNTER_SALES.PREVIEW', 'ORDERS.CREATE', 'ORDERS.READ', 'PAYMENTS.READ']
const time = '2026-11-23T03:15:00Z'
const product = { id: 'product-1', storeProductId: 'store-product-1', sku: 'SP-001', name: 'Phân bón kiểm thử', imageUrl: null, categoryId: 'category-1', categoryName: 'Phân bón', brandName: null, fromPrice: 100000 }
const packaging = { id: 'pack-1', unitName: 'Bao', symbol: 'bao', packagingName: 'Bao 25 kg', conversionToBase: 25, isBaseUnit: false, barcode: null, price: 100000 }
const paged = items => ({ items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1 })
const makeOrder = (id, body, status = 'COMPLETED') => ({
  id, orderNumber: `DH-${id}`, source: 'COUNTER', customerType: 'WALK_IN', farmerProfileId: null,
  customerName: body.customerName || 'Khách lẻ', customerPhone: body.customerPhone || null,
  customerGroupId: null, priceListId: 'price-1', settlementType: 'FULL_PAYMENT', creditTermDays: null,
  fulfillmentType: 'PICKUP', deliveryAddress: null, status, subtotalAmount: 180000, totalAmount: 180000,
  note: body.note || null, createdBy: 'staff-1', createdAt: time, completedAt: status === 'COMPLETED' ? time : null,
  version: 1, items: [{ id: `item-${id}`, storeProductId: product.storeProductId, productPackagingId: packaging.id,
    sku: product.sku, productName: product.name, packagingName: packaging.packagingName, quantity: 2,
    conversionToBase: 25, baseQuantity: 50, suggestedUnitPrice: 100000, unitPrice: 90000, lineTotalAmount: 180000,
    priceOverridden: true, overrideReason: 'Giá được máy chủ chấp nhận', overriddenBy: 'staff-1',
    fulfilledBaseQuantity: status === 'COMPLETED' ? 50 : 0, cancelledBaseQuantity: 0,
    remainingBaseQuantity: status === 'COMPLETED' ? 0 : 50, status: status === 'COMPLETED' ? 'FULFILLED' : 'PENDING' }],
})

async function session(role = 'SALES_STAFF') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    localStorage.setItem('agrisage_token', 'counter-invoice-test')
    window.invoicePrintCalls = 0
    window.print = () => {
      window.invoicePrintCalls++
      if (window.invoicePrintFails) throw new Error('Print unavailable')
    }
  })
  const state = { orders: [], receipts: [], requests: [], failSale: false }
  await context.route('**/api/**', async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    const method = req.method()
    if (path === '/api/realtime/negotiate') return route.abort()
    const body = req.postData() ? JSON.parse(req.postData()) : null
    state.requests.push({ path, method, body })
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (path === '/api/auth/me') return json({ id: 'staff-1', fullName: 'Nhân viên kiểm thử', role, status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ permissions })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/me/notifications') return json(paged([]))
    if (path === '/api/catalog/categories') return json([])
    if (path === '/api/catalog/products') return json(paged([product]))
    if (path === `/api/catalog/products/${product.id}`) return json({ ...product, packagings: [packaging], ingredients: [] })
    if (path === '/api/reports/counter-sales-today') return json({ date: '2026-11-23', asOf: time, paidSalesRevenue: 0, completedOrderCount: 0, receivedAmount: 0, creditSalesAmount: 0 })
    if (path === '/api/counter-sales/preview') return json({ customerGroupId: null, priceListId: 'price-1', totalAmount: 200000,
      items: [{ storeProductId: product.storeProductId, productPackagingId: packaging.id, sku: product.sku,
        productName: product.name, packagingName: packaging.packagingName, quantity: 2, conversionToBase: 25,
        baseQuantity: 50, suggestedUnitPrice: 100000, unitPrice: 100000, lineTotalAmount: 200000,
        shortageBaseQuantity: 0, lots: [{ inventoryLotId: 'lot-1', lotNumber: 'LOT-1', expiryDate: '2027-12-31', availableBaseQuantity: 1000, suggestedBaseQuantity: 50 }] }] })
    if (path === '/api/counter-sales' && method === 'POST') {
      if (state.failSale) return json({ title: 'Không đủ hàng', detail: 'Tồn kho đã thay đổi, vui lòng kiểm tra lại.' }, 422)
      const order = makeOrder(String(state.orders.length + 1), body)
      const payment = { id: `payment-${order.id}`, paymentNumber: `PT-${order.id}`, paymentContext: 'ORDER_PAYMENT',
        paymentMethod: 'CASH', status: 'PAID', amount: order.totalAmount, payerName: order.customerName,
        confirmedAt: time, initiatedAt: time, currency: 'VND', allocations: [] }
      state.orders.push(order); state.receipts.push(payment)
      return json({ order, payment }, 201)
    }
    if (path === '/api/orders' && method === 'POST') {
      const order = makeOrder(String(state.orders.length + 1), body, 'PENDING_CONFIRMATION')
      state.orders.push(order)
      return json(order, 201)
    }
    if (path === '/api/orders') return json(paged(state.orders.map(order => ({ ...order, items: [] }))))
    const orderMatch = path.match(/^\/api\/orders\/([^/]+)(\/payments)?$/)
    if (orderMatch) {
      const order = state.orders.find(item => item.id === orderMatch[1])
      if (!order) return json({ title: 'Not found' }, 404)
      if (!orderMatch[2]) return json(order)
      const receipts = state.receipts.filter(payment => payment.id === `payment-${order.id}`)
      const paidAmount = receipts.filter(payment => payment.status === 'PAID').reduce((sum, payment) => sum + payment.amount, 0)
      return json({ orderId: order.id, orderTotal: order.totalAmount, paidAmount,
        remainingToPay: Math.max(0, order.totalAmount - paidAmount), availablePrepayment: 0, consumedPrepayment: paidAmount,
        payments: receipts, refunds: [] })
    }
    errors.push(`Unexpected request: ${method} ${path}`)
    return json({ title: 'Unexpected test request' }, 500)
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(10000)
  return { context, page, state, area: role === 'STORE_OWNER' ? 'agent' : 'sales' }
}

async function prepare({ page, area }) {
  await page.goto(`${base}/${area}/counter-sales`)
  await page.locator('.agrisage-counter-product').click()
  await page.getByLabel(`Số lượng ${product.name}`, { exact: true }).fill('2')
  await page.getByLabel('Tên khách lẻ', { exact: true }).fill('Nguyễn Văn <img src=x onerror=alert(1)>')
  await page.getByLabel('SĐT khách lẻ', { exact: true }).fill('0901234567')
  await page.getByLabel('Ghi chú đơn hàng').fill('Giao hàng cẩn thận <script>alert(1)</script>')
  await page.getByRole('button', { name: 'BÁN NHANH', exact: true }).click()
  await page.getByRole('heading', { name: 'Xác nhận thanh toán', exact: true }).waitFor()
}
const invoiceDialog = page => page.getByRole('dialog', { name: /^Hóa đơn bán hàng/ })
const prints = page => page.evaluate(() => window.invoicePrintCalls)
const saleCount = state => state.requests.filter(req => req.path === '/api/counter-sales' && req.method === 'POST').length

try {
  const sale = await session()
  await prepare(sale)
  assert.equal(await sale.page.getByRole('radio', { name: 'Không in hóa đơn', exact: true }).isChecked(), true)
  await sale.page.getByRole('button', { name: 'XÁC NHẬN & THU TIỀN', exact: true }).click()
  await sale.page.getByRole('heading', { name: 'Đã bán và thu tiền', exact: true }).waitFor()
  assert.equal(await prints(sale.page), 0)
  assert.equal(sale.state.orders.length, 1)
  assert.equal(await invoiceDialog(sale.page).count(), 0)
  await sale.page.getByRole('button', { name: 'Xem / In hóa đơn', exact: true }).click()
  let dialog = invoiceDialog(sale.page)
  await dialog.waitFor()
  assert.match(await dialog.innerText(), /180\.000 đ/)
  assert.match(await dialog.innerText(), /90\.000 đ/)
  assert.doesNotMatch(await dialog.innerText(), /200\.000 đ/)
  assert.match(await dialog.innerText(), /23\/11\/2026 10:15/)
  assert.match(await dialog.innerText(), /0901234567/)
  assert.match(await dialog.innerText(), /PT-1 · Tiền mặt/)
  assert.equal(await dialog.locator('script, img').count(), 0, 'Customer text must not become HTML')
  await dialog.getByRole('button', { name: 'In hóa đơn', exact: true }).click()
  assert.equal(await prints(sale.page), 1)
  assert.equal(saleCount(sale.state), 1, 'Printing does not repeat the sale')
  await sale.page.emulateMedia({ media: 'print' })
  assert.equal(await sale.page.locator('#root').isVisible(), false)
  assert.equal(await sale.page.locator('.modal-overlay').isVisible(), false)
  assert.equal(await sale.page.locator('.sales-invoice-print').isVisible(), true)
  const printedRows = await sale.page.locator('.sales-invoice-print tbody tr').count()
  assert.equal(printedRows, 1)
  await sale.page.emulateMedia({ media: 'screen' })
  await sale.page.evaluate(() => { window.invoicePrintFails = true })
  await dialog.getByRole('button', { name: 'In hóa đơn', exact: true }).click()
  await dialog.getByRole('alert').waitFor()
  assert.equal(saleCount(sale.state), 1)
  await sale.page.evaluate(() => { window.invoicePrintFails = false })
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click()
  assert.equal(await sale.page.locator('.sales-invoice-print').count(), 0)
  console.log('PASS No-print sale, saved server prices, safe text, isolated printing, print failure and no duplicate sale')

  await sale.page.getByRole('button', { name: 'Xem đơn', exact: true }).click()
  const detail = sale.page.getByRole('dialog', { name: 'Chi tiết đơn hàng', exact: true })
  await detail.getByRole('button', { name: 'Xem / In hóa đơn', exact: true }).click()
  dialog = invoiceDialog(sale.page)
  await dialog.waitFor()
  assert.match(await dialog.innerText(), /DH-1/)
  assert.match(await dialog.innerText(), /180\.000 đ/)
  assert.equal(await prints(sale.page), 2, 'Opening a saved invoice does not automatically print')
  const writesBefore = sale.state.requests.filter(req => req.method === 'POST').length
  await dialog.getByRole('button', { name: 'In hóa đơn', exact: true }).click()
  assert.equal(await prints(sale.page), 3)
  assert.equal(sale.state.requests.filter(req => req.method === 'POST').length, writesBefore)
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click()
  assert.equal(await detail.isVisible(), true)
  console.log('PASS Reopen and reprint the saved invoice from order history without writes')

  const auto = await session('STORE_OWNER')
  await prepare(auto)
  await auto.page.getByRole('radio', { name: 'In hóa đơn sau thanh toán', exact: true }).check()
  await auto.page.getByRole('button', { name: 'THU TIỀN & IN HÓA ĐƠN', exact: true }).click()
  await invoiceDialog(auto.page).waitFor()
  await auto.page.waitForFunction(() => window.invoicePrintCalls === 1)
  assert.equal(saleCount(auto.state), 1)
  assert.equal(auto.state.receipts.length, 1)
  await invoiceDialog(auto.page).getByRole('button', { name: 'Đóng', exact: true }).last().click()
  await auto.page.getByRole('button', { name: 'Xem / In hóa đơn', exact: true }).click()
  assert.equal(await prints(auto.page), 1, 'Reopening must not repeat automatic printing')
  console.log('PASS Owner sale prints once after success; closing/cancelling print preserves the completed sale')

  await auto.page.setViewportSize({ width: 390, height: 844 })
  dialog = invoiceDialog(auto.page)
  assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
  assert.equal(await dialog.locator('.sales-invoice').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
  if (process.env.UI_SCREENSHOT_DIR) {
    await mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true })
    await auto.page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'counter-invoice-mobile.png') })
    await auto.page.setViewportSize({ width: 1440, height: 1000 })
    await auto.page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'counter-invoice-desktop.png') })
  }
  console.log('PASS Invoice layout fits desktop and mobile screens')

  auto.state.orders[0].settlementType = 'CREDIT'
  auto.state.receipts[0].amount = 60000
  await auto.page.goto(`${base}/agent/orders?open=1`)
  await auto.page.getByRole('dialog', { name: 'Chi tiết đơn hàng', exact: true }).getByRole('button', { name: 'Xem / In hóa đơn', exact: true }).click()
  dialog = invoiceDialog(auto.page)
  await dialog.waitFor()
  assert.match(await dialog.innerText(), /Mua chịu/)
  assert.match(await dialog.innerText(), /60\.000 đ/)
  assert.match(await dialog.innerText(), /120\.000 đ/)
  assert.equal(await prints(auto.page), 0, 'Loading history must not automatically print')
  console.log('PASS Completed credit orders show the server payment balance accurately')

  const failed = await session()
  failed.state.failSale = true
  await prepare(failed)
  await failed.page.getByRole('radio', { name: 'In hóa đơn sau thanh toán', exact: true }).check()
  await failed.page.getByRole('button', { name: 'THU TIỀN & IN HÓA ĐƠN', exact: true }).click()
  await failed.page.getByRole('alert').filter({ hasText: 'Tồn kho đã thay đổi' }).waitFor()
  assert.equal(await prints(failed.page), 0)
  assert.equal(await invoiceDialog(failed.page).count(), 0)
  assert.equal(failed.state.orders.length, 0)
  console.log('PASS Failed checkout neither opens nor prints an invoice')

  const pending = await session()
  await pending.page.goto(`${base}/sales/counter-sales`)
  await pending.page.locator('.agrisage-counter-product').click()
  await pending.page.getByRole('button', { name: 'TẠO ĐƠN', exact: true }).click()
  await pending.page.getByRole('heading', { name: 'Đã tạo đơn hàng', exact: true }).waitFor()
  assert.equal(await pending.page.getByRole('button', { name: 'Xem / In hóa đơn', exact: true }).count(), 0)
  assert.equal(await prints(pending.page), 0)
  await pending.page.getByRole('button', { name: 'Mở đơn để xử lý', exact: true }).click()
  await pending.page.getByRole('dialog', { name: 'Chi tiết đơn hàng', exact: true }).waitFor()
  assert.equal(await pending.page.getByRole('button', { name: 'Xem / In hóa đơn', exact: true }).count(), 0)
  console.log('PASS Pending orders are not presented as completed invoices')
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
