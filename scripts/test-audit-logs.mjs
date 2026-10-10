import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Run against a Vite dev/preview server; every API response is intercepted.
// AUDIT_PLAYWRIGHT_MODULE can point at the bundled Playwright runtime.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.AUDIT_TEST_URL || 'http://127.0.0.1:5173';
const modulePath = process.env.AUDIT_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.AUDIT_BROWSER_CHANNEL });
let checks = 0;
const id = (n) => '00000000-0000-4000-8000-' + String(n + 1).padStart(12, '0');
const actorId = id(900);
const storeId = id(901);
const rows = (page) => page.locator('[data-audit-log-id]');
const row = (page, n) => page.locator('[data-audit-log-id="' + id(n) + '"]');
const button = (page, name) => page.getByRole('button', { name, exact: true });
const passed = (name) => { checks++; console.log('PASS ' + name); };
const queryOf = (url) => Object.fromEntries([...url.searchParams].map(([key, value]) => [key.toLowerCase(), value]));
const record = (n) => ({
  id: id(n), storeId, actorUserId: n % 3 === 0 ? null : actorId,
  actorName: n % 3 === 0 ? null : 'Nguyễn Văn Sale',
  actorEmail: n % 3 === 0 ? null : 'sale@agrisage.test',
  actorRole: n % 3 === 0 ? null : 'SALES_STAFF', status: 'SUCCESS',
  action: 'ORDER_CONFIRMED', entityType: 'ORDER', entityId: id(1000 + n),
  oldValues: { status: 'DRAFT', amount: 123.45, note: 'Giá "trước"\nDòng cũ' },
  newValues: { status: 'CONFIRMED', quantity: 2 },
  reason: 'Lý do kiểm thử ' + n, ipAddress: n % 3 === 0 ? null : '192.0.2.10',
  userAgent: 'Audit browser fixture/' + n, correlationId: 'audit-request-' + n,
  occurredAt: new Date(Date.now() - n * 60_000).toISOString(),
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
async function waitForDeferred(waiter, name) {
  let timeout;
  try {
    await Promise.race([waiter.promise, new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Timed out waiting for ' + name)), 10_000);
    })]);
  } finally { clearTimeout(timeout); }
}

async function fixture({ count = 31, viewport = { width: 1440, height: 1000 }, role = 'ADMIN' } = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  await context.addInitScript(() => {
    if (['/admin/audit-logs', '/agent/activity-log'].includes(location.pathname)) localStorage.setItem('agrisage_token', 'audit.test.jwt');
  });
  const state = {
    records: Array.from({ length: count }, (_, n) => record(n)), requests: [],
    listError: null, detailError: null, exportErrorPage: null, holdList: null, holdExport: null,
  };
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (!pathname.startsWith('/api/')) return route.continue();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/api/audit-logs' || pathname.startsWith('/api/audit-logs/')) {
      assert.equal(request.headers().authorization, 'Bearer audit.test.jwt');
      assert.equal(request.method(), 'GET', 'audit viewer must never mutate records');
      const query = queryOf(url);
      state.requests.push({ path: pathname, query });
      if (pathname !== '/api/audit-logs') {
        if (state.detailError) return json(state.detailError.body, state.detailError.status);
        const target = state.records.find((entry) => pathname.endsWith('/' + entry.id)
          && (role !== 'STORE_OWNER' || entry.storeId === storeId));
        return target ? json(target) : json({ title: 'Not Found', detail: 'Không tìm thấy nhật ký kiểm thử.' }, 404);
      }
      if (state.listError) return json(state.listError.body, state.listError.status);
      const page = Number(query.page);
      const pageSize = Number(query.pagesize);
      assert(Number.isInteger(page) && page >= 1);
      assert([15, 100].includes(pageSize), 'viewer and export use bounded server pagination');
      const matching = state.records.filter((entry) =>
        (role !== 'STORE_OWNER' || entry.storeId === storeId) &&
        (!query.actorrole || entry.actorRole === query.actorrole) &&
        (!query.status || entry.status === query.status) &&
        (!query.search || [entry.actorName, entry.actorEmail, entry.action, entry.entityType, entry.reason]
          .some(value => value?.toLowerCase().includes(query.search.toLowerCase()))
          || entry.actorUserId === query.search || entry.entityId === query.search) &&
        (!query.action || entry.action === query.action) &&
        (!query.entitytype || entry.entityType === query.entitytype) &&
        (!query.actoruserid || entry.actorUserId === query.actoruserid) &&
        (!query.entityid || entry.entityId === query.entityid) &&
        (!query.from || Date.parse(entry.occurredAt) >= Date.parse(query.from)) &&
        (!query.to || Date.parse(entry.occurredAt) <= Date.parse(query.to)));
      // Capture the answer before waiting so the held request really is stale.
      const result = { items: matching.slice((page - 1) * pageSize, page * pageSize),
        page, pageSize, totalCount: matching.length, totalPages: Math.ceil(matching.length / pageSize) };
      const hold = pageSize === 100 ? state.holdExport : state.holdList;
      if (hold && (!hold.when || hold.when(query))) {
        hold.started.resolve();
        await hold.release.promise;
      }
      if (pageSize === 100 && state.exportErrorPage === page) return json({ title: 'Server error', detail: 'Lỗi trang xuất CSV kiểm thử.' }, 500);
      // Aborted fetches can finish after a newer request or after a context closes.
      await json(result).catch((error) => {
        if (!/closed|disposed|intercepted|aborted|Invalid InterceptionId/i.test(String(error))) throw error;
      });
      hold?.completed?.resolve();
      return;
    }
    if (pathname === '/api/me/permissions') return json({ role, storeId: role === 'STORE_OWNER' ? storeId : null, roleVersion: 0, memberVersion: null, permissions: ['AUDIT.READ'] });
    if (pathname === '/api/auth/me') return json({ id: actorId, fullName: 'Quản trị viên kiểm thử', role, status: 'ACTIVE' });
    if (pathname === '/api/me/notifications/unread-count') return json({ count: 0 });
    if (pathname === '/api/me/notifications') return json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
    return json({ items: [], totalCount: 0, totalPages: 0 });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl + (role === 'STORE_OWNER' ? '/agent/activity-log' : '/admin/audit-logs'));
  if (count) await row(page, 0).waitFor();
  else await page.getByText('Không tìm thấy nhật ký phù hợp.', { exact: true }).waitFor();
  return { context, page, state, errors };
}

const listRequests = (state, pageSize = 15) => state.requests.filter((entry) => entry.path === '/api/audit-logs' && entry.query.pagesize === String(pageSize));
const lastList = (state) => listRequests(state).at(-1).query;
async function submit(page, state) {
  const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/audit-logs');
  await button(page, 'Lọc').click();
  await response;
  await page.getByText('Đang tải nhật ký...', { exact: true }).waitFor({ state: 'hidden' });
  return lastList(state);
}
async function downloadCsv(page) {
  const pending = page.waitForEvent('download');
  await button(page, 'Xuất CSV').click();
  const download = await pending;
  assert.equal(await download.failure(), null);
  return fs.readFileSync(await download.path());
}
function parseCsv(text) {
  const result = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(value); value = ''; }
    else if (character === '\n' && !quoted) { row.push(value.replace(/\r$/, '')); result.push(row); row = []; value = ''; }
    else value += character;
  }
  if (row.length || value.length) { row.push(value.replace(/\r$/, '')); result.push(row); }
  assert.equal(quoted, false, 'CSV quotes must balance');
  return result;
}

try {
  const basic = await fixture();
  const { context, page, state, errors } = basic;
  if (process.env.AUDIT_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.AUDIT_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.AUDIT_SCREENSHOT_DIR, 'audit-logs-desktop.png') });
  }
  assert.equal(await rows(page).count(), 15);
  assert.equal(lastList(state).page, '1');
  assert.equal(lastList(state).pagesize, '15');
  const defaultQuery = lastList(state);
  assert(defaultQuery.from && defaultQuery.to);
  assert(Math.abs(Date.parse(defaultQuery.to) - Date.parse(defaultQuery.from) - 7 * 86_400_000) < 1000);
  assert(Math.abs(Date.parse(defaultQuery.to) - Date.now()) < 60_000);
  assert.equal(await page.getByRole('columnheader', { name: 'Loại tài nguyên', exact: true }).count(), 1);
  assert.equal(await page.getByRole('columnheader', { name: 'Mức độ', exact: true }).count(), 0);
  await row(page, 0).getByText('Hệ thống', { exact: true }).waitFor();
  assert.equal(await page.getByText('admin@agrisage.vn', { exact: false }).count(), 0);
  passed('authenticated real API fields, seven-day snapshot, and server page size');

  await button(page, 'Sau').click();
  await row(page, 15).waitFor();
  assert.equal(lastList(state).page, '2');
  assert.equal(lastList(state).from, defaultQuery.from);
  assert.equal(lastList(state).to, defaultQuery.to);
  assert.equal(await row(page, 0).count(), 0);
  await button(page, 'Trước').click();
  await row(page, 0).waitFor();
  assert.equal(lastList(state).page, '1');
  passed('next and previous pages are requested from the server with stable dates');

  await button(page, 'Sau').click();
  await row(page, 15).waitFor();
  await page.getByLabel('Hành động', { exact: true }).fill('  ORDER_CONFIRMED  ');
  await page.getByLabel('Loại tài nguyên', { exact: true }).fill(' ORDER ');
  await page.getByLabel('ID người thực hiện', { exact: true }).fill(actorId);
  await page.getByLabel('ID tài nguyên', { exact: true }).fill(id(1001));
  await page.getByLabel('Thời gian', { exact: true }).selectOption('30days');
  const filtered = await submit(page, state);
  assert.equal(filtered.page, '1');
  assert.equal(filtered.action, 'ORDER_CONFIRMED');
  assert.equal(filtered.entitytype, 'ORDER');
  assert.equal(filtered.actoruserid, actorId);
  assert.equal(filtered.entityid, id(1001));
  assert(Math.abs(Date.parse(filtered.to) - Date.parse(filtered.from) - 30 * 86_400_000) < 1000);
  await row(page, 1).waitFor();
  assert.equal(await rows(page).count(), 1);
  passed('exact action, entity, actor and resource filters reach API and reset page');

  const requestsBeforeInvalid = listRequests(state).length;
  await page.getByLabel('ID người thực hiện', { exact: true }).fill('invalid-guid');
  await button(page, 'Lọc').click();
  assert.equal(await page.getByLabel('ID người thực hiện', { exact: true }).evaluate((input) => input.checkValidity()), false);
  assert.equal(listRequests(state).length, requestsBeforeInvalid);
  await button(page, 'Xóa bộ lọc').click();
  await row(page, 0).waitFor();
  assert.equal(await page.getByLabel('Hành động', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('ID người thực hiện', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('Thời gian', { exact: true }).inputValue(), '7days');
  await page.getByLabel('Thời gian', { exact: true }).selectOption('all');
  const all = await submit(page, state);
  assert.equal(all.from, undefined);
  assert(all.to, 'all-time retains an upper snapshot for stable paging');
  passed('invalid UUID stays client-side, reset clears filters, all-time omits lower date');

  await row(page, 0).getByRole('button', { name: 'Chi tiết nhật ký ' + id(0), exact: true }).click();
  await page.getByRole('heading', { name: 'Chi tiết Audit Log', exact: true }).waitFor();
  await page.getByRole('columnheader', { name: 'Trước thay đổi', exact: true }).waitFor();
  await page.getByRole('columnheader', { name: 'Sau thay đổi', exact: true }).waitFor();
  await page.getByText('Dữ liệu gốc (JSON)', { exact: true }).click();
  await page.locator('pre').filter({ hasText: 'audit-request-0' }).waitFor();
  const detail = JSON.parse(await page.locator('pre').filter({ hasText: 'audit-request-0' }).innerText());
  assert.deepEqual(detail, state.records[0]);
  assert.equal(detail.actorUserId, null);
  assert.equal(detail.ipAddress, null);
  assert.deepEqual(detail.oldValues, state.records[0].oldValues);
  assert.equal(detail.userAgent, 'Audit browser fixture/0');
  assert(state.requests.some((entry) => entry.path === '/api/audit-logs/' + id(0)));
  await button(page, 'Đóng').last().click();
  passed('detail fetch displays real old/new JSON, nulls, user agent and correlation');

  state.records[1].oldValues = null;
  state.records[1].newValues = null;
  state.detailError = { status: 404, body: { title: 'Not Found', detail: 'Nhật ký kiểm thử đã không còn truy cập được.' } };
  await row(page, 1).getByRole('button', { name: 'Chi tiết nhật ký ' + id(1), exact: true }).click();
  await page.getByText(state.detailError.body.detail, { exact: true }).waitFor();
  assert.equal(await page.locator('pre').count(), 0);
  state.detailError = null;
  await button(page, 'Thử lại').click();
  await page.getByText('Sự kiện này không ghi nhận dữ liệu trước/sau.', { exact: true }).waitFor();
  await page.getByText('Dữ liệu gốc (JSON)', { exact: true }).click();
  await page.locator('pre').filter({ hasText: 'audit-request-1' }).waitFor();
  const nullable = JSON.parse(await page.locator('pre').filter({ hasText: 'audit-request-1' }).innerText());
  assert.equal(nullable.oldValues, null);
  assert.equal(nullable.newValues, null);
  await button(page, 'Đóng').last().click();
  passed('detail failure/retry clears previous data and preserves nullable changes');

  state.listError = { status: 500, body: { title: 'Server error', detail: 'Lỗi tải nhật ký kiểm thử.' } };
  await button(page, 'Tải lại').click();
  await page.getByText(state.listError.body.detail, { exact: true }).waitFor();
  assert.equal(await rows(page).count(), 0);
  state.listError = null;
  await button(page, 'Thử lại').click();
  await row(page, 0).waitFor();
  passed('list failure shows no stale records and retry reloads real data');

  const hold = { started: deferred(), release: deferred(), completed: deferred() };
  state.holdList = hold;
  await button(page, 'Tải lại').click();
  await waitForDeferred(hold.started, 'held list request');
  await page.getByText('Đang tải nhật ký...', { exact: true }).waitFor();
  state.holdList = null;
  state.records.push({ ...record(40), action: 'ACCOUNT_UNLOCKED', entityType: 'USER',
    occurredAt: new Date(Date.parse(lastList(state).to) - 600_000).toISOString() });
  await page.getByLabel('Hành động', { exact: true }).fill('ACCOUNT_UNLOCKED');
  await submit(page, state);
  await row(page, 40).waitFor();
  hold.release.resolve();
  await waitForDeferred(hold.completed, 'stale list completion');
  // Give the old answer one animation frame to render if request ownership is broken.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await rows(page).count(), 1);
  assert.equal(await row(page, 0).count(), 0);
  assert.equal(await row(page, 40).count(), 1);
  assert.deepEqual(errors, []);
  await context.close();
  passed('filter submission wins over a delayed reload response');

  const csv = await fixture({ count: 107 });
  csv.state.records[0].reason = '=HYPERLINK("https://example.test", "x")\nDòng hai';
  csv.state.records[0].userAgent = '+formula-agent';
  csv.state.records[0].correlationId = '@formula-request';
  // A record outside the exact active filter must never enter the download.
  csv.state.records.push({ ...record(200), action: 'USER_UPDATED' });
  await csv.page.getByLabel('Hành động', { exact: true }).fill('ORDER_CONFIRMED');
  await submit(csv.page, csv.state);
  const activeQuery = lastList(csv.state);
  await csv.page.getByLabel('Hành động', { exact: true }).fill('USER_UPDATED');
  const exportHold = { started: deferred(), release: deferred() };
  csv.state.holdExport = exportHold;
  const csvDownload = downloadCsv(csv.page);
  await waitForDeferred(exportHold.started, 'held export request');
  assert.equal(await button(csv.page, 'Lọc').isDisabled(), true);
  assert.equal(await button(csv.page, 'Tải lại').isDisabled(), true);
  assert.equal(await csv.page.getByLabel('Hành động', { exact: true }).isDisabled(), true);
  csv.state.holdExport = null;
  exportHold.release.resolve();
  const bytes = await csvDownload;
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const parsed = parseCsv(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  assert.equal(parsed.length, 108, 'CSV contains header plus all 107 matching logs');
  assert(parsed.every((entry) => entry.length === parsed[0].length), 'embedded quotes/newlines must preserve columns');
  assert(parsed[1].includes("'" + csv.state.records[0].reason), 'spreadsheet formulas are neutralized while preserving quoted newlines');
  assert(parsed[1].includes("'" + csv.state.records[0].userAgent));
  assert(parsed[1].includes("'" + csv.state.records[0].correlationId));
  assert(parsed.at(-1).includes(id(106)));
  assert.equal(parsed.some((entry) => entry.includes(id(200))), false);
  const exportQueries = listRequests(csv.state, 100).map((entry) => entry.query);
  assert.deepEqual(exportQueries.map((query) => query.page), ['1', '2']);
  assert(exportQueries.every((query) => query.action === activeQuery.action && query.from === activeQuery.from && query.to === activeQuery.to));
  passed('CSV exports all filtered pages, applied filters, UTF-8 BOM and safe escaped fields');

  const downloads = [];
  csv.page.on('download', (download) => downloads.push(download));
  csv.state.exportErrorPage = 2;
  await button(csv.page, 'Xuất CSV').click();
  await csv.page.getByText('Lỗi trang xuất CSV kiểm thử.', { exact: true }).waitFor();
  assert.equal(downloads.length, 0, 'a failed page must not create a partial CSV');
  assert.equal(await rows(csv.page).count(), 15);
  assert.equal(await button(csv.page, 'Xuất CSV').isDisabled(), false);
  assert.deepEqual(csv.errors, []);
  await csv.context.close();
  passed('later CSV page failure creates no partial download and restores controls');

  const empty = await fixture({ count: 0 });
  assert.equal(await rows(empty.page).count(), 0);
  assert.equal(await button(empty.page, 'Sau').isDisabled(), true);
  assert.equal(await button(empty.page, 'Trước').isDisabled(), true);
  assert.deepEqual(empty.errors, []);
  await empty.context.close();
  passed('empty API page shows a truthful empty state and disables pagination');

  const forbidden = await fixture();
  forbidden.state.listError = { status: 403, body: { title: 'Forbidden', detail: 'Bạn không có quyền đọc nhật ký kiểm thử.' } };
  await button(forbidden.page, 'Tải lại').click();
  await forbidden.page.getByText('Bạn không có quyền xem nhật ký hệ thống.', { exact: true }).waitFor();
  assert.equal(await rows(forbidden.page).count(), 0);
  assert.equal(await forbidden.page.evaluate(() => localStorage.getItem('agrisage_token')), 'audit.test.jwt');
  assert.equal(new URL(forbidden.page.url()).pathname, '/admin/audit-logs');
  await forbidden.context.close();
  passed('403 shows permission error without displaying records or clearing session');

  const expiry = await fixture();
  expiry.state.listError = { status: 401, body: { title: 'Unauthorized' } };
  await button(expiry.page, 'Tải lại').click();
  await expiry.page.waitForURL(/\/login/);
  assert.equal(await expiry.page.evaluate(() => localStorage.getItem('agrisage_token')), null);
  await expiry.context.close();
  passed('401 clears the token and redirects to login through the shared API client');

  const mobile = await fixture({ viewport: { width: 390, height: 844 } });
  if (process.env.AUDIT_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.AUDIT_SCREENSHOT_DIR, { recursive: true });
    await mobile.page.screenshot({ path: path.join(process.env.AUDIT_SCREENSHOT_DIR, 'audit-logs-mobile.png') });
  }
  const width = await mobile.page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('main, form, fieldset, main > div, table')].map((element) => ({
      tag: element.tagName, class: element.className, width: element.getBoundingClientRect().width,
    })).filter((element) => element.width > window.innerWidth) }));
  assert.equal(width.document <= width.viewport, true, JSON.stringify(width));
  const tableScroll = await mobile.page.locator('table').evaluate((table) => {
    const container = table.parentElement;
    container.scrollLeft = 200;
    return { client: container.clientWidth, content: container.scrollWidth, left: container.scrollLeft };
  });
  assert(tableScroll.content > tableScroll.client && tableScroll.left > 0, 'wide table must remain horizontally scrollable inside the page');
  assert.deepEqual(mobile.errors, []);
  await mobile.context.close();
  passed('mobile table scrolls within the page without document overflow');

  const enriched = await fixture({ count: 713 });
  await row(enriched.page, 1).getByText('Nguyễn Văn Sale', { exact: true }).waitFor();
  await row(enriched.page, 1).getByText('sale@agrisage.test', { exact: true }).waitFor();
  await row(enriched.page, 1).getByText('Sale', { exact: true }).waitFor();
  await row(enriched.page, 1).getByText('Xác nhận đơn hàng', { exact: true }).waitFor();
  const pagination = enriched.page.getByRole('navigation', { name: 'Phân trang', exact: true });
  assert.equal(await pagination.locator(':scope > *').count() <= 9, true);
  await pagination.getByRole('button', { name: 'Trang 48', exact: true }).click();
  await row(enriched.page, 705).waitFor();
  assert.equal(await button(enriched.page, 'Sau').isDisabled(), true);
  await enriched.page.getByLabel('Tìm kiếm', { exact: true }).fill(' SALE@AGRISAGE.TEST ');
  await enriched.page.getByLabel('Vai trò người thực hiện', { exact: true }).selectOption('SALES_STAFF');
  await enriched.page.getByLabel('Trạng thái hành động', { exact: true }).selectOption('SUCCESS');
  const search = await submit(enriched.page, enriched.state);
  assert.equal(search.search, 'SALE@AGRISAGE.TEST');
  assert.equal(search.actorrole, 'SALES_STAFF');
  assert.equal(search.status, 'SUCCESS');
  assert.equal(search.page, '1');
  assert.equal(await row(enriched.page, 0).count(), 0);
  const filteredCsv = parseCsv((await downloadCsv(enriched.page)).toString('utf8').replace(/^\uFEFF/, ''));
  assert(filteredCsv[0].includes('Email') && filteredCsv[0].includes('Vai trò') && filteredCsv[0].includes('Trạng thái'));
  assert(filteredCsv[1].includes('sale@agrisage.test') && filteredCsv[1].includes('Nguyễn Văn Sale'));
  assert(listRequests(enriched.state, 100).every(request => request.query.actorrole === 'SALES_STAFF' && request.query.status === 'SUCCESS'));
  enriched.state.records[1].action = 'PAYMENT_FAILED';
  enriched.state.records[1].status = 'FAILURE';
  enriched.state.records[1].userAgent = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
  await enriched.page.getByLabel('Trạng thái hành động', { exact: true }).selectOption('FAILURE');
  await submit(enriched.page, enriched.state);
  assert.equal(await rows(enriched.page).count(), 1);
  await row(enriched.page, 1).getByText('Thất bại', { exact: true }).waitFor();
  await row(enriched.page, 1).getByText('Edge 130.0.0.0 · Windows', { exact: true }).waitFor();
  await row(enriched.page, 1).getByRole('button', { name: 'Chi tiết nhật ký ' + id(1), exact: true }).click();
  const changeTable = enriched.page.getByRole('region', { name: 'Lịch sử thay đổi', exact: true });
  assert((await changeTable.innerText()).includes('DRAFT') && (await changeTable.innerText()).includes('CONFIRMED'));
  assert((await changeTable.innerText()).includes('Đã thay đổi'));
  await enriched.page.getByRole('heading', { name: 'Lý do thay đổi', exact: true }).waitFor();
  if (process.env.AUDIT_SCREENSHOT_DIR) await enriched.page.screenshot({ path: path.join(process.env.AUDIT_SCREENSHOT_DIR, 'audit-logs-detail.png') });
  await button(enriched.page, 'Đóng').last().click();
  await enriched.page.getByLabel('Thời gian', { exact: true }).selectOption('custom');
  const vnDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await enriched.page.getByLabel('Từ ngày (UTC+7)', { exact: true }).fill(vnDate);
  await enriched.page.getByLabel('Đến ngày (UTC+7)', { exact: true }).fill(vnDate);
  const dates = await submit(enriched.page, enriched.state);
  assert.equal(dates.from, new Date(vnDate + 'T00:00:00+07:00').toISOString());
  assert.equal(dates.to, new Date(vnDate + 'T23:59:59.999+07:00').toISOString());
  assert.deepEqual(enriched.errors, []);
  await enriched.context.close();
  passed('actor names/email/role, readable actions, before/after, failure/browser, filtered CSV, custom Vietnam dates and 48 pages');

  const owner = await fixture({ role: 'STORE_OWNER' });
  owner.state.records.push({ ...record(800), storeId: id(999), reason: 'Foreign store marker' },
    { ...record(801), storeId: null, reason: 'Global auth marker' });
  await button(owner.page, 'Tải lại').click();
  await row(owner.page, 0).waitFor();
  await owner.page.getByRole('main').getByRole('heading', { name: 'Nhật ký đại lý', exact: true }).waitFor();
  assert.equal(await owner.page.getByText('Foreign store marker', { exact: false }).count(), 0);
  assert.equal(await owner.page.getByText('Global auth marker', { exact: false }).count(), 0);
  assert.equal(listRequests(owner.state).length >= 2, true);
  assert.deepEqual(owner.errors, []);
  await owner.context.close();
  passed('Owner activity log uses the immutable server API and scoped records instead of mock data');
  console.log('PASS ' + checks + ' audit browser scenarios: ' + path.basename(root));
} finally { await browser.close(); }
