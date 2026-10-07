import { useState } from 'react'
import { Minus, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { formatVnd } from '@/utils/money'
import ProductThumb from '@/components/ui/ProductThumb'
import type { CounterSalePreviewResponse } from '@/api/types'
import type { CartItem } from './orderDraft'

type PreviewLine = CounterSalePreviewResponse['items'][number]

interface CartLinesProps {
  items: CartItem[]
  /** Server prices for the current customer (null while loading or when the preview failed). */
  preview: CounterSalePreviewResponse | null
  /** Row index → server message (422 errors["items[i]"]). */
  errors: Record<number, string>
  onQuantity: (index: number, quantity: number) => void
  onOverride: (index: number, override: CartItem['override']) => void
  onRemove: (index: number) => void
}

/** Order lines: packaging and quantity, the server price (read-only) and an optional price override with its reason. */
export default function CartLines({ items, preview, errors, onQuantity, onOverride, onRemove }: CartLinesProps) {
  const [editing, setEditing] = useState<number | null>(null)

  return (
    <ul className="space-y-3">
      {items.map((item, idx) => {
        const line: PreviewLine | undefined = preview?.items.find((l) => l.storeProductId === item.product.id && l.productPackagingId === item.packagingId)
        const suggested = line?.suggestedUnitPrice ?? item.price
        const unitPrice = item.override?.unitPrice ?? line?.unitPrice ?? item.price
        const shortage = line?.shortageBaseQuantity ?? 0
        return (
          <li key={`${item.product.id}-${item.packagingId}`} className={`p-3 rounded-xl border bg-surface ${errors[idx] ? 'border-rose-400' : 'border-outline-variant/60'}`}>
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <ProductThumb src={item.product.imageUrl} alt={item.product.name} className="w-10 h-10 rounded-lg border border-outline-variant/40" iconSize={18} />
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-on-surface leading-snug line-clamp-2">{item.product.name}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">{item.packagingName}</div>
                </div>
              </div>
              <button type="button" aria-label={`Xoá ${item.product.name}`} onClick={() => onRemove(idx)} className="p-1.5 rounded-lg text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 shrink-0">
                <Trash2 size={15} />
              </button>
            </div>

            <div className="flex justify-between items-end gap-2 mt-2">
              <div>
                {item.override ? (
                  <>
                    <div className="text-xs text-on-surface-variant line-through tabular-nums">{formatVnd(suggested)}</div>
                    <div className="text-emerald-700 font-bold tabular-nums">
                      {formatVnd(unitPrice)} <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold align-middle">đã sửa giá</span>
                    </div>
                  </>
                ) : (
                  <div className="text-emerald-700 font-bold tabular-nums">{formatVnd(unitPrice)}</div>
                )}
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => setEditing(editing === idx ? null : idx)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <Pencil size={12} /> Sửa giá
                  </button>
                  {item.override && (
                    <button type="button" onClick={() => onOverride(idx, undefined)} className="inline-flex items-center gap-1 text-xs font-medium text-on-surface-variant hover:underline">
                      <RotateCcw size={12} /> Giá gợi ý
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-lg p-1 border border-outline-variant/60 bg-surface-container-lowest">
                <button type="button" aria-label="Giảm số lượng" onClick={() => onQuantity(idx, Math.max(1, item.quantity - 1))} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-container">
                  <Minus size={14} />
                </button>
                <QuantityInput label={`Số lượng ${item.product.name}`} value={item.quantity} onChange={(q) => onQuantity(idx, q)} />
                <button type="button" aria-label="Tăng số lượng" onClick={() => onQuantity(idx, Math.min(100_000_000, item.quantity + 1))} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-container">
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {line && <div className="mt-1 text-right text-xs text-on-surface-variant tabular-nums">Thành tiền {formatVnd(item.override ? unitPrice * item.quantity : line.lineTotalAmount)}</div>}
            {shortage > 0 && (
              <p className="mt-1.5 text-xs font-medium text-amber-700">
                Thiếu {shortage} đơn vị cơ sở trong kho
                {item.conversionToBase > 1 ? ` (≈ ${Math.ceil(shortage / item.conversionToBase)} ${item.packagingName.toLowerCase()})` : ''} — chưa xác nhận hay bán nhanh được.
              </p>
            )}
            {errors[idx] && <p className="mt-1.5 text-xs font-medium text-rose-600">{errors[idx]}</p>}

            {editing === idx && (
              <PriceOverrideForm
                suggested={suggested}
                current={item.override}
                onCancel={() => setEditing(null)}
                onApply={(o) => {
                  onOverride(idx, o.unitPrice === suggested ? undefined : o)
                  setEditing(null)
                }}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** New unit price plus the mandatory reason (FE_GUIDE_FLOW_1 §M3). */
function PriceOverrideForm({ suggested, current, onApply, onCancel }: { suggested: number; current?: CartItem['override']; onApply: (o: { unitPrice: number; reason: string }) => void; onCancel: () => void }) {
  const [price, setPrice] = useState(String(current?.unitPrice ?? suggested))
  const [reason, setReason] = useState(current?.reason ?? '')
  const [error, setError] = useState('')
  const value = Number(price.replace(/[^\d]/g, ''))

  const apply = () => {
    if (!(value > 0)) return setError('Giá phải lớn hơn 0.')
    if (value !== suggested && !reason.trim()) return setError('Nhập lý do sửa giá.')
    onApply({ unitPrice: value, reason: reason.trim() })
  }

  return (
    <div className="mt-2.5 p-2.5 rounded-lg bg-surface-container space-y-2">
      <div className="text-xs text-on-surface-variant">Giá gợi ý {formatVnd(suggested)}</div>
      <input aria-label="Giá mới" inputMode="numeric" className="w-full h-8 px-2.5 rounded-md border border-outline-variant bg-surface-container-lowest text-sm tabular-nums" value={value ? value.toLocaleString('vi-VN') : ''} onChange={(e) => setPrice(e.target.value)} />
      <input aria-label="Lý do sửa giá" maxLength={500} className="w-full h-8 px-2.5 rounded-md border border-outline-variant bg-surface-container-lowest text-sm" placeholder="Lý do (bắt buộc), VD: Khách mua số lượng lớn" value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-8 px-3 rounded-md text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high">Huỷ</button>
        <button type="button" onClick={apply} className="h-8 px-3 rounded-md text-xs font-semibold bg-primary text-on-primary hover:bg-primary/90">Áp dụng giá</button>
      </div>
    </div>
  )
}

/**
 * Pack count typed by hand: keeps the text while the field is being edited (so clearing it to type "15" works)
 * and commits a number between 1 and 100,000,000 (FE_GUIDE_FLOW_1 §M3).
 */
function QuantityInput({ label, value, onChange }: { label: string; value: number; onChange: (q: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      className="w-12 h-7 text-center font-bold text-sm bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 rounded-md tabular-nums"
      value={draft ?? String(value)}
      onChange={(e) => {
        const text = e.target.value.replace(/[^\d]/g, '')
        setDraft(text)
        if (Number(text) >= 1) onChange(Math.min(100_000_000, Number(text)))
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}
