import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const management = path.basename(root) === 'Management-Webs';
const baseUrl = process.env.NOTIFICATION_TEST_URL || (management ? 'http://127.0.0.1:5173' : 'http://127.0.0.1:5174');
const modulePath = process.env.NOTIFICATION_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.NOTIFICATION_BROWSER_CHANNEL });
let checks = 0;
const id = (n) => '00000000-0000-4000-8000-' + String(n + 1).padStart(12, '0');
const item = (n, status = 'READ') => ({ id: id(n), notificationType: 'ORDER_STATUS_CHANGED',
  title: 'Thông báo kiểm thử ' + n, message: 'Thông tin đơn hàng từ API kiểm thử.',
  data: { entityType: 'ORDER', entityId: id(1000 + n) }, status,
  readAt: status === 'UNREAD' ? null : '2026-10-09T01:00:00Z', createdAt: '2026-10-09T00:00:00Z' });

async function fixture({ role = management ? 'SALES_STAFF' : 'FARMER', count = 21, viewport = { width: 1440, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ management }) => {
    if (location.pathname !== '/notifications') return
    localStorage.setItem(management ? 'agrisage_token' : 'agrisage.farmer_token', 'notification.test.jwt');
  }, { management });
  const state = { records: Array.from({ length: count }, (_, n) => item(n, n < 2 || n === count - 1 ? 'UNREAD' : 'READ')),
    failAction: false, failList: false, unauthorized: false, requests: [], holdUnread: null };
  await context.route('**/api/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const pathname = url.pathname;
    if (!pathname.startsWith('/api/')) return route.continue()
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname.startsWith('/api/me/notifications')) {
      assert.equal(request.headers().authorization, 'Bearer notification.test.jwt');
      assert.equal(url.searchParams.has('userId'), false);
      state.requests.push({ method: request.method(), path: pathname, status: url.searchParams.get('status'), page: url.searchParams.get('page') });
      if (state.unauthorized) return json({ title: 'Unauthorized' }, 401);
      if (pathname.endsWith('/unread-count')) return json({ count: state.records.filter((n) => n.status === 'UNREAD').length });
      if (request.method() !== 'GET' && state.failAction) return json({ title: 'Server error', detail: 'Lỗi cập nhật kiểm thử' }, 500);
      if (pathname.endsWith('/read-all')) state.records.forEach((n) => { if (n.status === 'UNREAD') n.status = 'READ'; });
      else if (pathname.endsWith('/read')) {
        const target = state.records.find((n) => pathname.includes(n.id)); if (target?.status === 'UNREAD') target.status = 'READ';
      } else if (request.method() === 'DELETE') {
        const target = state.records.find((n) => pathname.endsWith(n.id)); if (target) target.status = 'ARCHIVED';
      } else {
        if (state.failList) return json({ title: 'Server error', detail: 'Lỗi tải kiểm thử' }, 500);
        const status = url.searchParams.get('status');
        if (status === 'UNREAD' && state.holdUnread) await state.holdUnread;
        const records = state.records.filter((n) => status ? n.status === status : n.status !== 'ARCHIVED');
        const page = Number(url.searchParams.get('page')); const pageSize = Number(url.searchParams.get('pageSize'));
        assert.equal(pageSize, 20);
        return json({ items: records.slice((page - 1) * pageSize, page * pageSize), page, pageSize,
          totalCount: records.length, totalPages: Math.ceil(records.length / pageSize) });
      }
      return route.fulfill({ status: 204 });
    }
    if (pathname === '/api/auth/me') return json({ id: id(900), fullName: 'Tài khoản kiểm thử', role, status: 'ACTIVE' });
    if (pathname === '/api/me/profile') return json({ userId: id(900), fullName: 'Nông dân kiểm thử', phoneNumber: '0900000000' });
    if (pathname === '/api/me/cart') return json({ id: null, items: [], subtotalAmount: 0, priceListId: null });
    return json({ items: [], totalCount: 0, totalPages: 0 });
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl + '/notifications');
  await page.locator('article[data-notification-id]').first().waitFor();
  return { context, page, state, errors };
}
async function passed(name) { checks++; console.log('PASS ' + name); }
const bell = (page, count) => management
  ? page.getByRole('button', { name: count ? 'Thông báo, ' + count + ' chưa đọc' : 'Thông báo', exact: true })
  : page.getByRole('link', { name: count ? 'Thông báo, ' + count + ' chưa đọc' : 'Thông báo', exact: true });
const row = (page, n) => page.locator('[data-notification-id="' + id(n) + '"]');
const button = (page, name) => page.getByRole('button', { name, exact: true });

try {
  const { context, page, state, errors } = await fixture();
  await bell(page, 3).waitFor();
  if (process.env.NOTIFICATION_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.NOTIFICATION_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.NOTIFICATION_SCREENSHOT_DIR, path.basename(root) + '-notifications.png') });
  }
  assert.equal(await page.locator('article[data-notification-id]').count(), 20);
  await passed('paged API list and live unread badge');

  await row(page, 0).getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).click();
  await bell(page, 2).waitFor();
  await row(page, 0).getByText('Đã đọc', { exact: true }).waitFor();
  await passed('mark one read updates row and badge');

  state.failAction = true;
  await row(page, 1).getByRole('button', { name: 'Lưu trữ', exact: true }).click();
  await page.getByRole('alert').getByText('Lỗi cập nhật kiểm thử').waitFor();
  assert.equal(await bell(page, 2).count(), 1);
  assert.equal(await row(page, 1).count(), 1);
  await passed('failed mutation preserves notification and badge');

  state.failAction = false;
  await row(page, 1).getByRole('button', { name: 'Lưu trữ', exact: true }).click();
  await bell(page, 1).waitFor();
  await row(page, 1).waitFor({ state: 'detached' });
  await button(page, 'Đã lưu trữ').click();
  await row(page, 1).getByText('Đã lưu trữ', { exact: true }).waitFor();
  assert.equal(await row(page, 1).getByRole('button', { name: 'Lưu trữ', exact: true }).count(), 0);
  await passed('archive uses DELETE and remains accessible in archived filter');

  await button(page, 'Chưa đọc').click();
  await row(page, 20).waitFor();
  await button(page, 'Đánh dấu tất cả đã đọc').click();
  await bell(page, 0).waitFor();
  await page.getByText('Không có thông báo trong bộ lọc này.').waitFor();
  await passed('read-all removes unread results and zero badge');

  state.records.push(item(21, 'UNREAD'));
  await button(page, 'Tất cả').click();
  await button(page, 'Tải lại').click();
  await bell(page, 1).waitFor();
  await button(page, 'Trang sau').click();
  await row(page, 21).waitFor();
  await row(page, 21).getByRole('button', { name: 'Lưu trữ', exact: true }).click();
  await page.getByText('20 thông báo · Trang 1/1').waitFor();
  await passed('archiving last item clamps pagination back to valid page');

  state.failList = true;
  await button(page, 'Tải lại').click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('article[data-notification-id]').count(), 0);
  state.failList = false;
  await button(page, 'Thử lại').click();
  await row(page, 0).waitFor();
  await passed('loading failure and retry show correct content');

  let release;
  state.holdUnread = new Promise((resolve) => { release = resolve; });
  const pending = page.waitForRequest((request) => request.url().includes('status=UNREAD'));
  await button(page, 'Chưa đọc').click(); await pending;
  await button(page, 'Đã đọc').click();
  await row(page, 0).waitFor();
  release(); state.holdUnread = null;
  assert.equal(await button(page, 'Đã đọc').getAttribute('aria-pressed'), 'true');
  await passed('rapid filter switch aborts stale response');

  assert.deepEqual(errors, []);
  assert(state.requests.some((r) => r.path.endsWith('/read-all') && r.method === 'POST'));
  assert(state.requests.some((r) => r.path.endsWith('/read') && r.method === 'POST'));
  assert(state.requests.some((r) => r.method === 'DELETE'));
  await context.close();

  const expiry = await fixture();
  expiry.state.unauthorized = true;
  await button(expiry.page, 'Tải lại').click();
  await expiry.page.waitForURL(/\/login/);
  assert.equal(await expiry.page.evaluate((key) => localStorage.getItem(key), management ? 'agrisage_token' : 'agrisage.farmer_token'), null);
  await expiry.context.close();
  await passed('expired session clears authentication and redirects to login');

  const mobile = await fixture({ count: 101, viewport: { width: 390, height: 844 } });
  // Make all notifications unread and requery the badge.
  mobile.state.records.forEach((n) => { n.status = 'UNREAD'; });
  await button(mobile.page, 'Tải lại').click();
  if (management) await bell(mobile.page, 101).waitFor();
  else {
    await mobile.page.getByRole('button', { name: 'Toggle menu' }).click();
    await mobile.page.getByRole('link', { name: 'Thông báo (99+)', exact: true }).waitFor();
    await mobile.page.getByRole('link', { name: 'Thông báo (99+)', exact: true }).click();
  }
  assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await mobile.context.close();
  await passed('mobile notification entry and 99+ badge without horizontal overflow');

  if (management) {
    for (const role of ['ADMIN', 'STORE_OWNER', 'DELIVERY_STAFF']) {
      const roleFixture = await fixture({ role });
      assert.equal(await roleFixture.page.locator('article[data-notification-id]').count(), 20);
      if (role === 'ADMIN') {
        await roleFixture.page.goto(baseUrl + '/admin/notifications');
        await roleFixture.page.locator('article[data-notification-id]').first().waitFor();
        assert.equal(await roleFixture.page.locator('article[data-notification-id]').count(), 20);
        await passed('legacy Admin notification menu uses the real personal API');
      }
      await roleFixture.context.close();
      await passed('personal inbox accessible to ' + role);
    }
  }
  console.log('PASS ' + checks + ' browser scenarios: ' + path.basename(root));
} finally { await browser.close(); }
