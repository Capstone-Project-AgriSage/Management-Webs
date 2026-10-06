import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { ordersApi } from '@/api/ordersApi'
import { catalogApi } from '@/api/catalogApi'
import type { CatalogProduct, CatalogProductDetail, OrderItemResponse, OrderResponse } from '@/api/types'
import { formatVnd } from '@/utils/money'
import { describeApiError } from '@/utils/apiError'
import { packagingLabel } from '@/utils/packaging'

interface OrderEditModalProps {
  order: OrderResponse | null
  onClose: () => void
  /** Every change returns the whole order: the caller replaces its copy (totals, lines). */
  onChanged: (order: OrderResponse) => void
}

const input = 'h-9 px-3 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'

/**
 * Editing an order while it is PENDING_CONFIRMATION (FE_GUIDE_FLOW_1 §M3): note, quantities, price overrides with a
 * reason, back to the suggested price, removing and adding lines. After confirmation every change is a 422.
 */
export default function OrderEditModal({ order, onClose, onChanged }: OrderEditModalProps) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [priceFor, setPriceFor] = useState<string | null>(null)

  useEffect(() => {
    if (order) {
      setNote(order.note ?? '')
      setError('')
      setPriceFor(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id])

  if (!order) return null
  const locked = order.status !== 'PENDING_CONFIRMATION'

  const run = async (key: string, action: () => Promise<OrderResponse>) => {
    setBusy(key)
    setError('')
    try {
      onChanged(await action())
      return true
    } catch (err) {
      setError(describeApiError(err))
      return false
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Sửa đơn ${order.orderNumber}`} widthClassName="max-w-3xl">
      <div className="space-y-5 text-sm">
        {locked && <p className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">Đơn đã xác nhận, không sửa được.</p>}
        {error && (
          <p className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700" role="alert">
            {error}
          </p>
        )}

        <table className="w-full">
          <thead className="text-xs text-slate-500 border-b border-slate-100">
            <tr>
              <th className="py-2 text-left font-semibold">Sản phẩm · quy cách</th>
              <th className="py-2 text-center font-semibold w-28">Số lượng</th>
              <th className="py-2 text-right font-semibold">Đơn giá</th>
              <th className="py-2 text-right font-semibold">Thành tiền</th>
              <th className="w-10"><span className="sr-only">Xoá</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {order.items.map((item) => (
              <LineRow
                key={item.id}
                item={item}
                disabled={locked || busy !== null}
                busy={busy === item.id}
                editingPrice={priceFor === item.id}
                onEditPrice={() => setPriceFor(priceFor === item.id ? null : item.id)}
                onQuantity={(q) => run(item.id, () => ordersApi.changeQuantity(order.id, item.id, q))}
                onOverride={async (price, reason) => (await run(item.id, () => ordersApi.overridePrice(order.id, item.id, price, reason))) && setPriceFor(null)}
                onReset={() => run(item.id, () => ordersApi.resetPrice(order.id, item.id))}
                onRemove={() => {
                  if (window.confirm(`Xoá ${item.productName} (${item.packagingName ?? 'đơn vị'}) khỏi đơn?`)) run(item.id, () => ordersApi.removeItem(order.id, item.id))
                }}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 text-right font-bold text-slate-900">Tổng đơn</td>
              <td className="pt-3 text-right font-bold text-emerald-700 tabular-nums">{formatVnd(order.totalAmount)}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        {!locked && <AddLine disabled={busy !== null} onAdd={(storeProductId, productPackagingId, quantity) => run('add', () => ordersApi.addItem(order.id, { storeProductId, productPackagingId, quantity }))} />}

        <div className="space-y-2">
          <label htmlFor="order-note" className="block font-semibold text-slate-700">
            Ghi chú
          </label>
          <textarea id="order-note" rows={2} maxLength={1000} disabled={locked} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={locked || busy !== null || note === (order.note ?? '')}
              onClick={() => run('note', () => ordersApi.updateNote(order.id, note.trim()))}
              className="h-9 px-4 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-40"
            >
              Lưu ghi chú
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function LineRow({ item, disabled, busy, editingPrice, onEditPrice, onQuantity, onOverride, onReset, onRemove }: {
  item: OrderItemResponse
  disabled: boolean
  busy: boolean
  editingPrice: boolean
  onEditPrice: () => void
  onQuantity: (q: number) => void
  onOverride: (price: number, reason: string) => void
  onReset: () => void
  onRemove: () => void
}) {
  const [qty, setQty] = useState(String(item.quantity))
  useEffect(() => setQty(String(item.quantity)), [item.quantity])
  const commitQty = () => {
    const q = Number(qty)
    if (Number.isInteger(q) && q >= 1 && q <= 100_000_000 && q !== item.quantity) onQuantity(q)
    else setQty(String(item.quantity))
  }

  return (
    <>
      <tr>
        <td className="py-2.5 pr-2">
          <div className="font-medium text-slate-900">{item.productName}</div>
          <div className="text-xs text-slate-500">{item.packagingName ?? 'Đơn vị cơ sở'}</div>
        </td>
        <td className="py-2.5 text-center">
          <input
            aria-label={`Số lượng ${item.productName}`}
            inputMode="numeric"
            disabled={disabled}
            className={`${input} w-20 text-center tabular-nums`}
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={commitQty}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </td>
        <td className="py-2.5 text-right tabular-nums">
          {item.priceOverridden && <div className="text-xs text-slate-400 line-through">{formatVnd(item.suggestedUnitPrice)}</div>}
          <div className="font-semibold">{formatVnd(item.unitPrice)}</div>
          {item.priceOverridden && <div className="text-[11px] text-amber-700" title={item.overrideReason ?? ''}>đã sửa: {item.overrideReason}</div>}
          {!disabled && (
            <div className="flex justify-end gap-2 mt-0.5">
              <button type="button" onClick={onEditPrice} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline">
                <Pencil size={11} /> Sửa giá
              </button>
              {item.priceOverridden && (
                <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:underline">
                  <RotateCcw size={11} /> Giá gợi ý
                </button>
              )}
            </div>
          )}
        </td>
        <td className="py-2.5 text-right font-semibold tabular-nums">{busy ? <Loader2 size={14} className="inline animate-spin" /> : formatVnd(item.lineTotalAmount)}</td>
        <td className="py-2.5 text-right">
          <button type="button" aria-label={`Xoá ${item.productName}`} disabled={disabled} onClick={onRemove} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40">
            <Trash2 size={15} />
          </button>
        </td>
      </tr>
      {editingPrice && (
        <tr>
          <td colSpan={5} className="pb-3">
            <PriceForm suggested={item.suggestedUnitPrice} current={item.priceOverridden ? item.unitPrice : undefined} reason={item.overrideReason ?? ''} onSubmit={onOverride} onCancel={onEditPrice} />
          </td>
        </tr>
      )}
    </>
  )
}

function PriceForm({ suggested, current, reason: initialReason, onSubmit, onCancel }: { suggested: number; current?: number; reason: string; onSubmit: (price: number, reason: string) => void; onCancel: () => void }) {
  const [price, setPrice] = useState(String(current ?? suggested))
  const [reason, setReason] = useState(initialReason)
  const [error, setError] = useState('')
  const value = Number(price.replace(/[^\d]/g, ''))
  return (
    <div className="flex flex-wrap items-start gap-2 p-3 rounded-lg bg-slate-50">
      <span className="text-xs text-slate-500 w-full">Giá gợi ý {formatVnd(suggested)}</span>
      <input aria-label="Giá mới" inputMode="numeric" className={`${input} w-36 tabular-nums`} value={value ? value.toLocaleString('vi-VN') : ''} onChange={(e) => setPrice(e.target.value)} />
      <input aria-label="Lý do sửa giá" maxLength={500} placeholder="Lý do (bắt buộc)" className={`${input} flex-1 min-w-[180px]`} value={reason} onChange={(e) => setReason(e.target.value)} />
      <button type="button" onClick={onCancel} className="h-9 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100">Huỷ</button>
      <button
        type="button"
        onClick={() => {
          if (!(value > 0)) return setError('Giá phải lớn hơn 0.')
          if (!reason.trim()) return setError('Nhập lý do sửa giá.')
          onSubmit(value, reason.trim())
        }}
        className="h-9 px-3 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
      >
        Áp dụng giá
      </button>
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </div>
  )
}

/** Search a product, pick a packaging with a price and a quantity, add it as a new line. */
function AddLine({ disabled, onAdd }: { disabled: boolean; onAdd: (storeProductId: string, productPackagingId: string, quantity: number) => Promise<boolean> }) {
  const [text, setText] = useState('')
  const [results, setResults] = useState<CatalogProduct[]>([])
  const [product, setProduct] = useState<CatalogProductDetail | null>(null)
  const [packagingId, setPackagingId] = useState('')
  const [qty, setQty] = useState('1')

  useEffect(() => {
    if (product || !text.trim()) {
      setResults([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      catalogApi
        .getProducts({ search: text.trim(), pageSize: 6 })
        .then((r) => alive && setResults(r.items))
        .catch(() => alive && setResults([]))
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [text, product])

  const choose = async (p: CatalogProduct) => {
    const detail = await catalogApi.getProductDetail(p.id)
    setProduct(detail)
    setText(detail.name)
    setPackagingId(detail.packagings.find((x) => x.price !== null)?.id ?? '')
  }

  const clear = () => {
    setProduct(null)
    setText('')
    setPackagingId('')
    setQty('1')
  }

  return (
    <div className="p-3 rounded-lg border border-dashed border-slate-300 space-y-2">
      <div className="font-semibold text-slate-700">Thêm dòng hàng</div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input aria-label="Tìm sản phẩm để thêm" className={`${input} w-full pl-8`} placeholder="Tìm sản phẩm..." value={text} onChange={(e) => (product ? clear() : setText(e.target.value))} />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg" role="listbox" aria-label="Sản phẩm tìm được">
              {results.map((p) => (
                <button key={p.id} type="button" role="option" aria-selected={false} className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => choose(p)}>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.sku}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <select aria-label="Quy cách" className={`${input} min-w-[160px]`} disabled={!product} value={packagingId} onChange={(e) => setPackagingId(e.target.value)}>
          {!product && <option value="">Quy cách</option>}
          {product?.packagings.map((p) => (
            <option key={p.id} value={p.id} disabled={p.price === null}>
              {packagingLabel(p)}{p.price === null ? ' — chưa có giá' : ''}
            </option>
          ))}
        </select>
        <input aria-label="Số lượng thêm" inputMode="numeric" className={`${input} w-20 text-center`} value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))} />
        <button
          type="button"
          disabled={disabled || !product || !packagingId || !(Number(qty) >= 1)}
          onClick={async () => {
            if (await onAdd(product!.id, packagingId, Math.min(100_000_000, Number(qty)))) clear()
          }}
          className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-1"
        >
          <Plus size={15} /> Thêm
        </button>
      </div>
      <p className="text-xs text-slate-500">Dòng thêm sau dùng bảng giá đã chốt của đơn. Sản phẩm + quy cách đã có trong đơn thì đổi số lượng dòng đó.</p>
    </div>
  )
}
