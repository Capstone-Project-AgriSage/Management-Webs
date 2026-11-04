import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

// Input consultation, store side (ADVISORY.md sections 6 and 7): new problems, the reviewed links problem -> product with
// their approval, and the advice log. Every /api request is intercepted before navigation; no live backend is called.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const failures = []
const at = '2026-11-02T03:00:00Z'

const disease = (id, code, name, problemType, extra = {}) => ({
  id, code, name, scientificName: null, cropType: 'RICE', description: 'Mô tả.', symptoms: 'Triệu chứng.', causes: null, prevention: 'Phòng ngừa.',
  isHealthyClass: false, isActive: true, treatments: [], problemType, searchKeywords: null, ...extra,
})
const diseases = [
  disease('d-blast', 'LEAF_BLAST', 'Bệnh đạo ôn lá', 'DISEASE', { searchKeywords: 'đạo ôn, cháy lá', treatments: [
    { id: 't-active', diseaseId: 'd-blast', treatmentType: 'CULTURAL', title: 'Hướng dẫn canh tác kiểm thử', instructions: 'Nội dung hướng dẫn kiểm thử.', activeIngredientId: null, activeIngredientName: null, precautions: null, priority: 10, isActive: true },
    { id: 't-inactive', diseaseId: 'd-blast', treatmentType: 'OTHER', title: 'Hướng dẫn đã ngừng', instructions: 'Nội dung cũ để tra cứu.', activeIngredientId: null, activeIngredientName: null, precautions: null, priority: 0, isActive: false },
  ] }),
  disease('d-brown', 'BROWN_PLANTHOPPER', 'Rầy nâu', 'PEST'),
  disease('d-healthy', 'HEALTHY', 'Lá khỏe', 'DISEASE', { isHealthyClass: true }),
]
const link = (id, productName, status, extra = {}) => ({
  id, diseaseId: 'd-blast', productId: `p-${id}`, sku: `SKU-${id}`, productName, recommendationGroup: 'PROTECTION',
  registrationSource: 'TT 75/2025/TT-BNNMT, Phụ lục I, tr. 246', reason: null, doseText: '0,5 lít/ha, phun khi bệnh chớm xuất hiện.',
  doseSource: 'syngenta.com.vn/filiar-525se', dosePerHaBase: 5, baseUnit: 'Chai', applications: 1, preHarvestDays: 14,
  growthStages: [], priority: 20, status, approvedBy: status === 'APPROVED' ? 'u1' : null, approvedAt: status === 'APPROVED' ? at : null, ...extra,
})
const links = [
  link('a1', 'Filia 525SE', 'APPROVED'),
  link('b2', 'Beam 75WP', 'DRAFT', { dosePerHaBase: null, preHarvestDays: null, doseSource: null, doseText: 'Theo hướng dẫn trên nhãn.' }),
  link('c3', 'Thuốc cũ', 'INACTIVE'),
]
const product = {
  id: 'p-tilt', sku: 'TILT-100', name: 'Tilt Super 300EC', categoryId: 'c1', categoryName: 'Thuốc BVTV', brandId: null, brandName: null,
  description: null, usageInstructions: null, requiresLotTracking: true, requiresExpiryDate: true, imageUrl: null, status: 'ACTIVE',
  packagings: [{ id: 'pk1', unitId: 'u1', unitCode: 'BOTTLE', unitName: 'Chai', packagingName: 'Chai 100 ml', conversionToBase: 1, isBaseUnit: true, isPurchaseUnit: true, isSaleUnit: true, status: 'ACTIVE' }],
  ingredients: [], store: null,
}
const sessions = [
  {
    id: 's1', createdAt: at, farmer: { id: 'f1', name: 'Nguyễn Văn Thu', phone: '0912345678' }, problem: { id: 'd-blast', name: 'Bệnh đạo ôn lá' },
    source: 'TEXT', areaSqm: 3000, growthStage: 'HEADING', boughtWithin7Days: true,
    items: [{ storeProductId: 'sp1', name: 'Filia 525SE', group: 'PROTECTION', rankOrder: 1 }, { storeProductId: 'sp2', name: 'Phân NPK', group: 'NUTRITION', rankOrder: 1 }],
  },
  {
    id: 's2', createdAt: at, farmer: { id: 'f2', name: 'Trần Thị Mai', phone: null }, problem: { id: 'd-brown', name: 'Rầy nâu' },
    source: 'DIAGNOSIS_CASE', areaSqm: null, growthStage: null, boughtWithin7Days: false, items: [],
  },
]
const paged = (items) => ({ items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1 })

async function session(role, permissions, records = diseases) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'advisory-admin-test'))
  const state = { requests: [], failReads: false }
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    const method = request.method()
    const body = request.postData() ? JSON.parse(request.postData()) : null
    state.requests.push({ path, method, body, query: url.search })
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) }).catch(() => {})
    if (path.startsWith('/api/realtime/')) return json({ title: 'Not available in the test' }, 404)
    if (path === '/api/auth/me') return json({ id: 'me', fullName: 'Người kiểm thử', role, status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ role, storeId: 's1', roleVersion: 1, memberVersion: 1, permissions })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/diseases' && method === 'GET') return state.failReads ? json({ title: 'Không tải được danh sách thử nghiệm' }, 503) : json(records)
    if (path === '/api/diseases' && method === 'POST') return json({ ...disease('d-new', body.code, body.name, body.problemType), searchKeywords: body.searchKeywords }, 201)
    if (path === '/api/diseases/d-blast/products' && method === 'GET') return json(links)
    if (path === '/api/diseases/d-blast/products' && method === 'POST') return json(link('n9', 'Tilt Super 300EC', 'DRAFT', body), 201)
    if (/^\/api\/disease-products\/[^/]+$/.test(path) && method === 'PUT') return json(link('a1', 'Filia 525SE', 'DRAFT', body))
    if (/^\/api\/disease-products\/[^/]+\/approve$/.test(path)) return json(link('b2', 'Beam 75WP', 'APPROVED'))
    if (path === '/api/active-ingredients') return json(paged([]))
    if (path === '/api/products' && method === 'GET') return json(paged([{ id: product.id, sku: product.sku, name: product.name, categoryId: 'c1', categoryName: 'Thuốc BVTV', brandId: null, brandName: null, imageUrl: null, status: 'ACTIVE' }]))
    if (path === '/api/products/p-tilt' && method === 'GET') return json(product)
    if (path === '/api/advisory/sessions') return json(paged(sessions))
    failures.push(`Unhandled mock API ${method} ${path}`)
    return json({ title: 'Unexpected test request' }, 500)
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(error.message))
  return { context, page, state }
}

async function check(name, fn) {
  try { await fn(); console.log(`ok  ${name}`) } catch (error) { failures.push(`${name}: ${error.message}`); console.log(`FAIL ${name}: ${error.message}`) }
}

const owner = ['DISEASES.READ', 'DISEASES.UPDATE', 'DISEASES.CREATE', 'DISEASE_TREATMENTS.CREATE', 'DISEASE_PRODUCTS.READ', 'DISEASE_PRODUCTS.CREATE',
  'DISEASE_PRODUCTS.UPDATE', 'DISEASE_PRODUCTS.APPROVE', 'DISEASE_PRODUCTS.DEACTIVATE', 'ADVISORY_SESSIONS.READ', 'INGREDIENTS.READ',
  'DISEASE_TREATMENTS.UPDATE', 'DISEASE_TREATMENTS.ACTIVATE', 'DISEASE_TREATMENTS.DEACTIVATE']

{
  const { context, page, state } = await session('STORE_OWNER', owner)
  const panel = (code) => page.getByTestId(`products-${code}`)

  await check('the page lists each problem with its type and keywords', async () => {
    await page.goto(`${base}/agent/diseases`)
    await page.getByText('Bệnh đạo ôn lá').first().waitFor()
    assert.equal(await page.locator('.agrisage-kpi-card').count(), 4)
    assert.equal(await page.getByRole('table', { name: 'Danh sách vấn đề trên lúa' }).locator('tbody tr').count(), 3)
    assert.equal(await panel('LEAF_BLAST').count(), 0, 'detail panels are not mounted in the list')
    const reads = state.requests.filter(r => r.path === '/api/diseases').length
    await page.getByRole('textbox', { name: 'Tìm vấn đề trên lúa' }).fill('chay la')
    await page.getByRole('button', { name: 'Xem chi tiết Đạo ôn', exact: true }).waitFor()
    assert.equal(await page.getByRole('table', { name: 'Danh sách vấn đề trên lúa' }).locator('tbody tr').count(), 1, 'Vietnamese keyword search ignores accents')
    await page.getByRole('button', { name: 'Xóa lọc' }).click()
    await page.getByLabel('Loại vấn đề', { exact: true }).selectOption('PEST')
    await page.getByRole('button', { name: 'Xem chi tiết Rầy nâu' }).waitFor()
    assert.equal(await page.getByRole('table', { name: 'Danh sách vấn đề trên lúa' }).locator('tbody tr').count(), 1)
    await page.getByRole('textbox', { name: 'Tìm vấn đề trên lúa' }).fill('khong co ket qua')
    await page.getByText('Không có vấn đề phù hợp.', { exact: false }).waitFor()
    await page.getByRole('button', { name: 'Xóa lọc' }).click()
    assert.equal(state.requests.filter(r => r.path === '/api/diseases').length, reads, 'local filters reuse the complete API result')
    if (process.env.UI_SCREENSHOT_DIR) {
      await mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true })
      await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'list-desktop.png'), fullPage: true, animations: 'disabled' })
      await page.setViewportSize({ width: 390, height: 844 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile page does not overflow')
      await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'list-mobile.png'), fullPage: true, animations: 'disabled' })
      await page.setViewportSize({ width: 1280, height: 900 })
    }
    await page.getByRole('button', { name: 'Xem chi tiết Đạo ôn', exact: true }).click()
    const detail = page.getByRole('dialog', { name: 'Chi tiết vấn đề: Đạo ôn', exact: true })
    await detail.waitFor()
    assert.equal(await page.getByRole('table', { name: 'Danh sách vấn đề trên lúa' }).count(), 1, 'the list stays mounted behind the popup')
    assert.equal(new URL(page.url()).pathname, '/agent/diseases')
    const text = await detail.innerText()
    assert.match(text, /Bệnh/)
    assert.match(text, /đạo ôn, cháy lá/)
    assert.equal(await panel('HEALTHY').count(), 0, 'the healthy class gets no product panel')
    await page.getByRole('dialog').first().getByRole('button', { name: 'Đóng', exact: true }).first().click()
    assert.ok(await page.getByText('Rầy nâu').count() > 0)
  })

  await check('a new problem is created with its code, type and keywords', async () => {
    await page.getByRole('button', { name: 'Thêm vấn đề' }).click()
    const dialog = page.getByRole('dialog').last()
    const create = dialog.getByRole('button', { name: 'Thêm vấn đề' })
    assert.ok(await create.isDisabled(), 'disabled while empty')
    await dialog.getByLabel('Mã vấn đề').fill('bad code')
    await dialog.getByLabel('Tên vấn đề').fill('Sâu cuốn lá')
    assert.ok(await create.isDisabled(), 'a code with a space is refused')
    await dialog.getByLabel('Mã vấn đề').fill('leaf_folder')
    assert.equal(await dialog.getByLabel('Mã vấn đề').inputValue(), 'LEAF_FOLDER', 'the code is upper-cased')
    await dialog.getByLabel('Loại vấn đề').selectOption('PEST')
    await dialog.locator('textarea').first().fill('sâu cuốn lá, lá bị cuốn')
    await create.click()
    await page.waitForTimeout(300)
    const post = state.requests.find(r => r.method === 'POST' && r.path === '/api/diseases')
    assert.ok(post, 'POST sent')
    assert.equal(post.body.code, 'LEAF_FOLDER')
    assert.equal(post.body.problemType, 'PEST')
    assert.equal(post.body.name, 'Sâu cuốn lá')
    assert.equal(post.body.searchKeywords, 'sâu cuốn lá, lá bị cuốn')
  })

  await check('the product panel loads on demand and shows source, dose, status and gaps', async () => {
    assert.equal(state.requests.filter(r => r.path === '/api/diseases/d-blast/products').length, 0, 'nothing is loaded before opening')
    await page.getByRole('button', { name: 'Xem chi tiết Đạo ôn', exact: true }).click()
    await panel('LEAF_BLAST').getByRole('button', { name: /Sản phẩm gợi ý/ }).click()
    await panel('LEAF_BLAST').getByText('Filia 525SE').first().waitFor()
    const text = await panel('LEAF_BLAST').innerText()
    assert.match(text, /1 đã duyệt, 1 chờ duyệt/)
    assert.match(text, /Đăng ký: TT 75\/2025\/TT-BNNMT, Phụ lục I, tr\. 246/)
    assert.match(text, /5 chai\/ha × 1 lần/)
    assert.match(text, /Cách ly 14 ngày/)
    assert.match(text, /Chưa có liều theo ha/)
    assert.match(text, /Chưa ghi thời gian cách ly/)
    assert.match(text, /Nháp, chưa duyệt/)
    assert.match(text, /Đã ngừng/)
    if (process.env.UI_SCREENSHOT_DIR) {
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'detail-desktop.png'), fullPage: false, animations: 'disabled' })
      await page.setViewportSize({ width: 390, height: 844 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'detail-mobile.png'), fullPage: false, animations: 'disabled' })
      await page.setViewportSize({ width: 1280, height: 900 })
    }
  })

  await check('treatment row menus preserve state restrictions and confirmation', async () => {
    await page.getByRole('button', { name: 'Thao tác cách xử lý Hướng dẫn canh tác kiểm thử', exact: true }).click()
    assert.equal(await page.getByRole('menuitem', { name: 'Kích hoạt lại', exact: true }).count(), 0)
    await page.getByRole('menuitem', { name: 'Ngừng cách xử lý', exact: true }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: 'Hủy', exact: true }).click()
    await page.getByRole('button', { name: 'Thao tác cách xử lý Hướng dẫn đã ngừng', exact: true }).click()
    assert.equal(await page.getByRole('menuitem', { name: 'Ngừng cách xử lý', exact: true }).count(), 0)
    await page.getByRole('menuitem', { name: 'Kích hoạt lại', exact: true }).waitFor()
    await page.keyboard.press('Escape')
  })

  await check('approving needs the tick that the label was checked, then sends one POST', async () => {
    await page.getByRole('button', { name: 'Thao tác sản phẩm Beam 75WP' }).click()
    await page.getByRole('menuitem', { name: 'Duyệt liên kết' }).click()
    const dialog = page.getByRole('dialog').last()
    const approve = dialog.getByRole('button', { name: 'Duyệt', exact: true })
    assert.ok(await approve.isDisabled(), 'disabled until the box is ticked')
    await dialog.getByRole('checkbox').check()
    await approve.click()
    await page.waitForTimeout(300)
    assert.ok(state.requests.find(r => r.method === 'POST' && r.path === '/api/disease-products/b2/approve'), 'approve sent')
    assert.equal(await page.getByRole('button', { name: 'Duyệt liên kết Filia 525SE' }).count(), 0, 'an approved link has no approve button')
  })

  await check('a new link needs a source for a pesticide and sends the dose in base units', async () => {
    await page.getByRole('button', { name: 'Thêm sản phẩm gợi ý cho Bệnh đạo ôn lá' }).click()
    const dialog = page.getByRole('dialog').last()
    const add = dialog.getByRole('button', { name: 'Thêm sản phẩm' })
    assert.ok(await add.isDisabled(), 'disabled with no product')
    await dialog.getByRole('button', { name: /Tilt Super 300EC/ }).click()
    await dialog.getByText(/Liều cho 1 ha \(chai 100 ml\)/).waitFor()
    await dialog.locator('textarea').first().fill('0,25-0,3 lít/ha pha trong 500-600 lít nước.')
    assert.ok(await add.isDisabled(), 'a pesticide without a registration source is refused')
    await dialog.getByPlaceholder('TT 75/2025/TT-BNNMT, Phụ lục I, tr. 187').fill('TT 75/2025/TT-BNNMT, Phụ lục I, tr. 187')
    await dialog.getByLabel('Liều cho 1 ha', { exact: true }).fill('0')
    assert.ok(await add.isDisabled(), 'a dose of 0 is refused')
    await dialog.getByLabel('Liều cho 1 ha', { exact: true }).fill('3')
    await dialog.getByLabel('Thời gian cách ly').fill('14')
    await dialog.getByLabel('Trổ bông').check()
    await add.click()
    await page.waitForTimeout(300)
    const post = state.requests.find(r => r.method === 'POST' && r.path === '/api/diseases/d-blast/products')
    assert.ok(post, 'POST sent')
    assert.equal(post.body.productId, 'p-tilt')
    assert.equal(post.body.recommendationGroup, 'PROTECTION')
    assert.equal(post.body.registrationSource, 'TT 75/2025/TT-BNNMT, Phụ lục I, tr. 187')
    assert.equal(post.body.reason, null)
    assert.equal(post.body.dosePerHaBase, 3)
    assert.equal(post.body.applications, 1)
    assert.equal(post.body.preHarvestDays, 14)
    assert.deepEqual(post.body.growthStages, ['HEADING'])
  })

  await check('editing an approved link warns that it goes back to draft', async () => {
    await page.getByRole('button', { name: 'Thao tác sản phẩm Filia 525SE' }).click()
    await page.getByRole('menuitem', { name: 'Sửa liên kết' }).click()
    const dialog = page.getByRole('dialog').last()
    assert.match(await dialog.innerText(), /quay về Nháp|đưa nó về Nháp/)
    await dialog.getByLabel('Mức ưu tiên').fill('30')
    await dialog.getByRole('button', { name: 'Lưu liên kết' }).click()
    await page.waitForTimeout(300)
    const put = state.requests.find(r => r.method === 'PUT' && r.path === '/api/disease-products/a1')
    assert.ok(put, 'PUT sent')
    assert.equal(put.body.priority, 30)
    assert.equal(put.body.productId, undefined, 'the product cannot change on an edit')
  })

  await check('detail layout and row menus remain reachable on mobile', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    const detail = page.getByRole('dialog', { name: 'Chi tiết vấn đề: Đạo ôn', exact: true })
    const box = await detail.boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'the popup fits inside the mobile viewport')
    await page.getByRole('button', { name: 'Thao tác sản phẩm Filia 525SE' }).click()
    const items = await page.getByRole('menuitem').locator('span:last-child').allTextContents()
    assert.deepEqual(items, ['Sửa liên kết', 'Ngừng liên kết'], 'destructive action is last and approved products cannot be approved again')
    await page.keyboard.press('Escape')
    assert.equal(await detail.count(), 1, 'Escape closes the action menu without closing the detail popup')
    await page.getByRole('dialog').first().getByRole('button', { name: 'Đóng', exact: true }).first().click()
    assert.equal(await page.getByRole('button', { name: 'Xem chi tiết Đạo ôn', exact: true }).evaluate(e => e === document.activeElement), true, 'focus returns to the selected record')
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  await check('the advice log shows the farmer, the products and the purchase', async () => {
    await page.goto(`${base}/agent/advisory-sessions`)
    await page.getByText('Nguyễn Văn Thu').first().waitFor()
    const text = await page.locator('table').innerText()
    assert.match(text, /3 công \(3\.000 m²\)/)
    assert.match(text, /Trổ bông/)
    assert.match(text, /Filia 525SE/)
    assert.match(text, /Phân NPK/)
    assert.match(text, /Đã mua/)
    assert.match(text, /Từ kết quả AI/)
    assert.match(text, /Không có sản phẩm/)
    assert.equal(await page.locator('a[href="tel:0912345678"]').count(), 1)
    assert.ok(await page.getByRole('link', { name: 'Ca tư vấn vật tư' }).count() > 0, 'sidebar entry')
  })

  await check('an inverted date range is refused before any request', async () => {
    await page.getByLabel('Từ ngày').fill('2026-11-10')
    await page.getByLabel('Đến ngày').fill('2026-11-01')
    await page.getByRole('alert').filter({ hasText: 'Ngày bắt đầu' }).waitFor()
    await page.waitForTimeout(200)
    const queries = state.requests.filter(r => r.path === '/api/advisory/sessions').map(r => r.query)
    assert.ok(queries.some(q => q.includes('from=2026-11-10') && !q.includes('to=')), 'the valid first date was sent alone')
    assert.ok(!queries.some(q => q.includes('from=2026-11-10') && q.includes('to=2026-11-01')), 'the inverted range was never sent')
  })
  await context.close()
}

// Without the approve and create rights the buttons are absent, and a role without ADVISORY_SESSIONS.READ gets no log.
{
  const { context, page } = await session('STORE_OWNER', ['DISEASES.READ', 'DISEASE_PRODUCTS.READ'])
  await check('a reader sees links but no approve, edit, add or create button', async () => {
    await page.goto(`${base}/agent/diseases`)
    await page.getByText('Bệnh đạo ôn lá').first().waitFor()
    await page.getByRole('button', { name: 'Xem chi tiết Đạo ôn', exact: true }).click()
    await page.getByTestId('products-LEAF_BLAST').getByRole('button', { name: /Sản phẩm gợi ý/ }).click()
    await page.getByTestId('products-LEAF_BLAST').getByText('Beam 75WP').first().waitFor()
    for (const name of [/^Duyệt liên kết/, /^Sửa liên kết/, /^Ngừng liên kết/, /^Thêm sản phẩm gợi ý/, /^Thêm vấn đề/]) {
      assert.equal(await page.getByRole('button', { name }).count(), 0, String(name))
    }
    assert.equal(await page.getByRole('button', { name: /^Thao tác sản phẩm/ }).count(), 0, 'readers have no product action menu')
    assert.equal(await page.getByRole('button', { name: /^Thao tác cách xử lý/ }).count(), 0, 'readers have no treatment action menu')
    assert.equal(await page.getByRole('link', { name: 'Ca tư vấn vật tư' }).count(), 0, 'no sidebar entry without the permission')
  })
  await check('the advice log route is closed without ADVISORY_SESSIONS.READ', async () => {
    await page.goto(`${base}/agent/advisory-sessions`)
    await page.getByText('Không có quyền truy cập chức năng này').waitFor()
  })
  await context.close()
}

{
  const records = Array.from({ length: 12 }, (_, i) => disease(`extra-${i}`, `PEST_${i}`, `Sâu hại ${i + 1}`, 'PEST', { isActive: i !== 11 }))
  const { context, page } = await session('STORE_OWNER', ['DISEASES.READ'], records)
  await check('pagination, status filters and detail navigation preserve the current page', async () => {
    await page.goto(`${base}/agent/diseases`)
    const table = page.getByRole('table', { name: 'Danh sách vấn đề trên lúa' })
    await page.getByRole('button', { name: 'Trang 2', exact: true }).waitFor()
    assert.equal(await table.locator('tbody tr').count(), 10)
    await page.getByRole('button', { name: 'Trang 2', exact: true }).click()
    await page.getByRole('button', { name: 'Xem chi tiết Sâu hại 12', exact: true }).click()
    await page.getByRole('dialog', { name: 'Chi tiết vấn đề: Sâu hại 12' }).waitFor()
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 0, 'Escape closes the detail popup')
    assert.equal(await page.getByRole('button', { name: 'Trang 2', exact: true }).getAttribute('aria-current'), 'page')
    await page.getByLabel('Trạng thái', { exact: true }).selectOption('inactive')
    await page.getByRole('button', { name: 'Xem chi tiết Sâu hại 12', exact: true }).waitFor()
    assert.equal(await table.locator('tbody tr').count(), 1)
    assert.equal(await page.getByRole('button', { name: 'Trang 1', exact: true }).getAttribute('aria-current'), 'page')
    await page.getByRole('button', { name: 'Xóa lọc' }).click()
    assert.equal(await table.locator('tbody tr').count(), 10)
  })
  await context.close()
}

{
  const { context, page, state } = await session('STORE_OWNER', ['DISEASES.READ'])
  await check('a failed list exposes a retry without pretending the catalogue is empty', async () => {
    state.failReads = true
    await page.goto(`${base}/agent/diseases`)
    await page.getByRole('alert').waitFor()
    assert.match(await page.locator('.agrisage-kpi-card').first().innerText(), /Lỗi tải/)
    state.failReads = false
    await page.getByRole('button', { name: 'Thử lại' }).click()
    await page.getByRole('button', { name: 'Xem chi tiết Đạo ôn', exact: true }).waitFor()
    assert.equal(await page.getByRole('alert').count(), 0)
  })
  await context.close()
}

{
  const { context, page } = await session('SALES_STAFF', ['ADVISORY_SESSIONS.READ'])
  await check('sales staff open the advice log under /sales', async () => {
    await page.goto(`${base}/sales/advisory-sessions`)
    await page.getByText('Trần Thị Mai').first().waitFor()
    assert.ok(await page.getByRole('link', { name: 'Ca tư vấn vật tư' }).count() > 0, 'sidebar entry')
  })
  await context.close()
}

await browser.close()
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('advisory admin checks passed')
