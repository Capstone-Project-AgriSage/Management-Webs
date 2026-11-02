import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Isolated API fixtures: never write to a real product catalog.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5173'
const allCodes = ['CATEGORIES', 'BRANDS'].flatMap(module => ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE'].map(action => `${module}.${action}`))
let checks = 0
const pass = name => { checks++; console.log(`PASS ${name}`) }

async function fixture(kind, { role = 'STORE_OWNER', codes = allCodes, width = 1440 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'catalog-test'))
  const rows = Array.from({ length: 16 }, (_, i) => ({
    id: `record-${i}`, name: `Bản ghi ${i + 1}`, code: `CODE-${i + 1}`, description: 'Mô tả', isActive: true,
    ...(kind === 'brands' ? { logoUrl: 'https://example.test/logo.png' } : { parentId: i === 0 ? 'parent-category' : null, displayOrder: i }),
  }))
  const state = { rows, requests: [], writes: [], failList: false, failWrite: false, holdWrite: null }
  if (process.env.UI_TEST_DIST) await context.route(`${base}/**`, async route => {
    const pathname = new URL(route.request().url()).pathname
    const file = pathname.startsWith('/assets/') ? pathname.slice(1) : 'index.html'
    const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.woff2') ? 'font/woff2' : 'text/html'
    await route.fulfill({ contentType, body: await readFile(path.join(process.env.UI_TEST_DIST, file)) })
  })
  await context.route('**/api/**', async route => {
    const req = route.request()
    const url = new URL(req.url())
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    state.requests.push({ path: url.pathname, method: req.method(), query: url.searchParams })
    if (url.pathname === '/api/auth/me') return json({ id: 'test-user', fullName: 'Quản lý kiểm thử', role, status: 'ACTIVE' })
    if (url.pathname === '/api/me/permissions') return json({ role, permissions: codes })
    if (url.pathname.endsWith('/unread-count')) return json({ count: 0 })
    if (url.pathname === `/api/${kind}` && req.method() === 'GET') {
      if (state.failList) return json({ detail: 'Không tải được danh mục kiểm thử' }, 503)
      const search = url.searchParams.get('search')?.toLowerCase() || ''
      const active = url.searchParams.get('isActive')
      const matches = state.rows.filter(row => `${row.name} ${row.code}`.toLowerCase().includes(search) && (active === null || row.isActive === (active === 'true')))
      const page = Number(url.searchParams.get('page') || 1)
      const pageSize = Number(url.searchParams.get('pageSize') || 15)
      return json({ items: matches.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: matches.length, totalPages: Math.ceil(matches.length / pageSize) })
    }
    if (url.pathname.startsWith(`/api/${kind}`) && req.method() !== 'GET') {
      const body = req.postData() ? req.postDataJSON() : null
      state.writes.push({ path: url.pathname, method: req.method(), body })
      if (state.holdWrite) await state.holdWrite
      if (state.failWrite) return json({ detail: 'Bản ghi đang được sử dụng, không thể xóa.' }, 409)
      const [, , , id, action] = url.pathname.split('/')
      if (req.method() === 'POST' && !id) {
        const row = { ...body, id: 'created-record', isActive: true }
        state.rows.unshift(row)
        return json(row, 201)
      }
      const row = state.rows.find(item => item.id === id)
      if (req.method() === 'PUT') { Object.assign(row, body); return json(row) }
      if (action === 'reorder') return route.fulfill({ status: 204 })
      if (action) row.isActive = action === 'activate'
      else state.rows = state.rows.filter(item => item.id !== id)
      return route.fulfill({ status: 204 })
    }
    if (url.pathname === '/api/files/product-images') {
      state.writes.push({ path: url.pathname, method: req.method(), body: req.method() === 'POST' ? 'multipart' : null })
      return route.fulfill({ status: req.method() === 'POST' ? 201 : 204, contentType: 'application/json', body: req.method() === 'POST' ? JSON.stringify({ url: 'https://example.test/storage/v1/object/public/product-images/2026/11/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png', storageKey: '2026/11/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png', sizeBytes: 12 }) : '' })
    }
    return json({ items: [], totalCount: 0, totalPages: 0 })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', err => errors.push(err.message))
  await page.goto(`${base}/${role === 'ADMIN' ? 'admin' : 'agent'}/products/${kind}`)
  return { context, page, state, errors }
}

async function rowAction(page, name, action) {
  await page.getByRole('button', { name: `Thao tác ${name}`, exact: true }).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

try {
  for (const kind of ['categories', 'brands']) {
    const unit = kind === 'categories' ? 'danh mục' : 'thương hiệu'
    const { page, state, context, errors } = await fixture(kind)
    await page.getByRole('cell', { name: 'Bản ghi 1', exact: true }).waitFor()
    assert.equal(await page.getByRole('link', { name: 'Danh mục sản phẩm', exact: true }).count(), 1)
    assert.equal(await page.getByRole('link', { name: 'Thương hiệu', exact: true }).count(), 1)
    await page.getByRole('button', { name: 'Trang 2', exact: true }).click()
    await page.getByRole('cell', { name: 'Bản ghi 16', exact: true }).waitFor()
    const search = page.getByPlaceholder(`Tìm theo mã hoặc tên ${unit}...`)
    await search.fill('CODE-1')
    await page.waitForResponse(res => res.url().includes(`api/${kind}?`) && res.url().includes('search=CODE-1'))
    await page.getByRole('cell', { name: 'Bản ghi 1', exact: true }).waitFor()
    assert.equal(state.requests.filter(req => req.path === `/api/${kind}`).at(-1).query.get('page'), '1')
    const cleared = page.waitForResponse(response => response.url().includes(`/api/${kind}?`) && !response.url().includes('search='))
    await page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    await cleared
    pass(`${kind}: owner navigation, server pagination and search reset`)

    if (kind === 'categories') {
      const rows = page.locator('tbody tr')
      const reorderResponse = page.waitForResponse(response => response.url().includes('/api/categories/record-2/reorder'))
      await rows.nth(2).dragTo(rows.nth(1))
      await reorderResponse
      assert.equal(state.writes.at(-1).body.position, 1)
      pass('categories: drag and drop calls the reorder API')
    }

    await page.getByRole('button', { name: `+ Thêm ${unit}`, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click()
    assert.equal(state.writes.filter(write => write.path === `/api/${kind}`).length, 0)
    await dialog.getByRole('textbox', { name: /^Tên/ }).fill('  Bản ghi mới  ')
    if (kind === 'categories') {
      await dialog.getByRole('textbox', { name: /^Mã/ }).fill('NEW-CODE')
      await dialog.getByRole('spinbutton', { name: 'Vị trí' }).fill('-1')
      await dialog.getByRole('button', { name: 'Lưu', exact: true }).click()
      assert.equal(state.writes.filter(write => write.path === `/api/${kind}`).length, 0)
      await dialog.getByRole('spinbutton', { name: 'Vị trí' }).fill('2')
    } else {
      const upload = dialog.getByLabel('Chọn logo thương hiệu')
      const uploadRequest = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/files/product-images')
      await upload.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) })
      await uploadRequest
    }
    let release
    state.holdWrite = new Promise(resolve => { release = resolve })
    const sent = page.waitForRequest(req => req.method() === 'POST' && new URL(req.url()).pathname === `/api/${kind}`)
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click()
    await sent
    assert.equal(await dialog.getByRole('button', { name: 'Đang lưu...' }).isDisabled(), true)
    assert.equal(await dialog.getByRole('textbox', { name: /^Tên/ }).isDisabled(), true)
    release()
    state.holdWrite = null
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('cell', { name: 'Bản ghi mới', exact: true }).waitFor()
    const createWrite = state.writes.find(write => write.path === `/api/${kind}` && write.method === 'POST')
    assert(createWrite)
    assert.equal(createWrite.body.name, 'Bản ghi mới')
    assert.equal(createWrite.body.description, null)
    assert.equal(createWrite.body.code, kind === 'categories' ? 'NEW-CODE' : null)
    if (kind === 'brands') assert.equal(createWrite.body.logoUrl, 'https://example.test/storage/v1/object/public/product-images/2026/11/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png')
    pass(`${kind}: create validation, API payload and busy controls`)

    await rowAction(page, 'Bản ghi 1', 'Sửa thông tin')
    await dialog.getByRole('textbox', { name: /^Tên/ }).fill('Tên đã sửa')
    if (kind === 'categories') assert.equal(await dialog.getByRole('textbox', { name: /^Mã/ }).count(), 0)
    else assert.equal(await dialog.getByRole('button', { name: 'Đổi ảnh', exact: true }).count(), 1)
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('cell', { name: 'Tên đã sửa', exact: true }).waitFor()
    const update = state.writes.find(write => write.method === 'PUT').body
    if (kind === 'categories') { assert.equal(update.parentId, 'parent-category'); assert.equal('code' in update, false) }
    else assert.equal(update.logoUrl, 'https://example.test/logo.png')
    await rowAction(page, 'Bản ghi mới', 'Ngừng hoạt động')
    await page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Bản ghi mới', exact: true }) }).getByText('Ngừng hoạt động', { exact: true }).waitFor()
    await page.getByRole('combobox', { name: 'Lọc trạng thái' }).selectOption('false')
    await page.waitForResponse(res => res.url().includes('isActive=false'))
    await page.getByRole('cell', { name: 'Tên đã sửa', exact: true }).waitFor({ state: 'hidden' })
    await rowAction(page, 'Bản ghi mới', 'Kích hoạt')
    await page.getByText(`Không có ${unit} phù hợp.`, { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
    await page.getByRole('cell', { name: 'Bản ghi mới', exact: true }).waitFor()
    pass(`${kind}: edit preserves metadata; activation and status filters use API`)

    await rowAction(page, 'Bản ghi mới', 'Xóa')
    await dialog.getByRole('button', { name: 'Hủy', exact: true }).click()
    assert.equal(state.writes.some(write => write.method === 'DELETE'), false)
    await rowAction(page, 'Bản ghi mới', 'Xóa')
    state.failWrite = true
    await dialog.getByRole('button', { name: 'Xóa', exact: true }).click()
    await page.getByText('Bản ghi đang được sử dụng, không thể xóa.', { exact: true }).waitFor()
    assert.equal(await dialog.isVisible(), true)
    state.failWrite = false
    await dialog.getByRole('button', { name: 'Xóa', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('cell', { name: 'Bản ghi mới', exact: true }).waitFor({ state: 'hidden' })
    pass(`${kind}: delete confirmation, conflict feedback and retry`)
    assert.deepEqual(errors, [])
    await context.close()
  }

  for (const kind of ['categories', 'brands']) {
    const prefix = kind === 'categories' ? 'CATEGORIES' : 'BRANDS'
    const readOnly = await fixture(kind, { role: 'ADMIN', codes: [`${prefix}.READ`] })
    await readOnly.page.getByRole('cell', { name: 'Bản ghi 1', exact: true }).waitFor()
    assert.equal(await readOnly.page.getByRole('button', { name: /^\+ Thêm/ }).count(), 0)
    assert.equal(await readOnly.page.getByRole('button', { name: /^Thao tác/ }).count(), 0)
    assert.equal(readOnly.state.writes.length, 0)
    await readOnly.context.close()
    const denied = await fixture(kind, { codes: ['PRODUCTS.READ', 'STORE_PRODUCTS.READ'] })
    await denied.page.getByRole('alert').filter({ hasText: 'Không có quyền truy cập chức năng này' }).waitFor()
    assert.equal(denied.state.requests.some(req => req.path === `/api/${kind}`), false)
    await denied.context.close()
    pass(`${kind}: independent read permission and write restrictions`)
  }

  const mobile = await fixture('brands', { width: 390 })
  await mobile.page.getByRole('cell', { name: 'Bản ghi 1', exact: true }).waitFor()
  assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  if (process.env.UI_SCREENSHOT_DIR) {
    await mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true })
    await mobile.page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/brands-mobile.png`, fullPage: true })
  }
  await mobile.page.getByRole('button', { name: '+ Thêm thương hiệu', exact: true }).click()
  const bounds = await mobile.page.getByRole('dialog').boundingBox()
  assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390)
  assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  if (process.env.UI_SCREENSHOT_DIR) await mobile.page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/brand-form-mobile.png`, fullPage: true })
  await mobile.context.close()
  pass('Mobile list and form fit the viewport')

  const retry = await fixture('brands')
  await retry.page.getByRole('cell', { name: 'Bản ghi 1', exact: true }).waitFor()
  retry.state.failList = true
  await retry.page.getByPlaceholder('Tìm theo mã hoặc tên thương hiệu...').fill('retry')
  await retry.page.getByRole('alert').filter({ hasText: 'Không tải được danh mục kiểm thử' }).waitFor()
  retry.state.failList = false
  await retry.page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await retry.page.getByText('Không có thương hiệu phù hợp.', { exact: true }).waitFor()
  await retry.context.close()
  pass('List error and retry recover correctly')
  console.log(`${checks} catalog checks passed`)
} finally {
  await browser.close()
}
