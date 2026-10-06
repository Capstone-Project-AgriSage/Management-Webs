import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { ordersApi } from '@/api/ordersApi'
import { inventoryApi } from '@/api/inventoryApi'
import type { InventoryLot, OrderItemResponse, OrderResponse } from '@/api/types'
import { describeApiError, rowErrors } from '@/utils/apiError'
import { formatDay } from '@/utils/creditLabels'

interface PickupModalProps {
  order: OrderResponse | null
  onClose: () => void
  /** The order after the hand-over (PARTIALLY_FULFILLED or COMPLETED). */
  onDone: (order: OrderResponse) => void
}

interface LotRow {
  inventoryLotId: string
  lotNumber: string | null
  expiryDate: string | null
  /** Base units this order may take from the lot (held for it, or free stock for a lot added by hand). */
  available: number
  quantity: string
}

interface Line {
  item: OrderItemResponse
  rows: LotRow[]
  /** Other lots of the product with free stock, loaded on demand. */
  otherLots: InventoryLot[] | null
}

const input = 'h-8 px-2 rounded-md border border-slate-200 text-sm text-right tabular-nums focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
const qty = (r: LotRow) => Number(r.quantity || 0)
const packs = (base: number, item: OrderItemResponse) => (item.conversionToBase > 1 ? ` (= ${base / item.conversionToBase} ${(item.packagingName ?? 'quy cách').toLowerCase()})` : '')

/** Client checks of a line (FE_GUIDE_FLOW_1 §M6): the server checks again and answers per line with a 422. */
function lineProblem(line: Line): string | null {
  const total = line.rows.reduce((s, r) => s + qty(r), 0)
  const over = line.rows.find((r) => qty(r) > r.available)
  if (over) return `Lô ${over.lotNumber ?? 'không số'} chỉ còn ${over.available} đơn vị cơ sở cho đơn này.`
  if (total > line.item.remainingBaseQuantity) return `Tổng ${total} vượt số còn phải giao (${line.item.remainingBaseQuantity}).`
  if (total % line.item.conversionToBase !== 0) return `Tổng phải là bội số của ${line.item.conversionToBase} (nguyên ${(line.item.packagingName ?? 'quy cách').toLowerCase()}).`
  return null
}

/**
 * Counter hand-over (FE_GUIDE_FLOW_1 §M6): the lots held at confirmation are pre-filled (FEFO); staff may change the
 * quantities, take another lot with free stock, or hand over only part of the order (the rest stays to deliver later
 * or to cancel). Stock leaves the warehouse here.
 */
export default function PickupModal({ order, onClose, onDone }: PickupModalProps) {
  const [lines, setLines] = useState<Line[] | null>(null)
  const [note, setNote] = useState('Khách lấy tại quầy')
  const [error, setError] = useState('')
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!order) return
    let alive = true
    setLines(null)
    setError('')
    setServerErrors({})
    ordersApi
      .getFefoSuggestions(order.id)
      .then((s) => {
        if (!alive) return
        setLines(
          order.items
            .filter((i) => i.remainingBaseQuantity > 0)
            .map((item) => ({
              item,
              otherLots: null,
              rows: (s.items.find((x) => x.orderItemId === item.id)?.lots ?? []).map((l) => ({
                inventoryLotId: l.inventoryLotId,
                lotNumber: l.lotNumber,
                expiryDate: l.expiryDate,
                available: l.availableBaseQuantity,
                quantity: String(l.suggestedBaseQuantity),
              })),
            })),
        )
      })
      .catch((err) => alive && setError(describeApiError(err, 'Không tải được lô hàng cần giao')))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id])

  if (!order) return null

  const update = (idx: number, patch: (l: Line) => Line) => setLines((prev) => prev && prev.map((l, i) => (i === idx ? patch(l) : l)))

  const loadOtherLots = async (idx: number) => {
    const line = lines![idx]
    try {
      const res = await inventoryApi.getLots({ storeProductId: line.item.storeProductId, hasStock: true, pageSize: 50 })
      update(idx, (l) => ({ ...l, otherLots: res.items.filter((x) => x.status === 'ACTIVE' && !x.isExpired && x.quantityAvailable > 0) }))
    } catch (err) {
      setError(describeApiError(err, 'Không tải được danh sách lô'))
    }
  }

  const problems = (lines ?? []).map(lineProblem)
  const sending = (lines ?? []).filter((l) => l.rows.some((r) => qty(r) > 0))
  const canSubmit = !saving && sending.length > 0 && problems.every((p) => p === null)

  const submit = async () => {
    if (!lines || !canSubmit) return
    const items = sending.map((l) => ({
      orderItemId: l.item.id,
      lots: l.rows.filter((r) => qty(r) > 0).map((r) => ({ inventoryLotId: r.inventoryLotId, baseQuantity: qty(r) })),
    }))
    setSaving(true)
    setError('')
    setServerErrors({})
    try {
      onDone(await ordersApi.pickup(order.id, { items, note: note.trim() || null }))
    } catch (err) {
      // errors["items[i]"] points at the i-th line of the request.
      const byIndex = rowErrors(err)
      setServerErrors(Object.fromEntries(Object.entries(byIndex).map(([i, m]) => [items[Number(i)].orderItemId, m])))
      setError(Object.keys(byIndex).length ? 'Có dòng không giao được — xem các dòng tô đỏ. Không có gì được xuất kho.' : describeApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Giao hàng tại quầy · ${order.orderNumber}`} widthClassName="max-w-3xl">
      <div className="space-y-4 text-sm">
        <p className="p-3 rounded-lg bg-indigo-50 text-indigo-900">
          Lô đang giữ cho đơn được điền sẵn (hết hạn trước xuất trước). Sửa số lượng nếu lấy thực tế khác; có thể giao một phần — phần còn lại giao sau hoặc huỷ.
          Số lượng theo <strong>đơn vị cơ sở</strong>.
        </p>
        {error && (
          <p className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700" role="alert">
            {error}
          </p>
        )}
        {!lines ? (
          !error && <p className="py-8 text-center text-slate-500">Đang tải lô hàng...</p>
        ) : (
          lines.map((line, idx) => {
            const total = line.rows.reduce((s, r) => s + qty(r), 0)
            const problem = problems[idx] ?? serverErrors[line.item.id]
            const used = new Set(line.rows.map((r) => r.inventoryLotId))
            return (
              <section key={line.item.id} aria-label={`Giao ${line.item.productName}`} className={`rounded-xl border p-3.5 ${problem ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'}`}>
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{line.item.productName}</div>
                    <div className="text-xs text-slate-500">
                      {line.item.packagingName ?? 'Đơn vị cơ sở'} · còn phải giao {line.item.remainingBaseQuantity}
                      {packs(line.item.remainingBaseQuantity, line.item)}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button type="button" className="px-2 h-7 rounded-md border border-slate-200 hover:bg-slate-50" onClick={() => update(idx, (l) => ({ ...l, rows: l.rows.map((r) => ({ ...r, quantity: '0' })) }))}>
                      Không giao dòng này
                    </button>
                  </div>
                </div>

                <table className="w-full mt-2.5">
                  <thead className="text-[11px] text-slate-500">
                    <tr>
                      <th className="py-1 text-left font-medium">Lô</th>
                      <th className="py-1 text-left font-medium">Hạn dùng</th>
                      <th className="py-1 text-right font-medium">Có thể lấy</th>
                      <th className="py-1 text-right font-medium w-28">Xuất</th>
                      <th className="w-8"><span className="sr-only">Bỏ lô</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {line.rows.map((r, ri) => (
                      <tr key={r.inventoryLotId}>
                        <td className="py-1 font-mono text-xs">{r.lotNumber ?? 'Không số'}</td>
                        <td className="py-1 text-xs">{r.expiryDate ? formatDay(r.expiryDate.slice(0, 10)) : 'Không hạn'}</td>
                        <td className="py-1 text-right text-xs tabular-nums">{r.available}</td>
                        <td className="py-1 text-right">
                          <input
                            aria-label={`Số lượng xuất lô ${r.lotNumber ?? ''} ${line.item.productName}`}
                            inputMode="numeric"
                            className={`${input} w-24`}
                            value={r.quantity}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^\d]/g, '')
                              update(idx, (l) => ({ ...l, rows: l.rows.map((x, k) => (k === ri ? { ...x, quantity: v } : x)) }))
                            }}
                          />
                        </td>
                        <td className="py-1 text-right">
                          <button type="button" aria-label="Bỏ lô" className="p-1 rounded text-slate-400 hover:text-rose-600" onClick={() => update(idx, (l) => ({ ...l, rows: l.rows.filter((_x, k) => k !== ri) }))}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  {line.otherLots === null ? (
                    <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline" onClick={() => loadOtherLots(idx)}>
                      <Plus size={13} /> Lấy từ lô khác
                    </button>
                  ) : (
                    <select
                      aria-label={`Thêm lô cho ${line.item.productName}`}
                      className="h-8 px-2 rounded-md border border-slate-200 text-xs"
                      value=""
                      onChange={(e) => {
                        const lot = line.otherLots!.find((x) => x.id === e.target.value)
                        if (lot) update(idx, (l) => ({ ...l, rows: [...l.rows, { inventoryLotId: lot.id, lotNumber: lot.lotNumber, expiryDate: lot.expiryDate, available: lot.quantityAvailable, quantity: '0' }] }))
                      }}
                    >
                      <option value="">Chọn lô còn hàng...</option>
                      {line.otherLots.filter((x) => !used.has(x.id)).map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.lotNumber ?? 'Không số'} · HSD {x.expiryDate ? formatDay(x.expiryDate.slice(0, 10)) : '--'} · còn {x.quantityAvailable}
                        </option>
                      ))}
                    </select>
                  )}
                  <span className={`text-xs font-semibold tabular-nums ${problem ? 'text-rose-700' : 'text-slate-700'}`}>
                    Xuất {total}
                    {total > 0 && total % line.item.conversionToBase === 0 ? packs(total, line.item) : ''} / {line.item.remainingBaseQuantity}
                  </span>
                </div>
                {problem && <p className="mt-1.5 text-xs font-medium text-rose-700">{problem}</p>}
              </section>
            )
          })
        )}

        <div>
          <label htmlFor="pickup-note" className="block text-xs font-semibold text-slate-600 mb-1">
            Ghi chú phiếu xuất
          </label>
          <input id="pickup-note" maxLength={1000} className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-slate-500">{lines ? `${sending.length}/${lines.length} dòng sẽ giao` : ''}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Huỷ
            </button>
            <button type="button" disabled={!canSubmit} onClick={submit} className="h-10 px-5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2">
              {saving && <Loader2 size={15} className="animate-spin" />} Xác nhận giao & trừ kho
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
