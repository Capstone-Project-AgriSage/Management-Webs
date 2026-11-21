import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// AI_DIAGNOSIS.md 2.2 §15, admin side: the provider page with one tab per provider (Claude, Gemini; write-only API key,
// on/off, connection check), the crop of each problem, and registering a general model (Claude or Gemini) by crop. Every
// /api request is intercepted; no backend is called.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const failures = []
// Made-up keys: only their shape matters. They must never come back into the page.
const SECRET = 'sk-ant-test-0000000000000000-WXYZ'
const GOOGLE_SECRET = 'AIzaTESTGOOGLE000000000000-GK42'

const disease = (id, code, name, cropType, extra = {}) => ({
  id, code, name, scientificName: null, cropType, description: null, symptoms: 'Triệu chứng.', causes: null, prevention: 'Phòng ngừa.',
  isHealthyClass: false, isActive: true, treatments: [], problemType: 'DISEASE', searchKeywords: null, ...extra,
})
const diseases = [
  disease('d1', 'LEAF_BLAST', 'Bệnh đạo ôn lá', 'RICE'),
  disease('d2', 'BROWN_SPOT', 'Bệnh đốm nâu', 'RICE'),
  disease('d3', 'BROWN_PLANTHOPPER', 'Rầy nâu', 'RICE', { problemType: 'PEST' }),
  disease('d4', 'DURIAN_PHYTOPHTHORA', 'Thối gốc chảy nhựa', 'DURIAN'),
  disease('d5', 'COFFEE_RUST', 'Gỉ sắt cà phê', 'COFFEE'),
  disease('d6', 'MANGO_OLD', 'Bệnh đã ngừng', 'MANGO', { isActive: false }),
  disease('d7', 'HEALTHY', 'Lá khỏe', 'RICE', { isHealthyClass: true }),
]
const defaults = {
  ANTHROPIC: { provider: 'ANTHROPIC', modelId: 'claude-opus-5-5', suggestedModels: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] },
  GOOGLE: { provider: 'GOOGLE', modelId: 'gemini-3.8-flash', suggestedModels: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'] },
}
const settingOf = (provider, extra = {}) => ({
  isEnabled: false, timeoutSeconds: 60, hasApiKey: false, apiKeyHint: null, encryptionConfigured: true, updatedAt: null, version: 0,
  ...defaults[provider], ...extra,
})
const paged = (items) => ({ items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1 })
const admin = ['AI_PROVIDER.READ', 'AI_PROVIDER.MANAGE', 'PERMISSIONS.MANAGE_ROLES', 'AI_MODELS.CREATE', 'AI_MODELS.ACTIVATE', 'DISEASES.READ', 'DISEASES.CREATE', 'DISEASES.UPDATE']

async function session(permissions, options = {}) {
  const context = await browser.newContext({ viewport: options.viewport ?? { width: 1280, height: 900 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'ai-provider-test'))
  const state = {
    requests: [],
    settings: { ANTHROPIC: settingOf('ANTHROPIC', options.anthropic), GOOGLE: settingOf('GOOGLE', options.google) },
    conflictOnce: !!options.conflictOnce,
  }
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    const method = request.method()
    const body = request.postData() ? JSON.parse(request.postData()) : null
    state.requests.push({ path, method, body })
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) }).catch(() => {})
    if (path.startsWith('/api/realtime/')) return json({ title: 'Not available in the test' }, 404)
    if (path === '/api/auth/me') return json({ id: 'me', fullName: 'Quản trị viên', role: 'ADMIN', status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ role: 'ADMIN', storeId: 's1', roleVersion: 1, memberVersion: 1, permissions })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/admin/ai-providers' && method === 'GET') return json([state.settings.ANTHROPIC, state.settings.GOOGLE])
    const provider = path.match(/^\/api\/admin\/ai-providers\/([A-Z]+)(\/test)?$/)
    if (provider && provider[2] && method === 'POST') {
      return json({ ok: true, message: `Kết nối được. Model: ${state.settings[provider[1]].modelId}.` })
    }
    if (provider && method === 'GET') return json(state.settings[provider[1]])
    if (provider && method === 'PUT') {
      const code = provider[1]
      const current = state.settings[code]
      if (state.conflictOnce) { state.conflictOnce = false; state.settings[code] = { ...current, version: current.version + 1, modelId: 'claude-sonnet-5-5' }; return json({ title: 'Stale version' }, 409) }
      const key = body.apiKey ? body.apiKey.slice(-4) : null
      state.settings[code] = {
        ...current, modelId: body.modelId, isEnabled: body.isEnabled, timeoutSeconds: body.timeoutSeconds,
        hasApiKey: body.clearApiKey ? false : key ? true : current.hasApiKey,
        apiKeyHint: body.clearApiKey ? null : key ?? current.apiKeyHint, updatedAt: '2026-11-21T03:00:00Z', version: current.version + 1,
      }
      return json(state.settings[code])
    }
    if (path === '/api/diseases' && method === 'GET') return json(url.searchParams.get('isActive') === 'true' ? diseases.filter(d => d.isActive) : diseases)
    if (path === '/api/diseases' && method === 'POST') return json(disease('d-new', body.code, body.name, body.cropType ?? 'RICE'), 201)
    if (path === '/api/active-ingredients') return json(paged([]))
    if (path === '/api/ai-models' && method === 'GET') return json(paged([]))
    if (path === '/api/ai-models' && method === 'POST') return json({ id: 'm1', ...body, architecture: null, metrics: null, status: 'DRAFT', createdAt: '2026-11-21T03:00:00Z' }, 201)
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

const puts = (state, provider) => state.requests.filter(r => r.path === `/api/admin/ai-providers/${provider}` && r.method === 'PUT').map(r => r.body)
const reads = (state, provider) => state.requests.filter(r => r.path === `/api/admin/ai-providers/${provider}` && r.method === 'GET').length
const model = (page) => page.getByLabel('Model', { exact: true })

{
  const { context, page, state } = await session(admin)
  await check('the provider page opens on Claude with the defaults and cannot be switched on without a key', async () => {
    await page.goto(`${base}/admin/ai/provider`)
    await page.getByTestId('key-state').getByText('Chưa có key').waitFor()
    assert.equal(await page.getByRole('tab', { name: 'Anthropic (Claude)' }).getAttribute('aria-selected'), 'true')
    assert.equal(await page.getByTestId('provider-state').textContent(), 'Đang tắt')
    assert.equal(await model(page).inputValue(), 'claude-opus-5-5')
    assert.equal(await page.getByRole('checkbox', { name: 'Bật chẩn đoán ảnh bằng Claude' }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: 'Kiểm tra kết nối' }).isDisabled(), true, 'nothing to test without a stored key')
    assert.equal(await page.getByRole('button', { name: 'Lưu cấu hình' }).isDisabled(), true, 'nothing changed yet')
    assert.equal(await page.getByTestId('google-free-tier-note').count(), 0)
    assert.ok(await page.getByRole('link', { name: 'Nhà cung cấp AI' }).count() >= 1, 'the sidebar lists the page')
  })
  await check('saving a Claude key sends it once, shows only its last four characters and clears the field', async () => {
    await page.getByLabel('API key', { exact: true }).fill(SECRET)
    await page.getByRole('checkbox', { name: 'Bật chẩn đoán ảnh bằng Claude' }).check()
    await model(page).fill('claude-sonnet-5-5')
    await page.getByRole('button', { name: 'Lưu cấu hình' }).click()
    await page.getByTestId('key-state').getByText('kết thúc bằng WXYZ').waitFor()
    assert.deepEqual(puts(state, 'ANTHROPIC')[0], { modelId: 'claude-sonnet-5-5', isEnabled: true, timeoutSeconds: 60, version: 0, apiKey: SECRET })
    assert.equal(await page.getByTestId('provider-state').textContent(), 'Đang bật')
    assert.equal(await page.getByLabel('Thay API key', { exact: true }).inputValue(), '', 'the key does not stay in the form')
    assert.ok(!(await page.content()).includes(SECRET), 'the key is nowhere in the page')
  })
  await check('the connection check uses the stored settings of that provider', async () => {
    await page.getByRole('button', { name: 'Kiểm tra kết nối' }).click()
    await page.getByTestId('test-result').getByText('Kết nối được. Model: claude-sonnet-5-5.').waitFor()
    await page.getByLabel('Thời gian chờ tối đa').fill('5')
    await page.getByText('Số giây nguyên từ 10 đến 300.').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Lưu cấu hình' }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: 'Kiểm tra kết nối' }).isDisabled(), true, 'unsaved changes are saved before a check')
    await page.getByLabel('Thời gian chờ tối đa').fill('60')
  })
  await check('the Gemini tab has its own key, a model id the admin may type, and the free-tier warning', async () => {
    await page.getByRole('tab', { name: 'Google (Gemini)' }).click()
    await page.waitForURL(/provider=GOOGLE/)
    await page.getByTestId('google-free-tier-note').waitFor()
    assert.equal(await model(page).inputValue(), 'gemini-3.8-flash')
    assert.equal(await page.getByTestId('key-state').textContent(), 'Chưa có key', 'Claude\'s key is not Gemini\'s')
    assert.equal(await page.getByLabel('API key', { exact: true }).getAttribute('placeholder'), 'Dán API key từ Google AI Studio')
    await model(page).fill('Gemini 3')
    await page.getByText('Mã model gồm chữ thường', { exact: false }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Lưu cấu hình' }).isDisabled(), true)
    await model(page).fill('gemini-3.6-flash')
    await page.getByLabel('API key', { exact: true }).fill(GOOGLE_SECRET)
    await page.getByRole('checkbox', { name: 'Bật chẩn đoán ảnh bằng Gemini' }).check()
    await page.getByRole('button', { name: 'Lưu cấu hình' }).click()
    await page.getByTestId('key-state').getByText('kết thúc bằng GK42').waitFor()
    assert.deepEqual(puts(state, 'GOOGLE')[0], { modelId: 'gemini-3.6-flash', isEnabled: true, timeoutSeconds: 60, version: 0, apiKey: GOOGLE_SECRET })
    assert.equal(puts(state, 'ANTHROPIC').length, 1, 'Claude\'s settings are untouched')
    await page.getByRole('button', { name: 'Kiểm tra kết nối' }).click()
    await page.getByTestId('test-result').getByText('Kết nối được. Model: gemini-3.6-flash.').waitFor()
    assert.ok(!(await page.content()).includes(GOOGLE_SECRET), 'the key is nowhere in the page')
  })
  await check('clearing the Claude key also switches Claude off', async () => {
    await page.getByRole('tab', { name: 'Anthropic (Claude)' }).click()
    await page.getByTestId('key-state').getByText('kết thúc bằng WXYZ').waitFor()
    await page.getByRole('checkbox', { name: 'Xoá key đang lưu (nhà cung cấp sẽ tắt)' }).check()
    assert.equal(await page.getByRole('checkbox', { name: 'Bật chẩn đoán ảnh bằng Claude' }).isChecked(), false)
    assert.equal(await page.getByLabel('Thay API key', { exact: true }).isDisabled(), true)
    await page.getByRole('button', { name: 'Lưu cấu hình' }).click()
    await page.getByTestId('key-state').getByText('Chưa có key').waitFor()
    assert.deepEqual(puts(state, 'ANTHROPIC').at(-1), { modelId: 'claude-sonnet-5-5', isEnabled: false, timeoutSeconds: 60, version: 1, clearApiKey: true })
  })
  await context.close()
}

{
  const { context, page, state } = await session(admin, { conflictOnce: true, anthropic: { hasApiKey: true, apiKeyHint: 'ABCD', version: 3, updatedAt: '2026-11-20T03:00:00Z' } })
  await check('a stale save reloads the newer settings instead of overwriting them', async () => {
    await page.goto(`${base}/admin/ai/provider`)
    await page.getByTestId('key-state').getByText('kết thúc bằng ABCD').waitFor()
    await page.getByLabel('Thời gian chờ tối đa').fill('90')
    // Dev StrictMode reads the settings twice on mount: count the reads the conflict adds.
    const before = reads(state, 'ANTHROPIC')
    await page.getByRole('button', { name: 'Lưu cấu hình' }).click()
    await page.getByText('Cấu hình vừa được người khác sửa', { exact: false }).waitFor()
    await page.waitForFunction(() => document.querySelector('#provider-model')?.value === 'claude-sonnet-5-5')
    assert.equal(await page.getByLabel('Thời gian chờ tối đa').inputValue(), '60', 'the form shows the reloaded settings')
    assert.equal(reads(state, 'ANTHROPIC'), before + 1)
  })
  await context.close()
}

{
  const { context, page } = await session(admin, { anthropic: { encryptionConfigured: false }, google: { encryptionConfigured: false } })
  await check('without a master key on the server no key can be typed', async () => {
    await page.goto(`${base}/admin/ai/provider?provider=GOOGLE`)
    await page.getByText('Máy chủ chưa có khoá mã hoá.').waitFor()
    assert.equal(await page.getByLabel('API key', { exact: true }).isDisabled(), true)
  })
  await context.close()
}

{
  const { context, page } = await session(['AI_PROVIDER.READ', 'PERMISSIONS.MANAGE_ROLES'], { anthropic: { hasApiKey: true, apiKeyHint: 'ABCD', isEnabled: true, version: 2 } })
  await check('a reader sees the state but cannot change or test it', async () => {
    await page.goto(`${base}/admin/ai/provider`)
    await page.getByText('Chỉ Admin có quyền sửa cấu hình này.').waitFor()
    assert.equal(await model(page).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: 'Lưu cấu hình' }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Kiểm tra kết nối' }).count(), 0)
  })
  await context.close()
}

{
  const { context, page, state } = await session(['PERMISSIONS.MANAGE_ROLES'])
  await check('without AI_PROVIDER.READ the page and its menu entry are closed', async () => {
    await page.goto(`${base}/admin/ai/provider`)
    await page.getByText('Không có quyền truy cập', { exact: false }).first().waitFor()
    assert.equal(await page.getByRole('link', { name: 'Nhà cung cấp AI' }).count(), 0)
    assert.equal(state.requests.filter(r => r.path.startsWith('/api/admin/ai-providers')).length, 0, 'the settings are not even read')
  })
  await context.close()
}

{
  const { context, page, state } = await session(admin)
  await check('problems carry their crop; the crop filter keeps the shared healthy class', async () => {
    await page.goto(`${base}/admin/diseases`)
    const table = page.getByRole('table', { name: 'Danh sách vấn đề cây trồng' })
    await table.getByText('Thối gốc chảy nhựa').waitFor()
    assert.equal(await table.locator('tbody tr').count(), 7)
    await page.getByLabel('Cây trồng', { exact: true }).selectOption('DURIAN')
    await page.waitForFunction(() => document.querySelectorAll('table[aria-label="Danh sách vấn đề cây trồng"] tbody tr').length === 2)
    assert.equal(await table.locator('tbody tr').nth(0).locator('td').nth(1).textContent(), 'Sầu riêng')
    assert.equal(await table.locator('tbody tr').nth(1).locator('td').nth(1).textContent(), 'Mọi cây trồng')
  })
  await check('a new problem is created for the chosen crop', async () => {
    await page.getByRole('button', { name: 'Xóa lọc' }).click()
    await page.getByRole('button', { name: 'Thêm vấn đề' }).click()
    await page.getByLabel('Mã vấn đề').fill('MANGO_ANTHRACNOSE')
    await page.getByLabel('Tên vấn đề').fill('Thán thư xoài')
    await page.getByLabel('Cây trồng của vấn đề').selectOption('MANGO')
    await page.getByRole('dialog').getByRole('button', { name: 'Thêm vấn đề' }).click()
    await page.waitForFunction(() => document.querySelector('[data-testid="problem-form"]') === null)
    const created = state.requests.find(r => r.path === '/api/diseases' && r.method === 'POST')
    assert.equal(created?.body.cropType, 'MANGO')
    assert.equal(created?.body.code, 'MANGO_ANTHRACNOSE')
  })
  await context.close()
}

{
  const { context, page, state } = await session(admin, {
    anthropic: { hasApiKey: true, apiKeyHint: 'ABCD', isEnabled: true, version: 2 },
    google: { modelId: 'gemini-3.6-flash', hasApiKey: true, apiKeyHint: 'GK42', isEnabled: false, version: 1 },
  })
  const posts = () => state.requests.filter(r => r.path === '/api/ai-models' && r.method === 'POST').map(r => r.body)
  await check('a Claude model is registered from the chosen crops with Claude\'s configured model as its version', async () => {
    await page.goto(`${base}/admin/ai/models`)
    await page.getByRole('button', { name: '+ Đăng ký mô hình' }).click()
    const form = page.getByTestId('general-model-form')
    await form.waitFor()
    assert.equal(await form.getByRole('radio', { name: /Anthropic \(Claude\)/ }).isChecked(), true, 'starts on the provider that is on')
    assert.equal(await form.getByRole('checkbox', { name: /Xoài/ }).isDisabled(), true, 'a crop without an active disease cannot be chosen')
    assert.equal(await form.getByRole('checkbox', { name: /Bắp/ }).isDisabled(), true)
    assert.equal(await form.getByTestId('general-labels').textContent(), '5 nhãn: LEAF_BLAST, BROWN_SPOT, DURIAN_PHYTOPHTHORA, COFFEE_RUST, HEALTHY')
    await form.getByRole('checkbox', { name: /Cà phê/ }).uncheck()
    assert.equal(await form.getByTestId('general-labels').textContent(), '4 nhãn: LEAF_BLAST, BROWN_SPOT, DURIAN_PHYTOPHTHORA, HEALTHY')
    assert.equal(await form.getByLabel('Phiên bản = mã model Claude').inputValue(), 'claude-opus-5-5')
    await form.getByLabel('Phiên bản = mã model Claude').fill('claude-haiku-5-5')
    await form.getByText('Khác model đang cấu hình (claude-opus-5-5)', { exact: false }).waitFor()
    await form.getByLabel('Phiên bản = mã model Claude').fill('claude-opus-5-5')
    await form.getByRole('button', { name: 'Đăng ký mô hình Claude' }).click()
    await page.getByTestId('general-model-form').waitFor({ state: 'detached' })
    const body = posts()[0]
    assert.equal(body.framework, 'ANTHROPIC')
    assert.equal(body.version, 'claude-opus-5-5')
    assert.equal(body.modelStorageUrl, 'https://api.anthropic.com')
    assert.deepEqual(body.classLabels, ['LEAF_BLAST', 'BROWN_SPOT', 'DURIAN_PHYTOPHTHORA', 'HEALTHY'])
  })
  await check('a Gemini model takes Gemini\'s configured model and says when Gemini is still off', async () => {
    await page.getByRole('button', { name: '+ Đăng ký mô hình' }).click()
    const form = page.getByTestId('general-model-form')
    await form.waitFor()
    await form.getByRole('radio', { name: /Google \(Gemini\)/ }).check()
    assert.equal(await form.getByLabel('Phiên bản = mã model Gemini').inputValue(), 'gemini-3.6-flash')
    assert.match(await form.getByLabel('Tên mô hình').inputValue(), /^Gemini chẩn đoán /)
    await form.getByText('Google (Gemini) chưa bật', { exact: false }).waitFor()
    await form.getByRole('button', { name: 'Đăng ký mô hình Gemini' }).click()
    await page.getByTestId('general-model-form').waitFor({ state: 'detached' })
    const body = posts()[1]
    assert.equal(body.framework, 'GOOGLE')
    assert.equal(body.version, 'gemini-3.6-flash')
    assert.equal(body.modelStorageUrl, 'https://generativelanguage.googleapis.com')
    assert.deepEqual(body.classLabels, ['LEAF_BLAST', 'BROWN_SPOT', 'DURIAN_PHYTOPHTHORA', 'COFFEE_RUST', 'HEALTHY'])
  })
  await check('the JSON manifest still registers a fixed-class model', async () => {
    await page.getByRole('button', { name: '+ Đăng ký mô hình' }).click()
    await page.getByRole('button', { name: 'Manifest JSON (PyTorch)' }).click()
    await page.getByRole('textbox', { name: 'Manifest mô hình (JSON)' }).fill(JSON.stringify({ name: 'rice', version: '0.3.0', framework: 'PyTorch', modelStorageUrl: 'https://example.test/m', classLabels: ['LEAF_BLAST', 'BACTERIAL_LEAF_BLIGHT', 'BROWN_SPOT', 'SHEATH_BLIGHT', 'HEALTHY'] }))
    await page.getByRole('button', { name: 'Đăng ký', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 0)
    assert.equal(posts().length, 3)
    assert.equal(posts()[2].framework, 'PyTorch')
  })
  await context.close()
}

{
  const { context, page } = await session(admin, { viewport: { width: 390, height: 844 }, anthropic: { hasApiKey: true, apiKeyHint: 'ABCD', version: 1 } })
  await check('both provider tabs fit a phone screen without horizontal scrolling', async () => {
    for (const provider of ['ANTHROPIC', 'GOOGLE']) {
      await page.goto(`${base}/admin/ai/provider?provider=${provider}`)
      await page.getByTestId('key-state').waitFor()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 1, `${provider}: page scrolls sideways by ${overflow}px`)
    }
  })
  await context.close()
}

await browser.close()
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('\nAll AI provider and crop checks passed.')
