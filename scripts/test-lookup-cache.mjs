import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

// Exercise the actual TypeScript modules with fake HTTP; no live store data is accessed.
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
}).outputText).toString('base64')}`
const cacheUrl = moduleUrl(fs.readFileSync(new URL('../src/api/lookupCache.ts', import.meta.url), 'utf8'))
const { LookupCache, lookupCache, lookupKey, installLookupCacheInvalidation } = await import(cacheUrl)
const clientSource = fs.readFileSync(new URL('../src/api/client.ts', import.meta.url), 'utf8')
  .replace("'./lookupCache'", JSON.stringify(cacheUrl)).replaceAll('import.meta.env', '({})')
const clientUrl = moduleUrl(clientSource)
const { api } = await import(clientUrl)
const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
globalThis.window = Object.assign(new EventTarget(), { location: { assign() {} } })
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
const dispose = installLookupCacheInvalidation()
let calls = 0
let status = 200
let fail = false
globalThis.fetch = async () => {
  calls++
  if (fail) throw new TypeError('Offline')
  return new Response(JSON.stringify({ items: [{ name: `read-${calls}` }] }), { status, headers: { 'content-type': 'application/json' } })
}

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const originalNow = Date.now
let now = 1000
Date.now = () => now
try {
  const cache = new LookupCache(() => 'session', 2)
  let reads = 0
  const load = async () => ({ items: [{ name: `v${++reads}` }] })
  const [one, two] = await Promise.all([cache.get('a', load, 100), cache.get('a', load, 100)])
  assert.equal(reads, 1)
  one.items[0].name = 'mutated'
  assert.equal(two.items[0].name, 'v1')
  assert.equal((await cache.get('a', load, 100)).items[0].name, 'v1')
  now += 101
  await cache.get('a', load, 100)
  assert.equal(reads, 2)
  await cache.get('b', load)
  await cache.get('c', load)
  await cache.get('a', load)
  assert.equal(reads, 5, 'bounded cache evicts the oldest key')
  console.log('PASS Deduplication, independent DTO copies, TTL and bounded entries')

  const pending = deferred()
  const abort = new AbortController()
  const cancelled = cache.get('shared', () => pending.promise, 100, abort.signal)
  const survivor = cache.get('shared', () => { throw new Error('duplicate load') })
  const rejected = assert.rejects(cancelled, { name: 'AbortError' })
  abort.abort()
  pending.resolve({ ok: true })
  await rejected
  assert.deepEqual(await survivor, { ok: true })
  const invalidated = deferred()
  let staleLoads = 0
  const old = cache.get('old', () => ++staleLoads === 1 ? invalidated.promise : Promise.resolve('fresh'))
  cache.clear()
  invalidated.resolve('stale')
  assert.equal(await old, 'fresh')
  assert.equal(staleLoads, 2)
  assert.equal(await cache.get('old', async () => 'fresh'), 'fresh')
  console.log('PASS One consumer abort does not cancel others; invalidation refreshes in-flight reads without stale results')

  let identity = 'a'
  const scoped = new LookupCache(() => identity)
  await scoped.get('a', async () => 'user-a')
  identity = 'b'
  assert.equal(await scoped.get('a', async () => 'user-b'), 'user-b')
  const changing = deferred()
  const previousUser = scoped.get('pending', () => changing.promise)
  const previousRejected = assert.rejects(previousUser, { name: 'AbortError' })
  identity = 'c'
  changing.resolve('private-old')
  await previousRejected
  await assert.rejects(scoped.get('error', async () => { throw new Error('retry') }), /retry/)
  assert.equal(await scoped.get('error', async () => 'recovered'), 'recovered')
  console.log('PASS Session separation and failed-read recovery')

  assert.equal(lookupKey('/api/categories?page=1&isActive=true'), lookupKey('/api/categories?isActive=true&page=1'))
  for (const path of ['/api/orders', '/api/catalog/products', '/api/products/id', '/api/me/cart', '/api/inventory', '/api/me/permissions', '/api/reports/revenue']) assert.equal(lookupKey(path), null)
  const path = '/api/catalog/categories'
  await Promise.all([api(path), api(path)])
  assert.equal(calls, 1)
  await api(path)
  assert.equal(calls, 1)
  await api('/api/catalog/brands?page=1')
  await api('/api/catalog/brands?page=2')
  assert.equal(calls, 3, 'filters have separate entries')
  now += 120_001
  await api(path)
  assert.equal(calls, 4)
  console.log('PASS API allowlist, filter keys and two-minute TTL')

  const beforeWrite = calls
  await api('/api/categories/id', { method: 'PUT', body: '{}' })
  await api(path)
  assert.equal(calls, beforeWrite + 2, 'write invalidates cached lookups')
  status = 409
  await assert.rejects(api('/api/categories/id', { method: 'PUT', body: '{}' }))
  status = 200
  const afterFailedWrite = calls
  await api(path)
  assert.equal(calls, afterFailedWrite, 'failed writes retain valid cache')
  for (const event of ['focus', 'online', 'storage', 'agrisage-permissions-changed', 'permissions:changed']) {
    const before = calls
    window.dispatchEvent(new Event(event))
    await api(path)
    assert.equal(calls, before + 1, `${event} invalidates lookups`)
  }
  const beforeRealtime = calls
  const realtime = new Event('agrisage-realtime-change')
  realtime.detail = { topic: 'resync' }
  window.dispatchEvent(realtime)
  await api(path)
  assert.equal(calls, beforeRealtime + 1)
  document.dispatchEvent(new Event('visibilitychange'))
  const beforeVisibility = calls
  await api(path)
  assert.equal(calls, beforeVisibility + 1)
  console.log('PASS Successful-write, permission, reconnect and browser lifecycle invalidation')

  const beforeSession = calls
  storage.set('agrisage_token', 'next-session')
  await api(path)
  assert.equal(calls, beforeSession + 1)
  for (const code of [401, 403]) {
    status = code
    await assert.rejects(api('/api/private-check'))
    status = 200
    const before = calls
    await api(path)
    assert.equal(calls, before + 1)
  }
  lookupCache.clear()
  fail = true
  await assert.rejects(api(path), /Offline/)
  fail = false
  const beforeRetry = calls
  await api(path)
  assert.equal(calls, beforeRetry + 1)
  for (const fresh of ['/api/catalog/products', '/api/me/permissions', '/api/me/advisory/recommendations']) {
    const before = calls
    const init = fresh.endsWith('recommendations') ? { method: 'POST', body: '{}' } : {}
    await api(fresh, init)
    await api(fresh, init)
    assert.equal(calls, before + 2, 'live business reads and advice POSTs must not be cached')
  }
  console.log('PASS Identity, 401/403, network-error recovery and uncached business calls')

  const apiModule = (file, dependencies = {}) => moduleUrl(fs.readFileSync(new URL(`../src/api/${file}.ts`, import.meta.url), 'utf8')
    .replace("'./client'", JSON.stringify(clientUrl)).replace("'./lookupCache'", JSON.stringify(cacheUrl))
    .replace("'./stockApi'", JSON.stringify(dependencies.stockApi ?? './stockApi')))
  const stockUrl = apiModule('stockApi')
  const { productLookupApi } = await import(apiModule('productLookupApi', { stockApi: stockUrl }))
  const { catalogApi } = await import(apiModule('catalogApi'))
  lookupCache.clear()
  const packaging = { id: 'packaging', conversionToBase: 1, isSaleUnit: true }
  globalThis.fetch = async () => {
    calls++
    return new Response(JSON.stringify({ id: 'product', name: 'Product', sku: 'SKU', status: 'ACTIVE',
      requiresLotTracking: true, requiresExpiryDate: true, packagings: [packaging],
      store: { isActive: true, isSellable: true } }), { headers: { 'content-type': 'application/json' } })
  }
  const beforeLookups = calls
  const product = await productLookupApi.getProduct('product')
  await productLookupApi.getProduct('product')
  assert.equal(calls, beforeLookups + 1)
  assert.equal('store' in product, false, 'operational flags are excluded from the receiving lookup cache')
  const packagings = await catalogApi.getProductPackagings('product')
  packagings[0].conversionToBase = 999
  assert.equal((await catalogApi.getProductPackagings('product'))[0].conversionToBase, 1)
  assert.equal(calls, beforeLookups + 2)
  await api('/api/products/product')
  await api('/api/products/product')
  assert.equal(calls, beforeLookups + 4, 'full product management details are always fresh')
  await api('/api/products/product/packagings/packaging', { method: 'PUT', body: '{}' })
  const afterPackagingWrite = calls
  await productLookupApi.getProduct('product')
  await catalogApi.getProductPackagings('product')
  assert.equal(calls, afterPackagingWrite + 2)
  console.log('PASS Receiving and packaging lookup reuse, independent copies and invalidation; full product details stay fresh')
} finally {
  Date.now = originalNow
  dispose()
}
