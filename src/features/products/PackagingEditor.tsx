import { Plus, Trash2 } from 'lucide-react'
import type { PackagingInput, UnitOption } from '@/api/productsApi'

/** One row of the packaging table while a product is being created (the numbers stay text until validated). */
export interface PackagingDraft {
  key: string
  unitId: string
  packagingName: string
  conversionToBase: string
  isBaseUnit: boolean
  isPurchaseUnit: boolean
  isSaleUnit: boolean
  barcode: string
}

let counter = 0
export const newPackagingRow = (over: Partial<PackagingDraft> = {}): PackagingDraft => ({
  key: `row-${++counter}`,
  unitId: '',
  packagingName: '',
  conversionToBase: '',
  isBaseUnit: false,
  isPurchaseUnit: true,
  isSaleUnit: true,
  barcode: '',
  ...over,
})

/** The first row of a new product is its base unit (what the stock is counted in): conversion 1. */
export const firstPackagingRow = () => newPackagingRow({ isBaseUnit: true, conversionToBase: '1' })

/** Per-row messages (by index) plus one for the table as a whole; empty when the rows can be sent. */
export function validatePackagings(rows: PackagingDraft[]): { rows: Record<number, string>; table?: string } {
  const out: { rows: Record<number, string>; table?: string } = { rows: {} }
  if (rows.length === 0) return { rows: {}, table: 'Cần ít nhất một quy cách.' }
  const bases = rows.filter((r) => r.isBaseUnit).length
  if (bases !== 1) out.table = 'Cần đúng một quy cách cơ sở (quy đổi 1): đơn vị nhỏ nhất dùng để đếm tồn kho.'
  const barcodes = rows.map((r) => r.barcode.trim()).filter(Boolean)
  if (new Set(barcodes.map((b) => b.toLowerCase())).size !== barcodes.length) out.table = 'Mã vạch không được trùng nhau.'
  rows.forEach((r, i) => {
    const conversion = Number(r.conversionToBase)
    if (!r.unitId) out.rows[i] = 'Chọn đơn vị.'
    else if (rows.findIndex((x) => x.unitId === r.unitId) !== i) out.rows[i] = 'Mỗi đơn vị chỉ dùng cho một quy cách.'
    else if (!Number.isInteger(conversion) || conversion < 1) out.rows[i] = 'Quy đổi phải là số nguyên từ 1.'
    else if (r.isBaseUnit && conversion !== 1) out.rows[i] = 'Quy cách cơ sở có quy đổi bằng 1.'
    else if (r.packagingName.length > 150) out.rows[i] = 'Tên quy cách tối đa 150 ký tự.'
    else if (r.barcode.length > 100) out.rows[i] = 'Mã vạch tối đa 100 ký tự.'
  })
  return out
}

export const toPackagingInputs = (rows: PackagingDraft[]): PackagingInput[] =>
  rows.map((r) => ({
    unitId: r.unitId,
    conversionToBase: Number(r.conversionToBase),
    isBaseUnit: r.isBaseUnit,
    isPurchaseUnit: r.isPurchaseUnit,
    isSaleUnit: r.isSaleUnit,
    packagingName: r.packagingName.trim() || null,
    barcode: r.barcode.trim() || null,
  }))

interface PackagingEditorProps {
  rows: PackagingDraft[]
  units: UnitOption[]
  rowErrors: Record<number, string>
  tableError?: string
  onChange: (rows: PackagingDraft[]) => void
}

const cell =
  'w-full h-9 px-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100'

/** Packagings of a new product: the base unit first, then the bigger packs (bag, box...) with how many base units each holds. */
export default function PackagingEditor({ rows, units, rowErrors, tableError, onChange }: PackagingEditorProps) {
  const patch = (index: number, change: Partial<PackagingDraft>) => onChange(rows.map((r, i) => (i === index ? { ...r, ...change } : r)))

  const makeBase = (index: number) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, isBaseUnit: true, conversionToBase: '1' } : { ...r, isBaseUnit: false })))

  const remove = (index: number) => {
    const next = rows.filter((_, i) => i !== index)
    // The base row went: the first remaining one becomes the base.
    if (rows[index].isBaseUnit && next.length > 0) next[0] = { ...next[0], isBaseUnit: true, conversionToBase: '1' }
    onChange(next)
  }

  const used = new Set(rows.map((r) => r.unitId).filter(Boolean))

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[1.2fr_1.3fr_80px_52px_44px_44px_1fr_32px] gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <span>Đơn vị</span>
        <span>Tên quy cách</span>
        <span>Quy đổi</span>
        <span className="text-center">Cơ sở</span>
        <span className="text-center">Mua</span>
        <span className="text-center">Bán</span>
        <span>Mã vạch</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={r.key} className="space-y-1">
          <div className="grid grid-cols-2 sm:grid-cols-[1.2fr_1.3fr_80px_52px_44px_44px_1fr_32px] gap-2 items-center">
            <select aria-label={`Đơn vị dòng ${i + 1}`} className={cell} value={r.unitId} onChange={(e) => patch(i, { unitId: e.target.value })}>
              <option value="">Chọn đơn vị</option>
              {units.map((u) => (
                <option key={u.id} value={u.id} disabled={used.has(u.id) && u.id !== r.unitId}>
                  {u.name}
                  {u.symbol ? ` (${u.symbol})` : ''}
                </option>
              ))}
            </select>
            <input aria-label={`Tên quy cách dòng ${i + 1}`} className={cell} placeholder="VD: Bao 50 kg" value={r.packagingName} maxLength={150} onChange={(e) => patch(i, { packagingName: e.target.value })} />
            <input
              aria-label={`Quy đổi dòng ${i + 1}`}
              className={cell}
              inputMode="numeric"
              placeholder="VD: 50"
              value={r.conversionToBase}
              disabled={r.isBaseUnit}
              onChange={(e) => patch(i, { conversionToBase: e.target.value.replace(/\D/g, '') })}
            />
            <label className="flex justify-center" title="Quy cách cơ sở: đơn vị nhỏ nhất dùng để đếm tồn kho">
              <input aria-label={`Quy cách cơ sở dòng ${i + 1}`} type="radio" name="base-packaging" className="accent-emerald-600 w-4 h-4" checked={r.isBaseUnit} onChange={() => makeBase(i)} />
            </label>
            <label className="flex justify-center" title="Dùng khi nhập hàng">
              <input aria-label={`Dùng để mua dòng ${i + 1}`} type="checkbox" className="accent-emerald-600 w-4 h-4" checked={r.isPurchaseUnit} onChange={(e) => patch(i, { isPurchaseUnit: e.target.checked })} />
            </label>
            <label className="flex justify-center" title="Dùng khi bán">
              <input aria-label={`Dùng để bán dòng ${i + 1}`} type="checkbox" className="accent-emerald-600 w-4 h-4" checked={r.isSaleUnit} onChange={(e) => patch(i, { isSaleUnit: e.target.checked })} />
            </label>
            <input aria-label={`Mã vạch dòng ${i + 1}`} className={cell} placeholder="Mã vạch" value={r.barcode} maxLength={100} onChange={(e) => patch(i, { barcode: e.target.value })} />
            <button
              type="button"
              aria-label={`Xóa quy cách dòng ${i + 1}`}
              disabled={rows.length === 1}
              onClick={() => remove(i)}
              className="h-9 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Trash2 size={15} />
            </button>
          </div>
          {rowErrors[i] && <p className="text-xs text-rose-600 pl-1">{rowErrors[i]}</p>}
        </div>
      ))}
      {tableError && <p className="text-xs text-rose-600">{tableError}</p>}
      <button
        type="button"
        onClick={() => onChange([...rows, newPackagingRow()])}
        className="h-9 px-3 rounded-lg border border-dashed border-slate-300 text-slate-600 text-sm font-medium hover:border-emerald-500 hover:text-emerald-700 flex items-center gap-1.5"
      >
        <Plus size={15} /> Thêm quy cách
      </button>
      <p className="text-[11px] text-slate-500">
        Quy đổi là số đơn vị cơ sở trong một quy cách (bao 50 kg: đơn vị cơ sở là kg thì quy đổi 50). Sau khi tạo, quy đổi và quy cách cơ sở không đổi được.
      </p>
    </div>
  )
}
