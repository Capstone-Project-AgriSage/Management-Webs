import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ShoppingCart, Trash2 } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { counterSalesApi } from '@/api/counterSalesApi'
import { ordersApi } from '@/api/ordersApi'
import type { CounterSalePreviewResponse } from '@/api/types'
import { formatVnd } from '@/utils/money'
import { describeApiError, rowErrors } from '@/utils/apiError'
import { useRoleBase } from '@/utils/creditLabels'
import ProductSearchPanel from './ProductSearchPanel'
import CustomerSection from './CustomerSection'
import CartLines from './CartLines'
import OrderOptions from './OrderOptions'
import QuickSaleReview from './QuickSaleReview'
import SaleResult, { type CounterResult } from './SaleResult'
import { MAX_LINES, creditRefusal, customerFields, newDraft, toCreateRequest, toItemRequests, validateDraft, type CartItem, type OrderDraft } from './orderDraft'

/**
 * Counter screen (FE_GUIDE_FLOW_1 §M2/§M3/§M7): pick packagings, choose the customer, then either create an order
 * (collected, confirmed and handed over later from the order) or sell at once when a walk-in pays in full and takes
 * the goods. A registered customer gets the group's prices and may buy on credit (FLOW_3 §5).
 */
export default function CounterSalesPage() {
  usePageHeader({ title: 'Bán tại quầy', subtitle: 'Soạn đơn, bán nhanh và bán chịu cho khách quen' })
  const { showToast } = useToast()
  const navigate = useNavigate()
  const base = useRoleBase()

  const [items, setItems] = useState<CartItem[]>([])
  const [draft, setDraft] = useState<OrderDraft>(newDraft)
  const [preview, setPreview] = useState<CounterSalePreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState<'create' | 'review' | 'sell' | null>(null)
  const [review, setReview] = useState<CounterSalePreviewResponse | null>(null)
  const [result, setResult] = useState<CounterResult | null>(null)

  const customerReady = draft.customer.kind === 'WALK_IN' || draft.customer.customer !== null

  // Server prices for the current customer and lines (the group's price list for a registered customer).
  useEffect(() => {
    if (items.length === 0 || !customerReady) {
      setPreview(null)
      setPreviewError('')
      return
    }
    let alive = true
    const t = setTimeout(() => {
      setPreviewing(true)
      counterSalesApi
        .preview({ ...customerFields(draft.customer), items: toItemRequests(items) })
        .then((p) => {
          if (!alive) return
          setPreview(p)
          setPreviewError('')
          setLineErrors({})
        })
        .catch((err) => {
          if (!alive) return
          setPreview(null)
          setLineErrors(rowErrors(err))
          setPreviewError(describeApiError(err, 'Không tính được giá'))
        })
        .finally(() => alive && setPreviewing(false))
    }, 400)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [items, draft.customer, customerReady])

  const addItem = useCallback(
    (item: CartItem) => {
      setResult(null)
      setItems((prev) => {
        const i = prev.findIndex((x) => x.product.id === item.product.id && x.packagingId === item.packagingId)
        // One line per product + packaging (a duplicate pair is a 400): add to the existing line instead.
        if (i >= 0) return prev.map((x, k) => (k === i ? { ...x, quantity: Math.min(100_000_000, x.quantity + item.quantity) } : x))
        if (prev.length >= MAX_LINES) {
          showToast(`Một đơn tối đa ${MAX_LINES} dòng hàng`, 'warning')
          return prev
        }
        return [...prev, item]
      })
    },
    [showToast],
  )

  const reset = () => {
    setItems([])
    setDraft(newDraft())
    setReview(null)
    setResult(null)
    setSubmitError('')
    setFieldErrors({})
    setLineErrors({})
  }

  const total = preview?.totalAmount ?? items.reduce((s, i) => s + (i.override?.unitPrice ?? i.price) * i.quantity, 0)
  const quickSaleAllowed = draft.settlementType === 'FULL_PAYMENT' && draft.fulfillmentType === 'PICKUP'

  const check = () => {
    const errors = validateDraft(draft)
    setFieldErrors(errors)
    setSubmitError(errors.customer ?? '')
    return Object.keys(errors).length === 0
  }

  const failed = (err: unknown) => {
    setLineErrors(rowErrors(err))
    setSubmitError(creditRefusal(err) ?? describeApiError(err))
  }

  const createOrder = async () => {
    if (items.length === 0 || !check()) return
    setBusy('create')
    setSubmitError('')
    try {
      const order = await ordersApi.create(toCreateRequest(draft, items))
      setResult({ kind: 'ORDER', order })
      showToast(`Đã tạo đơn ${order.orderNumber}`, 'success')
    } catch (err) {
      failed(err)
    } finally {
      setBusy(null)
    }
  }

  const startQuickSale = async () => {
    if (items.length === 0 || !check()) return
    setBusy('review')
    setSubmitError('')
    try {
      setReview(await counterSalesApi.preview({ ...customerFields(draft.customer), items: toItemRequests(items) }))
    } catch (err) {
      failed(err)
    } finally {
      setBusy(null)
    }
  }

  const sell = async () => {
    if (!review) return
    setBusy('sell')
    try {
      // Lots chosen by the preview (FEFO); all or nothing — on any error nothing is saved and the staff retries.
      const res = await counterSalesApi.sell({
        ...customerFields(draft.customer),
        note: draft.note.trim() || null,
        items: toItemRequests(items).map((req) => {
          const line = review.items.find((l) => l.storeProductId === req.storeProductId && l.productPackagingId === req.productPackagingId)
          return { ...req, lots: (line?.lots ?? []).map((l) => ({ inventoryLotId: l.inventoryLotId, baseQuantity: l.suggestedBaseQuantity })) }
        }),
      })
      setReview(null)
      setResult({ kind: 'SALE', order: res.order, payment: res.payment })
      showToast(`Đã bán đơn ${res.order.orderNumber}`, 'success')
    } catch (err) {
      setReview(null)
      failed(err)
    } finally {
      setBusy(null)
    }
  }

  const right = result ? (
    <SaleResult result={result} onNew={reset} onOpenOrder={(id) => navigate(`${base}/orders?open=${id}`)} />
  ) : review ? (
    <QuickSaleReview preview={review} selling={busy === 'sell'} onBack={() => setReview(null)} onSell={sell} />
  ) : (
    <div className="flex flex-col h-full bg-surface-container-lowest z-10">
      <div className="px-5 py-4 border-b border-outline-variant/40 flex items-center justify-between">
        <h2 className="font-bold text-lg flex items-center gap-2.5 text-on-surface">
          <ShoppingCart className="w-5 h-5 text-emerald-600" /> Đơn đang soạn
          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{items.length}</span>
        </h2>
        {(items.length > 0 || draft.customer.kind === 'REGISTERED') && (
          <button type="button" onClick={reset} className="text-rose-600 text-sm font-semibold hover:bg-rose-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> Xoá hết
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <CustomerSection value={draft.customer} onChange={(customer) => setDraft((d) => ({ ...newDraft(), note: d.note, customer, settlementType: 'FULL_PAYMENT' }))} />
        {items.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center text-on-surface-variant">
            <ShoppingCart className="w-9 h-9 opacity-40 mb-3" />
            <p className="font-semibold text-on-surface">Chưa có hàng</p>
            <p className="text-sm">Chọn sản phẩm và quy cách ở danh sách bên trái.</p>
          </div>
        ) : (
          <CartLines
            items={items}
            preview={preview}
            errors={lineErrors}
            onQuantity={(i, q) => setItems((prev) => prev.map((x, k) => (k === i ? { ...x, quantity: q } : x)))}
            onOverride={(i, override) => setItems((prev) => prev.map((x, k) => (k === i ? { ...x, override } : x)))}
            onRemove={(i) => setItems((prev) => prev.filter((_, k) => k !== i))}
          />
        )}
        {items.length > 0 && <OrderOptions draft={draft} total={total} errors={fieldErrors} onChange={setDraft} />}
      </div>

      <div className="p-5 border-t border-outline-variant/40 bg-surface-container-lowest space-y-3">
        {previewError && <p className="text-xs text-amber-700">{previewError}</p>}
        {submitError && (
          <p className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" role="alert">
            {submitError}
          </p>
        )}
        <div className="flex justify-between items-end">
          <span className="font-bold text-on-surface-variant uppercase text-xs tracking-wider">Tổng cộng {previewing && <Loader2 className="inline w-3.5 h-3.5 animate-spin ml-1" />}</span>
          <span className="font-bold text-3xl text-emerald-600 tracking-tight tabular-nums">{formatVnd(total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={items.length === 0 || busy !== null}
            onClick={createOrder}
            className="h-12 rounded-xl border-2 border-emerald-600 text-emerald-700 font-bold text-sm hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy === 'create' && <Loader2 className="w-4 h-4 animate-spin" />} TẠO ĐƠN
          </button>
          <button
            type="button"
            disabled={items.length === 0 || busy !== null || !quickSaleAllowed}
            title={quickSaleAllowed ? undefined : 'Bán nhanh chỉ khi khách trả đủ và lấy hàng tại quầy'}
            onClick={startQuickSale}
            className="h-12 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy === 'review' && <Loader2 className="w-4 h-4 animate-spin" />} BÁN NHANH
          </button>
        </div>
        {!quickSaleAllowed && items.length > 0 && <p className="text-[11px] text-on-surface-variant text-center">Bán nhanh chỉ dùng khi khách trả đủ và lấy hàng ngay.</p>}
      </div>
    </div>
  )

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row bg-surface-container-lowest overflow-hidden -m-space-md">
      <div className="flex-1 min-w-0 flex flex-col border-r border-outline-variant">
        <ProductSearchPanel onAddToCart={addItem} />
      </div>
      <div className="w-full md:w-[460px] shrink-0 flex flex-col">{right}</div>
    </div>
  )
}
