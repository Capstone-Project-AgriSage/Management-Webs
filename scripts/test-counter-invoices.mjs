import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// All API traffic is mocked; no sale is sent to a real store backend.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const errors = []
const permissions = ['COUNTER_SALES.SELL', 'COUNTER_SALES.PREVIEW', 'ORDERS.CREATE', 'ORDERS.READ', 'PAYMENTS.READ', 'INVOICES.READ', 'INVOICES.CREATE', 'INVOICES.SEND_EMAIL']
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

async function session(role = 'SALES_STAFF', grantedPermissions = permissions) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    localStorage.setItem('agrisage_token', 'counter-invoice-test')
    window.invoicePrintCalls = 0
    window.print = () => {
      window.invoicePrintCalls++
      if (window.invoicePrintFails) throw new Error('Print unavailable')
    }
  })
  const state = { orders: [], receipts: [], invoices: [], emails: [], requests: [], failSale: false, failInvoice: false, failEmail: false, failInvoiceList: false, holdEmail: false, releaseEmail: null }
  await context.route('**/api/**', async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    const method = req.method()
    if (path === '/api/realtime/negotiate') return route.abort()
    const body = req.postData() ? JSON.parse(req.postData()) : null
    state.requests.push({ path, method, body, query: Object.fromEntries(new URL(req.url()).searchParams) })
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (path === '/api/auth/me') return json({ id: 'staff-1', fullName: 'Nhân viên kiểm thử', role, status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ permissions: grantedPermissions })
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
    const issue = path.match(/^\/api\/orders\/([^/]+)\/invoice$/)
    if (issue) {
      if (state.failInvoice) return json({ title: 'Invoice unavailable', detail: 'Chưa lưu được hóa đơn kiểm thử.' }, 503)
      const order = state.orders.find(order => order.id === issue[1])
      if (!order || order.status !== 'COMPLETED') return json({ title: 'Order not completed' }, 422)
      const existing = state.invoices.find(invoice => invoice.orderId === order.id)
      if (existing) return json(existing)
      const receipts = state.receipts.filter(payment => payment.id === `payment-${order.id}`)
      const paidAmount = receipts.reduce((sum, payment) => sum + payment.amount, 0)
      const invoice = { id: `invoice-${order.id}`, invoiceNumber: `INV-${order.id}`, orderId: order.id, orderNumber: order.orderNumber,
        customerName: order.customerName, customerEmail: 'customer@example.test', totalAmount: order.totalAmount, issuedAt: time,
        snapshot: { version: 1, store: { name: 'Cửa hàng kiểm thử', address: 'Thới Lai, Cần Thơ', phone: '02923891234', taxCode: null, email: null }, cashierName: 'Nhân viên kiểm thử',
          order: structuredClone(order), payments: { orderId: order.id, paidAmount, remainingToPay: Math.max(0, order.totalAmount - paidAmount), payments: structuredClone(receipts), refunds: [] } } }
      state.invoices.push(invoice)
      return json(invoice, 201)
    }
    if (path === '/api/invoices') {
      if (state.failInvoiceList) return json({ title: 'Invoice list unavailable', detail: 'Không tải được danh sách kiểm thử.' }, 503)
      const query = new URL(req.url()).searchParams
      const search = (query.get('search') || '').toLowerCase()
      const items = state.invoices.map(invoice => ({ ...invoice, emailStatus: state.emails.find(email => email.invoiceId === invoice.id)?.status || 'NOT_SENT' })).filter(invoice => {
        const day = new Date(new Date(invoice.issuedAt).getTime() + 7 * 3600000).toISOString().slice(0, 10)
        return (!query.get('orderId') || invoice.orderId === query.get('orderId')) && [invoice.invoiceNumber, invoice.orderNumber, invoice.customerName].some(value => value.toLowerCase().includes(search))
          && (!query.get('fromDate') || day >= query.get('fromDate')) && (!query.get('toDate') || day <= query.get('toDate'))
          && (!query.get('minAmount') || invoice.totalAmount >= Number(query.get('minAmount'))) && (!query.get('maxAmount') || invoice.totalAmount <= Number(query.get('maxAmount')))
          && (!query.has('hasCustomerEmail') || Boolean(invoice.customerEmail?.trim()) === (query.get('hasCustomerEmail') === 'true'))
          && (!query.get('emailStatus') || invoice.emailStatus === query.get('emailStatus'))
      })
      const page = Number(query.get('page') || 1)
      const pageSize = Number(query.get('pageSize') || 10)
      return json({ items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: items.length, totalPages: Math.ceil(items.length / pageSize) })
    }
    const invoiceMatch = path.match(/^\/api\/invoices\/([^/]+)(?:\/(pdf|emails))?$/)
    if (invoiceMatch) {
      const invoice = state.invoices.find(invoice => invoice.id === invoiceMatch[1])
      if (!invoice) return json({ title: 'Not found' }, 404)
      if (invoiceMatch[2] === 'pdf') return route.fulfill({ contentType: 'application/pdf', headers: { 'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"` }, body: '%PDF-1.7 mock saved invoice' })
      if (invoiceMatch[2] === 'emails') {
        if (method === 'GET') return json(paged(state.emails.filter(email => email.invoiceId === invoice.id)))
        let email = state.emails.find(email => email.requestId === body.requestId && email.invoiceId === invoice.id)
        if (!email) {
          email = { id: `email-${state.emails.length + 1}`, invoiceId: invoice.id, requestId: body.requestId, recipient: body.recipient,
            status: state.failEmail ? 'FAILED' : 'SENT', createdAt: time, sentAt: state.failEmail ? null : time,
            error: state.failEmail ? 'Không gửi được email kiểm thử.' : null }
          state.emails.unshift(email)
        }
        if (state.holdEmail) await new Promise(resolve => { state.releaseEmail = resolve })
        return json(email)
      }
      return json(invoice)
    }
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
  await sale.page.getByText('Đã lưu hóa đơn INV-1.', { exact: true }).waitFor()
  assert.equal(await prints(sale.page), 0)
  assert.equal(sale.state.orders.length, 1)
  assert.equal(await invoiceDialog(sale.page).count(), 0)
  await sale.page.getByRole('button', { name: 'Xem / In hóa đơn', exact: true }).click()
  let dialog = invoiceDialog(sale.page)
  await dialog.waitFor()
  await dialog.getByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG', exact: true }).waitFor()
  assert.match(await dialog.innerText(), /180\.000 đ/)
  assert.match(await dialog.innerText(), /90\.000 đ/)
  assert.doesNotMatch(await dialog.innerText(), /200\.000 đ/)
  assert.match(await dialog.innerText(), /23\/11\/2026 10:15/)
  assert.match(await dialog.innerText(), /0901234567/)
  assert.match(await dialog.innerText(), /PT-1 · Tiền mặt/)
  assert.equal(await dialog.locator('script, img').count(), 0, 'Customer text must not become HTML')
  const downloaded = sale.page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Tải PDF', exact: true }).click()
  assert.equal((await downloaded).suggestedFilename(), 'INV-1.pdf')
  await dialog.getByRole('textbox', { name: 'Email nhận hóa đơn', exact: true }).fill('receiver@example.test')
  await dialog.getByRole('button', { name: 'Gửi email', exact: true }).click()
  await dialog.getByText('Đã gửi hóa đơn tới receiver@example.test.', { exact: true }).waitFor()
  assert.equal(sale.state.emails.length, 1)
  assert.match(sale.state.emails[0].requestId, /^[0-9a-f-]{36}$/)
  sale.state.failEmail = true
  await dialog.getByRole('button', { name: 'Gửi email', exact: true }).click()
  await dialog.getByRole('alert').filter({ hasText: 'Không gửi được email kiểm thử.' }).waitFor()
  assert.equal(sale.state.emails.length, 2)
  sale.state.failEmail = false
  console.log('PASS Saved PDF download, email recipient, send history and honest email failure')
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
  await dialog.getByRole('alert').filter({ hasText: 'Không mở được hộp thoại in' }).waitFor()
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
  await dialog.getByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG', exact: true }).waitFor()
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

  await sale.page.goto(`${base}/sales/invoices`)
  await sale.page.getByRole('button', { name: 'Thao tác hóa đơn INV-1', exact: true }).click()
  await sale.page.getByRole('menuitem', { name: 'Xem / In hóa đơn', exact: true }).click()
  await invoiceDialog(sale.page).getByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG', exact: true }).waitFor()
  assert.equal(sale.state.invoices.length, 1)
  assert.equal(sale.state.requests.filter(req => /\/invoice$/.test(req.path) && req.method === 'POST').length, 1, 'History does not reissue invoices')
  console.log('PASS Invoice history reloads persisted records without reissuing')

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
  await dialog.getByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG', exact: true }).waitFor()
  assert.match(await dialog.innerText(), /Trả đủ/)
  assert.match(await dialog.innerText(), /180\.000 đ/)
  assert.doesNotMatch(await dialog.innerText(), /60\.000 đ/)
  assert.equal(await prints(auto.page), 0, 'Loading history must not automatically print')
  console.log('PASS Issued invoice keeps its original snapshot after later order/payment changes')

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

  const history = await session('STORE_OWNER')
  history.state.invoices = Array.from({ length: 12 }, (_, index) => ({
    ...structuredClone(sale.state.invoices[0]), id: `grid-${index + 1}`, invoiceNumber: `INV-GRID-${index + 1}`,
    customerName: `Khách hàng số ${index + 1}`, customerEmail: index % 2 ? 'customer@example.test' : null, totalAmount: (index + 1) * 1000,
  }))
  await history.page.goto(`${base}/agent/invoices`)
  const summary = history.page.getByRole('region', { name: 'Tổng hợp hóa đơn', exact: true })
  await summary.getByText('55.000 đ', { exact: true }).waitFor()
  assert.equal(await summary.locator('.agrisage-kpi-card').count(), 4)
  await summary.getByText('12', { exact: true }).waitFor()
  await history.page.getByRole('button', { name: 'Trang 2', exact: true }).click()
  await history.page.getByRole('button', { name: 'INV-GRID-12', exact: true }).waitFor()
  await summary.getByText('23.000 đ', { exact: true }).waitFor()
  await summary.getByText('12', { exact: true }).waitFor()
  await history.page.getByRole('button', { name: 'INV-GRID-12', exact: true }).click()
  dialog = invoiceDialog(history.page)
  await dialog.getByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG', exact: true }).waitFor()
  const footer = await dialog.locator('.modal-footer').boundingBox()
  assert.ok(footer.y >= 0 && footer.y + footer.height <= 1000, 'Invoice footer stays inside the viewport')
  await history.page.keyboard.press('Escape')
  assert.equal(await history.page.getByRole('button', { name: 'Trang 2', exact: true }).getAttribute('aria-current'), 'page')
  const search = history.page.getByPlaceholder('Tìm mã hóa đơn, mã đơn hoặc khách hàng...')
  await search.fill('INV-GRID-12')
  await summary.getByText('12.000 đ', { exact: true }).first().waitFor()
  await history.page.getByRole('button', { name: 'Thao tác hóa đơn INV-GRID-12', exact: true }).click()
  await history.page.getByRole('menuitem', { name: 'Gửi email', exact: true }).click()
  dialog = invoiceDialog(history.page)
  const recipient = dialog.getByRole('textbox', { name: 'Email nhận hóa đơn', exact: true })
  await recipient.waitFor()
  await history.page.waitForFunction(() => document.activeElement?.id === 'invoice-email-grid-12')
  history.state.holdEmail = true
  await recipient.fill('receiver@example.test')
  await dialog.getByRole('button', { name: 'Gửi email', exact: true }).click()
  await history.page.waitForFunction(() => document.querySelector('.modal-close')?.disabled === true)
  assert.equal(await dialog.locator('.modal-footer').getByRole('button', { name: 'Đóng', exact: true }).isDisabled(), true)
  await history.page.keyboard.press('Escape')
  assert.equal(await dialog.isVisible(), true, 'Cannot close while sending email')
  assert.ok(history.state.releaseEmail)
  history.state.releaseEmail()
  history.state.holdEmail = false
  await dialog.getByText('Đã gửi hóa đơn tới receiver@example.test.', { exact: true }).waitFor()
  await dialog.locator('.modal-footer').getByRole('button', { name: 'Đóng', exact: true }).click()
  assert.equal(await search.inputValue(), 'INV-GRID-12', 'Closing the invoice preserves list filters')
  await history.page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
  await summary.getByText('55.000 đ', { exact: true }).waitFor()
  if (process.env.UI_SCREENSHOT_DIR) await history.page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'invoices-list-desktop.png') })
  await history.page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await history.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Invoice list fits mobile width')
  if (process.env.UI_SCREENSHOT_DIR) await history.page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'invoices-list-mobile.png') })
  await history.page.getByRole('button', { name: 'INV-GRID-1', exact: true }).click()
  dialog = invoiceDialog(history.page)
  await dialog.getByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG', exact: true }).waitFor()
  assert.equal(await dialog.locator('.modal-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'Invoice content fits mobile width')
  if (process.env.UI_SCREENSHOT_DIR) await history.page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'invoices-popup-mobile.png') })
  await history.page.keyboard.press('Escape')
  history.state.failInvoiceList = true
  await history.page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await history.page.getByRole('alert').filter({ hasText: 'Không tải được danh sách kiểm thử.' }).waitFor()
  assert.equal(await summary.getByText('—', { exact: true }).count(), 4, 'Failed requests do not display stale totals')
  history.state.failInvoiceList = false
  await history.page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await summary.getByText('55.000 đ', { exact: true }).waitFor()
  await history.page.setViewportSize({ width: 1440, height: 1000 })
  const emailFilter = history.page.getByRole('combobox', { name: 'Email khách hàng', exact: true })
  const statusFilter = history.page.getByRole('combobox', { name: 'Trạng thái email gần nhất', exact: true })
  await history.page.getByRole('button', { name: 'Trang 2', exact: true }).click()
  await history.page.getByRole('button', { name: 'INV-GRID-12', exact: true }).waitFor()
  await emailFilter.selectOption('false')
  await summary.locator('.agrisage-kpi-card').first().getByText('6', { exact: true }).waitFor()
  assert.equal(await history.page.getByRole('button', { name: 'Trang 1', exact: true }).getAttribute('aria-current'), 'page')
  const lastListQuery = () => history.state.requests.filter(request => request.path === '/api/invoices').at(-1).query
  assert.equal(lastListQuery().hasCustomerEmail, 'false', 'Missing-email filter is sent as false, not omitted')
  await emailFilter.selectOption('true')
  await summary.locator('.agrisage-kpi-card').first().getByText('6', { exact: true }).waitFor()
  await statusFilter.selectOption('SENT')
  await history.page.getByRole('button', { name: 'INV-GRID-12', exact: true }).waitFor()
  assert.equal(await history.page.getByRole('region', { name: 'Danh sách hóa đơn', exact: true }).locator('tbody tr').count(), 1)
  await history.page.getByRole('textbox', { name: 'Ngày lập từ', exact: true }).fill('23/11/2026')
  await history.page.getByRole('textbox', { name: 'Ngày lập từ', exact: true }).press('Tab')
  await history.page.getByRole('textbox', { name: 'Ngày lập đến', exact: true }).fill('23/11/2026')
  await history.page.getByRole('textbox', { name: 'Ngày lập đến', exact: true }).press('Tab')
  await history.page.getByRole('spinbutton', { name: 'Tổng tiền từ (đ)', exact: true }).fill('12000')
  await history.page.getByRole('spinbutton', { name: 'Tổng tiền đến (đ)', exact: true }).fill('12000')
  await history.page.getByRole('button', { name: 'INV-GRID-12', exact: true }).waitFor()
  assert.deepEqual(lastListQuery(), { page: '1', pageSize: '10', fromDate: '2026-11-23', toDate: '2026-11-23', minAmount: '12000', maxAmount: '12000', hasCustomerEmail: 'true', emailStatus: 'SENT' })
  await history.page.getByRole('button', { name: 'INV-GRID-12', exact: true }).click()
  await invoiceDialog(history.page).getByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG', exact: true }).waitFor()
  await history.page.keyboard.press('Escape')
  assert.equal(await statusFilter.inputValue(), 'SENT')
  assert.equal(await history.page.getByRole('spinbutton', { name: 'Tổng tiền từ (đ)', exact: true }).inputValue(), '12000')
  const requestCount = history.state.requests.filter(request => request.path === '/api/invoices').length
  await history.page.getByRole('spinbutton', { name: 'Tổng tiền đến (đ)', exact: true }).fill('11000')
  await history.page.getByRole('alert').filter({ hasText: 'Tổng tiền đến phải lớn hơn hoặc bằng tổng tiền từ.' }).waitFor()
  assert.equal(history.state.requests.filter(request => request.path === '/api/invoices').length, requestCount, 'Invalid ranges are blocked before calling API')
  await history.page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
  await summary.getByText('55.000 đ', { exact: true }).waitFor()
  assert.equal(await emailFilter.inputValue(), '')
  assert.equal(await statusFilter.inputValue(), '')
  assert.equal(await history.page.getByRole('textbox', { name: 'Ngày lập từ', exact: true }).inputValue(), '')
  assert.equal(await history.page.getByRole('spinbutton', { name: 'Tổng tiền đến (đ)', exact: true }).inputValue(), '')
  if (process.env.UI_SCREENSHOT_DIR) await history.page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'invoices-filters-desktop.png') })
  await history.page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await history.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
  if (process.env.UI_SCREENSHOT_DIR) await history.page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'invoices-filters-mobile.png'), fullPage: true })
  console.log('PASS Invoice filters: dates, inclusive amounts, latest email status, missing email, combined API query, reset, validation and mobile width')
  const readonly = await session('SALES_STAFF', ['INVOICES.READ'])
  readonly.state.invoices = [structuredClone(sale.state.invoices[0])]
  await readonly.page.goto(`${base}/sales/invoices`)
  await readonly.page.getByRole('button', { name: 'Thao tác hóa đơn INV-1', exact: true }).click()
  assert.equal(await readonly.page.getByRole('menuitem', { name: 'Gửi email', exact: true }).count(), 0)
  await readonly.page.getByRole('menuitem', { name: 'Xem / In hóa đơn', exact: true }).click()
  await invoiceDialog(readonly.page).getByRole('heading', { name: 'HÓA ĐƠN BÁN HÀNG', exact: true }).waitFor()
  assert.equal(await invoiceDialog(readonly.page).getByRole('button', { name: 'Gửi email', exact: true }).count(), 0)
  console.log('PASS Invoice summary, pagination, preserved filters, email focus/busy lock, mobile layout, retry and read-only permissions')
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
