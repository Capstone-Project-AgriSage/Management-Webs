import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// F4.7 seasonal product suggestions (backend FLOW_4 "Seasonal product suggestions"): no AI and no screen that asks for
// a suggestion. The server's reminder prepares them; the store sees them on the dashboard and the product page, and a
// notification opens the dashboard. Every API request is intercepted; nothing may be written.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const failures = []
const screenshotDir = process.env.SEASONAL_SCREENSHOT_DIR
if (screenshotDir) await mkdir(screenshotDir, { recursive: true })
const shot = async (page, name) => { if (screenshotDir) await page.screenshot({ path: join(screenshotDir, name + '.png'), fullPage: true }) }
let checks = 0
const pass = message => { checks++; console.log('PASS ' + message) }

const vnToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const addDays = (iso, days) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
const dmy = iso => iso.split('-').reverse().join('/')
const startsOn = addDays(vnToday, 20)
const endsOn = addDays(vnToday, 80)
const RUN = '01a21157-e9c2-7011-9056-ec5725b68987'
const STARTED = '01a21157-e9c2-7011-9056-ec5725b68988'
const READ = ['SEASONAL_RULES.READ', 'STORE_PRODUCTS.READ', 'PRODUCTS.READ', 'INVENTORY.READ']

const item = (rank, extra) => ({ id: `item-${rank}`, rank, productId: `p-${rank}`, storeProductId: `sp-${rank}`, inStore: true,
  sku: `SKU-${rank}`, productName: `Sản phẩm ${rank}`, baseUnit: 'BAG', group: 'FERTILIZER', confidence: 'MEDIUM',
  reason: `Lý do ${rank}`, evidence: [], soldLastSeasonBase: 0, sellableBase: 0, suggestedTargetBase: null,
  orderByDate: addDays(startsOn, -21), ...extra })
const run = {
  id: RUN, cropType: 'RICE', cropName: 'Lúa', region: 'Cần Thơ', startsOn, endsOn, prepareDays: 14,
  comparedFrom: addDays(startsOn, -365), comparedTo: addDays(endsOn, -365), candidateCount: 6, seasonalRuleId: null,
  createdAt: new Date().toISOString(),
  items: [
    item(1, { productName: 'Phân NPK 16-16-8', confidence: 'HIGH', reason: 'Cùng kỳ năm trước đã bán 300 bao.',
      soldLastSeasonBase: 300, sellableBase: 700, suggestedTargetBase: 104,
      evidence: [{ kind: 'SALES', text: 'Bán 300 bao từ 01/12/2025 đến 30/01/2026 (cùng kỳ năm trước).' }] }),
    item(2, { productName: 'Thuốc trị rầy nâu', group: 'CROP_PROTECTION', inStore: false, storeProductId: null,
      sellableBase: null, soldLastSeasonBase: null, reason: 'Dùng cho Rầy nâu. Cửa hàng chưa kinh doanh sản phẩm này.' }),
    item(3), item(4), item(5), item(6, { productName: 'Sản phẩm thứ sáu' }),
  ],
}

async function session({ permissions = READ, role = 'STORE_OWNER' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'seasonal-suggestions'))
  const state = { requests: [] }
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/realtime/negotiate') return route.abort()
    const method = request.method()
    state.requests.push({ method, path, query: url.search })
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) }).catch(() => {})
    const paged = (items = []) => ({ items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1 })
    if (path === '/api/auth/me') return json({ id: 'owner', fullName: 'Chủ cửa hàng', role, status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ permissions })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/inventory/seasonal-suggestions') return json(paged([
      // A season that has started already is not "upcoming" and is left out.
      { id: STARTED, cropType: 'CORN', cropName: 'Bắp (ngô)', startsOn: addDays(vnToday, -3), endsOn, itemCount: 2, createdAt: new Date().toISOString() },
      { id: RUN, cropType: 'RICE', cropName: 'Lúa', startsOn, endsOn, itemCount: 6, createdAt: new Date().toISOString() },
    ]))
    if (path === `/api/inventory/seasonal-suggestions/${RUN}`) return json(run)
    if (path.startsWith('/api/inventory/seasonal-suggestions/')) { failures.push(`Unexpected read ${path}`); return json({}, 404) }
    if (method !== 'GET') { failures.push(`Unexpected write ${method} ${path}`); return route.abort() }
    return json(paged([]))
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(`Page error: ${error.message}`))
  return { context, page, state }
}

try {
  // 1. The product page shows the upcoming season and its products, a short list first.
  const owner = await session()
  const { page, state } = owner
  await page.goto(`${base}/agent/products`)
  const notice = page.getByRole('region', { name: 'Sắp tới mùa vụ' })
  await notice.getByRole('heading', { name: `Vụ Lúa: ${dmy(startsOn)} – ${dmy(endsOn)}` }).waitFor()
  await notice.getByText(`Nên đặt hàng trước ${dmy(addDays(startsOn, -21))}`).waitFor()
  await notice.getByText('Cùng kỳ năm trước đã bán 300 bao.').waitFor()
  await notice.getByText('Bán 300 bao từ 01/12/2025 đến 30/01/2026 (cùng kỳ năm trước).').waitFor()
  await notice.getByText(/Mục tiêu tồn gợi ý 104/).waitFor()
  assert.match(await notice.innerText(), /Thuốc trị rầy nâu[\s\S]*Chưa có trong cửa hàng/)
  assert.equal(await notice.getByText('Bắp (ngô)').count(), 0, 'a season that has started is not shown')
  assert.ok(!state.requests.some(r => r.path.endsWith(STARTED)), 'the started season is not even read')
  assert.match(state.requests.find(r => r.path === '/api/inventory/seasonal-suggestions').query, new RegExp(`fromDate=${vnToday}`))
  assert.equal(await notice.getByText('Sản phẩm thứ sáu').count(), 0, 'only the first four products at first')
  pass('The product page shows the upcoming season, order-by date, reasons, evidence and products not carried')
  await shot(page, 'products')

  await notice.getByRole('button', { name: 'Xem tất cả 6 mặt hàng' }).click()
  await notice.getByText('Sản phẩm thứ sáu').waitFor()
  await notice.getByRole('button', { name: 'Thu gọn' }).click()
  pass('All products of a season can be expanded and collapsed')

  // Nothing asks for a suggestion: no AI button, no create, no decisions.
  assert.equal(await page.getByRole('button', { name: /AI|Tạo gợi ý/ }).count(), 0)
  pass('There is no button that asks the AI or creates a suggestion')

  // 2. The dashboard keeps it to one line per season (the management figures stay on top); the list opens in a dialog.
  await page.goto(`${base}/agent`)
  const onDashboard = page.getByRole('region', { name: 'Sắp tới mùa vụ' })
  await onDashboard.getByText('Sắp tới vụ Lúa').waitFor()
  assert.match(await onDashboard.innerText(), new RegExp(`${dmy(startsOn)} – ${dmy(endsOn)}[\\s\\S]*6 mặt hàng nên chuẩn bị[\\s\\S]*đặt hàng trước ${dmy(addDays(startsOn, -21))}[\\s\\S]*nên đặt ngay`))
  assert.equal(await onDashboard.getByText('Phân NPK 16-16-8').count(), 0, 'the products are not listed on the dashboard itself')
  assert.ok((await onDashboard.boundingBox()).height < 90, 'one season takes one short line')
  await shot(page, 'dashboard')
  await onDashboard.getByRole('button', { name: 'Xem gợi ý nhập hàng vụ Lúa' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('heading', { name: 'Gợi ý nhập hàng vụ Lúa' }).waitFor()
  await dialog.getByText('Sản phẩm thứ sáu').waitFor()
  await dialog.getByText('Bán 300 bao từ 01/12/2025 đến 30/01/2026 (cùng kỳ năm trước).').waitFor()
  await shot(page, 'dashboard-dialog')
  await dialog.getByRole('link', { name: 'Quản lý sản phẩm' }).click()
  await page.waitForURL(/\/agent\/products$/)
  pass('The dashboard shows one line per season; its dialog lists every product with evidence and links to the product page')

  // 3. The old page is gone.
  await page.goto(`${base}/agent/inventory/seasonal-suggestions`)
  await page.waitForTimeout(500)
  assert.equal(await page.getByRole('heading', { name: 'Gợi ý nhập theo mùa vụ' }).count(), 0)
  assert.equal(await page.getByRole('link', { name: 'Gợi ý nhập theo mùa vụ' }).count(), 0, 'no sidebar entry')
  pass('The suggestion page and its menu entry are gone')

  for (const width of [1440, 390]) {
    // Sized before loading, as a phone opens it (some layouts choose their form when they mount).
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${base}/agent/products`)
    await page.getByRole('region', { name: 'Sắp tới mùa vụ' }).waitFor()
    // The notice itself, and everything in it, fits the screen. (The product table below has its own min width.)
    const right = await page.getByRole('region', { name: 'Sắp tới mùa vụ' }).evaluate(region =>
      Math.max(region.getBoundingClientRect().right, ...[...region.querySelectorAll('*')].map(e => e.getBoundingClientRect().right)))
    assert.ok(right <= width + 1, `The notice fits at ${width}px (right edge ${Math.round(right)})`)
    await shot(page, `products-${width}`)
  }
  pass('The notice fits at 1440 and 390 px')
  await owner.context.close()

  // 4. Without SEASONAL_RULES.READ nothing is asked and nothing is shown.
  const other = await session({ permissions: ['STORE_PRODUCTS.READ', 'PRODUCTS.READ', 'INVENTORY.READ'] })
  await other.page.goto(`${base}/agent/products`)
  await other.page.waitForTimeout(800)
  assert.equal(await other.page.getByRole('region', { name: 'Sắp tới mùa vụ' }).count(), 0)
  assert.ok(!other.state.requests.some(r => r.path.startsWith('/api/inventory/seasonal-suggestions')))
  pass('Without SEASONAL_RULES.READ the notice is not loaded or shown')
  await other.context.close()
} catch (error) {
  failures.push(error.stack || String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Seasonal suggestion checks passed (${checks})`)
