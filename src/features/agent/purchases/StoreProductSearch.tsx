import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { productLookupApi, type StoreProductRef } from '@/api/productLookupApi'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

interface StoreProductSearchProps {
  onPick: (product: StoreProductRef) => void
  placeholder?: string
}

/** Search-as-you-type over the store's active products (any stock level, including products never received yet). */
export default function StoreProductSearch({ onPick, placeholder = 'Gõ mã hoặc tên sản phẩm...' }: StoreProductSearchProps) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<StoreProductRef[]>([])
  const [loading, setLoading] = useState(false)
  const debounced = useDebouncedValue(text, 250)
  const box = useRef<HTMLDivElement>(null)
  const request = useRef(0)

  useEffect(() => {
    if (!open) return
    const id = ++request.current
    setLoading(true)
    productLookupApi
      .searchStoreProducts({ search: debounced.trim() || undefined, pageSize: 8 })
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

  return (
    <div ref={box} className="relative">
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
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50"
                  onClick={() => {
                    onPick(p)
                    setOpen(false)
                    setText('')
                  }}
                >
                  <div className="text-sm font-medium text-slate-900">{p.name}</div>
                  <div className="font-mono text-xs text-slate-500">{p.storeSku ?? p.sku}</div>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
