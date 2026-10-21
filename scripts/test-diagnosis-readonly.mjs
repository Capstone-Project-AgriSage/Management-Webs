import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// AI diagnosis without Human Review (AI_DIAGNOSIS.md 2.0): the store screens only read cases, the disease and product
// screens link active ingredients. Every /api request is intercepted before navigation; no live backend is called.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const failures = []
const at = '2026-10-21T03:00:00Z'
const REMOVED = /\/api\/diagnosis-cases\/[^/]+\/(start-review|review|rerun-ai|recommendations)|\/api\/staff\/[^/]+\/ai-review/

const disease = { id: 'd-blast', code: 'LEAF_BLAST', name: 'Leaf Blast', isHealthy: false, symptoms: 'Vết hình thoi.', prevention: 'Bón cân đối.' }
const inference = (passed) => ({
  id: 'inf-1', diagnosisImageId: 'img-1', status: 'SUCCESS', inferredAt: at, durationMs: 70,
  model: { id: 'm1', name: 'agrisage-rice-classifier', version: '0.2.0' },
  policy: { id: 'p2', version: 'policy-2', minimumConfidence: 0.77, minimumMargin: 0.2, topK: 3 },
  predictedClassLabel: 'LEAF_BLAST', predictedDiseaseId: 'd-blast', confidence: passed ? 0.91 : 0.55, margin: passed ? 0.85 : 0.1,
  passedPolicy: passed, topPredictions: [{ classLabel: 'LEAF_BLAST', diseaseId: 'd-blast', confidence: passed ? 0.91 : 0.55 }], error: null,
})
const caseOf = (id, extra = {}) => ({
  id, caseNumber: `DG-20261021-${id.slice(-4)}`, status: 'AI_COMPLETED', submittedAt: at, completedAt: at,
  farmer: { farmerProfileId: 'f1', userId: 'u1', fullName: 'Nông dân A', phoneNumber: '0901234567' },
  farmerNote: 'TEST- lá vàng', finalDisease: null,
  images: [{ id: 'img-1', imageUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', expiresAt: '2099-01-01T00:00:00Z', isPrimary: true, fileName: 'leaf.jpg', uploadedAt: at }],
  inferences: [inference(true)], currentReview: null, reviewHistory: [], recommendations: [],
  farmerResult: {
    certainty: 'CONFIDENT', hint: null, disease, reviewerComment: null,
    treatments: [{ id: 't1', type: 'CHEMICAL', title: 'Phun thuốc', instructions: 'Theo nhãn.', precautions: null, rankOrder: 1, reason: null, activeIngredientName: 'Tricyclazole' }],
    products: [{ storeProductId: 'sp1', productId: 'p1', name: 'Thuốc Beam 75WP', sku: 'BEAM-75', imageUrl: null, reason: 'Chứa hoạt chất Tricyclazole', rankOrder: 1 }],
  },
  ...extra,
})
const cases = {
  'case-0001': caseOf('case-0001'),
  'case-0002': caseOf('case-0002', {
    inferences: [inference(false)],
    farmerResult: { certainty: 'UNCERTAIN', hint: 'RETAKE_PHOTO_OR_ASK_STORE', disease, reviewerComment: null, treatments: [], products: [] },
  }),
  'case-0003': caseOf('case-0003', {
    status: 'VERIFIED', finalDisease: disease,
    currentReview: { id: 'r1', decision: 'CONFIRMED', finalDisease: disease, aiDiseaseId: 'd-blast', primaryAiInferenceId: 'inf-1', comment: 'Duyệt cũ.', isCurrent: true, reviewedAt: at, reviewerMemberId: 'sm1', reviewerName: 'Chuyên viên cũ', supersededAt: null },
    farmerResult: { certainty: 'VERIFIED', hint: null, disease, reviewerComment: 'Duyệt cũ.', treatments: [], products: [] },
  }),
}
const listItem = (c) => ({
  id: c.id, caseNumber: c.caseNumber, status: c.status, submittedAt: c.submittedAt, completedAt: c.completedAt, farmerProfileId: 'f1',
  farmerName: c.farmer.fullName, farmerPhone: c.farmer.phoneNumber, predictedClassLabel: 'LEAF_BLAST',
  confidence: c.inferences[0].confidence, passedPolicy: c.inferences[0].passedPolicy, finalDiseaseCode: c.finalDisease?.code ?? null,
})
const ingredient = { id: 'ing-1', code: 'TRI', name: 'Tricyclazole', description: null, isActive: true }
const product = {
  id: 'p1', sku: 'BEAM-75', name: 'Thuốc Beam 75WP', categoryId: 'c1', categoryName: 'Thuốc BVTV', brandId: null, brandName: null,
  description: null, usageInstructions: null, requiresLotTracking: true, requiresExpiryDate: true, imageUrl: null, status: 'ACTIVE',
  packagings: [], ingredients: [], store: null,
}
const paged = (items) => ({ items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1 })

async function session(role, permissions) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'diagnosis-readonly-test'))
  const state = { requests: [] }
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    const method = request.method()
    const body = request.postData() ? JSON.parse(request.postData()) : null
    state.requests.push({ path, method, body })
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) }).catch(() => {})
    if (REMOVED.test(path)) { failures.push(`removed route called: ${method} ${path}`); return json({ title: 'Not found' }, 404) }
    if (path === '/api/auth/me') return json({ id: 'me', fullName: 'Người kiểm thử', role, status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ role, storeId: 's1', roleVersion: 1, memberVersion: 1, permissions })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/diagnosis-cases') return json(paged(Object.values(cases).map(listItem)))
    const caseMatch = path.match(/^\/api\/diagnosis-cases\/([^/]+)$/)
    if (caseMatch) return cases[caseMatch[1]] ? json(cases[caseMatch[1]]) : json({ title: 'Not found' }, 404)
    if (path === '/api/staff') return json(paged([{ id: 'sales-1', fullName: 'Nhân viên A', phoneNumber: '0900000001', email: null, role: 'SALES_STAFF', status: 'ACTIVE', memberStatus: 'ACTIVE', employeeCode: null, joinedAt: null, leftAt: null, createdAt: at }]))
    if (path === '/api/diseases' && method === 'GET') return json([{ ...disease, scientificName: null, cropType: 'RICE', description: null, causes: null, isHealthyClass: false, isActive: true, treatments: [] }])
    if (path === '/api/diseases/d-blast/treatments' && method === 'POST') return json({ id: 't-new', diseaseId: 'd-blast', ...body, activeIngredientName: 'Tricyclazole', isActive: true }, 201)
    if (path === '/api/active-ingredients') return json(paged([ingredient]))
    if (path === '/api/products' && method === 'GET') return json(paged([{ id: product.id, sku: product.sku, name: product.name, categoryId: 'c1', categoryName: 'Thuốc BVTV', brandId: null, brandName: null, imageUrl: null, status: 'ACTIVE' }]))
    if (path === '/api/products/p1' && method === 'GET') return json(product)
    if (path === '/api/products/p1/ingredients' && method === 'PUT') return json({ ...product, ingredients: body.ingredients.map(i => ({ ...i, name: 'Tricyclazole' })) })
    if (path === '/api/categories') return json(paged([{ id: 'c1', parentId: null, code: 'BVTV', name: 'Thuốc BVTV', isActive: true }]))
    if (path === '/api/brands' || path === '/api/units' || path === '/api/store-products') return json(paged([]))
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

// Sales staff: the menu entry and the list come from DIAGNOSIS.READ alone (no review right exists any more).
{
  const { context, page } = await session('SALES_STAFF', ['DIAGNOSIS.READ'])
  await check('sales sees the read-only list without a review right', async () => {
    await page.goto(`${base}/sales/ai-review`)
    await page.getByText('Ca chẩn đoán AI của nông dân').first().waitFor()
    assert.ok(await page.getByRole('link', { name: 'Ca chẩn đoán AI' }).count() > 0, 'sidebar entry')
    assert.equal(await page.getByText('chưa được cấp quyền duyệt').count(), 0)
    assert.ok(await page.locator('a[href="tel:0901234567"]').count() > 0, 'tel link')
    await page.getByText('Chưa chắc').first().waitFor()
    assert.equal(await page.getByRole('button', { name: /Duyệt/ }).count(), 0)
  })
  await check('a confident case shows what the farmer saw and a call button, nothing to decide', async () => {
    await page.goto(`${base}/sales/ai-review/case-0001`)
    const view = page.getByTestId('farmer-view')
    await view.waitFor()
    assert.match(await view.innerText(), /AI chắc chắn/)
    assert.match(await view.innerText(), /Thuốc Beam 75WP/)
    assert.equal(await page.getByTestId('call-farmer').getAttribute('href'), 'tel:0901234567')
    for (const label of ['Duyệt ca này', 'Bắt đầu duyệt', 'Chạy lại AI', 'Thêm gợi ý']) {
      assert.equal(await page.getByRole('button', { name: label }).count(), 0, label)
    }
    assert.equal(await page.getByTestId('legacy-review').count(), 0)
  })
  await check('an uncertain case says no product was offered', async () => {
    await page.goto(`${base}/sales/ai-review/case-0002`)
    const view = page.getByTestId('farmer-view')
    await view.waitFor()
    assert.match(await view.innerText(), /AI chưa chắc chắn/)
    assert.match(await view.innerText(), /không có thuốc nào được gợi ý/)
  })
  await check('a case reviewed before 2.0 keeps its review, read only', async () => {
    await page.goto(`${base}/sales/ai-review/case-0003`)
    await page.getByTestId('legacy-review').waitFor()
    assert.match(await page.getByTestId('legacy-review').innerText(), /Chuyên viên cũ/)
    assert.match(await page.getByTestId('farmer-view').innerText(), /Đã được duyệt \(trước đây\)/)
  })
  await context.close()
}

// Store owner: no review toggle on staff; treatments and products carry active ingredients.
{
  const owner = ['DIAGNOSIS.READ', 'STAFF.READ', 'STAFF.READ_GET', 'DISEASES.READ', 'DISEASES.UPDATE', 'DISEASE_TREATMENTS.CREATE',
    'DISEASE_TREATMENTS.UPDATE', 'INGREDIENTS.READ', 'PRODUCTS.READ', 'PRODUCTS.UPDATE', 'CATEGORIES.READ', 'BRANDS.READ', 'UNITS.READ', 'STORE_PRODUCTS.READ']
  const { context, page, state } = await session('STORE_OWNER', owner)
  await check('the staff list has no review column', async () => {
    await page.goto(`${base}/agent/staff`)
    await page.getByText('Nhân viên A').first().waitFor()
    assert.equal(await page.getByRole('columnheader', { name: 'Duyệt AI' }).count(), 0)
  })
  await check('a new treatment sends its active ingredient', async () => {
    await page.goto(`${base}/agent/diseases`)
    await page.getByRole('button', { name: /Thêm cách xử lý cho/ }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Hoạt chất').selectOption('ing-1')
    await dialog.locator('input[maxlength="255"]').fill('Phun thuốc đặc trị')
    await dialog.locator('textarea').first().fill('Theo hướng dẫn trên nhãn.')
    await dialog.getByRole('button', { name: 'Thêm cách xử lý' }).click()
    await page.waitForTimeout(300)
    const post = state.requests.find(r => r.method === 'POST' && r.path === '/api/diseases/d-blast/treatments')
    assert.ok(post, 'POST sent')
    assert.equal(post.body.activeIngredientId, 'ing-1')
  })
  await check('a product gets its active ingredients through PUT /ingredients', async () => {
    await page.goto(`${base}/agent/products`)
    await page.getByRole('button', { name: 'Thao tác Thuốc Beam 75WP' }).click()
    await page.getByText('Sửa sản phẩm và ảnh').click()
    const editor = page.getByTestId('ingredient-editor')
    await editor.waitFor()
    await editor.getByRole('button', { name: 'Thêm hoạt chất' }).click()
    await editor.getByLabel('Hoạt chất 1', { exact: true }).selectOption('ing-1')
    await editor.getByLabel('Hàm lượng 1', { exact: true }).fill('75WP')
    await editor.getByRole('button', { name: 'Lưu hoạt chất' }).click()
    await page.waitForTimeout(300)
    const put = state.requests.find(r => r.method === 'PUT' && r.path === '/api/products/p1/ingredients')
    assert.ok(put, 'PUT sent')
    assert.deepEqual(put.body, { ingredients: [{ activeIngredientId: 'ing-1', concentration: '75WP', note: null }] })
    assert.ok(await editor.isVisible(), 'the dialog stays open')
  })
  await context.close()
}

await browser.close()
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('diagnosis read-only checks passed')
