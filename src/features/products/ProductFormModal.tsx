import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useEffect, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/context/ToastContext'
import { ApiError, describeError } from '@/api/client'
import {
  productsApi,
  storageKeyFromUrl,
  type BrandOption,
  type CategoryOption,
  type ProductResponse,
  type UnitOption,
  type UploadedImage,
} from '@/api/productsApi'
import ImageUploader from './ImageUploader'
import PackagingEditor, { firstPackagingRow, toPackagingInputs, validatePackagings, type PackagingDraft } from './PackagingEditor'

interface ProductFormModalProps {
  open: boolean
  /** null = create a product. */
  product: ProductResponse | null
  categories: CategoryOption[]
  brands: BrandOption[]
  units: UnitOption[]
  onClose: () => void
  onSaved: (product: ProductResponse) => void
}

const inputClassName =
  'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500'

function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-600 ml-0.5">*</span>}
      </span>
      {children}
      {hint && !error && <span className="block text-[11px] text-slate-500">{hint}</span>}
      {error && <span className="block text-xs text-rose-600">{error}</span>}
    </label>
  )
}

const EMPTY = {
  sku: '',
  name: '',
  categoryId: '',
  brandId: '',
  description: '',
  usageInstructions: '',
  requiresLotTracking: true,
  requiresExpiryDate: true,
  addToStore: true,
}

/** Create a product (with its packagings and picture) or edit its details and picture. Packagings of an existing product are shown, not edited. */
export default function ProductFormModal({ open, product, categories, brands, units, onClose, onSaved }: ProductFormModalProps) {
  const { showToast } = useToast()
  const isCreate = product === null
  const [v, setV] = useState(EMPTY)
  const [rows, setRows] = useState<PackagingDraft[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [tableError, setTableError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  // Storage keys uploaded in this dialog and still in use: deleted when replaced, removed or when the dialog is dismissed.
  const uploaded = useRef<string[]>([])

  useEffect(() => {
    if (!open) return
    uploaded.current = []
    setErrors({})
    setRowErrors({})
    setTableError(undefined)
    setSaving(false)
    setImageUrl(product?.imageUrl ?? null)
    setRows(product ? [] : [firstPackagingRow()])
    setV(
      product
        ? {
          ...EMPTY,
          sku: product.sku,
          name: product.name,
          categoryId: product.categoryId,
          brandId: product.brandId ?? '',
          description: product.description ?? '',
          usageInstructions: product.usageInstructions ?? '',
          requiresLotTracking: product.requiresLotTracking,
          requiresExpiryDate: product.requiresExpiryDate,
        }
        : EMPTY,
    )
  }, [open, product])

  const set = (key: keyof typeof EMPTY, value: string | boolean) => setV((prev) => ({ ...prev, [key]: value }))

  const discard = (key: string) => {
    uploaded.current = uploaded.current.filter((k) => k !== key)
    void productsApi.deleteImage(key).catch(() => undefined) // a leftover file is harmless
  }

  const onUploaded = (image: UploadedImage) => {
    const current = storageKeyFromUrl(imageUrl)
    if (current && uploaded.current.includes(current)) discard(current) // the previous upload of this dialog was replaced
    uploaded.current.push(image.storageKey)
    setImageUrl(image.url)
  }

  const onRemoveImage = () => {
    const current = storageKeyFromUrl(imageUrl)
    if (current && uploaded.current.includes(current)) discard(current)
    setImageUrl(null)
  }

  const dismiss = () => {
    if (saving) return
    uploaded.current.slice().forEach(discard)
    onClose()
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (isCreate) {
      if (!v.sku.trim()) e.sku = 'Nhập mã SKU.'
      else if (v.sku.trim().length > 50) e.sku = 'SKU tối đa 50 ký tự.'
    }
    if (!v.name.trim()) e.name = 'Nhập tên sản phẩm.'
    else if (v.name.trim().length > 255) e.name = 'Tên tối đa 255 ký tự.'
    if (!v.categoryId) e.categoryId = 'Chọn danh mục.'
    let packagingsOk = true
    if (isCreate) {
      const p = validatePackagings(rows)
      setRowErrors(p.rows)
      setTableError(p.table)
      packagingsOk = Object.keys(p.rows).length === 0 && !p.table
      if (v.addToStore && !rows.some((r) => r.isSaleUnit)) e.addToStore = 'Muốn bán ngay thì cần ít nhất một quy cách dùng để bán.'
    }
    setErrors(e)
    return Object.keys(e).length === 0 && packagingsOk
  }

  const submit = async () => {
    if (saving || !validate()) return
    setSaving(true)
    try {
      const common = {
        name: v.name.trim(),
        categoryId: v.categoryId,
        brandId: v.brandId || null,
        description: v.description.trim() || null,
        usageInstructions: v.usageInstructions.trim() || null,
        imageUrl,
      }
      let saved: ProductResponse
      if (isCreate) {
        saved = await productsApi.create({
          ...common,
          sku: v.sku.trim(),
          packagings: toPackagingInputs(rows),
          requiresLotTracking: v.requiresLotTracking || v.requiresExpiryDate,
          requiresExpiryDate: v.requiresExpiryDate,
        })
        let warning = ''
        if (v.addToStore) {
          try {
            const storeProduct = await productsApi.addToStore(saved.id)
            await productsApi.setSellable(storeProduct.id, true)
          } catch (err) {
            warning = describeError(err, 'không rõ lý do')
          }
        }
        showToast(warning ? `Đã tạo ${saved.name}, nhưng chưa đưa vào bán được: ${warning}` : `Đã tạo sản phẩm ${saved.name}`, warning ? 'warning' : 'success')
      } else {
        saved = await productsApi.update(product.id, common)
        showToast('Đã lưu sản phẩm', 'success')
      }
      // The picture the product had before is ours to delete only when it was an upload and has been replaced or removed.
      const before = storageKeyFromUrl(product?.imageUrl)
      if (before && product?.imageUrl !== imageUrl) void productsApi.deleteImage(before).catch(() => undefined)
      uploaded.current = []
      onSaved(saved)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors((prev) => ({ ...prev, sku: 'SKU này đã được dùng.' }))
      showToast(describeError(err, 'Không lưu được sản phẩm'), 'error')
      setSaving(false)
    }
  }

  // An inactive category or brand the product already has must stay selectable.
  const categoryOptions =
    product && !categories.some((c) => c.id === product.categoryId) ? [{ id: product.categoryId, name: product.categoryName }, ...categories] : categories
  const brandOptions = product?.brandId && !brands.some((b) => b.id === product.brandId) ? [{ id: product.brandId, name: product.brandName ?? '' }, ...brands] : brands

  return (
    <Modal open={open} onClose={dismiss} title={isCreate ? 'Thêm sản phẩm' : `Sửa sản phẩm: ${product.name}`} widthClassName="max-w-3xl">
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <ModalLayout footer={<div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium" onClick={dismiss}>
            Hủy
          </button>
          <PermissionAction codes={[product ? 'PRODUCTS.UPDATE' : 'PRODUCTS.CREATE']}><button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
            {saving ? 'Đang lưu...' : isCreate ? 'Tạo sản phẩm' : 'Lưu thay đổi'}
          </button></PermissionAction>
        </div>} bodyClassName="space-y-5"><section className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Ảnh sản phẩm</h4>
            <ImageUploader url={imageUrl} onUploaded={onUploaded} onRemove={onRemoveImage} disabled={saving} />
          </section><section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Mã SKU" required={isCreate} error={errors.sku} hint={isCreate ? 'Không đổi được sau khi tạo.' : undefined}>
              <input className={inputClassName} value={v.sku} disabled={!isCreate} maxLength={50} onChange={(e) => set('sku', e.target.value)} placeholder="VD: NPK-16-16-8" />
            </Field>
            <Field label="Tên sản phẩm" required error={errors.name}>
              <input className={inputClassName} value={v.name} maxLength={255} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Danh mục" required error={errors.categoryId}>
              <select className={inputClassName} value={v.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">Chọn danh mục</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Thương hiệu">
              <select className={inputClassName} value={v.brandId} onChange={(e) => set('brandId', e.target.value)}>
                <option value="">Không có</option>
                {brandOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </section><section className="grid grid-cols-1 gap-3">
            <Field label="Mô tả">
              <textarea className={`${inputClassName} h-auto py-2`} rows={3} value={v.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label="Hướng dẫn sử dụng">
              <textarea className={`${inputClassName} h-auto py-2`} rows={3} value={v.usageInstructions} onChange={(e) => set('usageInstructions', e.target.value)} />
            </Field>
          </section>{isCreate ? (
            <>
              <section className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Quy cách</h4>
                <PackagingEditor rows={rows} units={units.filter((u) => u.isActive)} rowErrors={rowErrors} tableError={tableError} onChange={setRows} />
              </section>

              <section className="space-y-2 rounded-lg border border-slate-200 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <input type="checkbox" className="accent-emerald-600 w-4 h-4" checked={v.requiresExpiryDate} onChange={(e) => set('requiresExpiryDate', e.target.checked)} />
                  Có hạn sử dụng (nhập hàng phải ghi hạn dùng)
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <input
                    type="checkbox"
                    className="accent-emerald-600 w-4 h-4"
                    checked={v.requiresLotTracking || v.requiresExpiryDate}
                    disabled={v.requiresExpiryDate}
                    onChange={(e) => set('requiresLotTracking', e.target.checked)}
                  />
                  Quản lý theo lô {v.requiresExpiryDate && <span className="text-[11px] font-normal text-slate-500">(bắt buộc khi có hạn sử dụng)</span>}
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <input type="checkbox" className="accent-emerald-600 w-4 h-4" checked={v.addToStore} onChange={(e) => set('addToStore', e.target.checked)} />
                  Đưa vào bán tại cửa hàng ngay
                </label>
                {errors.addToStore && <p className="text-xs text-rose-600">{errors.addToStore}</p>}
                <p className="text-[11px] text-slate-500">Hai tùy chọn đầu không đổi được sau khi tạo. Sản phẩm bán được cần có giá trong bảng giá và có hàng trong kho.</p>
              </section>
            </>
          ) : (
            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Quy cách (chỉ xem)</h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Đơn vị</th>
                      <th className="px-3 py-2 font-medium">Tên quy cách</th>
                      <th className="px-3 py-2 font-medium text-right">Quy đổi</th>
                      <th className="px-3 py-2 font-medium">Vai trò</th>
                      <th className="px-3 py-2 font-medium">Mã vạch</th>
                      <th className="px-3 py-2 font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {product.packagings.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2">{p.unitName}</td>
                        <td className="px-3 py-2 text-slate-600">{p.packagingName ?? '--'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.conversionToBase}</td>
                        <td className="px-3 py-2 text-slate-600">{[p.isBaseUnit && 'Cơ sở', p.isPurchaseUnit && 'Mua', p.isSaleUnit && 'Bán'].filter(Boolean).join(', ') || '--'}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{p.barcode ?? '--'}</td>
                        <td className="px-3 py-2 text-slate-600">{p.status === 'ACTIVE' ? 'Đang dùng' : 'Tạm ngưng'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500">
                SKU, quản lý theo lô ({product.requiresLotTracking ? 'có' : 'không'}) và hạn sử dụng ({product.requiresExpiryDate ? 'có' : 'không'}) không đổi được sau khi tạo.
              </p>
            </section>
          )}
        </ModalLayout>
      </form>
    </Modal>
  )
}
