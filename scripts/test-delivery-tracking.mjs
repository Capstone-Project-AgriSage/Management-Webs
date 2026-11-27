import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// F2.8 (FLOW_2 §9a): the store sees the drivers of running trips on "Bản đồ giao hàng" and in the delivery detail (the
// running attempt's position, the route of finished attempts). Every API request and every map tile is intercepted; no
// live store and no OpenStreetMap server is reached.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const failures = []
const screenshotDir = process.env.DASHBOARD_SCREENSHOT_DIR
if (screenshotDir) await mkdir(screenshotDir, { recursive: true })
let checks = 0
const pass = message => { checks++; console.log('PASS ' + message) }

// A 1x1 transparent PNG for every tile.
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const ago = minutes => new Date(Date.now() - minutes * 60_000).toISOString()
const point = (latitude, longitude, minutesAgo) => ({ latitude, longitude, accuracyMeters: 8, recordedAt: ago(minutesAgo) })
const driver = { userId: 'driver-1', fullName: 'Lê Văn Tài', phoneNumber: '0909000111' }

const LIVE = [
  { deliveryId: 'd-1', deliveryNumber: 'DL-20261127-0001', orderId: 'o-1', orderNumber: 'OD-20261127-0001', recipientName: 'Nguyễn Văn An',
    addressLine: 'Ấp 3, Thới Lai', destination: { latitude: 10.0452, longitude: 105.7469 }, attemptId: 'att-3', attemptNumber: 3,
    startedAt: ago(20), driver, lastPoint: point(10.0380, 105.7600, 0.5) },
  { deliveryId: 'd-2', deliveryNumber: 'DL-20261127-0002', orderId: 'o-2', orderNumber: 'OD-20261127-0002', recipientName: 'Trần Thị Bình',
    addressLine: 'Ấp 5, Cờ Đỏ', destination: null, attemptId: 'att-9', attemptNumber: 1,
    startedAt: ago(40), driver: { ...driver, userId: 'driver-2', fullName: 'Phạm Văn Năm' }, lastPoint: point(10.0900, 105.6400, 10) },
]

const attempt = (id, number, status, over = {}) => ({ id, attemptNumber: number, status, attemptedBy: driver, startedAt: ago(200 - number * 50),
  completedAt: status === 'IN_PROGRESS' ? null : ago(190 - number * 50), receiverName: null, proofImageUrl: null,
  failureReasonCode: status === 'FAILED' ? 'CUSTOMER_ABSENT' : null, note: null, saleStockMovementId: null, items: [], ...over })

const DETAIL = {
  id: 'd-1', deliveryNumber: 'DL-20261127-0001', orderId: 'o-1', orderNumber: 'OD-20261127-0001', status: 'OUT_FOR_DELIVERY',
  assignedTo: driver, deliveryAddress: { recipientName: 'Nguyễn Văn An', recipientPhone: '0901234567', addressLine: 'Ấp 3', ward: null,
    district: 'Thới Lai', province: 'Cần Thơ', latitude: 10.0452, longitude: 105.7469 },
  scheduledAt: ago(300), dispatchedAt: ago(250), completedAt: null, note: null, createdBy: 'owner', createdAt: ago(400), cancelledBy: null,
  cancelledAt: null, cancelReason: null, items: [],
  attempts: [attempt('att-1', 1, 'FAILED'), attempt('att-2', 2, 'FAILED'), attempt('att-3', 3, 'IN_PROGRESS')],
}

const ROUTES = {
  'att-1': [point(10.0300, 105.7800, 150), point(10.0350, 105.7700, 148), point(10.0400, 105.7550, 146)],
  'att-2': [],
  'att-3': [point(10.0320, 105.7750, 15), point(10.0350, 105.7680, 8), point(10.0380, 105.7600, 0.5)],
}

async function session({ role = 'STORE_OWNER', live = LIVE, viewport = { width: 1440, height: 1000 } } = {}) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'delivery-tracking'))
  const state = { requests: [], tiles: 0 }
  await context.route('https://tile.openstreetmap.org/**', route => {
    state.tiles++
    return route.fulfill({ status: 200, contentType: 'image/png', body: TILE })
  })
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/realtime/negotiate') return route.abort()
    state.requests.push({ path, method: request.method() })
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {})
    const paged = (items = []) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1 })
    if (request.method() !== 'GET') { failures.push(`Unexpected write ${request.method()} ${path}`); return route.abort() }
    if (path === '/api/auth/me') return json({ id: 'me', fullName: role === 'SALES_STAFF' ? 'Nhân viên' : 'Chủ cửa hàng', role, status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ permissions: ['DELIVERIES.READ', 'DELIVERY_ATTEMPTS.READ', 'DELIVERY_INCIDENTS.READ', 'ORDERS.READ'] })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/deliveries/live') return json(live)
    const routeMatch = path.match(/^\/api\/deliveries\/([^/]+)\/attempts\/([^/]+)\/locations$/)
    if (routeMatch) return json(ROUTES[routeMatch[2]] ?? [])
    if (path === '/api/deliveries/d-1') return json(DETAIL)
    if (path === '/api/deliveries/d-1/incidents') return json([])
    if (path === '/api/deliveries') return json(paged([]))
    return json(paged([]))
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(`Page error: ${error.message}`))
  return { context, page, state }
}

const shot = async (page, name) => { if (screenshotDir) await page.screenshot({ path: join(screenshotDir, `${name}.png`), fullPage: true }) }
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
const markerCount = page => page.locator('[data-testid="delivery-map"] path.leaflet-interactive').count()

try {
  // The list links to the map; the map lists the running trips with their signal.
  const owner = await session()
  await owner.page.goto(`${base}/agent/deliveries`)
  await owner.page.getByRole('link', { name: 'Bản đồ giao hàng' }).first().click()
  await owner.page.waitForURL(/\/agent\/deliveries\/map$/)
  await owner.page.locator('.leaflet-container').waitFor()
  await owner.page.getByTestId('live-row').first().waitFor()
  assert.equal(await owner.page.getByTestId('live-row').count(), 2)
  assert.match(await owner.page.getByTestId('live-summary').innerText(), /2\s*chuyến đang giao · 1 chưa có hoặc mất tín hiệu/)
  const rows = owner.page.getByTestId('live-row')
  assert.match(await rows.nth(0).innerText(), /Cập nhật lúc \d\d:\d\d/)
  assert.match(await rows.nth(1).innerText(), /Mất tín hiệu từ \d\d:\d\d/)
  assert.match(await rows.nth(1).innerText(), /địa chỉ chưa có tọa độ/)
  pass('The map page lists the running trips with a fresh and a lost signal')

  // Two drivers and one destination with coordinates; OpenStreetMap tiles, with the attribution.
  await owner.page.waitForFunction(() => document.querySelectorAll('[data-testid="delivery-map"] path.leaflet-interactive').length >= 3)
  assert.equal(await markerCount(owner.page), 3)
  assert.ok(owner.state.tiles > 0, 'tiles were requested')
  assert.match(await owner.page.locator('.leaflet-control-attribution').innerText(), /OpenStreetMap/)
  assert.ok(await noSideScroll(owner.page))
  await shot(owner.page, 'delivery-map-page')
  pass('The map draws the drivers and the destinations on OpenStreetMap without side scroll')

  // A trip opens its delivery: the running attempt's position, read from its route.
  await rows.nth(0).click()
  const location = owner.page.getByTestId('driver-location')
  await location.waitFor()
  await location.getByTestId('attempt-location-status').waitFor()
  assert.match(await location.getByTestId('attempt-location-status').innerText(), /^Cập nhật lúc \d\d:\d\d$/)
  await location.locator('.leaflet-container').waitFor()
  assert.ok(owner.state.requests.some(r => r.path === '/api/deliveries/d-1/attempts/att-3/locations'))
  await owner.page.waitForFunction(() => document.querySelector('[data-testid="driver-location"]')?.querySelectorAll('path.leaflet-interactive').length >= 3)
  // The page's own map must stay under the modal: Leaflet's panes have z-indexes up to 1000 and take no pointer events,
  // so a hit test cannot see them; every map must therefore be its own stacking context.
  assert.ok((await owner.page.locator('[data-testid="delivery-map"]').evaluateAll(maps => maps.map(m => getComputedStyle(m).isolation)))
    .every(value => value === 'isolate'), 'every map is isolated')
  pass("The delivery detail shows the running attempt's driver, route and destination")

  // A finished attempt shows its route on demand; one without points says so.
  await owner.page.getByRole('button', { name: 'Xem đường đi' }).first().click()
  await owner.page.waitForFunction(() => document.querySelectorAll('.leaflet-container').length >= 3)
  assert.ok(owner.state.requests.some(r => r.path === '/api/deliveries/d-1/attempts/att-1/locations'))
  await owner.page.getByRole('button', { name: 'Ẩn đường đi' }).first().waitFor()
  await owner.page.getByRole('button', { name: 'Xem đường đi' }).first().click()
  await owner.page.getByTestId('attempt-location-empty').waitFor()
  assert.equal(await owner.page.getByRole('button', { name: 'Xem đường đi' }).count(), 0, 'every finished attempt is now open')
  await shot(owner.page, 'delivery-detail-routes')
  pass('Finished attempts show their route on demand, or say they have none')
  await owner.context.close()

  // Sales staff have the same map under /sales, from the sidebar.
  const sales = await session({ role: 'SALES_STAFF' })
  await sales.page.goto(`${base}/sales/deliveries`)
  await sales.page.locator('aside').getByRole('link', { name: 'Bản đồ giao hàng' }).click()
  await sales.page.waitForURL(/\/sales\/deliveries\/map$/)
  await sales.page.getByTestId('live-row').first().waitFor()
  pass('Sales staff open the map from the sidebar')
  await sales.context.close()

  // Nothing running: an empty map and a plain sentence; a phone width keeps the page in the screen.
  const quiet = await session({ live: [], viewport: { width: 390, height: 900 } })
  await quiet.page.goto(`${base}/agent/deliveries/map`)
  await quiet.page.getByTestId('live-empty').waitFor()
  assert.equal(await markerCount(quiet.page), 0)
  assert.ok(await noSideScroll(quiet.page))
  pass('With no running trip the page says so, also at 390 px')
  await quiet.context.close()
} catch (error) {
  failures.push(error.stack || String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Delivery tracking checks passed (${checks})`)
