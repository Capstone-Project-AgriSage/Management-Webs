import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Select from '@/components/ui/Select'
import { useToast } from '@/context/ToastContext'
import { usePermission } from '@/context/PermissionContext'
import { describeError } from '@/api/client'
import { adminCatalogApi, type AdminCatalogRow } from '@/api/adminCatalogApi'
import { productsApi, type ProductIngredientRow, type ProductResponse } from '@/api/productsApi'

interface Row {
  activeIngredientId: string
  concentration: string
}

const field =
  'w-full h-9 px-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100'

const rowsOf = (ingredients: ProductIngredientRow[]): Row[] =>
  ingredients.map((i) => ({ activeIngredientId: i.activeIngredientId, concentration: i.concentration ?? '' }))

/**
 * The active ingredients of an existing product (PUT /api/products/{id}/ingredients replaces the whole list). They decide
 * which products the Farmer is offered when the AI is sure of a disease whose treatment names one of them
 * (AI_DIAGNOSIS.md 2.0, D13). Saved on its own, apart from the product details: the dialog stays open. Render it with
 * `key={product.id}` so another product starts from its own list.
 */
export default function IngredientEditor({ product }: { product: ProductResponse }) {
  const { showToast } = useToast()
  const { has } = usePermission()
  const canEdit = has('PRODUCTS.UPDATE')
  const [rows, setRows] = useState<Row[]>(() => rowsOf(product.ingredients))
  const [options, setOptions] = useState<AdminCatalogRow[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    adminCatalogApi
      .activeIngredients(controller.signal)
      .then((res) => setOptions(res.items))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  const known = new Map(product.ingredients.map((i) => [i.activeIngredientId, i.name]))
  const chosen = rows.map((r) => r.activeIngredientId).filter(Boolean)
  const duplicate = new Set(chosen).size !== chosen.length
  const incomplete = rows.some((r) => !r.activeIngredientId)
  const tooLong = rows.some((r) => r.concentration.trim().length > 100)

  const save = async () => {
    setSaving(true)
    try {
      const saved = await productsApi.setIngredients(product.id, {
        ingredients: rows.map((r) => ({ activeIngredientId: r.activeIngredientId, concentration: r.concentration.trim() || null, note: null })),
      })
      showToast('Đã lưu hoạt chất của sản phẩm', 'success')
      setRows(rowsOf(saved.ingredients))
    } catch (err) {
      showToast(describeError(err, 'Không lưu được hoạt chất'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-2" data-testid="ingredient-editor">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Hoạt chất</h4>
      <p className="text-[11px] text-slate-500">
        Khi AI chắc chắn về một bệnh, nông dân được gợi ý các sản phẩm chứa hoạt chất của cách xử lý bệnh đó.
      </p>
      {rows.length === 0 && <p className="text-sm text-slate-600">Sản phẩm chưa gắn hoạt chất nào.</p>}
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_140px_36px] items-center gap-2">
          <Select
            className={field}
            value={row.activeIngredientId}
            disabled={!canEdit || saving}
            aria-label={`Hoạt chất ${index + 1}`}
            onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, activeIngredientId: e.target.value } : r)))}
          >
            <option value="">Chọn hoạt chất...</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
            {row.activeIngredientId && !options.some((o) => o.id === row.activeIngredientId) && (
              <option value={row.activeIngredientId}>{known.get(row.activeIngredientId) ?? 'Hoạt chất hiện tại'} (đã ngừng)</option>
            )}
          </Select>
          <input
            className={field}
            value={row.concentration}
            maxLength={100}
            disabled={!canEdit || saving}
            placeholder="Hàm lượng"
            aria-label={`Hàm lượng ${index + 1}`}
            onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, concentration: e.target.value } : r)))}
          />
          {canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
              className="p-1.5 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              aria-label={`Bỏ hoạt chất ${index + 1}`}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
      {duplicate && <p className="text-xs text-rose-600">Mỗi hoạt chất chỉ chọn một lần.</p>}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => setRows([...rows, { activeIngredientId: '', concentration: '' }])}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus size={14} /> Thêm hoạt chất
          </button>
          <button
            type="button"
            disabled={saving || duplicate || incomplete || tooLong}
            onClick={() => void save()}
            className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu hoạt chất'}
          </button>
        </div>
      )}
    </section>
  )
}
