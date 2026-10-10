import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

// Test-only HTTP fixtures: this suite never sends traffic or writes to the real backend.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5173'
const baseline = file => execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' }).replaceAll('\r\n', '\n')
const current = file => fs.readFileSync(path.join(root, file), 'utf8').replaceAll('\r\n', '\n')
const sidebarFile = 'src/components/layout/Sidebar.tsx'
const navFunction = text => text.slice(text.indexOf('function useNavConfig()'), text.indexOf('export default function Sidebar'))
let checks = 0
const pass = name => { checks++; console.log('PASS ' + name) }

const changed = execFileSync('git', ['diff', 'HEAD', '--name-only'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
const protectedPaths = /^(?:src\/(?:api|hooks|utils|services)\/|src\/context\/(?:AuthContext|PermissionContext)\.tsx$|src\/components\/auth\/|src\/router\.tsx$|vite\.config\.ts$|src\/features\/.*\/(?:services|data)\/|src\/features\/.*\/(?:mock\w+|dashboardData)\.[tj]sx?$)/
assert.deepEqual(changed.filter(file => protectedPaths.test(file)), [], 'API, fetching, auth, permission, router, utilities, services, and data modules must stay unchanged')
assert.equal(navFunction(current(sidebarFile)).trim(), navFunction(baseline(sidebarFile)).trim(), 'Sidebar menu definitions and their ordering must match HEAD')
const filterLine = 'const groups = allGroups.map(group => ({ ...group, items: group.items.filter(item => canAccessRoute(item.to, has)) })).filter(group => group.items.length > 0)'
assert(current(sidebarFile).includes(filterLine), 'Sidebar must preserve its original permission filtering')
pass('protected integration source and exact menu definitions are unchanged')

const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
const makeMenu = new Function('useAuth', 'accountsService', compile(navFunction(baseline(sidebarFile))) + '\nreturn useNavConfig()')
const routeSource = baseline('src/components/auth/PermissionRoute.tsx')
const routeLogic = routeSource.slice(routeSource.indexOf('const routes:'), routeSource.indexOf('export function PermissionRoute')).replaceAll('export ', '')
const canAccess = new Function('path', 'has', compile(routeLogic) + '\nreturn canAccessRoute(path, has)')
const allCodes = [...new Set([...routeSource.matchAll(/'([A-Z_]+\.[A-Z_]+)'/g)].map(match => match[1]))]
const roleMapping = { ADMIN: 'admin', STORE_OWNER: 'agent', SALES_STAFF: 'sales_staff', DELIVERY_STAFF: 'delivery_staff' }
const user = role => ({ id: '00000000-0000-4000-8000-000000000901', fullName: 'Người kiểm thử', name: 'Người kiểm thử', initials: 'KT', role, roleLabel: 'Nhân viên kiểm thử', status: 'ACTIVE', canReviewAi: true, storeName: 'Cửa hàng kiểm thử', hub: 'Cửa hàng kiểm thử', hubName: 'Cửa hàng kiểm thử' })
const expectedMenu = (role, codes) => makeMenu(() => ({ user: user(role), currentRole: roleMapping[role] }), { list: () => [] }).groups.flatMap(group => group.items).filter(item => canAccess(item.to, code => codes.includes(code))).map(({ label, to }) => ({ label, to }))

const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const presentationFailures = []
const customerId = '00000000-0000-4000-8000-000000000902'
const customer = { id: customerId, userId: customerId, customerCode: 'KH-001', fullName: 'Khách hàng kiểm thử Nguyễn Văn An', phoneNumber: '0900000000', email: 'customer@example.test', customerType: 'REGISTERED', customerGroup: null, status: 'ACTIVE', notes: null, totalOrders: 10, totalPurchaseAmount: 5000000, currentDebt: 0, creditLimit: 0, allowCreditPurchase: false, reservedCredit: 0, availableCredit: 0, paymentTermDays: null, createdAt: '2026-10-09T00:00:00Z', updatedAt: '2026-10-09T00:00:00Z', address: null, debtSummary: null }

async function fixture({ role = 'STORE_OWNER', codes = allCodes, width = 1440, height = 900, pathname = '/notifications' } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'presentation.test.jwt'))
  const state = { codes: [...codes], requests: [], errors: [] }
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    assert.equal(request.headers().authorization, 'Bearer presentation.test.jwt')
    state.requests.push({ method: request.method(), pathname: url.pathname, query: Object.fromEntries(url.searchParams), body: request.postData() })
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/api/auth/me') return json(user(role))
    if (url.pathname === '/api/me/permissions') return json({ role, storeId: 'store-test', roleVersion: 1, memberVersion: 0, permissions: state.codes })
    if (url.pathname === '/api/me/notifications/unread-count') return json({ count: 2 })
    if (url.pathname === '/api/me/notifications') return json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 })
    if (url.pathname === '/api/customers' && request.method() === 'POST') return json({ ...customer, ...request.postDataJSON() })
    if (url.pathname === '/api/customers') return json({ items: [customer], page: 1, pageSize: 15, totalCount: 1, totalPages: 1 })
    if (url.pathname === '/api/customers/' + customerId) return json(customer)
    if (url.pathname === '/api/orders') return json({ items: [{ id: 'order-test', orderNumber: 'DH-KIEM-THU', customerName: 'Khách hàng kiểm thử', customerType: 'WALK_IN', status: 'COMPLETED', source: 'COUNTER', settlementType: 'FULL_PAYMENT', fulfillmentType: 'PICKUP', subtotalAmount: 1000000, totalAmount: 1000000, createdAt: '2026-10-10T03:00:00Z', items: [] }], page: 1, pageSize: 10, totalCount: 1, totalPages: 1 })
    if (url.pathname === '/api/orders/order-test/payments') return json({ orderTotal: 1000000, paidAmount: 1000000, remainingToPay: 0, payments: [], refunds: [] })
    if (url.pathname === '/api/goods-receipts') return json({ items: [{ id: 'receipt-test', receiptNumber: 'PN-KIEM-THU', supplierId: 'supplier-test', supplierName: 'Nhà cung cấp kiểm thử', supplierInvoiceNumber: null, receivedAt: '2026-10-10T03:00:00Z', status: 'DRAFT', totalAmount: 1000000, itemCount: 1 }], page: 1, pageSize: 10, totalCount: 1, totalPages: 1 })
    if (url.pathname === '/api/suppliers') return json({ items: [{ id: 'supplier-test', code: 'NCC-KT', name: 'Nhà cung cấp kiểm thử', isActive: true }], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 })
    if (url.pathname.startsWith('/api/reports/')) return json({ totals: {} })
    return json({ items: [], page: 1, pageSize: 15, totalCount: 0, totalPages: 0 })
  })
  const page = await context.newPage()
  page.on('pageerror', error => state.errors.push(error.message))
  await page.goto(base + pathname)
  await page.getByRole('button', { name: 'Thông báo, 2 chưa đọc', exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelector('aside nav a'))
  return { page, context, state }
}

async function menu(page) {
  return page.locator('aside nav a').evaluateAll(links => links.map(link => ({ to: link.getAttribute('href'), label: link.getAttribute('aria-label') || (() => { const clone = link.cloneNode(true); clone.querySelectorAll('[aria-hidden="true"], .material-symbols-outlined').forEach(node => node.remove()); return clone.textContent.trim().replace(/\s+/g, ' ').replace(/\s+\d+$/, '') })() })))
}
async function noOverflow(page, description) {
  const measurements = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }))
  if (measurements.page > measurements.viewport + 1) {
    console.log('OVERFLOW ' + description, await page.locator('main *').evaluateAll(elements => elements.filter(element => { const box = element.getBoundingClientRect(); return box.right > innerWidth + 1 && box.width > 0 && !element.closest('[class*="overflow-x"]') }).slice(0, 12).map(element => ({ tag: element.tagName, class: element.className?.baseVal ?? element.className, text: element.textContent.slice(0, 80), right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width }))))
    await screenshot(page, 'overflow-' + description.replaceAll(/[^a-z0-9]/gi, '-'))
  }
  assert(measurements.page <= measurements.viewport + 1, `${description}: document width ${measurements.page} > viewport ${measurements.viewport}`)
}
async function screenshot(page, name) {
  if (!process.env.UI_SCREENSHOT_DIR) return
  fs.mkdirSync(process.env.UI_SCREENSHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, name + '.png'), animations: 'disabled' })
}
async function reachable(locator, page, description) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()
  assert(box && box.width > 0 && box.height > 0 && box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y >= -1 && box.y + box.height <= viewport.height + 1, description)
  await locator.click({ trial: true })
}

try {
  for (const role of Object.keys(roleMapping)) {
    const f = await fixture({ role })
    assert.deepEqual(await menu(f.page), expectedMenu(role, allCodes))
    assert.deepEqual(f.state.errors, [])
    await f.context.close()
    pass('exact role menu labels, routes, and order: ' + role)
  }

  const filteredCodes = ['CUSTOMERS.READ', 'CUSTOMERS.CREATE', 'CREDIT_TIERS.READ']
  const f = await fixture({ role: 'SALES_STAFF', codes: filteredCodes })
  assert.deepEqual(await menu(f.page), expectedMenu('SALES_STAFF', filteredCodes))
  f.state.codes = ['CUSTOMERS.READ']
  await f.page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await f.page.locator('aside nav a[href="/agent/credit-config"]').waitFor({ state: 'detached' })
  assert.deepEqual(await menu(f.page), expectedMenu('SALES_STAFF', f.state.codes))
  assert.deepEqual(f.state.errors, [])
  await f.context.close()
  pass('permission filtering and live revocation preserve baseline menu behavior')

  for (const role of Object.keys(roleMapping)) {
    const roleFailuresBefore = presentationFailures.length
    for (const width of [1440, 1024, 768, 375]) {
      const pathname = { ADMIN: '/', STORE_OWNER: '/agent', SALES_STAFF: '/sales', DELIVERY_STAFF: '/delivery' }[role]
      const f = await fixture({ role, width, height: width === 375 ? 812 : 900, pathname, codes: allCodes.filter(code => code !== 'REPORTS.READ') })
      try {
        await f.page.locator('main .agrisage-dashboard').waitFor()
        // Recharts uses JavaScript entrance animation; CSS animation disabling does not settle its paths.
        if (process.env.UI_SCREENSHOT_DIR) await f.page.waitForTimeout(1700)
        await screenshot(f.page, `${role.toLowerCase()}-dashboard-${width}`)
        await noOverflow(f.page, role + ' dashboard at ' + width)
        if (role === 'STORE_OWNER' && width === 1440) {
          await f.page.getByRole('button', { name: 'Thu gọn thanh điều hướng', exact: true }).click()
          await f.page.waitForFunction(() => document.querySelector('.management-shell')?.classList.contains('sidebar-collapsed'))
          await screenshot(f.page, 'store_owner-dashboard-collapsed-1440')
        }
        assert.deepEqual(f.state.errors, [])
      } catch (error) {
        presentationFailures.push(error.message)
      } finally {
        await f.context.close()
      }
    }
    if (presentationFailures.length === roleFailuresBefore) pass('dashboard responsive viewport matrix: ' + role)
  }

  for (const width of [1440, 1024, 768, 375]) {
    const f = await fixture({ width, height: width < 768 ? 812 : 900, pathname: '/agent/farmers', codes: ['CUSTOMERS.READ', 'CUSTOMERS.CREATE'] })
    const { page } = f
    await page.getByRole('cell', { name: /Khách hàng kiểm thử Nguyễn Văn An/ }).waitFor()
    await noOverflow(page, 'customer list at ' + width)
    await screenshot(page, 'customers-list-' + width)
    const table = page.getByRole('table')
    assert.equal(await table.getByRole('columnheader').count(), 6)
    const scroller = table.locator('..')
    const scroll = await scroller.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, overflow: getComputedStyle(element).overflowX }))
    if (width < 1024) assert(scroll.scroll > scroll.width && ['auto', 'scroll'].includes(scroll.overflow), 'wide table must scroll inside its container')
    await reachable(page.getByRole('button', { name: 'Thêm khách hàng', exact: true }), page, 'create action must be reachable')

    if (width >= 1024) {
      const collapse = page.getByRole('button', { name: 'Thu gọn thanh điều hướng', exact: true })
      await collapse.click()
      await page.waitForFunction(() => document.querySelector('.management-shell')?.classList.contains('sidebar-collapsed'))
      const link = page.locator('aside nav a[href="/agent/farmers"]')
      assert.equal(await link.getAttribute('title'), 'Khách hàng')
      assert.equal(await link.getAttribute('aria-label'), 'Khách hàng')
      await link.hover()
      await noOverflow(page, 'collapsed sidebar at ' + width)
      await page.getByRole('button', { name: 'Mở rộng thanh điều hướng', exact: true }).click()
      pass('desktop collapse, accessible tooltip, and expansion at ' + width)
    } else {
      const opener = page.getByRole('button', { name: 'Mở menu điều hướng', exact: true })
      await opener.click()
      const drawer = page.locator('aside.sidebar-drawer')
      await drawer.getByRole('button', { name: 'Đóng menu', exact: true }).waitFor()
      assert.equal(await drawer.getAttribute('aria-modal'), 'true')
      assert.equal(await page.evaluate(() => document.querySelector('aside').contains(document.activeElement)), true, 'focus must enter the drawer')
      for (let i = 0; i < 10; i++) await page.keyboard.press('Tab')
      assert.equal(await page.evaluate(() => document.querySelector('aside').contains(document.activeElement)), true, 'keyboard focus must remain in the drawer')
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => !document.querySelector('aside').classList.contains('is-open'))
      assert.equal(await opener.evaluate(element => element === document.activeElement), true, 'drawer must restore focus to opener')
      await opener.click()
      await drawer.locator('a[href="/agent/farmers"]').click()
      await page.waitForFunction(() => !document.querySelector('aside').classList.contains('is-open'))
      await noOverflow(page, 'drawer navigation at ' + width)
      pass('mobile/tablet drawer focus trap, Escape, and route close at ' + width)
    }

    await page.getByRole('button', { name: 'Thêm khách hàng', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Thêm khách hàng', exact: true })
    await dialog.waitFor()
    assert.equal(await dialog.getByLabel(/^Họ tên/).evaluate(element => element === document.activeElement), true)
    await reachable(dialog.getByLabel(/^Họ tên/), page, 'first modal input must be reachable')
    await dialog.getByLabel(/^Họ tên/).fill('Khách trình bày')
    await dialog.getByLabel('Email', { exact: true }).fill('presentation@example.test')
    await dialog.getByLabel(/^Mật khẩu đăng nhập/).fill('test-only-password')
    await reachable(dialog.getByLabel('Ghi chú', { exact: true }), page, 'last modal input must be reachable')
    await reachable(dialog.getByRole('button', { name: 'Hủy', exact: true }), page, 'cancel button must be reachable')
    await reachable(dialog.getByRole('button', { name: 'Tạo khách hàng', exact: true }), page, 'save button must be reachable')
    await noOverflow(page, 'modal at ' + width)
    await screenshot(page, 'customers-modal-' + width)
    if (width === 375) {
      const response = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/customers')
      await dialog.getByRole('button', { name: 'Tạo khách hàng', exact: true }).click()
      await response
      const write = f.state.requests.find(request => request.method === 'POST' && request.pathname === '/api/customers')
      assert.deepEqual(JSON.parse(write.body), { fullName: 'Khách trình bày', phoneNumber: null, email: 'presentation@example.test', notes: null, password: 'test-only-password', customerType: 'REGISTERED', customerGroupId: null })
      await dialog.waitFor({ state: 'detached' })
      pass('mobile customer create preserves the exact existing API payload')
    } else {
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      assert.equal(await page.getByRole('button', { name: 'Thêm khách hàng', exact: true }).evaluate(element => element === document.activeElement), true)
    }
    const customerRead = f.state.requests.find(request => request.method === 'GET' && request.pathname === '/api/customers')
    assert.deepEqual(customerRead.query, { SortBy: 'NAME', Descending: 'false', Page: '1', PageSize: '15' })
    assert.deepEqual(f.state.errors, [])
    await f.context.close()
    pass('list, table scrolling, dialog input/footer reachability at ' + width)
  }
  for (const [pathname, name, codes] of [
    ['/agent/orders', 'orders', ['ORDERS.READ', 'COUNTER_SALES.SELL']],
    ['/agent/purchases/receipts', 'receipts', ['GOODS_RECEIPTS.READ', 'GOODS_RECEIPTS.CREATE']],
  ]) {
    const f = await fixture({ pathname, codes, width: 375, height: 812 })
    await f.page.getByRole('table').waitFor()
    await f.page.getByRole('cell', { name: name === 'orders' ? /^DH-KIEM-THU/ : /^PN-KIEM-THU/ }).waitFor()
    await noOverflow(f.page, name + ' list at 375')
    await screenshot(f.page, name + '-list-375')
    if (name === 'orders') {
      await reachable(f.page.getByRole('button', { name: 'Soạn đơn tại quầy', exact: true }), f.page, 'counter order action must be reachable on mobile')
      assert.equal(await f.page.getByRole('table').getByRole('columnheader').count(), 6)
    } else {
      await reachable(f.page.getByRole('link', { name: 'Nhập từ Excel', exact: true }), f.page, 'receipt import action must be reachable on mobile')
      await f.page.getByRole('button', { name: 'Tạo phiếu nhập', exact: true }).click()
      const dialog = f.page.getByRole('dialog')
      await dialog.getByLabel('Nhà cung cấp *', { exact: true }).selectOption('supplier-test')
      await reachable(dialog.getByLabel('Ghi chú', { exact: true }), f.page, 'receipt note input must be reachable on mobile')
      await reachable(dialog.getByRole('button', { name: 'Tạo phiếu nháp', exact: true }), f.page, 'receipt submit action must be reachable on mobile')
      await noOverflow(f.page, 'receipt dialog at 375')
      await screenshot(f.page, 'receipts-modal-375')
      await f.page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
    }
    assert.deepEqual(f.state.errors, [])
    await f.context.close()
    pass('mobile filters, table, and actions: ' + name)
  }
  assert.deepEqual(presentationFailures, [], 'dashboard presentation regressions must be fixed')
  console.log(`${checks} presentation regression checks passed`)
} finally {
  await browser.close()
}
