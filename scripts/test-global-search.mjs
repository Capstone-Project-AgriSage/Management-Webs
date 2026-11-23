import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// All requests are intercepted: this suite cannot read or write a real store.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'chrome' })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const output = process.env.SEARCH_SCREENSHOT_DIR
if (output) await mkdir(output, { recursive: true })
let checks = 0
const pass = message => { checks++; console.log('PASS ' + message) }
const customer = (id = 'c1', fullName = 'Nguyễn Văn An') => ({ id, userId: id, customerCode: id.toUpperCase(), fullName, phoneNumber: '0901234567', email: null, customerType: 'REGISTERED', status: 'ACTIVE', customerGroup: null, totalOrders: 0, totalPurchaseAmount: 0, currentDebt: 0, creditLimit: 0, reservedCredit: 0, availableCredit: 0, allowCreditPurchase: false, address: null, debtSummary: null, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' })
const product = { id: 'p1', sku: 'URE', name: 'Đạm Phú Mỹ', categoryName: 'Phân bón', status: 'ACTIVE', imageUrl: null }
const order = { id: 'o1', orderNumber: 'DH-001', customerName: 'Nguyễn Văn An', customerPhone: '0901234567', customerType: 'REGISTERED', status: 'PENDING_CONFIRMATION', totalAmount: 200000, subtotalAmount: 200000, createdAt: '2026-11-01T00:00:00Z', items: [] }

async function fixture({ role = 'STORE_OWNER', permissions = ['CUSTOMERS.READ', 'ORDERS.READ', 'PRODUCTS.READ', 'STORE_PRODUCTS.READ'], width = 1440 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 950 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'global-search-test'))
  const state = { requests: [], errors: [], failProducts: false }
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname === '/api/realtime/negotiate') return route.abort()
    assert.equal(request.method(), 'GET', `Unexpected write: ${url.pathname}`)
    assert.equal(request.headers().authorization, 'Bearer global-search-test')
    const query = Object.fromEntries(url.searchParams)
    const search = query.Search ?? query.search ?? ''
    state.requests.push({ path: url.pathname, query, search })
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {})
    const paged = items => ({ items, totalCount: items.length, page: 1, pageSize: Number(query.pageSize || query.PageSize || 15), totalPages: items.length ? 1 : 0 })
    if (url.pathname === '/api/auth/me') return json({ id: 'tester', fullName: 'Người kiểm thử', role, status: 'ACTIVE' })
    if (url.pathname === '/api/me/permissions') return json({ permissions })
    if (url.pathname.endsWith('/unread-count')) return json({ count: 0 })
    if (url.pathname === '/api/customers') {
      if (search === 'Chậm') await new Promise(resolve => setTimeout(resolve, 700))
      const item = search === 'Bình' ? customer('c2', 'Trần Văn Bình') : search === 'Mới' ? customer('c3', 'Khách Mới') : search === 'Chậm' ? customer('old', 'Khách Chậm') : customer()
      return json(paged(search === 'zzzz' ? [] : [item]))
    }
    if (/^\/api\/customers\/c\d$/.test(url.pathname)) {
      const id = url.pathname.split('/').at(-1)
      return json(customer(id, id === 'c2' ? 'Trần Văn Bình' : 'Nguyễn Văn An'))
    }
    if (url.pathname === '/api/orders') return json(paged(search === 'zzzz' ? [] : [order]))
    if (url.pathname === '/api/orders/o1') return json(order)
    if (url.pathname === '/api/orders/o1/payments') return json({ orderTotal: 200000, paidAmount: 0, remainingToPay: 200000, payments: [], refunds: [] })
    if (url.pathname === '/api/products' || url.pathname === '/api/catalog/products') {
      if (state.failProducts) return json({ detail: 'Không tải được sản phẩm kiểm thử.' }, 503)
      const item = search === 'DAP' || search === 'Khác' ? { ...product, id: 'p2', sku: 'DAP', name: 'Phân DAP' } : product
      return json(paged(search === 'zzzz' ? [] : [item]))
    }
    if (url.pathname === '/api/staff') return json(paged([{ id: 's1', fullName: 'Lê Thị Lan', employeeCode: 'NV01', phoneNumber: '0901111111', email: 'lan@example.test', role: 'SALES_STAFF', status: 'ACTIVE', memberStatus: 'ACTIVE' }]))
    if (url.pathname === '/api/deliveries') return json(paged([{ id: 'd1', deliveryNumber: 'GH-001', orderNumber: 'DH-001', recipientName: 'Nguyễn Văn An', status: 'OUT_FOR_DELIVERY' }]))
    return json(paged([]))
  })
  const page = await context.newPage()
  page.on('pageerror', error => state.errors.push(error.message))
  await page.goto(base + '/notifications')
  await page.getByRole('heading', { name: 'Thông báo', exact: true }).waitFor()
  return { context, page, state }
}

async function openSearch(page, query, shortcut = false) {
  if (shortcut) await page.keyboard.press('Control+k')
  else await page.getByRole('button', { name: 'Tìm kiếm toàn hệ thống', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tìm kiếm toàn hệ thống', exact: true })
  await dialog.waitFor()
  if (query) await dialog.getByRole('searchbox', { name: 'Từ khóa tìm kiếm' }).fill(query)
  return dialog
}

try {
  const normal = await fixture()
  const { page, state } = normal
  assert.equal(state.requests.filter(request => request.search).length, 0)
  let dialog = await openSearch(page)
  const input = dialog.getByRole('searchbox')
  assert.equal(await input.evaluate(element => element === document.activeElement), true)
  await input.fill('A')
  await page.waitForTimeout(400)
  assert.equal(state.requests.filter(request => request.search).length, 0)
  await input.fill('An')
  await dialog.getByRole('link', { name: /Nguyễn Văn An C1/ }).waitFor()
  assert.equal(await dialog.getByRole('region').count(), 3)
  assert.equal(await dialog.getByRole('link', { name: /DH-001/ }).getAttribute('href'), '/agent/orders?open=o1')
  for (const path of ['/api/customers', '/api/orders', '/api/products']) assert.ok(state.requests.some(request => request.path === path && request.search === 'An' && Number(request.query.pageSize || request.query.PageSize) === 5), path)
  if (output) await page.screenshot({ path: join(output, 'global-search-desktop.png') })
  pass('Topbar opens real, scoped API results; no requests until two characters and no fake toast')
  await input.press('ArrowDown')
  assert.equal(await dialog.getByRole('link').first().evaluate(element => element === document.activeElement), true)
  await page.keyboard.press('Enter')
  await page.getByRole('dialog').getByRole('heading', { name: 'Nguyễn Văn An', exact: true }).waitFor()
  assert.ok(state.requests.some(request => request.path === '/api/customers/c1'))
  await page.keyboard.press('Escape')
  dialog = await openSearch(page, 'Bình', true)
  await dialog.getByRole('link', { name: /Trần Văn Bình/ }).click()
  await page.getByRole('dialog').getByRole('heading', { name: 'Trần Văn Bình', exact: true }).waitFor()
  pass('Keyboard selection opens customer detail, including a second customer on the same list route')
  await page.keyboard.press('Escape')
  dialog = await openSearch(page, 'Đạm')
  await dialog.getByRole('link', { name: /Đạm Phú Mỹ/ }).click()
  await page.getByPlaceholder('Tìm theo tên hoặc mã SKU...').waitFor()
  await page.waitForFunction(() => document.querySelector('input[placeholder="Tìm theo tên hoặc mã SKU..."]')?.value === 'URE')
  assert.ok(new URL(page.url()).searchParams.get('search') === 'URE')
  dialog = await openSearch(page, 'Khác', true)
  await dialog.getByRole('link', { name: /Phân DAP/ }).click()
  await page.waitForFunction(() => document.querySelector('input[placeholder="Tìm theo tên hoặc mã SKU..."]')?.value === 'DAP')
  await page.getByRole('cell', { name: 'Phân DAP', exact: false }).first().waitFor()
  assert.ok(state.requests.some(request => request.path === '/api/products' && request.search === 'DAP' && Number(request.query.Page) === 1))
  pass('Product results filter by SKU and update the already-open product list')
  dialog = await openSearch(page, 'Chậm', true)
  await page.waitForRequest(request => new URL(request.url()).searchParams.get('Search') === 'Chậm')
  await dialog.getByRole('searchbox').fill('Mới')
  await dialog.getByRole('link', { name: /Khách Mới/ }).waitFor()
  await page.waitForTimeout(800)
  assert.equal(await dialog.getByRole('link', { name: /Khách Chậm/ }).count(), 0)
  await dialog.getByRole('searchbox').fill('zzzz')
  await dialog.getByText('Không tìm thấy khách hàng phù hợp.').waitFor()
  assert.equal(await dialog.getByRole('link').count(), 0)
  pass('Late responses cannot overwrite a newer query; empty results are explicit')
  state.failProducts = true
  await dialog.getByRole('searchbox').fill('lỗi')
  await dialog.getByRole('alert').waitFor()
  assert.equal(await dialog.getByRole('link', { name: /DH-001/ }).count(), 1)
  state.failProducts = false
  await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await dialog.getByRole('link', { name: /Đạm Phú Mỹ/ }).waitFor()
  pass('A failing source leaves other results usable and can be retried')
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('button', { name: 'Tìm kiếm toàn hệ thống', exact: true }).evaluate(element => element === document.activeElement), true)
  assert.deepEqual(state.errors, [])
  await normal.context.close()

  const limited = await fixture({ permissions: ['ORDERS.READ'] })
  dialog = await openSearch(limited.page, 'An', true)
  await dialog.getByRole('link', { name: /DH-001/ }).waitFor()
  assert.equal(await dialog.getByRole('region').count(), 1)
  assert.equal(limited.state.requests.filter(request => ['/api/customers', '/api/products'].includes(request.path)).length, 0)
  await limited.context.close()
  const denied = await fixture({ permissions: [] })
  dialog = await openSearch(denied.page, 'An')
  await dialog.getByText('Bạn chưa có quyền tìm kiếm trong các mục này.').waitFor()
  assert.equal(denied.state.requests.filter(request => request.search).length, 0)
  await denied.context.close()
  pass('Permission filtering prevents requests and results from unauthorized areas')

  for (const [role, permissions, title, href] of [
    ['ADMIN', ['STAFF.READ'], /Lê Thị Lan/, '/admin/accounts?search=NV01'],
    ['SALES_STAFF', ['STORE_PRODUCTS.READ'], /Đạm Phú Mỹ/, '/sales/products?search=URE'],
    ['DELIVERY_STAFF', ['DELIVERIES.READ'], /GH-001/, '/delivery/deliveries/d1'],
  ]) {
    const fixtureRole = await fixture({ role, permissions })
    dialog = await openSearch(fixtureRole.page, 'An', true)
    await dialog.getByRole('link', { name: title }).waitFor()
    assert.equal(await dialog.getByRole('link', { name: title }).getAttribute('href'), href)
    if (role !== 'DELIVERY_STAFF') {
      await dialog.getByRole('link', { name: title }).click()
      const expected = role === 'ADMIN' ? 'NV01' : 'URE'
      await fixtureRole.page.waitForFunction(value => [...document.querySelectorAll('main input')].some(input => input.value === value), expected)
    }
    assert.deepEqual(fixtureRole.state.errors, [])
    await fixtureRole.context.close()
  }
  pass('Admin, sales and delivery use their own APIs and accessible routes')

  for (const width of [390, 320]) {
    const mobile = await fixture({ width })
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Topbar fits ${width}px`)
    dialog = await openSearch(mobile.page, 'An')
    await dialog.getByRole('link', { name: /Đạm Phú Mỹ/ }).waitFor()
    if (output) await mobile.page.screenshot({ path: join(output, `global-search-${width}.png`) })
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Dialog fits ${width}px`)
    await mobile.page.keyboard.press('Escape')
    assert.equal(await mobile.page.getByRole('dialog').count(), 0)
    await mobile.context.close()
  }
  pass('Mobile search is accessible without horizontal overflow; Escape closes and restores focus')
  console.log(`Global search checks passed (${checks})`)
} finally { await browser.close() }
