import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// F3.23 (FLOW_3 §8j, team task 3): the store logs the reminders it made outside the system. The customer debt page records
// them (channel, outcome, contact time, promise) and lists them with the promise label; "Cần quyết định" shows the latest
// one. Logging needs DEBT.FOLLOW_UP and something owed. Every API request is intercepted; no live store is read or written.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const failures = []
const screenshotDir = process.env.DASHBOARD_SCREENSHOT_DIR
if (screenshotDir) await mkdir(screenshotDir, { recursive: true })
let checks = 0
const pass = message => { checks++; console.log('PASS ' + message) }

const vnToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const addDays = (iso, days) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
const dmy = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const FARMER = 'farmer-1'
const customer = { id: FARMER, fullName: 'Nguyễn Văn An', phoneNumber: '0901234567', customerGroup: null, paymentTermDays: 30, availableCredit: 7000000 }
const followUp = (id, over) => ({ id, contactedAt: `${addDays(vnToday, -5)}T02:00:00Z`, channel: 'PHONE_CALL', outcome: 'NO_ANSWER', note: null, promisedDate: null, promisedAmount: null,
  promiseStatus: null, paidSinceContact: 0, outstandingAmount: 3000000, overdueAmount: 2000000, createdBy: { id: 'owner', name: 'Chủ cửa hàng', role: 'STORE_OWNER' }, createdAt: `${addDays(vnToday, -5)}T02:05:00Z`, ...over })
const entry = (id, over) => ({ id, entryNumber: `DE-${id}`, farmerProfileId: FARMER, fullName: customer.fullName, phoneNumber: customer.phoneNumber, sourceType: 'PICKUP', orderNumber: null,
  originalAmount: 2000000, totalPaid: 0, outstandingAmount: 2000000, dueDate: addDays(vnToday, -40), isOverdue: true, overdueDays: 40, status: 'OPEN', createdAt: `${addDays(vnToday, -70)}T02:00:00Z`,
  originSeason: null, collectionSeason: null, originalDueDate: addDays(vnToday, -40), rolloverCount: 0, isRolledOver: false, dueState: 'OVERDUE', needsDecision: true, ...over })

async function session(mode = 'owner') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'debt-follow-ups'))
  const state = { requests: [], posts: [], followUps: [
    followUp('f-2', { channel: 'VISIT', outcome: 'PROMISED', note: 'Hẹn bán lúa xong trả', promisedDate: addDays(vnToday, -1), promisedAmount: 1000000, promiseStatus: 'BROKEN', contactedAt: `${addDays(vnToday, -3)}T03:00:00Z` }),
    followUp('f-1', { outcome: 'PROMISED', promisedDate: addDays(vnToday, -10), promiseStatus: 'KEPT', paidSinceContact: 2000000, contactedAt: `${addDays(vnToday, -12)}T03:00:00Z`, hasLaterContact: true }),
    followUp('f-0', { outcome: 'PROMISED', promisedDate: addDays(vnToday, -20), promiseStatus: 'LATE', paidSinceContact: 500000, contactedAt: `${addDays(vnToday, -22)}T03:00:00Z`, hasLaterContact: true }),
    followUp('f-z', { outcome: 'PROMISED', promisedDate: addDays(vnToday, -25), promiseStatus: 'CLEARED', contactedAt: `${addDays(vnToday, -26)}T03:00:00Z`, hasLaterContact: true }),
  ] }
  const staff = mode === 'staff'
  const permissions = ['DEBT.READ', 'DEBT.READ_DASHBOARD', 'PAYMENTS.RECEIVE_CASH', 'BANK_PAYMENTS.RECORD', 'CUSTOMERS.READ', 'ORDERS.READ', ...(staff ? [] : ['DEBT.FOLLOW_UP', 'DEBT.MANUAL'])]
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/realtime/negotiate') return route.abort()
    const query = Object.fromEntries(url.searchParams)
    state.requests.push({ path, query, method: request.method() })
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {})
    const paged = (items = []) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1 })
    if (path === '/api/auth/me') return json({ id: staff ? 'seller' : 'owner', fullName: staff ? 'Nhân viên' : 'Chủ cửa hàng', role: staff ? 'SALES_STAFF' : 'STORE_OWNER', status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ permissions })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === `/api/customers/${FARMER}/debt/follow-ups`) {
      if (request.method() === 'POST') {
        const body = JSON.parse(request.postData() || '{}')
        state.posts.push(body)
        const created = followUp('f-new', { ...body, contactedAt: body.contactedAt, promiseStatus: body.promisedDate ? 'WAITING' : null, createdAt: new Date().toISOString() })
        state.followUps = [created, ...state.followUps.map(item => ({ ...item, hasLaterContact: true }))]
        return json(created, 201)
      }
      return json(paged(state.followUps))
    }
    if (request.method() !== 'GET') { failures.push(`Unexpected write ${request.method()} ${path}`); return route.abort() }
    if (path === `/api/customers/${FARMER}`) return json(customer)
    if (path === `/api/customers/${FARMER}/debt`) return json({ id: 'account-1', farmerProfileId: FARMER, status: 'ACTIVE', currentBalance: mode === 'paid' ? 0 : 3000000,
      overdueAmount: mode === 'paid' ? 0 : 2000000, openEntryCount: mode === 'paid' ? 0 : 2, oldestDueDate: mode === 'paid' ? null : addDays(vnToday, -40), lastTransactionAt: null, version: 1, groups: [] })
    if (path === '/api/debt-entries') return json(paged(mode === 'paid' ? [] : [entry('1', { lastFollowUp: null })]))
    if (path === '/api/debt-entries/dashboard') return json({ totalOutstandingDebt: 3000000, totalOverdueDebt: 2000000, collectedToday: 0, collectedThisMonth: 0, customersWithDebt: 2,
      customersWithOverdueDebt: 2, topDebtors: [], recentDebtPayments: [], overdueDebts: [], currentSeason: null, currentSeasonOutstanding: 0, dueSoonAmount: 0, needsDecisionCount: 2,
      needsDecision: [
        entry('1', { lastFollowUp: { contactedAt: `${addDays(vnToday, -3)}T03:00:00Z`, channel: 'PHONE_CALL', outcome: 'PROMISED', promisedDate: addDays(vnToday, -1), promiseStatus: 'BROKEN', byName: 'Chủ cửa hàng' } }),
        entry('2', { farmerProfileId: 'farmer-2', fullName: 'Trần Thị Bình', lastFollowUp: null }),
      ], creditLimitAlertCount: 0, creditLimitAlerts: [], followUp: { windowDays: 7, overdueCustomerCount: 2, notContactedCount: 1, brokenPromiseCount: 1 } })
    return json(paged([]))
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(`Page error: ${error.message}`))
  return { context, page, state }
}

try {
  const { context, page, state } = await session('owner')
  await page.goto(`${base}/agent/debts/${FARMER}`)
  const record = page.getByRole('button', { name: 'Ghi nhận nhắc nợ' })
  await record.waitFor()
  // The account loads after the button appears; once it shows overdue debt the button stands out.
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Ghi nhận nhắc nợ') && b.className.includes('amber')))
  await record.click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Ghi nhận nhắc nợ — Nguyễn Văn An' })
  await dialog.getByText('Ghi nhận nhắc nợ — Nguyễn Văn An').waitFor()
  assert.match(await dialog.innerText(), /không gửi tin nhắn, không đổi khoản nợ/)
  const submit = dialog.getByRole('button', { name: 'Ghi nhận', exact: true })
  assert.equal(await submit.isDisabled(), true, 'Channel and outcome are required')
  await dialog.getByRole('combobox', { name: 'Hình thức' }).selectOption('OTHER')
  await dialog.getByRole('combobox', { name: 'Kết quả' }).selectOption('NO_ANSWER')
  await dialog.getByText('Ghi chú là bắt buộc khi chọn "Khác".').waitFor()
  assert.equal(await submit.isDisabled(), true)
  assert.equal(await dialog.getByLabel('Ngày hẹn trả').count(), 0, 'No promise fields without a promise')
  pass('The form needs a channel, an outcome, and a note for "Khác"; promise fields stay hidden')

  await dialog.getByRole('combobox', { name: 'Hình thức' }).selectOption('VISIT')
  await dialog.getByRole('combobox', { name: 'Kết quả' }).selectOption('PROMISED')
  await dialog.getByText('Nhập ngày khách hẹn trả.').waitFor()
  await dialog.getByLabel('Ngày hẹn trả').fill(dmy(addDays(vnToday, 3)))
  await dialog.getByLabel('Số tiền hẹn trả (đ)').fill('5000000')
  await dialog.getByText('không quá dư nợ', { exact: false }).waitFor()
  await dialog.getByLabel('Số tiền hẹn trả (đ)').fill('500000')
  await dialog.getByLabel('Ghi chú').fill('Ra ruộng gặp, hẹn cuối tuần')
  assert.equal(await submit.isDisabled(), false)
  await submit.click()
  await page.getByText('Đã ghi nhận lần nhắc nợ').waitFor()
  const body = state.posts.at(-1)
  assert.equal(body.channel, 'VISIT'); assert.equal(body.outcome, 'PROMISED')
  assert.equal(body.promisedDate, addDays(vnToday, 3)); assert.equal(body.promisedAmount, 500000)
  assert.equal(body.note, 'Ra ruộng gặp, hẹn cuối tuần')
  assert.match(body.contactedAt, new RegExp(`^${vnToday}T\\d{2}:\\d{2}:00\\+07:00$`), 'Contact time is sent in Vietnam time')
  pass('A visit with a promise is sent with its date, amount, note and the contact time in Vietnam time')

  // After saving, the "Nhắc nợ" tab shows the history with the promise labels from the server.
  assert.equal(await page.getByRole('tab', { name: 'Nhắc nợ' }).getAttribute('aria-selected'), 'true')
  const history = page.getByRole('list', { name: 'Lịch sử nhắc nợ' })
  await history.getByText('Ra ruộng gặp, hẹn cuối tuần').waitFor()
  const items = history.getByRole('listitem')
  assert.equal(await items.count(), 5)
  assert.match(await items.nth(0).innerText(), /Đến nhà\/ruộng[\s\S]*Hứa trả[\s\S]*500\.000 đ[\s\S]*Chờ đến hẹn/)
  assert.doesNotMatch(await items.nth(0).innerText(), /đã có lần nhắc sau/, 'The newest record is the latest word')
  assert.match(await items.nth(1).innerText(), /Quá hẹn[\s\S]*đã có lần nhắc sau[\s\S]*Hẹn bán lúa xong trả/)
  assert.match(await items.nth(2).innerText(), /Đã trả theo hẹn/)
  assert.match(await items.nth(3).innerText(), /Trả trễ hẹn/)
  assert.match(await items.nth(4).innerText(), /Hết nợ/)
  assert.doesNotMatch(await items.nth(4).innerText(), /Đã trả theo hẹn/, 'A debt cleared without paying is not "paid as promised"')
  assert.match(await items.nth(1).innerText(), /Lúc ghi: còn nợ 3\.000\.000 đ · quá hạn 2\.000\.000 đ/)
  pass('The history lists reminders newest first with "Chờ đến hẹn", "Quá hẹn", "Đã trả theo hẹn", "Trả trễ hẹn", "Hết nợ" and marks older ones')

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1, null, { timeout: 5000 })
    if (screenshotDir) await page.screenshot({ path: join(screenshotDir, `follow-ups-${width}.png`), fullPage: true })
  }
  pass('No page overflow at 390 and 320 px')

  // "Cần quyết định" on the debts page shows the latest reminder, or that there was none.
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto(`${base}/agent/debts`)
  const decisions = page.getByRole('region', { name: 'Cần quyết định' })
  await decisions.getByText('Trần Thị Bình').waitFor()
  assert.match(await decisions.innerText(), new RegExp(`Nhắc gần nhất: ${dmy(addDays(vnToday, -3)).slice(0, 5)} · Gọi điện · Hứa trả ${dmy(addDays(vnToday, -1)).slice(0, 5)}[\\s\\S]*Quá hẹn`))
  assert.match(await decisions.innerText(), /Chưa ghi nhận lần nhắc nợ nào/)
  pass('"Cần quyết định" shows the latest reminder with its promise label, or "Chưa ghi nhận"')
  await context.close()

  // Sale staff without DEBT.FOLLOW_UP read the history but cannot log; nothing is posted.
  const staff = await session('staff')
  await staff.page.goto(`${base}/sales/debts/${FARMER}`)
  await staff.page.getByRole('tab', { name: 'Nhắc nợ' }).click()
  await staff.page.getByText('Hẹn bán lúa xong trả').waitFor()
  assert.equal(await staff.page.getByRole('button', { name: 'Ghi nhận nhắc nợ' }).count(), 0)
  assert.equal(staff.state.posts.length, 0)
  pass('Without DEBT.FOLLOW_UP the history is readable and there is no way to log')
  await staff.context.close()

  // A customer who owes nothing: nothing to remind.
  const paid = await session('paid')
  await paid.page.goto(`${base}/agent/debts/${FARMER}`)
  const disabled = paid.page.getByRole('button', { name: 'Ghi nhận nhắc nợ' })
  await disabled.waitFor()
  await paid.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Ghi nhận nhắc nợ') && b.disabled))
  assert.doesNotMatch(await disabled.getAttribute('class'), /amber/)
  pass('A customer who owes nothing cannot be logged')
  await paid.context.close()
} catch (error) {
  failures.push(error.stack || String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Debt follow-up checks passed (${checks})`)
