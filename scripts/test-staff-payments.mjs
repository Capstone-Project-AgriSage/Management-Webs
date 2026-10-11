import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// Every /api request is intercepted before navigation. These tests never call a live backend.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5174'
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL })
const failures = []
const fullStaffPermissions = ['STAFF.READ', 'STAFF.READ_GET', 'STAFF.CREATE', 'STAFF.UPDATE', 'STAFF.LOCK', 'STAFF.UNLOCK', 'STAFF.DELETE', 'STAFF.RESET_PASSWORD']
const fullPaymentPermissions = ['PAYMENTS.READ', 'PAYMENTS.CREATE', 'PAYMENTS.SYNC', 'PAYMENTS.CANCEL', 'BANK_PAYMENTS.CONFIRM', 'BANK_PAYMENTS.REJECT']
const createdAt = '2026-10-10T10:00:00Z'
const member = (id, name, role = 'SALES_STAFF') => ({ id, fullName: name, phoneNumber: '0901234567', email: null, role, status: 'ACTIVE', memberStatus: 'ACTIVE', employeeCode: 'NV-01', joinedAt: '2026-10-01', leftAt: null, canReviewAi: false, createdAt })
const payment = (id, method = 'BANK_TRANSFER') => ({ id, paymentNumber: 'PAY-' + id, paymentContext: method === 'PAYOS' ? 'ORDER_PAYMENT' : 'DEBT_REPAYMENT', paymentMethod: method, amount: 100000, currency: 'VND', status: 'PENDING', payerFarmerProfileId: 'customer-1', payerName: 'Khách kiểm thử', confirmationSource: null, confirmedBy: null, confirmedAt: null, checkoutUrl: method === 'PAYOS' ? 'https://checkout.payos.vn/test-link' : null, providerOrderCode: method === 'PAYOS' ? 123456 : null, initiatedAt: createdAt, failedAt: null, cancelledAt: null, note: null, unallocatedAmount: 100000, allocations: [] })
const order = { id: 'order-1', orderNumber: 'OD-TEST-1', status: 'CONFIRMED', customerName: 'Khách kiểm thử', customerPhone: '0901234567', totalAmount: 100000, createdAt, source: 'COUNTER', settlementType: 'FULL_PAYMENT', customerType: 'REGISTERED', items: [] }

async function session(permissions) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token', 'staff-payment-test'))
  const state = { staff: [member('owner', 'Chủ cửa hàng', 'STORE_OWNER'), member('sales-1', 'Nhân viên kiểm thử'), member('driver-1', 'Nhân viên giao hàng', 'DELIVERY_STAFF')], payments: [payment('payos-1', 'PAYOS'), payment('cancel-1'), payment('confirm-1'), payment('reject-1')], requests: [], failStaffReset: false, failSync: false, failPayOs: false }
  await context.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    const method = request.method()
    const body = request.postData() ? JSON.parse(request.postData()) : null
    const query = Object.fromEntries([...url.searchParams].map(([key, value]) => [key.toLowerCase(), value]))
    state.requests.push({ path, method, body, query })
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) }).catch(() => {})
    const empty = () => route.fulfill({ status: 204 }).catch(() => {})
    if (path === '/api/auth/me') return json({ id: 'owner', fullName: 'Kiểm thử', role: 'STORE_OWNER', status: 'ACTIVE' })
    if (path === '/api/me/permissions') return json({ permissions })
    if (path.endsWith('/unread-count')) return json({ count: 0 })
    if (path === '/api/staff' && method === 'GET') {
      const items = state.staff.filter(item => (!query.search || item.fullName.toLowerCase().includes(query.search.toLowerCase())) && (!query.role || item.role === query.role) && (!query.status || item.status === query.status))
      return json({ items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1 })
    }
    if (path === '/api/staff' && method === 'POST') { const item = { ...member('created-1', body.fullName, body.role), ...body }; delete item.password; state.staff.push(item); return json(item, 201) }
    const staffMatch = path.match(/^\/api\/staff\/([^/]+)(?:\/(lock|unlock|reset-password))?$/)
    if (staffMatch) {
      const item = state.staff.find(row => row.id === staffMatch[1])
      if (!item) return json({ title: 'Not found' }, 404)
      if (method === 'GET') return json(item)
      if (method === 'PUT') { Object.assign(item, body); return json(item) }
      if (method === 'DELETE') { item.status = 'LOCKED'; item.memberStatus = 'LEFT'; item.leftAt = '2026-10-11'; return empty() }
      if (staffMatch[2] === 'reset-password') return state.failStaffReset ? json({ title: 'Invalid password', detail: 'Mật khẩu kiểm thử bị từ chối' }, 422) : empty()
      if (staffMatch[2] === 'lock') item.status = 'LOCKED'
      if (staffMatch[2] === 'unlock') { item.status = 'ACTIVE'; item.memberStatus = 'ACTIVE'; item.leftAt = null }
      return empty()
    }
    if (path === '/api/orders') return json({ items: [order], page: 1, pageSize: 10, totalCount: 1, totalPages: 1 })
    if (path === '/api/orders/order-1/payments') return json({ orderId: order.id, orderTotal: 100000, paidAmount: 0, availablePrepayment: 0, consumedPrepayment: 0, remainingToPay: 100000, payments: state.payments.filter(item => item.paymentContext === 'ORDER_PAYMENT'), refunds: [] })
    if (path === '/api/payments' && method === 'GET') {
      const items = state.payments.filter(item => (!query.search || item.paymentNumber.toLowerCase().includes(query.search.toLowerCase())) && (!query.status || item.status === query.status) && (!query.paymentmethod || item.paymentMethod === query.paymentmethod) && (!query.paymentcontext || item.paymentContext === query.paymentcontext))
      return json({ items, page: 1, pageSize: 10, totalCount: items.length, totalPages: 1 })
    }
    if (path === '/api/payments/payos' && method === 'POST') {
      if (state.failPayOs) return json({ title: 'Gateway unavailable', detail: 'payOS kiểm thử chưa khả dụng' }, 503)
      const item = { ...payment('created-payos', 'PAYOS'), amount: body.amount }
      state.payments.push(item)
      return json({ paymentId: item.id, paymentNumber: item.paymentNumber, amount: item.amount, checkoutUrl: item.checkoutUrl, qrCode: 'test-qr', providerOrderCode: 123456, expiresAt: null, status: 'PENDING' }, 201)
    }
    const paymentMatch = path.match(/^\/api\/payments\/([^/]+)(?:\/(sync|cancel|confirm|reject))?$/)
    if (paymentMatch) {
      const item = state.payments.find(row => row.id === paymentMatch[1])
      if (!item) return json({ title: 'Not found' }, 404)
      if (method === 'GET') return json(item)
      if (paymentMatch[2] === 'sync' && state.failSync) return json({ title: 'Gateway unavailable', detail: 'Đồng bộ payOS kiểm thử bị lỗi' }, 503)
      if (paymentMatch[2] === 'sync' || paymentMatch[2] === 'confirm') { item.status = 'PAID'; item.confirmedAt = createdAt }
      else if (paymentMatch[2] === 'reject') item.status = 'FAILED'
      else if (paymentMatch[2] === 'cancel') item.status = 'CANCELLED'
      return json(item)
    }
    failures.push(`Unhandled mock API ${method} ${path}`)
    return json({ title: 'Unexpected test request' }, 500)
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(error.message))
  return { context, page, state }
}
const lastRequest = (state, path, method) => state.requests.filter(item => item.path === path && item.method === method).at(-1)
const writeCount = state => state.requests.filter(item => !['GET', 'HEAD'].includes(item.method)).length
const staffRow = (page, name) => page.getByRole('row').filter({ hasText: name })
async function staffAction(page, name, action) {
  const trigger = staffRow(page, name).getByRole('button', { name: `Thao tác nhân viên ${name}`, exact: true })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  const menu = page.locator('body > .fixed').filter({ has: page.getByRole('button', { name: action, exact: true }) })
  const bounds = await menu.boundingBox()
  const viewport = page.viewportSize()
  assert.ok(bounds && viewport && bounds.x >= 7 && bounds.y >= 7 && bounds.x + bounds.width <= viewport.width - 7 && bounds.y + bounds.height <= viewport.height - 7, 'Row menu stays inside the viewport using its measured height')
  await page.getByRole('button', { name: action, exact: true }).click()
}
async function openPayment(page, id) {
  await page.getByRole('row').filter({ hasText: 'PAY-' + id }).getByRole('button', { name: 'Xem chi tiết', exact: true }).click()
  await page.getByRole('dialog').getByText('Khách kiểm thử', { exact: true }).waitFor()
}

try {
  const staff = await session(fullStaffPermissions)
  await staff.page.goto(base + '/agent/staff')
  await staffRow(staff.page, 'Nhân viên kiểm thử').waitFor()
  await staff.page.getByRole('button', { name: 'Thêm nhân viên', exact: true }).click()
  let dialog = staff.page.getByRole('dialog')
  assert.equal(await dialog.getByRole('option', { name: 'Chủ cửa hàng', exact: true }).count(), 0, 'Store Owner cannot create another owner')
  const roleDropdown = dialog.getByLabel('Vai trò *', { exact: true })
  await roleDropdown.click()
  let rolePopup = staff.page.locator('.agrisage-select-menu')
  await rolePopup.waitFor()
  assert.equal(await rolePopup.getByRole('option', { name: 'Chủ cửa hàng', exact: true }).count(), 0)
  await roleDropdown.press('Escape')
  assert.equal(await dialog.isVisible(), true, 'Escape dismisses the dropdown before dismissing its modal')
  assert.equal(await rolePopup.count(), 0)
  await roleDropdown.click()
  rolePopup = staff.page.locator('.agrisage-select-menu')
  await rolePopup.getByRole('option', { name: 'Nhân viên giao hàng', exact: true }).click()
  assert.equal(await roleDropdown.inputValue(), 'DELIVERY_STAFF')
  await roleDropdown.selectOption('SALES_STAFF')
  console.log('PASS Modal dropdown keeps role restrictions, changes the native value, and handles Escape without closing the form')
  await dialog.getByLabel('Họ và tên *', { exact: true }).fill('Nhân viên mới')
  await dialog.getByLabel('Mật khẩu mới *', { exact: true }).fill('Password123')
  await dialog.getByLabel('Xác nhận mật khẩu *', { exact: true }).fill('Password123')
  const beforeContact = writeCount(staff.state)
  await dialog.getByRole('button', { name: 'Thêm nhân viên', exact: true }).click()
  await dialog.getByRole('alert').getByText('Nhập ít nhất một số điện thoại hoặc email để nhân viên đăng nhập.', { exact: true }).waitFor()
  assert.equal(writeCount(staff.state), beforeContact)
  await dialog.getByLabel('Email', { exact: true }).fill('new@example.test')
  await dialog.getByLabel('Mã nhân viên', { exact: true }).fill('NV-NEW')
  await dialog.getByLabel('Ngày vào làm', { exact: true }).fill('2026-10-01')
  await dialog.getByRole('button', { name: 'Thêm nhân viên', exact: true }).click()
  await staffRow(staff.page, 'Nhân viên mới').waitFor()
  assert.deepEqual(lastRequest(staff.state, '/api/staff', 'POST').body, { fullName: 'Nhân viên mới', phoneNumber: null, email: 'new@example.test', employeeCode: 'NV-NEW', joinedAt: '2026-10-01', role: 'SALES_STAFF', password: 'Password123' })

  await staffAction(staff.page, 'Nhân viên kiểm thử', 'Cập nhật thông tin')
  dialog = staff.page.getByRole('dialog')
  await dialog.getByLabel('Họ và tên *', { exact: true }).waitFor()
  await dialog.getByLabel('Họ và tên *', { exact: true }).fill('Nhân viên đã sửa')
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await staffRow(staff.page, 'Nhân viên đã sửa').waitFor()
  assert.ok(lastRequest(staff.state, '/api/staff/sales-1', 'GET'))
  assert.deepEqual(lastRequest(staff.state, '/api/staff/sales-1', 'PUT').body, { fullName: 'Nhân viên đã sửa', phoneNumber: '0901234567', email: null, employeeCode: 'NV-01', joinedAt: '2026-10-01' })
  console.log('PASS Staff create/edit use exact DTOs, contact validation, and backend detail reads')

  await staffAction(staff.page, 'Nhân viên đã sửa', 'Đặt lại mật khẩu')
  dialog = staff.page.getByRole('dialog')
  assert.equal(await dialog.getByLabel('Mật khẩu mới *', { exact: true }).getAttribute('type'), 'password')
  await dialog.getByLabel('Mật khẩu mới *', { exact: true }).fill('NewPassword123')
  await dialog.getByLabel('Xác nhận mật khẩu *', { exact: true }).fill('Mismatch123')
  const beforeMismatch = writeCount(staff.state)
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await dialog.getByRole('alert').getByText('Mật khẩu xác nhận chưa khớp.', { exact: true }).waitFor()
  assert.equal(writeCount(staff.state), beforeMismatch)
  await dialog.getByLabel('Xác nhận mật khẩu *', { exact: true }).fill('NewPassword123')
  staff.state.failStaffReset = true
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await dialog.getByRole('alert').getByText('Mật khẩu kiểm thử bị từ chối', { exact: true }).waitFor()
  staff.state.failStaffReset = false
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.deepEqual(lastRequest(staff.state, '/api/staff/sales-1/reset-password', 'POST').body, { newPassword: 'NewPassword123' })
  console.log('PASS Staff password reset masks input, rejects mismatch, and preserves visible server failure')

  for (const [action, path, method] of [['Khóa tài khoản', '/api/staff/sales-1/lock', 'POST'], ['Mở khóa / kích hoạt', '/api/staff/sales-1/unlock', 'POST'], ['Cho nhân viên nghỉ việc', '/api/staff/sales-1', 'DELETE']]) {
    await staffAction(staff.page, 'Nhân viên đã sửa', action)
    await staff.page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await staff.page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.equal(lastRequest(staff.state, path, method).body, null)
    await staff.page.getByRole('table').getAttribute('aria-busy').then(async () => { await staff.page.waitForFunction(() => document.querySelector('table[aria-busy]')?.getAttribute('aria-busy') === 'false') })
  }
  assert.equal(staff.state.staff.find(item => item.id === 'sales-1').memberStatus, 'LEFT')
  await staffAction(staff.page, 'Chủ cửa hàng', 'Xem thông tin')
  await staff.page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).last().click()
  await staffRow(staff.page, 'Chủ cửa hàng').getByRole('button', { name: 'Thao tác nhân viên Chủ cửa hàng', exact: true }).click()
  assert.equal(await staff.page.getByRole('button', { name: 'Khóa tài khoản', exact: true }).count(), 0)
  await staff.page.keyboard.press('Escape')
  console.log('PASS Staff lock/unlock/remove are semantic writes and self-management actions stay hidden')
  await staff.context.close()

  const readStaff = await session(['STAFF.READ', 'STAFF.READ_GET'])
  await readStaff.page.goto(base + '/agent/staff')
  await staffRow(readStaff.page, 'Nhân viên kiểm thử').waitFor()
  assert.equal(await readStaff.page.getByRole('button', { name: 'Thêm nhân viên', exact: true }).count(), 0)
  await staffRow(readStaff.page, 'Nhân viên kiểm thử').getByRole('button', { name: 'Thao tác nhân viên Nhân viên kiểm thử', exact: true }).click()
  for (const name of ['Cập nhật thông tin', 'Đặt lại mật khẩu', 'Khóa tài khoản', 'Cho nhân viên nghỉ việc']) assert.equal(await readStaff.page.getByRole('button', { name, exact: true }).count(), 0)
  assert.equal(writeCount(readStaff.state), 0)
  await readStaff.context.close()
  console.log('PASS Staff read-only permission hides all write actions')

  const ledger = await session(fullPaymentPermissions)
  await ledger.page.goto(base + '/agent/payments')
  await ledger.page.getByRole('region', { name: 'Danh sách phiếu thanh toán', exact: true }).waitFor()
  await ledger.page.getByRole('row').filter({ hasText: 'PAY-payos-1' }).waitFor()
  assert.equal(ledger.state.requests.filter(item => item.path === '/api/orders').length, 0, 'Ledger users without ORDERS.READ must not query orders')
  await ledger.page.getByRole('combobox', { name: 'Phương thức', exact: true }).selectOption('BANK_TRANSFER')
  await ledger.page.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption('PENDING')
  await ledger.page.getByRole('combobox', { name: 'Mục đích thanh toán', exact: true }).selectOption('DEBT_REPAYMENT')
  await ledger.page.getByRole('textbox', { name: 'Tìm theo mã phiếu thanh toán...', exact: true }).fill('cancel-1')
  await ledger.page.waitForFunction(() => document.querySelector('table[aria-busy]')?.getAttribute('aria-busy') === 'false' && document.querySelector('tbody')?.textContent?.includes('PAY-cancel-1'))
  await ledger.page.waitForTimeout(450)
  const query = lastRequest(ledger.state, '/api/payments', 'GET').query
  assert.equal(query.paymentmethod, 'BANK_TRANSFER'); assert.equal(query.status, 'PENDING'); assert.equal(query.paymentcontext, 'DEBT_REPAYMENT'); assert.equal(query.search, 'cancel-1'); assert.equal(query.page, '1')
  await ledger.page.getByRole('button', { name: 'Xóa lọc', exact: true }).click()
  await ledger.page.getByRole('row').filter({ hasText: 'PAY-payos-1' }).waitFor()
  console.log('PASS Payment ledger uses supported server search/filters and avoids unauthorized order reads')

  await openPayment(ledger.page, 'payos-1')
  dialog = ledger.page.getByRole('dialog')
  assert.equal(await dialog.getByRole('button', { name: 'Hủy phiếu thanh toán', exact: true }).count(), 0, 'Staff cannot cancel payOS via the non-payOS route')
  ledger.state.failSync = true
  await dialog.getByRole('button', { name: 'Đồng bộ payOS', exact: true }).click()
  await dialog.getByRole('alert').getByText('Đồng bộ payOS kiểm thử bị lỗi', { exact: true }).waitFor()
  assert.equal(ledger.state.payments.find(item => item.id === 'payos-1').status, 'PENDING')
  ledger.state.failSync = false
  await dialog.getByRole('button', { name: 'Đồng bộ payOS', exact: true }).click()
  await dialog.getByText('Trạng thái từ payOS: Đã thanh toán.', { exact: true }).waitFor()
  assert.equal(lastRequest(ledger.state, '/api/payments/payos-1/sync', 'POST').body, null)
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click()
  console.log('PASS payOS sync reflects provider responses and never marks a failed request paid')

  await openPayment(ledger.page, 'cancel-1')
  await ledger.page.getByRole('dialog').getByRole('button', { name: 'Hủy phiếu thanh toán', exact: true }).click()
  let confirm = ledger.page.getByRole('dialog').last()
  await confirm.getByLabel('Lý do hủy', { exact: true }).fill('Nhập trùng')
  await confirm.getByRole('button', { name: 'Hủy phiếu', exact: true }).click()
  await ledger.page.getByText('Trạng thái phiếu: Đã hủy.', { exact: true }).waitFor()
  assert.deepEqual(lastRequest(ledger.state, '/api/payments/cancel-1/cancel', 'POST').body, { reason: 'Nhập trùng' })
  await ledger.page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).last().click()

  await openPayment(ledger.page, 'confirm-1')
  await ledger.page.getByRole('dialog').getByRole('button', { name: 'Xác nhận chuyển khoản', exact: true }).click()
  await ledger.page.getByRole('dialog').last().getByRole('button', { name: 'Xác nhận đã nhận tiền', exact: true }).click()
  await ledger.page.getByText('Trạng thái phiếu: Đã thanh toán.', { exact: true }).waitFor()
  assert.equal(lastRequest(ledger.state, '/api/payments/confirm-1/confirm', 'POST').body, null)
  await ledger.page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).last().click()

  await openPayment(ledger.page, 'reject-1')
  await ledger.page.getByRole('dialog').getByRole('button', { name: 'Từ chối chuyển khoản', exact: true }).click()
  confirm = ledger.page.getByRole('dialog').last()
  assert.equal(await confirm.getByRole('button', { name: 'Từ chối phiếu', exact: true }).isEnabled(), false)
  await confirm.getByLabel('Lý do từ chối *', { exact: true }).fill('Không tìm thấy giao dịch ngân hàng')
  await confirm.getByRole('button', { name: 'Từ chối phiếu', exact: true }).click()
  await ledger.page.getByText('Trạng thái phiếu: Thất bại.', { exact: true }).waitFor()
  assert.deepEqual(lastRequest(ledger.state, '/api/payments/reject-1/reject', 'POST').body, { reason: 'Không tìm thấy giao dịch ngân hàng' })
  await ledger.context.close()
  console.log('PASS Pending bank receipts cancel/confirm/reject use exact methods and rejection reason')

  const readPayments = await session(['PAYMENTS.READ'])
  await readPayments.page.goto(base + '/agent/payments')
  await openPayment(readPayments.page, 'confirm-1')
  for (const name of ['Xác nhận chuyển khoản', 'Từ chối chuyển khoản', 'Hủy phiếu thanh toán']) assert.equal(await readPayments.page.getByRole('dialog').getByRole('button', { name, exact: true }).count(), 0)
  await readPayments.page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).last().click()
  await openPayment(readPayments.page, 'payos-1')
  assert.equal(await readPayments.page.getByRole('dialog').getByRole('button', { name: 'Đồng bộ payOS', exact: true }).count(), 0)
  assert.equal(writeCount(readPayments.state), 0)
  await readPayments.context.close()
  console.log('PASS Payment read-only permission hides every mutation')

  const payos = await session([...fullPaymentPermissions, 'ORDERS.READ'])
  await payos.page.goto(base + '/agent/payments')
  await payos.page.getByRole('row').filter({ hasText: order.orderNumber }).waitFor()
  await payos.page.getByRole('row').filter({ hasText: order.orderNumber }).click()
  dialog = payos.page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Tạo liên kết payOS', exact: true }).waitFor({ state: 'visible' })
  await dialog.getByRole('button', { name: 'Tạo liên kết payOS', exact: true }).click()
  let form = payos.page.getByRole('dialog').last()
  await form.getByRole('spinbutton').fill('100.25')
  const beforeFraction = writeCount(payos.state)
  await form.getByRole('button', { name: 'TẠO LIÊN KẾT', exact: true }).click()
  await payos.page.getByText('payOS chỉ nhận số tiền nguyên đồng. Phần lẻ cần thu bằng tiền mặt.', { exact: true }).waitFor()
  assert.equal(writeCount(payos.state), beforeFraction)
  await form.getByRole('spinbutton').fill('25000')
  payos.state.failPayOs = true
  await form.getByRole('button', { name: 'TẠO LIÊN KẾT', exact: true }).click()
  await payos.page.getByText('payOS kiểm thử chưa khả dụng', { exact: true }).waitFor()
  assert.equal(payos.state.payments.some(item => item.id === 'created-payos'), false)
  payos.state.failPayOs = false
  await form.getByRole('button', { name: 'TẠO LIÊN KẾT', exact: true }).click()
  await payos.page.getByRole('link', { name: 'Mở liên kết thanh toán payOS', exact: true }).waitFor()
  assert.deepEqual(lastRequest(payos.state, '/api/payments/payos', 'POST').body, { paymentContext: 'ORDER_PAYMENT', orderId: 'order-1', amount: 25000 })
  assert.equal(payos.state.payments.find(item => item.id === 'created-payos').status, 'PENDING')
  assert.equal(await payos.page.getByRole('link', { name: 'Mở liên kết thanh toán payOS', exact: true }).getAttribute('href'), 'https://checkout.payos.vn/test-link')
  assert.equal(payos.state.requests.some(item => item.path.endsWith('/simulate-paid')), false)
  await payos.context.close()
  console.log('PASS payOS creation validates whole VND, preserves gateway failure, and returns a pending checkout link')
  assert.deepEqual(failures, [])
} finally { await browser.close() }
