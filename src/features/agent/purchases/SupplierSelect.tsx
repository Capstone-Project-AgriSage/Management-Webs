import { useEffect, useState } from 'react'
import { suppliersApi, type Supplier } from '@/api/suppliersApi'

interface SupplierSelectProps {
  value: string
  onChange: (supplierId: string) => void
  /** Only suppliers still cooperating (the receipt rules need an active supplier). */
  activeOnly?: boolean
  /** First option when nothing is chosen. */
  emptyLabel?: string
  id?: string
  className?: string
}

const selectClassName =
  'w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'

/** Dropdown of the store's suppliers (up to 100, which is plenty for one store). */
export default function SupplierSelect({ value, onChange, activeOnly = true, emptyLabel = 'Chọn nhà cung cấp...', id, className = '' }: SupplierSelectProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    suppliersApi
      .list({ isActive: activeOnly ? true : undefined, pageSize: 100 })
      .then((res) => {
        if (!cancelled) setSuppliers(res.items)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeOnly])

  return (
    <select id={id} className={`${selectClassName} ${className}`} value={value} onChange={(e) => onChange(e.target.value)} disabled={loading}>
      <option value="">{loading ? 'Đang tải...' : emptyLabel}</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
          {s.code ? ` (${s.code})` : ''}
          {!s.isActive ? ' - ngừng hợp tác' : ''}
        </option>
      ))}
    </select>
  )
}
