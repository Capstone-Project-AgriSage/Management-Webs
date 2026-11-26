import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// F4.7 seasonal product suggestions (backend FLOW_4 "Seasonal product suggestions"): no AI and no screen that asks for
// a suggestion. The server's reminder prepares them; the store sees them on the dashboard and the product page, and a
// notification opens the dashboard. An owner with SEASONAL_RULES.MANAGE can open the seasonal-rule form filled in
// from a season and save it; that is the only write allowed. Every API request is intercepted.
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
const COVERED = '01a21157-e9c2-7011-9056-ec5725b68989'
const READ = ['SEASONAL_RULES.READ', 'STORE_PRODUCTS.READ', 'PRODUCTS.READ', 'INVENTORY.READ']
const MANAGE = [...READ, 'SEASONAL_RULES.MANAGE']

const item = (rank, extra) => ({ id: `item-${rank}`, rank, productId: `p-${rank}`, storeProductId: `sp-${rank}`, inStore: true,
  sku: `SKU-${rank}`, productName: `Sản phẩm ${rank}`, baseUnit: 'BAG', group: 'FERTILIZER', confidence: 'MEDIUM',
  reason: `Lý do ${rank}`, evidence: [], soldLastSeasonBase: 0, sellableBase: 0, suggestedTargetBase: null,
  orderByDate: addDays(startsOn, -21), ...extra })
const run = {
  id: RUN, cropType: 'RICE', cropName: 'Lúa', region: 'Cần Thơ', startsOn, endsOn, prepareDays: 14,
  comparedFrom: addDays(startsOn, -365), comparedTo: addDays(endsOn, -365), candidateCount: 6, seasonalRuleId: null,
  createdAt: new Date().toISOString(), coveringRule: null,
  items: [
    item(1, { productName: 'Phân NPK 16-16-8', confidence: 'HIGH', reason: 'Cùng kỳ năm trước đã bán 300 bao.',
      soldLastSeasonBase: 300, sellableBase: 700, suggestedTargetBase: 104,
      evidence: [{ kind: 'SALES', text: 'Bán 300 bao từ 01/12/2025 đến 30/01/2026 (cùng kỳ năm trước).' }] }),
    item(2, { productName: 'Thuốc trị rầy nâu', group: 'CROP_PROTECTION', inStore: false, storeProductId: null,
      sellableBase: null, soldLastSeasonBase: null, reason: 'Dùng cho Rầy nâu. Cửa hàng chưa kinh doanh sản phẩm này.' }),
    item(3), item(4), item(5), item(6, { productName: 'Sản phẩm thứ sáu' }),
  ],
}
// The rule the server fills in from the run (backend FLOW_4 rule 6): carried products only, the factor from last season.
const draft = {
  suggestionId: RUN, name: `Vụ Lúa ${dmy(startsOn)} – ${dmy(endsOn)}`, cropType: 'RICE', cropName: 'Lúa', region: 'Cần Thơ',
  startsOn, endsOn, prepareDays: 14, demandFactor: 1.8, demandFactorBasis: 'LAST_SEASON', demandFactorProducts: 3,
  comparedFrom: run.comparedFrom, comparedTo: run.comparedTo, baselineFrom: addDays(run.comparedFrom, -90),
  baselineTo: addDays(run.comparedFrom, -1), coveringRule: null,
  items: [
    { storeProductId: 'sp-1', sku: 'SKU-1', productName: 'Phân NPK 16-16-8', baseUnit: 'BAG', targetStockLevelBase: 104 },
    { storeProductId: 'sp-3', sku: 'SKU-3', productName: 'Sản phẩm 3', baseUnit: 'BAG', targetStockLevelBase: null },
  ],
  skipped: [{ productId: 'p-2', sku: 'SKU-2', productName: 'Thuốc trị rầy nâu', reason: 'NOT_CARRIED' }],
}
const RULE = { id: 'rule-new', name: draft.name }

async function session({ permissions = READ, role = 'STORE_OWNER' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'seasonal-suggestions'))
  const state = { requests: [], saved: null }
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
      { id: STARTED, cropType: 'CORN', cropName: 'Bắp (ngô)', startsOn: addDays(vnToday, -3), endsOn, itemCount: 2, createdAt: new Date().toISOString(), coveringRule: null },
      { id: RUN, cropType: 'RICE', cropName: 'Lúa', startsOn, endsOn, itemCount: 6, createdAt: new Date().toISOString(), coveringRule: state.saved ? RULE : null },
      // A season a rule already covers is planned: no notice, not even read.
      { id: COVERED, cropType: 'CORN', cropName: 'Bắp (ngô)', startsOn: addDays(startsOn, 5), endsOn, itemCount: 3, createdAt: new Date().toISOString(), coveringRule: { id: 'rule-old', name: 'Vụ bắp đã lập' } },
    ]))
    if (path === `/api/inventory/seasonal-suggestions/${RUN}`) return json({ ...run, coveringRule: state.saved ? RULE : null })
    if (path === `/api/inventory/seasonal-suggestions/${RUN}/rule-draft`) {
      if (!permissions.includes('SEASONAL_RULES.MANAGE')) failures.push('The draft was read without SEASONAL_RULES.MANAGE')
      return json({ ...draft, coveringRule: state.saved ? RULE : null })
    }
    if (path.startsWith('/api/inventory/seasonal-suggestions/')) { failures.push(`Unexpected read ${path}`); return json({}, 404) }
    // The one write: the owner saves the filled-in rule with the usual seasonal-rule create.
    if (method === 'POST' && path === '/api/inventory/seasonal-rules' && permissions.includes('SEASONAL_RULES.MANAGE')) {
      state.saved = request.postDataJSON()
      return json({ ...state.saved, id: RULE.id, version: 0, items: [] }, 201)
    }
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
  assert.ok(!state.requests.some(r => r.path.includes(COVERED)), 'a season a rule already covers is not read')
  assert.match(state.requests.find(r => r.path === '/api/inventory/seasonal-suggestions').query, new RegExp(`fromDate=${vnToday}`))
  assert.equal(await notice.getByText('Sản phẩm thứ sáu').count(), 0, 'only the first four products at first')
  pass('The product page shows the upcoming season, order-by date, reasons, evidence and products not carried')
  await shot(page, 'products')

  await notice.getByRole('button', { name: 'Xem tất cả 6 mặt hàng' }).click()
  await notice.getByText('Sản phẩm thứ sáu').waitFor()
  await notice.getByRole('button', { name: 'Thu gọn' }).click()
  pass('All products of a season can be expanded and collapsed')

  // Nothing asks for a suggestion: no AI button, no create, no decisions. Reading alone offers no rule either.
  assert.equal(await page.getByRole('button', { name: /AI|Tạo gợi ý/ }).count(), 0)
  assert.equal(await page.getByRole('button', { name: /Tạo quy tắc mùa vụ/ }).count(), 0, 'no rule button without SEASONAL_RULES.MANAGE')
  pass('There is no button that asks the AI or creates a suggestion; without MANAGE there is no rule button')

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

  // 5. An owner with SEASONAL_RULES.MANAGE turns a season into a seasonal rule: the suggestion dialog closes, the form
  // opens filled in (crop, days, preparation, factor from last season, carried products and targets), and only "Lưu"
  // writes.
  const manager = await session({ permissions: MANAGE })
  const mp = manager.page
  await mp.goto(`${base}/agent/products`)
  await mp.getByRole('region', { name: 'Sắp tới mùa vụ' }).getByRole('button', { name: 'Tạo quy tắc mùa vụ cho vụ Lúa' }).waitFor()
  pass('The product page offers a rule next to each season to an owner who manages rules')

  await mp.goto(`${base}/agent`)
  const banner = mp.getByRole('region', { name: 'Sắp tới mùa vụ' })
  await banner.getByRole('button', { name: 'Xem gợi ý nhập hàng vụ Lúa' }).click()
  await mp.getByRole('dialog').getByRole('button', { name: 'Tạo quy tắc mùa vụ cho vụ Lúa' }).click()
  const form = mp.getByRole('dialog').filter({ has: mp.getByRole('heading', { name: 'Tạo quy tắc mùa vụ từ gợi ý' }) })
  await form.waitFor()
  await mp.getByRole('heading', { name: 'Gợi ý nhập hàng vụ Lúa' }).waitFor({ state: 'detached' })
  const note = form.getByRole('note', { name: 'Căn cứ của bản nháp' })
  assert.match(await note.innerText(), /Hệ số nhu cầu 1,8 tính từ mùa trước[\s\S]*trung vị của 3 sản phẩm/)
  assert.match(await note.innerText(), /chưa kinh doanh: Thuốc trị rầy nâu/)
  assert.equal(await form.getByLabel('Tên quy tắc').inputValue(), draft.name)
  assert.equal(await form.getByLabel('Cây trồng').inputValue(), 'RICE')
  assert.equal(await form.getByLabel('Chuẩn bị trước (ngày)').inputValue(), '14')
  assert.equal(await form.getByLabel('Hệ số nhu cầu').inputValue(), '1.8')
  assert.equal(await form.getByLabel('Mục tiêu Phân NPK 16-16-8').inputValue(), '104')
  assert.equal(await form.getByLabel('Mục tiêu Sản phẩm 3').inputValue(), '')
  assert.equal(await form.getByText('Thuốc trị rầy nâu', { exact: true }).count(), 0, 'a product the store does not carry is no rule line')
  assert.equal(manager.state.requests.filter(r => r.path.endsWith('/rule-draft')).length, 1)
  assert.equal(manager.state.saved, null, 'opening the form saves nothing')
  await shot(mp, 'rule-draft')
  pass('The form opens filled in from the season, explains the factor and the products left out, and saves nothing yet')

  await form.getByLabel('Hệ số nhu cầu').fill('2')
  await form.getByRole('button', { name: 'Lưu quy tắc' }).click()
  await mp.getByText('Đã tạo quy tắc mùa vụ cho vụ Lúa.').waitFor()
  assert.deepEqual(manager.state.saved, {
    name: draft.name, cropType: 'RICE', region: 'Cần Thơ', startsOn, endsOn, prepareDays: 14, demandFactor: 2, isActive: true,
    items: [{ storeProductId: 'sp-1', targetStockLevelBase: 104 }, { storeProductId: 'sp-3', targetStockLevelBase: null }],
  })
  await banner.waitFor({ state: 'detached' })
  pass('Saving posts the edited rule once; the season is then covered and leaves the dashboard')
  await manager.context.close()
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
