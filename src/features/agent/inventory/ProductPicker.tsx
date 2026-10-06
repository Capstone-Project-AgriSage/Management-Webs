import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { stockApi, type StockSummaryItem } from '@/api/stockApi'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

export interface PickedProduct {
  storeProductId: string
  sku: string
  productName: string
  baseUnit: string
}

interface ProductPickerProps {
  value: PickedProduct | null
  onChange: (product: PickedProduct | null) => void
  placeholder?: string
  /** Shown instead of the chip while only the id is known (e.g. coming from a link). */
  pendingLabel?: string | null
  className?: string
}

/** Search-as-you-type picker over the store's products (stock summary: SKU, name, base unit). */
export default function ProductPicker({ value, onChange, placeholder = 'Gõ mã hoặc tên sản phẩm...', pendingLabel = null, className = '' }: ProductPickerProps) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<StockSummaryItem[]>([])
  const [loading, setLoading] = useState(false)
  const debounced = useDebouncedValue(text, 250)
  const box = useRef<HTMLDivElement>(null)
  const request = useRef(0)

  useEffect(() => {
    if (!open) return
    const id = ++request.current
    setLoading(true)
    stockApi
      .getSummary({ search: debounced.trim() || undefined, pageSize: 8 })
      .then((res) => {
        if (id === request.current) setResults(res.items)
      })
      .catch(() => {
        if (id === request.current) setResults([])
      })
      .finally(() => {
        if (id === request.current) setLoading(false)
      })
  }, [debounced, open])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  if (value || pendingLabel) {
    return (
      <div className={`flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">{value ? value.productName : pendingLabel}</div>
          {value ? <div className="font-mono text-xs text-slate-500">{value.sku}</div> : null}
        </div>
        <button
          type="button"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          aria-label="Chọn sản phẩm khác"
          onClick={() => {
            onChange(null)
            setText('')
            setOpen(true)
          }}
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors shadow-sm"
        placeholder={placeholder}
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
      />
      {open ? (
        <ul className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100" role="listbox">
          {loading && results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">Đang tìm...</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">Không tìm thấy sản phẩm.</li>
          ) : (
            results.map((p) => (
              <li key={p.storeProductId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50"
                  onClick={() => {
                    onChange({ storeProductId: p.storeProductId, sku: p.sku, productName: p.productName, baseUnit: p.baseUnit })
                    setOpen(false)
                  }}
                >
                  <div className="text-sm font-medium text-slate-900">{p.productName}</div>
                  <div className="font-mono text-xs text-slate-500">{p.sku}</div>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
