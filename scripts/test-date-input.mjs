import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// The date fields read dd/mm/yyyy in an ENGLISH browser too (the native date input followed the browser and showed
// mm/dd/yyyy), and dates on screen are dd/mm/yyyy HH:mm in Vietnam time. Every /api request is intercepted.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5174'
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const failures = []
// 10:00 UTC is 17:00 in Vietnam.
const order = { id: 'order-1', orderNumber: 'OD-TEST-1', status: 'CONFIRMED', customerName: 'Khách kiểm thử', customerPhone: '0901234567', totalAmount: 100000, createdAt: '2026-10-10T10:00:00Z', source: 'COUNTER', settlementType: 'FULL_PAYMENT', customerType: 'WALK_IN', items: [] }

async function session() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US', timezoneId: 'America/New_York' })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'date-input-test'))
  const state = { orderQueries: [] }
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/realtime/negotiate') return route.abort()
    const query = Object.fromEntries([...url.searchParams].map(([key, value]) => [key.toLowerCase(), value]))
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) }).catch(() => {})
    if (path === '/api/auth/me') return json({ id: 'owner', fullName: 'Kiểm thử', role: 'STORE_OWNER', status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ permissions: ['PAYMENTS.READ', 'ORDERS.READ', 'PAYMENTS.CREATE'] })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/orders') { state.orderQueries.push(query); return json({ items: [order], page: 1, pageSize: 10, totalCount: 1, totalPages: 1 }) }
    if (request.method() === 'GET') return json({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 })
    failures.push(`Unhandled mock API ${request.method()} ${path}`)
    return json({ title: 'Unexpected test request' }, 500)
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(`Page error: ${error.message}`))
  return { context, page, state }
}

const lastQuery = state => state.orderQueries.at(-1) ?? {}
async function until(check, message) {
  for (let i = 0; i < 40; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 100)) }
  assert.fail(message)
}

const { context, page, state } = await session()
try {
  await page.goto(`${base}/agent/payments`)
  const from = page.getByLabel('Từ ngày', { exact: true })
  const to = page.getByLabel('Đến ngày', { exact: true })
  await from.waitFor()

  // 1. No native date input is left: the field is a text box that reads dd/mm/yyyy.
  assert.equal(await page.locator('input[type=date], input[type=datetime-local]').count(), 0)
  assert.equal(await from.getAttribute('placeholder'), 'dd/mm/yyyy')

  // 2. Dates on screen: 10:00 UTC shows as 10/10/2026 17:00 (Vietnam time, day first), even in a New York browser.
  await page.getByText('10/10/2026 17:00').first().waitFor()

  // 3. Typing digits adds the slashes and filters the list by the ISO day.
  await from.click(); await from.pressSequentially('05112026')
  assert.equal(await from.inputValue(), '05/11/2026')
  await until(() => lastQuery(state).fromdate === '2026-11-05', 'typing 05112026 must filter from 2026-11-05')

  // 4. A filled ISO date (as tests and paste do) is accepted and shown day first.
  await to.fill('2026-11-20')
  assert.equal(await to.inputValue(), '20/11/2026')
  await until(() => lastQuery(state).todate === '2026-11-20', 'filling 2026-11-20 must filter to 2026-11-20')

  // 5. An impossible date is marked and never sent; leaving the field brings back the last good value.
  await to.fill('31/02/2026')
  assert.equal(await to.getAttribute('aria-invalid'), 'true')
  await from.click()
  assert.equal(await to.inputValue(), '20/11/2026')
  assert.ok(!state.orderQueries.some(q => q.todate === '2026-02-31'), 'an impossible date must not reach the API')

  // 6. Before "from" is out of range: still reported (the page decides), but the field is marked invalid.
  await to.fill('01/11/2026')
  await until(() => lastQuery(state).todate === '2026-11-01', 'a date before min is still reported, like the native input')
  assert.equal(await to.getAttribute('aria-invalid'), 'true')
  await to.fill('20/11/2026')
  await until(() => lastQuery(state).todate === '2026-11-20', 'back to 20/11/2026')
  assert.equal(await to.getAttribute('aria-invalid'), null)

  // 7. The calendar is Vietnamese, days outside min/max are disabled, a click picks the day.
  await from.locator('xpath=..').getByRole('button', { name: 'Mở lịch chọn ngày' }).click()
  const dialog = page.getByRole('dialog', { name: 'Chọn ngày' })
  await dialog.waitFor()
  await dialog.getByText('Tháng 11, 2026').waitFor()
  for (const day of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) assert.ok(await dialog.getByText(day, { exact: true }).isVisible(), `weekday ${day}`)
  assert.equal(await dialog.getByRole('gridcell', { name: '21/11/2026' }).isDisabled(), true, 'after "to" (max) is disabled')
  await dialog.getByRole('gridcell', { name: '12/11/2026' }).click()
  await dialog.waitFor({ state: 'detached' })
  assert.equal(await from.inputValue(), '12/11/2026')
  await until(() => lastQuery(state).fromdate === '2026-11-12', 'clicking 12 must filter from 2026-11-12')

  // 8. Keyboard: ArrowDown opens on the value, ArrowRight moves a day, Enter picks it, Escape closes.
  await from.focus(); await page.keyboard.press('ArrowDown')
  await dialog.waitFor()
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter')
  await dialog.waitFor({ state: 'detached' })
  assert.equal(await from.inputValue(), '13/11/2026')
  await until(() => lastQuery(state).fromdate === '2026-11-13', 'keyboard pick must filter from 2026-11-13')
  await from.focus(); await page.keyboard.press('ArrowDown'); await dialog.waitFor()
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })

  // 9. "Xoá" clears the filter.
  await from.locator('xpath=..').getByRole('button', { name: 'Mở lịch chọn ngày' }).click()
  await dialog.getByRole('button', { name: 'Xoá' }).click()
  assert.equal(await from.inputValue(), '')
  await until(() => !lastQuery(state).fromdate, 'Xoá must remove the from filter')
} catch (error) {
  failures.push(error.stack || String(error))
} finally {
  await context.close()
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('Date input checks passed (9 groups)')
