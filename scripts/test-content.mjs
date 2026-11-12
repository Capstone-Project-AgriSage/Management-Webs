import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// UI contract tests: every API is intercepted; no real article or contact is changed.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const base = 'http://content.test'
const at = '2026-11-12T10:00:00Z'
const permissions = ['ARTICLES.READ', 'ARTICLES.MANAGE', 'CONTACT_REQUESTS.READ', 'CONTACT_REQUESTS.MANAGE']
const paged = items => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1 })
let articles = []
const contact = { id: 'c1', requestNumber: 'CR-20261112-0001', contactName: 'Nguyễn Văn A', contactPhone: '0912345678', contactEmail: null, subject: 'Kỹ thuật canh tác', message: 'Cần hỗ trợ canh tác.', status: 'OPEN', resolutionNote: null, resolvedAt: null, createdAt: at, updatedAt: at }
const writes = []
let activePage
async function fixture(role = 'ADMIN', codes = permissions, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport })
  const state = { failUpload: false }
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'content-test-token'))
  await context.route(`${base}/**`, async route => {
    const name = new URL(route.request().url()).pathname
    if (name === '/article-image.jpg') return route.fulfill({ body: await readFile('public/images/farmland-dawn-v1.jpg'), contentType: 'image/jpeg' })
    const file = name.startsWith('/assets/') ? name.slice(1) : 'index.html'
    const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'
    await route.fulfill({ body: await readFile(path.join('dist', file)), contentType })
  })
  await context.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), name = url.pathname, method = req.method()
    const data = req.postData() && req.headers()['content-type']?.includes('application/json') ? req.postDataJSON() : null
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (name === '/api/auth/me') return json({ id: 'me', fullName: 'Người quản lý', role, status: 'ACTIVE' })
    if (name === '/api/me/permissions') return json({ role, permissions: codes, roleVersion: 1, memberVersion: 1, storeId: 'store1' })
    if (name.includes('/realtime/')) return json({}, 404)
    if (name.endsWith('/unread-count')) return json({ count: 0 })
    if (method !== 'GET') writes.push({ name, method, data })
    if (name === '/api/files/article-images') {
      assert.ok(req.headers()['content-type'].startsWith('multipart/form-data; boundary='))
      if (state.failUpload) return json({ title: 'Không tải được ảnh lên' }, 503)
      return json({ url: base + '/article-image.jpg', storageKey: '2026/11/test.jpg', sizeBytes: 1200 }, 201)
    }
    if (name === '/api/admin/articles' && method === 'GET') {
      let items = articles
      if (url.searchParams.get('status')) items = items.filter(a => a.status === url.searchParams.get('status'))
      if (url.searchParams.get('search')) items = items.filter(a => a.title.includes(url.searchParams.get('search')))
      return json(paged(items))
    }
    if (name === '/api/admin/articles' && method === 'POST') {
      const article = { ...data, id: 'a1', status: 'DRAFT', authorId: 'me', authorName: 'Người quản lý', publishedAt: null, createdAt: at, updatedAt: at }
      articles.push(article); return json(article, 201)
    }
    if (name === '/api/admin/articles/a1/status') { Object.assign(articles[0], { status: data.status, publishedAt: at }); return json(articles[0]) }
    if (name === '/api/admin/articles/a1' && method === 'PUT') { Object.assign(articles[0], data); return json(articles[0]) }
    if (name === '/api/admin/articles/a1' && method === 'DELETE') { articles = []; return route.fulfill({ status: 204 }) }
    if (name === '/api/contact-requests' && method === 'GET') return json(paged([contact]))
    if (name === '/api/contact-requests/c1' && method === 'PUT') { Object.assign(contact, data, { resolvedAt: at }); return json(contact) }
    return json(paged([]))
  })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  activePage = page
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  return { context, page, errors, state }
}

try {
  const { context, page, errors, state } = await fixture()
  await page.goto(base + '/admin/articles')
  await page.getByRole('button', { name: 'Viết bài mới', exact: true }).click()
  await page.getByLabel('Tiêu đề', { exact: true }).fill('Kỹ thuật lúa')
  await page.getByLabel('Đường dẫn (slug)', { exact: true }).fill('ky-thuat-lua')
  await page.getByLabel('Tóm tắt', { exact: true }).fill('Tóm tắt kiểm thử')
  await page.getByLabel('Nội dung', { exact: true }).fill('Nội dung thực tế\nDòng thứ hai')
  assert.equal(await page.getByRole('button', { name: 'Tạo bản nháp', exact: true }).isDisabled(), true)
  await page.getByLabel('Chọn ảnh bài viết', { exact: true }).setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('test') })
  await page.getByRole('alert').filter({ hasText: 'Chỉ nhận ảnh JPG, PNG hoặc WebP.' }).waitFor()
  state.failUpload = true
  await page.getByLabel('Chọn ảnh bài viết', { exact: true }).setInputFiles('public/images/farmland-dawn-v1.jpg')
  await page.getByRole('alert').filter({ hasText: 'Không tải được ảnh lên' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Tạo bản nháp', exact: true }).isDisabled(), true)
  state.failUpload = false
  await page.getByLabel('Chọn ảnh bài viết', { exact: true }).setInputFiles('public/images/farmland-dawn-v1.jpg')
  await page.getByRole('button', { name: 'Đổi ảnh', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Tạo bản nháp', exact: true }).click()
  await page.getByRole('button', { name: 'Kỹ thuật lúa', exact: true }).waitFor()
  assert.equal(articles[0].content, 'Nội dung thực tế\nDòng thứ hai')
  assert.equal(articles[0].status, 'DRAFT')
  assert.equal(articles[0].thumbnailUrl, base + '/article-image.jpg')
  await page.getByRole('button', { name: 'Thao tác bài viết Kỹ thuật lúa', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Xuất bản', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await page.getByRole('table').getByText('Đã xuất bản', { exact: true }).waitFor()
  assert.equal(articles[0].status, 'PUBLISHED')
  await page.getByRole('button', { name: 'Kỹ thuật lúa', exact: true }).click()
  assert.equal(await page.getByLabel('Nội dung', { exact: true }).inputValue(), 'Nội dung thực tế\nDòng thứ hai')
  await page.getByLabel('Nội dung', { exact: true }).fill('Nội dung đã cập nhật')
  await page.getByRole('button', { name: 'Lưu bài viết', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal(articles[0].content, 'Nội dung đã cập nhật')
  await mkdir('artifacts/content', { recursive: true })
  await page.screenshot({ path: 'artifacts/content/articles-desktop.png', fullPage: true })
  console.log('PASS required image, file validation, upload failure/retry, preview, create/edit/publish contracts')
  await page.goto(base + '/admin/contact-requests')
  await page.getByRole('button', { name: 'Thao tác CR-20261112-0001', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Xem và xử lý', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Trạng thái', { exact: true }).selectOption('RESOLVED')
  assert.equal(await page.getByRole('button', { name: 'Lưu phản hồi', exact: true }).isDisabled(), true)
  await page.getByLabel('Phản hồi', { exact: true }).fill('Đã hướng dẫn bà con canh tác.')
  await page.getByRole('button', { name: 'Lưu phản hồi', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal(contact.status, 'RESOLVED')
  assert.equal(contact.resolutionNote, 'Đã hướng dẫn bà con canh tác.')
  assert.deepEqual(errors, [])
  await context.close()
  console.log('PASS staff contact detail, required response, status and reply persistence contract')

  const mobile = await fixture('STORE_OWNER', permissions, { width: 390, height: 844 })
  await mobile.page.goto(base + '/agent/articles')
  await mobile.page.getByRole('button', { name: 'Thao tác bài viết Kỹ thuật lúa', exact: true }).waitFor()
  assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  await mobile.page.screenshot({ path: 'artifacts/content/articles-mobile.png', fullPage: true })
  await mobile.context.close()
  console.log('PASS owner route and mobile layout')

  const sales = await fixture('SALES_STAFF', ['CONTACT_REQUESTS.READ'])
  await sales.page.goto(base + '/sales/contact-requests')
  await sales.page.getByRole('button', { name: 'Thao tác CR-20261112-0001', exact: true }).click()
  await sales.page.getByRole('menuitem', { name: 'Xem và xử lý', exact: true }).click()
  assert.equal(await sales.page.getByLabel('Phản hồi', { exact: true }).isDisabled(), true)
  assert.equal(await sales.page.getByRole('button', { name: 'Lưu phản hồi', exact: true }).count(), 0)
  assert.equal(await sales.page.getByRole('link', { name: 'Bài viết & Tin tức', exact: true }).count(), 0)
  await sales.context.close()
  console.log('PASS contact read-only permission and article navigation restrictions')
  assert.equal(writes.filter(w => w.name.startsWith('/api/admin/articles') && w.method === 'POST').length, 2)
} catch (error) {
  console.log(await activePage.locator('body').innerText())
  console.log('writes', JSON.stringify(writes))
  throw error
} finally { await browser.close() }
