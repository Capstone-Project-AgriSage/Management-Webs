import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// All APIs are intercepted. Credentials and tokens below are test fixtures only.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
let checks = 0
const pass = name => { checks++; console.log('PASS ' + name) }
async function fixture(path, authenticated = true) {
  const context = await browser.newContext()
  if (authenticated) await context.addInitScript(() => localStorage.setItem('agrisage_token', 'auth-fixture-token'))
  const state = { requests: [], fail: '', sessions: [
    { id: 'current', createdAt: '2026-10-01T00:00:00Z', lastUsedAt: '2026-10-11T00:00:00Z', expiresAt: '2026-11-11T00:00:00Z', isCurrent: true },
    { id: 'other', createdAt: '2026-10-01T00:00:00Z', lastUsedAt: '2026-10-10T00:00:00Z', expiresAt: '2026-11-11T00:00:00Z', isCurrent: false },
  ] }, errors = []
  await context.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    state.requests.push({ path, method: request.method(), body: request.postDataJSON(), authorization: request.headers().authorization })
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (state.fail === path) return json({ title: 'Test error', detail: path.endsWith('change-password') ? 'Mật khẩu hiện tại không đúng.' : 'Yêu cầu không hợp lệ.' }, path.endsWith('change-password') ? 401 : 400)
    if (path === '/api/auth/me') return json({ id: 'owner', fullName: 'Kiểm thử', role: 'STORE_OWNER', status: 'ACTIVE', email: 'fixture@example.test' })
    if (path === '/api/me/permissions') return json({ permissions: [] })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/auth/sessions') return json(state.sessions)
    if (path.startsWith('/api/auth/sessions/') && request.method() === 'DELETE') state.sessions = state.sessions.filter(session => session.id !== path.split('/').at(-1))
    if (path.startsWith('/api/auth/')) return route.fulfill({ status: path.endsWith('/forgot-password') ? 202 : 204, body: '' })
    return json({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base + path)
  return { context, page, state, errors }
}
async function fillPassword(page) {
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill('wrong-fixture-password')
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('new-fixture-password')
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('new-fixture-password')
}
try {
  const settings = await fixture('/agent/settings')
  await settings.page.getByText('Thiết bị khác', { exact: true }).waitFor()
  assert(settings.state.requests.some(request => request.path === '/api/auth/sessions' && request.method === 'GET'))
  await settings.page.getByRole('button', { name: 'Đăng xuất phiên', exact: true }).click()
  await settings.page.getByText('Thiết bị khác', { exact: true }).waitFor({ state: 'hidden' })
  assert(settings.state.requests.some(request => request.path === '/api/auth/sessions/other' && request.method === 'DELETE'))
  pass('Sessions load from the real contract and revoking another session preserves the current login')
  settings.state.fail = '/api/auth/change-password'
  await fillPassword(settings.page)
  await settings.page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click()
  await settings.page.getByRole('alert').filter({ hasText: 'Mật khẩu hiện tại không đúng.' }).waitFor()
  assert.equal(new URL(settings.page.url()).pathname, '/agent/settings')
  assert.equal(await settings.page.evaluate(() => localStorage.getItem('agrisage_token')), 'auth-fixture-token')
  const change = settings.state.requests.findLast(request => request.path === '/api/auth/change-password')
  assert.deepEqual(change.body, { currentPassword: 'wrong-fixture-password', newPassword: 'new-fixture-password' })
  assert.equal(change.authorization, 'Bearer auth-fixture-token')
  pass('Wrong current-password 401 is shown on the form without logging out the user')
  settings.state.fail = ''
  await settings.page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click()
  await settings.page.waitForURL('**/login')
  assert.equal(await settings.page.evaluate(() => localStorage.getItem('agrisage_token')), null)
  assert.deepEqual(settings.errors, [])
  await settings.context.close()
  pass('Successful password change handles empty 204 and requires a fresh login')
  for (const [label, path, method] of [
    ['Đăng xuất thiết bị này', '/api/auth/sessions/current', 'DELETE'],
    ['Đăng xuất mọi thiết bị', '/api/auth/logout-all', 'POST'],
  ]) {
    const f = await fixture('/agent/settings')
    await f.page.getByRole('button', { name: label, exact: true }).click()
    await f.page.waitForURL('**/login')
    assert(f.state.requests.some(request => request.path === path && request.method === method))
    assert.deepEqual(f.errors, [])
    await f.context.close()
    pass(label + ': exact endpoint and local session clearing')
  }
  const forgot = await fixture('/forgot-password', false)
  forgot.state.fail = '/api/auth/forgot-password'
  await forgot.page.getByLabel('Email hoặc số điện thoại', { exact: true }).fill('fixture@example.test')
  await forgot.page.getByRole('button', { name: /Gửi yêu cầu khôi phục/ }).click()
  await forgot.page.getByRole('alert').waitFor()
  assert.equal(await forgot.page.getByRole('heading', { name: 'Đã nhận yêu cầu khôi phục' }).count(), 0)
  forgot.state.fail = ''
  await forgot.page.getByRole('button', { name: /Gửi yêu cầu khôi phục/ }).click()
  await forgot.page.getByRole('heading', { name: 'Đã nhận yêu cầu khôi phục' }).waitFor()
  const recovery = forgot.state.requests.findLast(request => request.path === '/api/auth/forgot-password')
  assert.deepEqual(recovery.body, { identifier: 'fixture@example.test' })
  assert.equal(recovery.authorization, undefined)
  assert.deepEqual(forgot.errors, [])
  await forgot.context.close()
  pass('Recovery rejects errors and accepts empty 202 without claiming an email was sent')
  const reset = await fixture('/reset-password?token=fixture-recovery-token', false)
  assert.equal(await reset.page.getByLabel('Mã khôi phục', { exact: true }).inputValue(), 'fixture-recovery-token')
  await reset.page.getByLabel('Mật khẩu mới', { exact: true }).fill('new-fixture-password')
  await reset.page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('other-fixture-password')
  await reset.page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click()
  await reset.page.getByRole('alert').waitFor()
  assert.equal(reset.state.requests.filter(request => request.path === '/api/auth/reset-password').length, 0)
  await reset.page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('new-fixture-password')
  await reset.page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click()
  await reset.page.getByRole('status').filter({ hasText: 'Đã đặt lại mật khẩu.' }).waitFor()
  assert.deepEqual(reset.state.requests.findLast(request => request.path === '/api/auth/reset-password').body, { token: 'fixture-recovery-token', newPassword: 'new-fixture-password' })
  assert.deepEqual(reset.errors, [])
  await reset.context.close()
  pass('Password reset validates confirmation and submits the recovery token through the backend contract')
  console.log(`${checks} auth integration browser checks passed`)
} finally { await browser.close() }
