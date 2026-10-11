import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { spawn } from 'node:child_process'

// Intercept every API request; never read or write live store data.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5174'
const server = process.env.UI_START_SERVER ? spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', new URL(base).port, '--strictPort'],
  { windowsHide: true, stdio: 'pipe' }) : null
if (server) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite startup timed out')), 15000)
    server.stdout.on('data', data => {
      if (data.toString().includes('Local:')) { clearTimeout(timeout); resolve() }
    })
    server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Vite exited with ${code}`)) })
  }).catch(error => { server.kill(); throw error })
}
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL }).catch(error => { server?.kill(); throw error })
const context = await browser.newContext()
await context.addInitScript(() => localStorage.setItem('agrisage_token', 'refund-performance-test'))
const requests = []
let failRefund = false
let amount = 10000
const row = (status, index, kind) => ({
  id: `${status}-${index}`, orderNumber: `OD-${status}-${index}`, returnNumber: `RT-${status}-${index}`,
  status, customerName: `Khách ${index}`, totalAmount: 10000, totalRefundAmount: 10000,
  createdAt: new Date(Date.UTC(2026, 9, 10) - (index * 2 + (status === 'CANCELLED' || status === 'INSPECTED' ? 0 : 1)) * 1000).toISOString(),
  requestedAt: new Date(Date.UTC(2026, 9, 10) - (index * 2 + (status === 'INSPECTED' ? 0 : 1)) * 1000).toISOString(),
  ...(kind === 'return' ? { orderId: `order-${index}` } : {}),
})
await context.route('**/api/**', async route => {
  const url = new URL(route.request().url())
  if (!url.pathname.startsWith('/api/')) return route.continue()
  const query = Object.fromEntries(url.searchParams)
  requests.push({ path: url.pathname, query })
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {})
  if (url.pathname === '/api/auth/me') return json({ id: 'owner', fullName: 'Kiểm thử', role: 'STORE_OWNER', status: 'ACTIVE' })
  if (url.pathname === '/api/me/permissions') return json({ permissions: ['REFUNDS.READ', 'ORDERS.READ', 'RETURNS.READ'] })
  if (url.pathname.endsWith('/unread-count')) return json({ count: 0 })
  if (url.pathname === '/api/orders' || url.pathname === '/api/returns') {
    const page = Number(query.page || 1)
    const items = query.search ? [] : Array.from({ length: 30 }, (_, index) => row(query.status, index, url.pathname === '/api/returns' ? 'return' : 'order'))
    if (page === 3) await new Promise(resolve => setTimeout(resolve, 250))
    return json({ items: items.slice((page - 1) * 10, page * 10), page, pageSize: 10, totalCount: items.length, totalPages: Math.ceil(items.length / 10) })
  }
  if (/\/api\/orders\/.+\/refunds$/.test(url.pathname)) {
    if (failRefund) return json({ title: 'Unavailable', detail: 'Không tải được khoản hoàn kiểm thử' }, 503)
    return json([{ id: 'refund-' + url.pathname, originalPaymentId: 'payment', amount, status: 'PENDING' }])
  }
  return json({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 })
})
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const count = path => requests.filter(request => request.path === path).length
const refundCount = () => requests.filter(request => /\/api\/orders\/.+\/refunds$/.test(request.path)).length
const table = kind => page.getByRole('region', { name: kind === 'order' ? 'Hoàn tiền từ đơn đã hủy' : 'Hoàn tiền từ trả hàng', exact: true })
async function ready(kind, text) {
  await table(kind).getByText(text, { exact: true }).waitFor()
  await page.waitForFunction(label => document.querySelector(`section[aria-label="${label}"]`)?.getAttribute('aria-busy') === 'false', kind === 'order' ? 'Hoàn tiền từ đơn đã hủy' : 'Hoàn tiền từ trả hàng')
}

try {
  await page.goto(base + '/agent/refunds')
  await ready('order', 'OD-CANCELLED-0')
  await page.getByText('Cần hoàn 100.000 đ (trước khi trừ các khoản đã hoàn)', { exact: true }).waitFor()
  assert.equal(count('/api/orders'), 2, 'StrictMode must not duplicate the two source reads')
  assert.equal(count('/api/returns'), 2)
  assert.equal(refundCount(), 10)
  console.log('PASS Initial load: one read per source and per visible order, including StrictMode')

  await table('order').getByRole('button', { name: 'Trang 2', exact: true }).click()
  await ready('order', 'OD-CANCELLED-5')
  assert.equal(count('/api/orders'), 4, 'Page 2 must reuse both source page-1 results')
  assert.equal(count('/api/returns'), 2, 'Inactive return tab must not load again')
  assert.equal(refundCount(), 20)
  const beforeBack = requests.length
  await table('order').getByRole('button', { name: 'Trang 1', exact: true }).click()
  await ready('order', 'OD-CANCELLED-0')
  assert.equal(requests.length, beforeBack, 'Returning to a loaded page must reuse its lists and refunds')
  console.log('PASS Pagination fetches only missing source pages; revisiting a page needs no requests')

  await table('order').getByRole('button', { name: 'Trang 3', exact: true }).click()
  await table('order').getByText('Đang tải...', { exact: true }).waitFor()
  assert.equal(await table('order').getByText('OD-CANCELLED-0', { exact: true }).count(), 0)
  await table('order').getByRole('button', { name: 'Trang 1', exact: true }).click()
  await ready('order', 'OD-CANCELLED-0')
  await page.waitForTimeout(350)
  assert.equal(await table('order').getByText('OD-CANCELLED-0', { exact: true }).count(), 1)
  assert.equal(await table('order').getByText('OD-CANCELLED-10', { exact: true }).count(), 0)
  console.log('PASS Rapid navigation cancels obsolete reads and never displays late/stale rows')

  await page.getByRole('tab', { name: 'Từ trả hàng', exact: true }).click()
  await ready('return', 'RT-INSPECTED-0')
  const beforeReturns = { orders: count('/api/orders'), refunds: refundCount(), returns: count('/api/returns') }
  await table('return').getByRole('button', { name: 'Trang 2', exact: true }).click()
  await ready('return', 'RT-INSPECTED-5')
  assert.equal(count('/api/orders'), beforeReturns.orders)
  assert.equal(refundCount(), beforeReturns.refunds)
  assert.equal(count('/api/returns'), beforeReturns.returns + 2)
  console.log('PASS Return pagination leaves order APIs untouched')

  await page.getByRole('tab', { name: 'Từ đơn đã hủy', exact: true }).click()
  await ready('order', 'OD-CANCELLED-0')
  amount = 20000
  const beforeWrite = refundCount()
  await page.evaluate(() => window.dispatchEvent(new Event('agrisage-business-data-changed')))
  await table('order').getByText('20.000 đ', { exact: true }).first().waitFor()
  await ready('order', 'OD-CANCELLED-0')
  assert.equal(refundCount(), beforeWrite + 10, 'Successful writes must invalidate cached financial data')
  console.log('PASS Business changes invalidate caches and display updated refund amounts')

  failRefund = true
  await page.getByRole('button', { name: 'Làm mới danh sách', exact: true }).click()
  await table('order').getByText('Không tải được khoản hoàn kiểm thử', { exact: true }).waitFor()
  assert.equal(await table('order').getByText('Không có đơn hủy nào đang chờ hoàn tiền.', { exact: true }).count(), 0)
  failRefund = false
  await page.getByRole('button', { name: 'Làm mới danh sách', exact: true }).click()
  await ready('order', 'OD-CANCELLED-0')
  const beforeStatus = count('/api/orders')
  await page.getByRole('combobox', { name: 'Lọc trạng thái nguồn hoàn tiền', exact: true }).selectOption('CANCELLED')
  await ready('order', 'OD-CANCELLED-9')
  assert.equal(count('/api/orders'), beforeStatus)
  await table('order').getByRole('button', { name: 'Trang 3', exact: true }).click()
  await ready('order', 'OD-CANCELLED-20')
  assert.equal(count('/api/orders'), beforeStatus + 1)
  console.log('PASS Filtering to one status jumps directly to the selected page')
  assert.deepEqual(errors, [])
  console.log('PASS Failed refund reads are visible, never cached as an empty successful list, and can be retried')

  const source = fs.readFileSync('src/utils/requestCache.ts', 'utf8').replace('export class', 'class')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const RequestCache = new Function(compiled + '\nreturn RequestCache')()
  const cache = new RequestCache(0)
  let reads = 0
  await cache.get('expiry', async () => ++reads)
  await cache.get('expiry', async () => ++reads)
  assert.equal(reads, 2)
  const bounded = new RequestCache(30000, 1)
  await bounded.get('one', async () => ++reads)
  await bounded.get('two', async () => ++reads)
  await bounded.get('one', async () => ++reads)
  assert.equal(reads, 5)
  const controller = new AbortController()
  let release
  const pending = bounded.get('aborted', () => new Promise(resolve => { release = resolve }), controller.signal)
  await Promise.resolve()
  controller.abort()
  release('old')
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(await bounded.get('aborted', async () => 'new'), 'new')
  console.log('PASS Cache expires, stays bounded, and never reuses aborted results')

  const mergeSource = fs.readFileSync('src/utils/mergePagedLists.ts', 'utf8').replace(/^import .*\n/gm, '').replace('export async function', 'async function')
  const mergeCompiled = ts.transpileModule('const LIST_PAGE_SIZE = 10;\n' + mergeSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const merge = new Function(mergeCompiled + '\nreturn mergePagedLists')()
  const pages = []
  const result = await merge([async page => {
    pages.push(page)
    return { items: [page], page, pageSize: 10, totalCount: 60, totalPages: 6 }
  }], 5, (a, b) => a - b)
  assert.deepEqual(pages, [5])
  assert.equal(result.page, 5)
  console.log('PASS A single selected status loads the requested page directly, even on a deep jump')
} catch (error) {
  console.error('Browser errors:', errors)
  console.error('API requests:', requests)
  console.error('Visible page:', await page.locator('body').innerText())
  throw error
} finally {
  await context.close()
  await browser.close()
  server?.kill()
}
