import Select from '@/components/ui/Select'
import { Plus, Search, Trash2 } from 'lucide-react'
import { exchangeField as input, exchangeSecondary, exchangeSection } from './exchangeStyles'
import { useEffect, useState } from 'react'
import { exchangesApi, type Exchange, type Exchangeable, type ExchangeRequest } from '@/api/exchangesApi'
import { api } from '@/api/client'

type Product = { id: string; name: string }
type Packaging = { id: string; packagingName: string | null; unitName: string | null; conversionToBase: number; price: number | null }
type Replacement = { storeProductId: string; productPackagingId: string; quantity: number; name: string }
export interface ExchangeFormState { busy: boolean; canSubmit: boolean }
export default function ExchangeRequestForm({ orderId, formId, onCreated, onStateChange }: {
 orderId: string
 formId: string
 onCreated: (exchange: Exchange) => void
 onStateChange: (state: ExchangeFormState) => void
}) {
 const [source, setSource] = useState<Exchangeable | null>(null)
 const [quantities, setQuantities] = useState<Record<string, number>>({})
 const [reason, setReason] = useState('')
 const [search, setSearch] = useState('')
 const [products, setProducts] = useState<Product[]>([])
 const [product, setProduct] = useState<Product | null>(null)
 const [packagings, setPackagings] = useState<Packaging[]>([])
 const [packaging, setPackaging] = useState('')
 const [quantity, setQuantity] = useState(1)
 const [replacements, setReplacements] = useState<Replacement[]>([])
 const [error, setError] = useState('')
 const [revision, setRevision] = useState(0)
 const [busy, setBusy] = useState(false)
 const [searchBusy, setSearchBusy] = useState(false)
 useEffect(() => {
  let active = true
  exchangesApi.exchangeable(orderId).then(r => { if (active) setSource(r) }).catch(e => { if (active) setError(e.message) })
  return () => { active = false }
 }, [orderId, revision])
 const canSubmit = Boolean(source && reason.trim() && replacements.length && Object.values(quantities).some(value => value > 0))
 useEffect(() => { onStateChange({ busy, canSubmit }) }, [busy, canSubmit, onStateChange])
 const searchProducts = async () => {
  setSearchBusy(true); setError('')
  try { const r = await api<{ items: Product[] }>(`/api/catalog/products?search=${encodeURIComponent(search)}&pageSize=20`); setProducts(r.items) }
  catch(e) { setError(e instanceof Error ? e.message : 'Không tải được sản phẩm') }
  finally { setSearchBusy(false) }
 }
 const choose = async (id: string) => {
  setProduct(null); setPackagings([]); setPackaging(''); setSearchBusy(true)
  try { const p = await api<Product & { packagings: Packaging[] }>(`/api/catalog/products/${id}`); setProduct(p); setPackagings(p.packagings); setPackaging(p.packagings[0]?.id ?? '') }
  catch(e) { setError(e instanceof Error ? e.message : 'Không tải được quy cách') }
  finally { setSearchBusy(false) }
 }
 const submit = async () => {
  if (!source || busy) return
  const items: ExchangeRequest['items'] = []
  source.items.forEach(i => i.sources.forEach((s, index) => {
   const q = quantities[`${i.orderItemId}:${index}`] ?? 0
   if (q > 0) items.push({ orderItemId: i.orderItemId, returnedBaseQuantity: q, reasonCode: 'OTHER', deliveryItemLotAllocationId: s.deliveryItemLotAllocationId, originalStockMovementItemId: s.originalStockMovementItemId })
  }))
  if (!items.length || !replacements.length || !reason.trim()) { setError('Chọn hàng thu hồi, hàng thay thế và nhập lý do đổi.'); return }
  if (source.items.some(i => i.sources.reduce((sum, _, index) => sum + (quantities[`${i.orderItemId}:${index}`] ?? 0), 0) > i.returnableBaseQuantity)) { setError('Tổng số lượng đổi vượt quá số lượng còn được đổi.'); return }
  setBusy(true); setError('')
  const data = { orderId, reason: reason.trim(), items, replacements: replacements.map(({ storeProductId, productPackagingId, quantity: q }) => ({ storeProductId, productPackagingId, quantity: q })) }
  const json = JSON.stringify(data)
  const storageKey = `exchange-request:${orderId}`
  try {
   let attempt: { json: string; key: string } | null = null
   try { attempt = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') } catch { /* a new attempt */ }
   if (attempt?.json !== json) attempt = { json, key: crypto.randomUUID() }
   sessionStorage.setItem(storageKey, JSON.stringify(attempt))
   const result = await exchangesApi.create({ ...data, requestKey: attempt!.key })
   sessionStorage.removeItem(storageKey); onCreated(result)
  } catch(e) { setError(e instanceof Error ? e.message : 'Không tạo được yêu cầu đổi hàng') }
  finally { setBusy(false) }
 }
 return <form id={formId} className="space-y-5 text-on-surface" onSubmit={event => { event.preventDefault(); void submit() }}>
  {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  {!source ? error ? <button type="button" className={exchangeSecondary} onClick={() => { setError(''); setRevision(revision + 1) }}>Tải lại điều kiện đổi hàng</button> : <p role="status" className="py-6 text-sm text-on-surface-variant">Đang tải điều kiện đổi hàng...</p> : <>
   <section className={exchangeSection}>
    <div><h2 className="font-semibold">Hàng thu hồi từ {source.orderNumber}</h2><p className="mt-1 text-sm text-on-surface-variant">Nhập số lượng theo đơn vị cơ sở. Hàng đã trả hoặc đang xử lý trả/đổi đã được trừ khỏi số còn lại.</p></div>
    {source.items.map(item => <fieldset key={item.orderItemId} disabled={busy} className="space-y-3 rounded-lg border border-outline-variant p-4">
     <legend className="px-2 text-sm font-semibold">{item.productName}</legend>
     <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-surface-variant"><span>Đã mua: <strong className="text-on-surface">{item.fulfilledBaseQuantity}</strong></span><span>Đã trả/đang trả đổi: {item.alreadyReturnedBaseQuantity}</span><span>Còn được đổi: <strong className="text-primary">{item.returnableBaseQuantity}</strong></span></div>
     {!item.sources.some(source => source.returnableBaseQuantity > 0) && <p className="text-sm text-on-surface-variant">Không còn số lượng đủ điều kiện đổi.</p>}
     {item.sources.map((source, index) => source.returnableBaseQuantity > 0 && <label key={`${source.inventoryLotId}:${index}`} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_160px]">
      <span>Lô {source.lotNumber ?? 'không mã'} <span className="text-on-surface-variant">· Tối đa {Math.min(source.returnableBaseQuantity, item.returnableBaseQuantity)}</span></span>
      <input aria-label={`Số lượng đổi ${item.productName}, lô ${source.lotNumber ?? index + 1}`} className={`${input} text-right tabular-nums`} type="number" min="0" max={Math.min(source.returnableBaseQuantity, item.returnableBaseQuantity)} step="1" value={quantities[`${item.orderItemId}:${index}`] ?? 0} onChange={event => setQuantities({ ...quantities, [`${item.orderItemId}:${index}`]: Math.max(0, Math.floor(Number(event.target.value))) })} />
     </label>)}
    </fieldset>)}
   </section>
   <section className={exchangeSection}>
    <h2 className="font-semibold">Sản phẩm thay thế</h2>
    <div className="flex gap-2"><input className={input} aria-label="Tên sản phẩm thay thế" placeholder="Tìm tên sản phẩm" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!searchBusy && !busy) void searchProducts() } }} disabled={busy} /><button type="button" className={`${exchangeSecondary} shrink-0`} disabled={searchBusy || busy} onClick={searchProducts}><Search size={16} aria-hidden="true" /> Tìm kiếm</button></div>
    <label className="block space-y-1.5 text-sm font-medium">Sản phẩm<Select aria-label="Sản phẩm thay thế" className={input} value={product?.id ?? ''} disabled={searchBusy || busy} onChange={event => { if (event.target.value) void choose(event.target.value) }}><option value="">Chọn sản phẩm</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</Select></label>
    {product && <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
     <label className="space-y-1.5 text-sm font-medium">Quy cách<Select aria-label="Quy cách thay thế" className={input} value={packaging} onChange={event => setPackaging(event.target.value)} disabled={busy}>{packagings.map(packaging => <option key={packaging.id} value={packaging.id}>{packaging.packagingName ?? packaging.unitName} ({packaging.conversionToBase} đơn vị cơ sở)</option>)}</Select></label>
     <label className="space-y-1.5 text-sm font-medium">Số lượng<input className={input} type="number" min="1" step="1" value={quantity} disabled={busy} onChange={event => setQuantity(Math.max(1, Math.floor(Number(event.target.value))))} /></label>
     <button type="button" className={exchangeSecondary} disabled={busy || !packaging} onClick={() => {
      const existing = replacements.find(item => item.storeProductId === product.id && item.productPackagingId === packaging)
      const selected = packagings.find(item => item.id === packaging)
      setReplacements(existing ? replacements.map(item => item === existing ? { ...item, quantity: item.quantity + quantity } : item) : [...replacements, { storeProductId: product.id, productPackagingId: packaging, quantity, name: `${product.name} — ${selected?.packagingName ?? selected?.unitName}` }])
     }}><Plus size={16} aria-hidden="true" /> Thêm</button>
    </div>}
    {replacements.length > 0 ? <div className="overflow-x-auto rounded-lg border border-outline-variant"><table className="w-full text-left text-sm"><thead className="bg-surface-container-low text-on-surface-variant"><tr><th className="px-3 py-2 font-medium">Sản phẩm / Quy cách</th><th className="px-3 py-2 text-right font-medium">Số lượng</th><th className="px-3 py-2 text-right font-medium">Thao tác</th></tr></thead><tbody className="divide-y divide-outline-variant">{replacements.map((item, index) => <tr key={`${item.storeProductId}:${item.productPackagingId}`}><td className="px-3 py-3">{item.name}</td><td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td><td className="px-3 py-3 text-right"><button type="button" aria-label={`Bỏ ${item.name}`} disabled={busy} onClick={() => setReplacements(replacements.filter((_, position) => position !== index))} className="inline-flex items-center gap-1.5 text-rose-700 hover:underline disabled:opacity-50"><Trash2 size={15} aria-hidden="true" /> Bỏ dòng</button></td></tr>)}</tbody></table></div> : <p className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">Chưa chọn sản phẩm thay thế.</p>}
   </section>
   <section className={exchangeSection}>
    <label className="block space-y-1.5 text-sm font-medium">Lý do đổi hàng<textarea className={input} maxLength={1000} rows={3} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} placeholder="Mô tả lý do khách hàng muốn đổi sản phẩm" /></label>
    <p className="text-sm text-on-surface-variant">Giá hàng thay thế được xác định khi gửi yêu cầu. Tiền chênh lệch được chốt sau khi kiểm tra hàng và đối trừ công nợ.</p>
   </section>
  </>}
 </form>
}
