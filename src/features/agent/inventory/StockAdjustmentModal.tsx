import ModalLayout from '@/components/ui/ModalLayout'
import { useEffect, useState } from 'react'
import DetailModal from '@/components/ui/DetailModal'
import { describeError } from '@/api/client'
import { stockApi, type AdjustmentReason } from '@/api/stockApi'
import { useToast } from '@/context/ToastContext'
import { formatQty, unitLabel } from '@/utils/units'
import { ADJUSTMENT_REASONS } from './stockLabels'

export interface AdjustmentTarget {
  lotId: string
  sku: string
  productName: string
  lotNumber: string | null
  /** Unit code of the product's base unit. */
  baseUnit: string
  onHand: number
  reserved: number
  averageUnitCost: number | null
}

interface StockAdjustmentModalProps {
  target: AdjustmentTarget | null
  /** Reason pre-selected when the dialog opens (e.g. EXPIRED from an expiry alert). */
  defaultReason?: AdjustmentReason
  onClose: () => void
  onDone: () => void
}

const inputClassName =
  'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'

/**
 * Manual stock adjustment of one lot (Manage). One movement: a decrease writes goods off at the lot's average cost
 * (never below the reserved quantity), an increase adds stock at the entered cost, or the average cost when omitted.
 */
export default function StockAdjustmentModal({ target, defaultReason, onClose, onDone }: StockAdjustmentModalProps) {
  const { showToast } = useToast()
  const [direction, setDirection] = useState<'DECREASE' | 'INCREASE'>('DECREASE')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<AdjustmentReason>('DAMAGED')
  const [note, setNote] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!target) return
    const free = Math.max(target.onHand - target.reserved, 0)
    setDirection('DECREASE')
    setReason(defaultReason ?? 'DAMAGED')
    // An expiry write-off normally removes everything that is not reserved.
    setQuantity(defaultReason === 'EXPIRED' && free > 0 ? String(free) : '')
    setNote('')
    setUnitCost('')
    setBusy(false)
  }, [target, defaultReason])

  if (!target) return null

  const unit = unitLabel(target.baseUnit)
  const free = Math.max(target.onHand - target.reserved, 0)
  const qty = Number(quantity)
  const qtyValid = Number.isInteger(qty) && qty >= 1
  const costNeeded = direction === 'INCREASE' && target.onHand <= 0
  const costValue = unitCost.trim() === '' ? null : Number(unitCost)
  const costValid = costValue === null ? !costNeeded : Number.isFinite(costValue) && costValue >= 0

  let problem: string | null = null
  if (quantity !== '' && !qtyValid) problem = 'Số lượng phải là số nguyên từ 1 trở lên.'
  else if (direction === 'DECREASE' && qtyValid && qty > free) {
    problem =
      target.reserved > 0
        ? `Chỉ giảm tối đa ${formatQty(free)} ${unit}: ${formatQty(target.reserved)} ${unit} đang được giữ cho đơn hàng.`
        : `Chỉ giảm tối đa ${formatQty(free)} ${unit} (số đang tồn).`
  } else if (costNeeded && costValue === null) problem = 'Lô đang hết hàng nên cần nhập giá vốn cho số lượng tăng thêm.'
  else if (!costValid) problem = 'Giá vốn không hợp lệ.'

  const canSubmit = qtyValid && note.trim().length > 0 && problem === null && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      const movement = await stockApi.createAdjustment({
        reasonCode: reason,
        note: note.trim(),
        lines: [
          {
            inventoryLotId: target.lotId,
            quantityDeltaBase: direction === 'DECREASE' ? -qty : qty,
            unitCost: direction === 'INCREASE' ? costValue : null,
          },
        ],
      })
      showToast(`Đã ghi phiếu điều chỉnh ${movement.movementNumber}`, 'success')
      onDone()
    } catch (err) {
      showToast(describeError(err, 'Không thể điều chỉnh kho'), 'error')
      setBusy(false)
    }
  }

  return (
    <DetailModal open onClose={busy ? () => undefined : onClose} widthClassName="max-w-lg">
      <ModalLayout header={<div>
        <h3 className="text-lg text-slate-900 font-bold">Điều chỉnh kho</h3>
        <p className="text-sm text-slate-600 mt-1">
          <strong>{target.productName}</strong> <span className="font-mono text-xs text-slate-500">{target.sku}</span>
          <br />
          Lô <span className="font-mono">{target.lotNumber ?? 'không có số lô'}</span>: tồn {formatQty(target.onHand)} {unit}, đang giữ{' '}
          {formatQty(target.reserved)} {unit}.
        </p>
      </div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
          onClick={onClose}
          disabled={busy}
        >
          Hủy
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors text-sm shadow-sm disabled:opacity-50"
          onClick={submit}
          disabled={!canSubmit}
        >
          {busy ? 'Đang ghi...' : 'Ghi phiếu điều chỉnh'}
        </button>
      </div>} bodyClassName="space-y-4"><div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hướng điều chỉnh">
          {(
            [
              ['DECREASE', 'Giảm tồn (xuất hủy, hao hụt)'],
              ['INCREASE', 'Tăng tồn (sửa sai số)'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={direction === value}
              onClick={() => setDirection(value)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${direction === value
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              {label}
            </button>
          ))}
        </div><div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="adj-qty">
              Số lượng ({unit})
            </label>
            <input
              id="adj-qty"
              className={inputClassName}
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={direction === 'DECREASE' ? `Tối đa ${formatQty(free)}` : 'Ví dụ 5'}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="adj-reason">
              Lý do
            </label>
            <select id="adj-reason" className={inputClassName} value={reason} onChange={(e) => setReason(e.target.value as AdjustmentReason)}>
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>{direction === 'INCREASE' ? (
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="adj-cost">
              Giá vốn mỗi {unit} (đ){costNeeded ? '' : ' - bỏ trống để dùng giá vốn bình quân của lô'}
            </label>
            <input
              id="adj-cost"
              className={inputClassName}
              type="number"
              min={0}
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder={target.averageUnitCost !== null ? `Bình quân hiện tại: ${formatQty(Math.round(target.averageUnitCost))}` : 'Ví dụ 12000'}
            />
          </div>
        ) : null}<div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="adj-note">
            Ghi chú (bắt buộc)
          </label>
          <textarea
            id="adj-note"
            className="w-full min-h-[72px] px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: 5 bao rách vỏ, ẩm mốc, phát hiện khi kiểm hàng"
          />
        </div>{problem ? (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" role="alert">
            {problem}
          </p>
        ) : null}<p className="text-xs text-slate-500">
          Điều chỉnh tạo một phiếu kho có ghi lý do và người thực hiện, không sửa trực tiếp số tồn. Phiếu đã ghi không xóa được.
        </p>
      </ModalLayout>
    </DetailModal>
  )
}
