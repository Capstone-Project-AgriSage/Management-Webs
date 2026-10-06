import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import SearchInput from '@/components/ui/SearchInput'
import ServerPagination from '@/components/ui/ServerPagination'
import { useToast } from '@/context/ToastContext'
import { priceListsApi, type PriceList, type PriceListItem, type PriceListItemInput } from '@/api/priceListsApi'
import { catalogApi, type ProductPackagingRef, type StoreProductRef } from '@/api/catalogApi'
import type { Paged } from '@/api/types'
import { describeApiError, rowErrors } from '@/utils/apiError'
import { formatVnd } from '@/utils/money'
import { packagingLabel } from '@/utils/packaging'

const PAGE_SIZE = 50

interface NewRow {
  storeProductId: string
  productName: string
  sku: string
  packaging: ProductPackagingRef
  price: string
}

interface PriceListItemsModalProps {
  list: PriceList | null
  canEdit: boolean
  onClose: () => void
  /** Item counts on the list page change after a save or a delete. */
  onChanged: () => void
}

const priceInput = 'w-36 h-9 px-3 rounded-lg border border-slate-200 text-sm text-right tabular-nums focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'

const toPrice = (text: string) => Number(text.replace(/[^\d]/g, ''))

/** Prices of one list (FE_GUIDE_FLOW_1 §M12): owners edit them in place and add products; everyone else reads. */
export default function PriceListItemsModal({ list, canEdit, onClose, onChanged }: PriceListItemsModalProps) {
  const { showToast } = useToast()
  const [data, setData] = useState<Paged<PriceListItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Edited prices of existing rows (item id → text) and rows being added.
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [newRows, setNewRows] = useState<NewRow[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = async (listId: string) => {
    setLoading(true)
    try {
      setData(await priceListsApi.getItems(listId, { search: debouncedSearch || undefined, page, pageSize: PAGE_SIZE }))
    } catch (err) {
      showToast(describeApiError(err, 'Không tải được giá của bảng giá'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (list) load(list.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list?.id, page, debouncedSearch])

  const close = () => {
    const pending = Object.keys(edits).length + newRows.length
    if (pending > 0 && !window.confirm(`Còn ${pending} giá chưa lưu. Đóng và bỏ thay đổi?`)) return
    setEdits({})
    setNewRows([])
    setErrors({})
    setSearch('')
    setPage(1)
    setData(null)
    onClose()
  }

  const addProduct = async (product: StoreProductRef) => {
    try {
      const packagings = (await catalogApi.getProductPackagings(product.productId)).filter((p) => p.isSaleUnit && p.status === 'ACTIVE')
      if (packagings.length === 0) {
        showToast('Sản phẩm chưa có quy cách bán nào đang hoạt động', 'warning')
        return
      }
      setNewRows((rows) => [
        ...rows,
        ...packagings
          .filter((p) => !rows.some((r) => r.packaging.id === p.id))
          .map((p) => ({ storeProductId: product.id, productName: product.name, sku: product.sku, packaging: p, price: '' })),
      ])
    } catch (err) {
      showToast(describeApiError(err, 'Không tải được quy cách của sản phẩm'), 'error')
    }
  }

  const save = async () => {
    if (!list || !data) return
    const changed = data.items.filter((i) => edits[i.id] !== undefined && toPrice(edits[i.id]) !== i.sellingPrice)
    const added = newRows.filter((r) => r.price.trim() !== '')
    // The request rows, with the key of the screen row each one came from (to show a 422 on the right row).
    const rows: { key: string; input: PriceListItemInput }[] = [
      ...changed.map((i) => ({ key: i.id, input: { storeProductId: i.storeProductId, productPackagingId: i.productPackagingId, sellingPrice: toPrice(edits[i.id]) } })),
      ...added.map((r) => ({ key: r.packaging.id, input: { storeProductId: r.storeProductId, productPackagingId: r.packaging.id, sellingPrice: toPrice(r.price) } })),
    ]
    if (rows.length === 0) {
      showToast('Chưa có giá nào thay đổi', 'info')
      return
    }
    const invalid = rows.filter((r) => !(r.input.sellingPrice > 0))
    if (invalid.length > 0) {
      setErrors(Object.fromEntries(invalid.map((r) => [r.key, 'Giá phải lớn hơn 0'])))
      return
    }
    if (rows.length > 500) {
      showToast('Mỗi lần lưu tối đa 500 giá', 'error')
      return
    }
    setSaving(true)
    setErrors({})
    try {
      const res = await priceListsApi.updateItems(list.id, rows.map((r) => r.input))
      showToast(`Đã lưu: ${res.created} giá mới, ${res.updated} giá cập nhật`, 'success')
      setEdits({})
      setNewRows([])
      await load(list.id)
      onChanged()
    } catch (err) {
      const byRow = rowErrors(err)
      if (Object.keys(byRow).length > 0) {
        setErrors(Object.fromEntries(Object.entries(byRow).map(([i, msg]) => [rows[Number(i)].key, msg])))
        showToast('Có giá không hợp lệ, không giá nào được lưu. Xem các dòng tô đỏ.', 'error')
      } else {
        showToast(describeApiError(err), 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const removeItem = async (item: PriceListItem) => {
    if (!list || !window.confirm(`Xóa giá của ${item.productName} (${item.packagingName ?? 'đơn vị cơ sở'})? Quy cách này sẽ không bán được theo bảng giá này.`)) return
    try {
      await priceListsApi.deleteItem(list.id, item.id)
      showToast('Đã xóa giá', 'success')
      await load(list.id)
      onChanged()
    } catch (err) {
      showToast(describeApiError(err), 'error')
    }
  }

  const pendingCount = Object.keys(edits).length + newRows.filter((r) => r.price.trim()).length
  const items = data?.items ?? []

  return (
    <Modal open={list !== null} onClose={close} title={list ? `${list.name} · ${list.code}` : ''} widthClassName="max-w-4xl">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Tìm sản phẩm trong bảng giá..." className="relative flex-1" />
          {canEdit && <StoreProductPicker onPick={addProduct} />}
        </div>

        {newRows.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40">
            <div className="px-4 py-2 text-xs font-semibold text-emerald-900 border-b border-emerald-200">Giá mới chưa lưu (bỏ trống ô giá để không thêm)</div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-emerald-100">
                {newRows.map((r) => (
                  <tr key={r.packaging.id}>
                    <td className="py-2 px-4">
                      <div className="font-medium text-slate-900">{r.productName}</div>
                      <div className="text-xs text-slate-500">{packagingLabel(r.packaging)}{r.packaging.conversionToBase > 1 ? ` · ${r.packaging.conversionToBase} đơn vị cơ sở` : ''}</div>
                      {errors[r.packaging.id] && <div className="text-xs text-rose-600 mt-0.5">{errors[r.packaging.id]}</div>}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        aria-label={`Giá ${r.productName} ${packagingLabel(r.packaging)}`}
                        inputMode="numeric"
                        className={`${priceInput} ${errors[r.packaging.id] ? 'border-rose-400' : ''}`}
                        placeholder="Giá bán (₫)"
                        value={r.price ? Number(toPrice(r.price)).toLocaleString('vi-VN') : ''}
                        onChange={(e) => setNewRows((rows) => rows.map((x) => (x.packaging.id === r.packaging.id ? { ...x, price: e.target.value } : x)))}
                      />
                    </td>
                    <td className="py-2 pr-3 w-10">
                      <button type="button" aria-label="Bỏ dòng" className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-white" onClick={() => setNewRows((rows) => rows.filter((x) => x.packaging.id !== r.packaging.id))}>
                        <X size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[13px] font-bold text-slate-900">
              <tr>
                <th className="py-2.5 px-4 text-left" scope="col">Sản phẩm · Quy cách</th>
                <th className="py-2.5 px-2 text-right" scope="col">Giá bán</th>
                {canEdit && <th className="w-10" scope="col"><span className="sr-only">Xóa</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && !data ? (
                <tr><td colSpan={3} className="py-10 text-center text-slate-500">Đang tải giá...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={3} className="py-10 text-center text-slate-500">{debouncedSearch ? 'Không có sản phẩm khớp.' : 'Bảng giá chưa có giá nào.'}</td></tr>
              ) : (
                items.map((item) => {
                  const edited = edits[item.id]
                  return (
                    <tr key={item.id} className={edited !== undefined ? 'bg-amber-50/50' : ''}>
                      <td className="py-2 px-4">
                        <div className="font-medium text-slate-900">{item.productName}</div>
                        <div className="text-xs text-slate-500">{item.packagingName ?? 'Đơn vị cơ sở'}{item.sku ? ` · ${item.sku}` : ''}</div>
                        {errors[item.id] && <div className="text-xs text-rose-600 mt-0.5">{errors[item.id]}</div>}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {canEdit ? (
                          <input
                            aria-label={`Giá ${item.productName} ${item.packagingName ?? ''}`}
                            inputMode="numeric"
                            className={`${priceInput} ${errors[item.id] ? 'border-rose-400' : ''}`}
                            value={Number(edited !== undefined ? toPrice(edited) : item.sellingPrice).toLocaleString('vi-VN')}
                            onChange={(e) =>
                              setEdits((prev) => {
                                const next = { ...prev }
                                if (toPrice(e.target.value) === item.sellingPrice) delete next[item.id]
                                else next[item.id] = e.target.value
                                return next
                              })
                            }
                          />
                        ) : (
                          <span className="font-semibold tabular-nums">{formatVnd(item.sellingPrice)}</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="py-2 pr-3">
                          <button type="button" aria-label="Xóa giá" className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50" onClick={() => removeItem(item)}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          {data && data.totalPages > 1 && (
            <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={data.totalCount} totalPages={data.totalPages} unitLabel="giá" onPageChange={setPage} />
          )}
        </div>

        {canEdit && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500">Một giá sai thì cả lần lưu bị từ chối. Giá chỉ áp dụng cho quy cách bán đang hoạt động.</p>
            <button
              type="button"
              disabled={saving || pendingCount === 0}
              onClick={save}
              className="h-10 px-5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shrink-0"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Lưu thay đổi{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Search-as-you-type over the store's active products to add their packagings to the list. */
function StoreProductPicker({ onPick }: { onPick: (p: StoreProductRef) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [results, setResults] = useState<StoreProductRef[]>([])
  const [loading, setLoading] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    const t = setTimeout(() => {
      setLoading(true)
      catalogApi
        .getStoreProducts({ search: text.trim() || undefined, pageSize: 8 })
        .then((res) => alive && setResults(res.items))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false))
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [text, open])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div ref={box} className="relative sm:w-80">
      <div className="relative">
        <Plus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700" />
        <input
          aria-label="Thêm sản phẩm vào bảng giá"
          className="w-full h-10 pl-9 pr-9 rounded-lg border border-emerald-300 bg-white text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          placeholder="Thêm sản phẩm..."
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
        />
        {loading ? <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" /> : <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />}
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">{loading ? 'Đang tìm...' : 'Không tìm thấy sản phẩm'}</div>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-slate-50"
                onClick={() => {
                  onPick(p)
                  setOpen(false)
                  setText('')
                }}
              >
                <div className="text-sm font-medium text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500">{p.sku}{p.isSellable ? '' : ' · đang ngừng bán'}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
