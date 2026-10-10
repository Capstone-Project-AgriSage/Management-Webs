import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { ordersApi, type FefoSuggestionResponse } from '@/api/ordersApi'
import type { OrderResponse } from '@/api/types'
import { describeApiError, rowErrors } from '@/utils/apiError'
import { formatDay } from '@/utils/creditLabels'
import { creditRefusal } from '@/features/sales/counter-sales/orderDraft'

interface ConfirmOrderModalProps {
  order: OrderResponse | null
  onClose: () => void
  onConfirmed: (order: OrderResponse) => void
}

/**
 * FE_GUIDE_FLOW_1 §M5: before confirming, staff see the lots that will be held (FEFO). A shortage blocks the confirm;
 * the server holds the stock (and, for a credit order, the customer's credit) only when it answers 200.
 */
export default function ConfirmOrderModal({ order, onClose, onConfirmed }: ConfirmOrderModalProps) {
  const [fefo, setFefo] = useState<FefoSuggestionResponse | null>(null)
  const [error, setError] = useState('')
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!order) return
    let alive = true
    setFefo(null)
    setError('')
    setLineErrors({})
    ordersApi
      .getFefoSuggestions(order.id)
      .then((f) => alive && setFefo(f))
      .catch((err) => alive && setError(describeApiError(err, 'Không lấy được lô hàng gợi ý')))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id])

  if (!order) return null
  const shortage = fefo?.items.some((i) => i.shortageBaseQuantity > 0) ?? false

  const confirm = async () => {
    setBusy(true)
    setError('')
    setLineErrors({})
    try {
      onConfirmed(await ordersApi.confirm(order.id))
    } catch (err) {
      // errors["items[i]"] refers to the i-th line of the order (e.g. a product that can no longer be sold).
      setLineErrors(rowErrors(err))
      setError(creditRefusal(err) ?? describeApiError(err, 'Không xác nhận được đơn'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Xác nhận đơn và giữ hàng · ${order.orderNumber}`} widthClassName="max-w-2xl">
      <ModalLayout footer={<div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100">
          Huỷ
        </button>
        <PermissionAction codes={["ORDERS.CONFIRM"]}><button type="button" disabled={busy || !fefo || shortage} onClick={confirm} className="h-10 px-5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2">
          {busy && <Loader2 size={15} className="animate-spin" />} Xác nhận và giữ hàng
        </button></PermissionAction>
      </div>} bodyClassName="space-y-4"><p className="p-3 rounded-lg bg-emerald-50 text-emerald-900">
          Hàng được giữ theo lô hết hạn trước (FEFO) — chưa xuất kho; lô thực tế chọn khi giao.
          {order.settlementType === 'CREDIT' && ' Đơn mua chịu: xác nhận sẽ giữ hạn mức của khách.'}
        </p>{error && (
          <p className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700" role="alert">
            {error}
          </p>
        )}{!fefo ? (
          !error && <p className="py-8 text-center text-slate-500">Đang tính lô hàng gợi ý...</p>
        ) : (
          order.items.map((item, idx) => {
            const s = fefo.items.find((x) => x.orderItemId === item.id)
            const short = (s?.shortageBaseQuantity ?? 0) > 0
            const lineError = lineErrors[idx]
            return (
              <section key={item.id} aria-label={`Giữ hàng ${item.productName}`} className={`rounded-xl border p-3.5 ${short || lineError ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'}`}>
                <div className="flex justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{item.productName}</div>
                    <div className="text-xs text-slate-500">
                      {item.packagingName ?? 'Đơn vị cơ sở'} × {item.quantity} = {item.baseQuantity} đơn vị cơ sở
                    </div>
                  </div>
                  {short && <span className="h-fit px-2 py-1 rounded-md bg-rose-100 text-rose-700 text-xs font-bold">Thiếu {s!.shortageBaseQuantity}</span>}
                </div>
                {s && s.lots.length > 0 ? (
                  <table className="w-full mt-2 text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="py-1 text-left font-medium">Lô</th>
                        <th className="py-1 text-left font-medium">Hạn dùng</th>
                        <th className="py-1 text-right font-medium">Khả dụng</th>
                        <th className="py-1 text-right font-medium">Sẽ giữ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.lots.map((l) => (
                        <tr key={l.inventoryLotId}>
                          <td className="py-1 font-mono">{l.lotNumber ?? 'Không số'}</td>
                          <td className="py-1">{l.expiryDate ? formatDay(l.expiryDate.slice(0, 10)) : 'Không hạn'}</td>
                          <td className="py-1 text-right tabular-nums">{l.availableBaseQuantity}</td>
                          <td className="py-1 text-right font-semibold text-emerald-700 tabular-nums">{l.suggestedBaseQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="mt-2 text-xs text-rose-700">Không còn lô nào có hàng cho sản phẩm này.</p>
                )}
                {lineError && <p className="mt-1.5 text-xs font-medium text-rose-700">{lineError}</p>}
              </section>
            )
          })
        )}{shortage && <p className="text-xs font-medium text-rose-700">Thiếu hàng: nhập thêm hàng, giảm số lượng hoặc xoá dòng (sửa đơn) rồi xác nhận lại.</p>}
      </ModalLayout>
    </Modal>
  )
}
