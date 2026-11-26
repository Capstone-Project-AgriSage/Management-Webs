import assert from 'node:assert/strict'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
// API-intercepted workflows; no requests reach the operational backend.
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'msedge' })
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const out = fileURLToPath(new URL('../../outputs/exchange-ui/', import.meta.url)); await mkdir(out, { recursive: true })
const now = '2026-11-25T06:00:00Z'
const permissions = ['EXCHANGES.READ','EXCHANGES.CREATE','EXCHANGES.APPROVE','EXCHANGES.REJECT','EXCHANGES.CANCEL','EXCHANGES.RECEIVE','EXCHANGES.INSPECT','EXCHANGES.COMPLETE_INSPECTION','EXCHANGES.COMPLETE','ORDERS.READ','INVENTORY.READ','MY_ORDERS.READ','MY_EXCHANGES.READ','MY_EXCHANGES.CREATE','MY_EXCHANGES.CANCEL']
const paged = items => ({ items, page:1, pageSize:20, totalPages:1, totalCount:items.length })
const product = { id:'new-product', name:'Phân bón thay thế', sku:'NEW', fromPrice:120000, categoryId:'cat', imageUrl:null }
const pack = { id:'new-pack', packagingName:'Bao', unitName:'Bao', conversionToBase:1, price:120000 }
const order = { id:'old-order', orderNumber:'OD-OLD', source:'ONLINE', customerType:'REGISTERED', customerName:'Khách kiểm thử', customerPhone:'0900000000', settlementType:'FULL_PAYMENT', fulfillmentType:'PICKUP', status:'COMPLETED', totalAmount:400000, subtotalAmount:400000, createdAt:now, completedAt:now, note:null, items:[{ id:'old-item', productName:'Phân bón gốc', sku:'OLD', packagingName:'Bao', quantity:4, baseQuantity:4, conversionToBase:1, unitPrice:100000, lineTotalAmount:400000, fulfilledBaseQuantity:4, cancelledBaseQuantity:0, status:'FULFILLED' }] }
const source = { orderNumber:order.orderNumber, items:[{ orderItemId:'old-item', productName:'Phân bón gốc', fulfilledBaseQuantity:4, alreadyReturnedBaseQuantity:1, returnableBaseQuantity:3, unitPrice:100000, conversionToBase:1, sources:[{ inventoryLotId:'old-lot', lotNumber:'OLD-LOT', returnableBaseQuantity:3, originalStockMovementItemId:'sale-line', deliveryItemLotAllocationId:null }] }] }
const initial = () => ({ id:'exchange-1', orderId:order.id, orderNumber:order.orderNumber, status:'REQUESTED', reason:'Đổi loại phân bón', replacementAmount:120000, difference:null, replacementOrderId:null, createdAt:now, history:[{ action:'EXCHANGE_REQUESTED', occurredAt:now }], originalItems:[{ orderItemId:'old-item', productName:'Phân bón gốc', packagingName:'Bao' }], return:{ id:'return-1', returnNumber:'RT-TEST', customerName:order.customerName, totalReturnAmount:100000, totalDebtAdjustment:0, totalRefundAmount:100000, refunds:[], items:[{ id:'return-line', orderItemId:'old-item', returnedBaseQuantity:1, returnValue:100000, conditionStatus:'PENDING_INSPECTION', inventoryDisposition:'NONE' }] }, replacements:[{ id:'replacement-1', storeProductId:product.id, productPackagingId:pack.id, productName:product.name, packagingName:'Bao', quantity:1, baseQuantity:1, unitPrice:120000, lineTotal:120000 }] })
async function session(farmer=false, codes=permissions, role='STORE_OWNER') {
 const context = await browser.newContext({ viewport:{ width:1440, height:1000 } })
 await context.addInitScript(() => { localStorage.setItem('agrisage_token','test.exchange.token'); localStorage.setItem('agrisage.farmer_token','test.exchange.token') })
 const page = await context.newPage(), errors=[], state={ exchange:null, posted:[], failOnce:false }
 page.on('pageerror',e => errors.push(e.message))
 await context.route('**/api/**',async route => {
  const req=route.request(), path=new URL(req.url()).pathname, method=req.method(), body=req.postData() ? JSON.parse(req.postData()) : null
  if (!path.startsWith('/api/')) return route.continue()
  const json=(data,status=200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(data) })
  if(path.includes('/realtime')) return route.abort()
  if(path==='/api/auth/me') return json({ id:'actor',fullName:'Khách kiểm thử',role:farmer?'FARMER':role,status:'ACTIVE' })
  if(path==='/api/me/permissions') return json({ role:farmer?'FARMER':role,permissions:codes })
  if(path.endsWith('/unread-count')) return json({ count:0 })
  if(path==='/api/catalog/products') return json(paged([product]))
  if(path==='/api/catalog/products/new-product') return json({ ...product,packagings:[pack],ingredients:[] })
  if(path.endsWith('/exchangeable')) return json(source)
  if(path==='/api/orders') return json(paged([order]))
  if(path==='/api/me/orders/old-order') return json(order)
  if(path==='/api/inventory/lots') return json(paged([{ id:'new-lot',storeProductId:product.id,lotNumber:'NEW-LOT',status:'ACTIVE',isExpired:false,expiryDate:'2027-12-01',quantityAvailable:10 }]))
  if(/\/exchanges$/.test(path)) {
   if(method==='GET') {
    const difference=state.exchange?.status==='COMPLETED' ? state.exchange.difference ?? 0 : 0
    return json({...paged(state.exchange ? [{ ...state.exchange,returnNumber:'RT-TEST',customerName:order.customerName }] : []),summary:{receivedAmount:Math.max(0,difference),refundedAmount:Math.max(0,-difference),netReceivedAmount:difference}})
   }
   state.posted.push(body)
   if (state.holdCreate) await new Promise(resolve => { state.releaseCreate = resolve })
   if(state.failOnce) { state.failOnce=false; return json({ title:'Conflict',detail:'Tạm thời chưa gửi được, hãy thử lại.' },409) }
   state.exchange=initial(); return json(state.exchange,201)
  }
  if(path.includes('/exchanges/exchange-1')) {
   if(method==='GET') return json(state.exchange)
   const action=path.split('/').at(-1), e=state.exchange
   if(action==='inspection') { e.return.items[0].conditionStatus=body.conditionStatus; e.return.items[0].inspectionNote=body.inspectionNote }
   if(action==='approve') e.status='APPROVED'
   if(action==='receive') e.status='RECEIVED'
   if(action==='complete-inspection') { e.status='READY_TO_COMPLETE'; e.difference=20000 }
   if(action==='complete') { assert.equal(body.confirmedDifference,20000); assert.equal(body.lots[0].inventoryLotId,'new-lot'); e.status='COMPLETED'; e.replacementOrderId='new-order'; e.replacementOrderNumber='OD-NEW'; e.settlementReference=body.settlementReference }
   if(action==='cancel') e.status='CANCELLED'
   e.history.push({ action:'EXCHANGE_'+action.toUpperCase().replaceAll('-','_'),occurredAt:now,reason:body?.reason })
   return json(e)
  }
  return json(paged([]))
 })
 return { context,page,state,errors }
}
async function fill(page) {
 await page.getByRole('spinbutton',{ name:/Số lượng đổi/ }).fill('1')
 await page.getByRole('textbox',{ name:'Tên sản phẩm thay thế' }).fill('Phân bón')
 await page.getByRole('button',{ name:'Tìm kiếm',exact:true }).click()
 await page.getByRole('combobox',{ name:'Sản phẩm thay thế',exact:true }).selectOption('new-product')
 await page.getByRole('button',{ name:'Thêm',exact:true }).click()
 await page.getByLabel('Lý do đổi hàng',{ exact:true }).fill('Đổi loại phân bón')
}
let farmerServer
try {
 const create=await session()
 await create.page.goto(`${base}/agent/exchanges`)
 const listSearch=create.page.getByPlaceholder('Tìm mã đơn, mã phiếu trả hoặc tên khách hàng...')
 await listSearch.fill('OD-OLD')
 await create.page.getByRole('combobox',{ name:'Trạng thái đổi hàng',exact:true }).selectOption('REQUESTED')
 await create.page.getByRole('link',{ name:'Tạo yêu cầu đổi',exact:true }).click()
 const createDialog=create.page.getByRole('dialog',{ name:'Tạo yêu cầu đổi hàng',exact:true })
 await createDialog.waitFor()
 assert.equal(await create.page.locator('table').count(),1,'List stays mounted behind the create popup')
 await createDialog.getByRole('combobox',{ name:'Đơn hàng gốc',exact:true }).selectOption('old-order')
 await createDialog.getByRole('heading',{ name:'Hàng thu hồi từ OD-OLD' }).waitFor()
 await createDialog.locator('.modal-body').evaluate(element=>element.scrollTop=element.scrollHeight)
 const footerBox=await createDialog.locator('.modal-footer').boundingBox()
 assert.ok(footerBox && footerBox.y+footerBox.height <= 1000,'Create action footer stays inside the viewport')
 await create.page.screenshot({path:`${out}/management-create-popup.png`,fullPage:true})
 await create.page.keyboard.press('Escape')
 await create.page.waitForURL('**/agent/exchanges')
 assert.equal(await listSearch.inputValue(),'OD-OLD','Closing create preserves list search')
 assert.equal(await create.page.getByRole('combobox',{ name:'Trạng thái đổi hàng',exact:true }).inputValue(),'REQUESTED','Closing create preserves status')
 assert.equal(create.state.posted.length,0,'Closing create posts nothing')
 await create.page.setViewportSize({width:390,height:844})
 await create.page.getByRole('link',{name:'Tạo yêu cầu đổi',exact:true}).click()
 await createDialog.waitFor()
 await createDialog.getByRole('combobox',{name:'Đơn hàng gốc',exact:true}).selectOption('old-order')
 await createDialog.getByRole('heading',{ name:'Hàng thu hồi từ OD-OLD' }).waitFor()
 await fill(create.page)
 assert.ok(await createDialog.locator('.modal-body').evaluate(element=>element.scrollWidth<=element.clientWidth),'Create form fits mobile width with selected products')
 assert.ok(await createDialog.evaluate(element=>element.scrollWidth<=element.clientWidth),'Create dialog fits mobile width')
 await create.page.screenshot({path:`${out}/management-create-popup-mobile.png`,fullPage:true})
 await create.page.keyboard.press('Escape')
 assert.deepEqual(create.errors,[])
 await create.context.close()
 const o=await session(); await o.page.goto(`${base}/agent/exchanges/new?orderId=old-order`); await fill(o.page)
 o.state.failOnce=true; await o.page.getByRole('button',{ name:'Gửi yêu cầu đổi hàng',exact:true }).click()
 await o.page.getByRole('alert').filter({ hasText:'Tạm thời' }).waitFor()
 o.state.holdCreate=true
 await o.page.getByRole('button',{ name:'Gửi yêu cầu đổi hàng',exact:true }).click()
 await o.page.waitForFunction(()=>document.querySelector('.modal-footer button[type=submit]')?.disabled)
 const sending=o.page.getByRole('dialog',{name:'Tạo yêu cầu đổi hàng',exact:true})
 assert.equal(await sending.getByRole('button',{name:'Đóng',exact:true}).isDisabled(),true)
 assert.equal(await sending.getByRole('button',{name:'Hủy',exact:true}).isDisabled(),true)
 await o.page.keyboard.press('Escape')
 assert.ok(o.page.url().includes('/exchanges/new'),'Sending cannot be dismissed by Escape')
 o.state.releaseCreate()
 await o.page.getByRole('button',{ name:'Duyệt yêu cầu',exact:true }).waitFor()
 assert.equal(o.state.posted.length,2); assert.equal(o.state.posted[0].requestKey,o.state.posted[1].requestKey)
 assert.equal(o.state.posted[0].items[0].originalStockMovementItemId,'sale-line')
 for(const name of ['Duyệt yêu cầu','Xác nhận đã thu hồi']) { await o.page.getByRole('button',{ name,exact:true }).click(); await o.page.getByRole('button',{ name:'Xác nhận',exact:true }).click() }
 await o.page.getByLabel('Tình trạng hàng thu hồi dòng 1').selectOption('RESELLABLE')
 await o.page.getByLabel('Ghi chú kiểm tra dòng 1').fill('Bao nguyên vẹn')
 await o.page.getByRole('button',{ name:'Lưu kiểm tra',exact:true }).click()
 await o.page.getByRole('button',{ name:'Chốt kiểm tra và nhập kho',exact:true }).click()
 await o.page.getByRole('button',{ name:'Xác nhận',exact:true }).click()
 await o.page.getByRole('spinbutton').fill('1')
 await o.page.getByRole('button',{ name:'Quyết toán và giao hàng mới',exact:true }).click()
 await o.page.getByLabel('Mã biên nhận / tham chiếu quyết toán').fill('CASH-TEST-20K')
 await o.page.getByRole('button',{ name:'Xác nhận',exact:true }).click()
 await o.page.getByRole('heading',{ name:'Chứng từ hoàn tất' }).waitFor()
 await o.page.screenshot({ path:`${out}/management-completed.png`,fullPage:true })
 assert.equal(o.state.exchange.status,'COMPLETED'); assert.deepEqual(o.errors,[])
 await o.page.locator('.modal-footer').getByRole('button',{ name:'Đóng',exact:true }).click()
 await o.page.getByRole('table').getByText('Hoàn thành',{exact:true}).waitFor()
 const totals=o.page.getByRole('region',{name:'Tổng hợp đổi hàng',exact:true})
 await totals.getByRole('heading',{name:'Tiền đã thu',exact:true}).waitFor()
 assert.ok((await totals.innerText()).includes('20.000'),'Received and net totals include the completed exchange difference')
 assert.equal(await totals.locator('.agrisage-kpi-card').count(),4)
 await o.page.screenshot({path:`${out}/management-exchange-summary.png`,fullPage:true})
 await o.page.getByRole('button',{ name:'Thao tác đổi hàng RT-TEST' }).click()
 await o.page.getByRole('menuitem',{ name:'Xem chi tiết' }).waitFor(); await o.context.close()
 const sales=await session(false,['EXCHANGES.READ']); sales.state.exchange=initial()
 await sales.page.goto(`${base}/agent/exchanges/exchange-1`)
 await sales.page.getByText('Đổi loại phân bón',{ exact:true }).waitFor()
 assert.equal(await sales.page.getByRole('button',{ name:'Duyệt yêu cầu',exact:true }).count(),0); await sales.context.close()
 const seller=await session(false,['EXCHANGES.READ','EXCHANGES.CREATE'],'SALES_STAFF')
 await seller.page.goto(`${base}/sales/exchanges/new?orderId=old-order`)
 await seller.page.getByRole('dialog',{name:'Tạo yêu cầu đổi hàng',exact:true}).getByRole('heading',{name:'Hàng thu hồi từ OD-OLD'}).waitFor()
 await seller.page.getByRole('dialog').getByRole('button',{name:'Hủy',exact:true}).click()
 await seller.page.waitForURL('**/sales/exchanges')
 assert.deepEqual(seller.errors,[]); await seller.context.close()
 const dir=fileURLToPath(new URL('../../Farmer-Web/',import.meta.url)), farmerBase='http://127.0.0.1:5287'
 farmerServer=spawn(process.execPath,[`${dir}/node_modules/vite/bin/vite.js`,'--host','127.0.0.1','--port','5287','--strictPort'],{ cwd:dir,windowsHide:true,stdio:'pipe' })
 await new Promise((resolve,reject) => { const timeout=setTimeout(() => reject(new Error('Farmer Vite timeout')),15000); farmerServer.stdout.on('data',d => { if(d.toString().includes('Local:')) { clearTimeout(timeout); resolve() } }); farmerServer.on('exit',c => reject(new Error(`Farmer Vite exit ${c}`))) })
 const f=await session(true); await f.page.goto(`${farmerBase}/orders/old-order`)
 await f.page.getByRole('button',{ name:'Yêu cầu đổi hàng',exact:true }).click(); await fill(f.page)
 await f.page.getByRole('button',{ name:'Gửi yêu cầu đổi hàng',exact:true }).click()
 await f.page.getByRole('heading',{ name:/RT-TEST/ }).waitFor()
 await f.page.screenshot({ path:`${out}/farmer-requested.png`,fullPage:true })
 await f.page.getByLabel('Lý do hủy',{ exact:true }).fill('Chọn lại sản phẩm'); f.page.once('dialog',d => d.accept())
 await f.page.getByRole('button',{ name:'Hủy yêu cầu đổi',exact:true }).click()
 await f.page.getByRole('heading',{ name:/Đã hủy/ }).waitFor()
 assert.equal(f.state.exchange.status,'CANCELLED'); assert.deepEqual(f.errors,[]); await f.context.close()
 console.log('Passed Exchange UI: create/detail popups, preserved list filters, mobile fit, busy close lock, owner lifecycle/retry, sales navigation, permission gate, Farmer create/cancel, zero page errors.')
} catch (error) {
 for (const context of browser.contexts()) for (const page of context.pages()) { console.log('FAILED PAGE', page.url(), (await page.locator('body').innerText()).slice(0, 6000)); await page.screenshot({ path:`${out}/failure.png`,fullPage:true }) }
 throw error
} finally { await browser.close(); farmerServer?.kill() }
