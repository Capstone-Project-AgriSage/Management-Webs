import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// Browser contract tests use intercepted responses and never change a live account's permissions.
const { chromium } = await import(process.env.PERMISSION_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PERMISSION_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.PERMISSION_BROWSER_CHANNEL })
const base = process.env.PERMISSION_TEST_URL || 'http://127.0.0.1:5173'
const catalog = [
  ['PERMISSIONS.MANAGE_ROLES', 'Cấu hình quyền vai trò', false, ['ADMIN']],
  ['PERMISSIONS.DELEGATE', 'Phân quyền nhân viên', false, ['ADMIN','STORE_OWNER']],
  ['STAFF.READ', 'Xem', false, ['ADMIN','STORE_OWNER','SALES_STAFF']],
  ['STAFF.READ_GET', 'Xem nhân viên', false, ['ADMIN','STORE_OWNER']],
  ['PRODUCTS.READ', 'Xem', true, ['ADMIN','STORE_OWNER','SALES_STAFF']],
  ['STORE_PRODUCTS.READ', 'Xem', true, ['ADMIN','STORE_OWNER','SALES_STAFF']],
  ['PRODUCTS.CREATE', 'Tạo', true, ['ADMIN','STORE_OWNER']],
  ['ORDERS.READ', 'Xem', true, ['ADMIN','STORE_OWNER','SALES_STAFF']],
  ['ORDERS.CANCEL', 'Hủy', true, ['ADMIN','STORE_OWNER']],
].map(([code,name,delegable,defaultRoles], index) => ({ id: String(index), code, module: code.split('.')[0], name, delegable, defaultRoles, allowedRoles: [...new Set([...defaultRoles,...(delegable ? ['SALES_STAFF'] : [])])] }))
const roleRows = ['ADMIN','STORE_OWNER','SALES_STAFF','FARMER'].map((code,index) => ({ id: `role-${index}`, code, name: code, editable: code !== 'ADMIN', version: 3, permissionCodes: catalog.filter(p=>p.defaultRoles.includes(code)).map(p=>p.code) }))
const staffId = '00000000-0000-4000-8000-000000000123'
const ownerId = '00000000-0000-4000-8000-000000000124'
const checked = (page, code) => page.getByRole('checkbox', { name: new RegExp(code.replaceAll('.', '\\.')) })
let checks = 0
const pass = name => { checks++; console.log('PASS '+name) }
async function fixture(role, path, initialCodes, responses = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addInitScript(() => localStorage.setItem('agrisage_token','browser-contract-test'))
  const state = { codes: initialCodes ?? catalog.filter(p=>p.defaultRoles.includes(role)).map(p=>p.code), writes: [], requests: [], conflict: false, error: false }
  const member = { userId: staffId, fullName: 'Sale kiểm thử', role: 'SALES_STAFF', storeId: 'store-test', version: 7, roleVersion: 3, defaultPermissions: ['ORDERS.READ'], effectivePermissions: ['ORDERS.READ'], overrides: [], grantablePermissions: ['PRODUCTS.CREATE','ORDERS.READ'] }
  const errors = []
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const json = (data,status=200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    const request = route.request()
    state.requests.push({ path: url.pathname, method: request.method(), body: request.postData() })
    if (url.pathname === '/api/auth/me') return json({ id: role === 'STORE_OWNER' ? ownerId : staffId, fullName: 'Người kiểm thử', role, status: 'ACTIVE' })
    if (url.pathname === '/api/me/permissions') return state.error ? json({ title: 'Unavailable' },503) : json({ role, storeId: 'store-test', roleVersion: 3, memberVersion: 0, permissions: state.codes })
    if (url.pathname === '/api/permissions') return json(catalog)
    if (url.pathname === '/api/roles') return json(roleRows)
    if (/^\/api\/roles\/[^/]+\/permissions$/.test(url.pathname) && request.method() === 'PUT') {
      const body = request.postDataJSON(); state.writes.push(body)
      const row = roleRows.find(r => url.pathname.includes(r.id))
      return json({ ...row, version: row.version+1, permissionCodes: body.permissionCodes })
    }
    if (url.pathname === '/api/staff') return json({ items: [
      { id: staffId, fullName: 'Sale kiểm thử', role: 'SALES_STAFF', status: 'ACTIVE', memberStatus: 'ACTIVE', email: 'sale@example.test' },
      { id: ownerId, fullName: 'Owner kiểm thử', role: 'STORE_OWNER', status: 'ACTIVE', memberStatus: 'ACTIVE', email: 'owner@example.test' },
    ], page: 1, pageSize: 15, totalCount: 2, totalPages: 1 })
    if (url.pathname === `/api/staff/${staffId}/permissions`) {
      if (request.method() === 'GET') return json(member)
      const body = request.postDataJSON(); state.writes.push(body)
      if (state.conflict) return json({ title: 'Conflict', detail: 'Quyền đã thay đổi. Tải lại cấu hình.' },409)
      for (const item of body.overrides) { member.effectivePermissions = member.effectivePermissions.filter(c=>c!==item.code); if(item.granted)member.effectivePermissions.push(item.code) }
      member.version++; member.overrides = body.overrides
      return json(member)
    }
    if (url.pathname.endsWith('/unread-count')) return json({ count: 0 })
    if (Object.hasOwn(responses,url.pathname)) return json(typeof responses[url.pathname] === 'function' ? responses[url.pathname](request) : responses[url.pathname])
    return json({ items: [], page: 1, pageSize: 15, totalCount: 0, totalPages: 0 })
  })
  const page = await context.newPage()
  page.on('pageerror',err=>errors.push(err.message))
  await page.goto(base+path)
  return { page, context, state, errors }
}
try {
  const admin = await fixture('ADMIN','/admin/roles')
  await checked(admin.page,'PRODUCTS.CREATE').waitFor()
  assert.equal(await checked(admin.page,'PRODUCTS.CREATE').isDisabled(),true)
  pass('Admin permissions are protected in role editor')
  await admin.page.getByRole('combobox',{ name: 'Vai trò' }).selectOption('role-2')
  await checked(admin.page,'PRODUCTS.CREATE').check()
  const saveRole = admin.page.getByRole('button',{ name: 'Lưu thay đổi', exact: true })
  assert.equal(await saveRole.isDisabled(),true)
  await admin.page.getByRole('textbox',{ name: 'Lý do thay đổi' }).fill('Cấp quyền tạo sản phẩm cho Sale')
  const roleResponse = admin.page.waitForResponse(r=>r.request().method()==='PUT' && r.url().includes('/api/roles/'))
  await saveRole.click()
  await roleResponse
  assert.equal(admin.state.writes[0].version,3)
  assert(admin.state.writes[0].permissionCodes.includes('PRODUCTS.CREATE'))
  pass('Role save uses live API, reason and expected version')
  assert.deepEqual(admin.errors,[])
  await admin.context.close()

  const owner = await fixture('STORE_OWNER','/agent/staff')
  await owner.page.getByRole('button',{ name: 'Phân quyền', exact:true }).waitFor()
  assert.equal(await owner.page.getByRole('button',{ name:'Phân quyền',exact:true }).count(),1)
  await owner.page.getByRole('button',{ name:'Phân quyền',exact:true }).click()
  await checked(owner.page,'PRODUCTS.CREATE').waitFor()
  assert.equal(await checked(owner.page,'ORDERS.CANCEL').isDisabled(),true)
  await checked(owner.page,'PRODUCTS.CREATE').check()
  await owner.page.getByRole('textbox',{ name:'Lý do thay đổi' }).fill('Phụ trách sản phẩm')
  const memberResponse = owner.page.waitForResponse(r=>r.request().method()==='PUT' && r.url().includes('/permissions'))
  await owner.page.getByRole('button',{ name: 'Lưu quyền (1)', exact:true }).click()
  await memberResponse
  await checked(owner.page,'PRODUCTS.CREATE').waitFor({ state:'visible' })
  assert.deepEqual(owner.state.writes[0].overrides,[{ code:'PRODUCTS.CREATE',granted:true }])
  assert.equal(owner.state.writes[0].version,7)
  assert.equal(owner.state.writes[0].roleVersion,3)
  pass('Owner can configure only Sale; disabled authority and changed-checkbox patch are respected')
  await owner.page.getByRole('button',{ name:'Lưu quyền (0)',exact:true }).waitFor()
  owner.state.conflict=true
  await checked(owner.page,'ORDERS.READ').uncheck()
  await owner.page.getByRole('textbox',{ name:'Lý do thay đổi' }).fill('Kiểm thử cấu hình cũ')
  await owner.page.getByRole('button',{ name:'Lưu quyền (1)',exact:true }).click()
  await owner.page.getByRole('alert').filter({ hasText:'Tải lại cấu hình' }).waitFor()
  assert.equal(await owner.page.getByRole('button',{ name:'Lưu quyền (1)',exact:true }).isDisabled(),true)
  pass('Conflict freezes stale draft until explicit reload')
  assert.deepEqual(owner.errors,[])
  await owner.context.close()

  const sale = await fixture('SALES_STAFF','/agent/products',['PRODUCTS.READ','STORE_PRODUCTS.READ'])
  await sale.page.getByRole('table').waitFor()
  assert.equal(await sale.page.getByRole('button',{name:/Thêm sản phẩm/}).count(),0)
  assert.equal(await sale.page.getByRole('link',{name:/Đơn hàng$/}).count(),0)
  sale.state.codes.push('PRODUCTS.CREATE')
  await sale.page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await sale.page.getByRole('button',{name:/Thêm sản phẩm/}).waitFor()
  sale.state.codes=sale.state.codes.filter(c=>c!=='PRODUCTS.CREATE')
  await sale.page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await sale.page.getByRole('button',{name:/Thêm sản phẩm/}).waitFor({state:'hidden'})
  pass('Menu and action update on live grant/revoke without re-login')
  sale.state.codes=[]
  await sale.page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await sale.page.getByRole('alert').filter({hasText:'Không có quyền truy cập'}).waitFor()
  pass('Protected route denies direct access after revocation')
  sale.state.error=true
  await sale.page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await sale.page.getByRole('alert').filter({hasText:'Không thể tải quyền truy cập'}).waitFor()
  pass('Permission API failure fails closed')
  assert.deepEqual(sale.errors,[])
  await sale.context.close()

  const tierRow = { id:'tier-test', code:'LOYAL', name:'Hạng kiểm thử', defaultCreditLimit:1000, defaultPaymentTermDays:30, isActive:true, profileCount:0, groups:[] }
  const tiers = await fixture('SALES_STAFF','/agent/credit-config',['CREDIT_TIERS.READ','CREDIT_TIERS.CREATE'], {
    '/api/credit-tiers': { items:[tierRow], page:1, pageSize:100, totalCount:1, totalPages:1 },
  })
  await tiers.page.getByRole('cell',{name:'Hạng kiểm thử LOYAL',exact:true}).waitFor()
  assert.equal(await tiers.page.getByRole('link',{name:/Nhóm khách & tín dụng$/}).count(),1)
  assert.equal(await tiers.page.getByRole('tab',{name:'Nhóm khách hàng',exact:true}).count(),0)
  assert.equal(await tiers.page.getByRole('tab',{name:'Hạng tín dụng',exact:true}).getAttribute('aria-selected'),'true')
  assert.equal(await tiers.page.getByRole('button',{name:'Thêm nhóm',exact:true}).count(),0)
  assert.equal(tiers.state.requests.some(r=>r.path==='/api/customer-groups'),false)
  await tiers.page.getByRole('button',{name:'Thêm hạng',exact:true}).click()
  await tiers.page.getByRole('dialog',{name:'Thêm hạng tín dụng',exact:true}).waitFor()
  pass('Tier-only Sale grant exposes menu and permitted tab without group access or group API calls')
  tiers.state.codes=['CREDIT_TIERS.READ']
  await tiers.page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await tiers.page.getByRole('dialog',{name:'Thêm hạng tín dụng',exact:true}).waitFor({state:'hidden'})
  assert.equal(await tiers.page.getByRole('button',{name:'Thêm hạng',exact:true}).count(),0)
  await tiers.page.getByRole('table').waitFor()
  pass('Revoking tier creation closes the open prompt while retaining the permitted read page')
  assert.deepEqual(tiers.errors,[])
  await tiers.context.close()

  const customerRow = { id:staffId, userId:staffId, customerCode:null, fullName:'Khách kiểm thử', phoneNumber:null, email:'customer@example.test', customerType:'REGISTERED', customerGroup:null, status:'ACTIVE', notes:null, totalOrders:0, totalPurchaseAmount:0, currentDebt:0, creditLimit:0, allowCreditPurchase:false, reservedCredit:0, availableCredit:0, paymentTermDays:null, createdAt:'2026-10-09T00:00:00Z', updatedAt:'2026-10-09T00:00:00Z', address:null, debtSummary:null }
  const manual = await fixture('SALES_STAFF',`/agent/debts/${staffId}`,['DEBT.READ','CUSTOMERS.READ','DEBT.MANUAL'], {
    [`/api/customers/${staffId}`]:customerRow,
    [`/api/customers/${staffId}/debt`]:{id:'debt-account-test',farmerProfileId:staffId,status:'ACTIVE',currentBalance:0,overdueAmount:0,openEntryCount:0,oldestDueDate:null,lastTransactionAt:null,version:0},
  })
  await manual.page.getByRole('heading',{name:'Khách kiểm thử',exact:true}).waitFor()
  assert.equal(await manual.page.getByRole('button',{name:'Thu tiền mặt',exact:true}).count(),0)
  assert.equal(await manual.page.getByRole('button',{name:'Ghi nhận chuyển khoản',exact:true}).count(),0)
  await manual.page.getByRole('button',{name:'Ghi nợ thủ công',exact:true}).click()
  await manual.page.getByRole('dialog',{name:'Ghi nợ thủ công — Khách kiểm thử',exact:true}).waitFor()
  manual.state.codes=manual.state.codes.filter(c=>c!=='DEBT.MANUAL')
  await manual.page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await manual.page.getByRole('dialog',{name:'Ghi nợ thủ công — Khách kiểm thử',exact:true}).waitFor({state:'hidden'})
  assert.equal(await manual.page.getByRole('button',{name:'Ghi nợ thủ công',exact:true}).count(),0)
  pass('Manual-debt grant works independently of other manager permissions and revocation closes the prompt')
  assert.deepEqual(manual.errors,[])
  await manual.context.close()

  const creditForm = await fixture('SALES_STAFF','/agent/farmers',['CUSTOMERS.READ','CUSTOMERS.CREATE','CREDIT.CREATE','CREDIT_TIERS.READ'], {
    '/api/credit-tiers':{items:[tierRow],page:1,pageSize:100,totalCount:1,totalPages:1},
    '/api/customers':request=>request.method()==='POST' ? customerRow : {items:[],page:1,pageSize:15,totalCount:0,totalPages:0},
    [`/api/customers/${staffId}`]:customerRow,
  })
  await creditForm.page.getByRole('button',{name:'Thêm khách hàng',exact:true}).click()
  await creditForm.page.getByLabel(/^Họ tên/).fill('Khách kiểm thử')
  await creditForm.page.getByLabel('Email',{exact:true}).fill('customer@example.test')
  await creditForm.page.getByLabel(/^Mật khẩu đăng nhập/).fill('test-only-password')
  await creditForm.page.getByRole('checkbox',{name:'Cho phép mua chịu (mở tín dụng ngay)',exact:true}).check()
  await creditForm.page.getByRole('spinbutton',{name:/Hạn mức/}).fill('9999')
  creditForm.state.codes=creditForm.state.codes.filter(c=>c!=='CREDIT.CREATE')
  await creditForm.page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await creditForm.page.getByRole('checkbox',{name:'Cho phép mua chịu (mở tín dụng ngay)',exact:true}).waitFor({state:'hidden'})
  const customerResponse = creditForm.page.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/api/customers')
  await creditForm.page.getByRole('button',{name:'Tạo khách hàng',exact:true}).click()
  await customerResponse
  const customerWrite = JSON.parse(creditForm.state.requests.find(r=>r.path==='/api/customers' && r.method==='POST').body)
  for (const field of ['allowCreditPurchase','creditTierId','creditLimit','creditChangeReason']) assert.equal(Object.hasOwn(customerWrite,field),false)
  pass('Credit creation revoked with a checked form strips stale credit fields from the customer payload')
  assert.deepEqual(creditForm.errors,[])
  await creditForm.context.close()
  console.log(`${checks} permission browser checks passed`)
} finally { await browser.close() }
