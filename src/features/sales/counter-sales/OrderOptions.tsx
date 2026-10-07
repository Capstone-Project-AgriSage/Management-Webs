import { formatVnd } from '@/utils/money'
import { EMPTY_ADDRESS, MAX_NOTE, creditUsable, deliveryAllowed, type OrderDraft } from './orderDraft'

interface OrderOptionsProps {
  draft: OrderDraft
  total: number
  errors: Record<string, string>
  onChange: (draft: OrderDraft) => void
}

const inputClass =
  'w-full h-9 px-3 rounded-lg border bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'

function Choice<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: { value: T; label: string; disabled?: boolean; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex flex-col gap-0.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
            o.disabled ? 'opacity-50 cursor-not-allowed border-outline-variant' : value === o.value ? 'border-primary bg-primary/5 cursor-pointer' : 'border-outline-variant hover:border-primary/50 cursor-pointer'
          }`}
        >
          <span className="flex items-center gap-2 font-semibold text-on-surface">
            <input type="radio" name={name} className="accent-emerald-600" checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} />
            {o.label}
          </span>
          {o.hint && <span className="text-[11px] text-on-surface-variant pl-5">{o.hint}</span>}
        </label>
      ))}
    </div>
  )
}

/** How the order is settled and handed over, plus the note (FE_GUIDE_FLOW_1 §M3, FLOW_2 delivery, FLOW_3 credit). */
export default function OrderOptions({ draft, total, errors, onChange }: OrderOptionsProps) {
  const set = (patch: Partial<OrderDraft>) => onChange({ ...draft, ...patch })
  const canCredit = creditUsable(draft.customer)
  const canDeliver = deliveryAllowed(draft.customer)
  const credit = draft.customer.kind === 'REGISTERED' ? draft.customer.credit : null
  const overLimit = draft.settlementType === 'CREDIT' && credit !== null && total > credit.availableCredit
  const saved = draft.customer.kind === 'REGISTERED' ? draft.customer.addresses : []
  const a = draft.address
  const setAddress = (patch: Partial<OrderDraft['address']>) => set({ address: { ...a, ...patch } })

  const creditHint =
    draft.customer.kind === 'WALK_IN'
      ? 'Chỉ khách quen'
      : !credit
        ? 'Khách chưa mở mua chịu'
        : credit.status !== 'ACTIVE'
          ? 'Tín dụng đang tạm dừng / khoá'
          : `Còn ${formatVnd(credit.availableCredit)}${credit.paymentTermDays ? ` · trả trong ${credit.paymentTermDays} ngày` : ''}`

  return (
    <section className="space-y-3" aria-label="Thanh toán và nhận hàng">
      <div className="space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Thanh toán</div>
        <Choice
          name="Hình thức thanh toán"
          value={draft.settlementType}
          onChange={(v) => set({ settlementType: v })}
          options={[
            { value: 'FULL_PAYMENT', label: 'Trả đủ', hint: 'Thu tiền trước khi xác nhận' },
            { value: 'CREDIT', label: 'Mua chịu', hint: creditHint, disabled: !canCredit },
          ]}
        />
        {errors.settlementType && <p className="text-xs text-rose-600">{errors.settlementType}</p>}
        {overLimit && <p className="text-xs font-medium text-rose-600">Tổng đơn {formatVnd(total)} vượt hạn mức còn lại — server sẽ từ chối.</p>}
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Nhận hàng</div>
        <Choice
          name="Cách nhận hàng"
          value={draft.fulfillmentType}
          onChange={(v) => {
            // Pre-fill the recipient from the buyer when switching to delivery.
            if (v === 'DELIVERY' && !a.addressId && !a.recipientName && !a.recipientPhone) {
              const c = draft.customer
              const def = c.kind === 'REGISTERED' ? c.addresses.find((x) => x.isDefault) ?? c.addresses[0] : undefined
              const recipient = c.kind === 'REGISTERED' ? { recipientName: c.customer?.fullName ?? '', recipientPhone: c.customer?.phoneNumber ?? '' } : { recipientName: c.name, recipientPhone: c.phone }
              set({ fulfillmentType: v, address: def ? { ...EMPTY_ADDRESS, addressId: def.id } : { ...EMPTY_ADDRESS, ...recipient } })
            } else set({ fulfillmentType: v })
          }}
          options={[
            { value: 'PICKUP', label: 'Tại quầy', hint: 'Khách lấy hàng ở cửa hàng' },
            {
              value: 'DELIVERY',
              label: 'Giao tận nơi',
              hint: canDeliver ? 'Lập phiếu giao sau khi xác nhận' : 'Chỉ khách quen: sang tab "Khách quen" để tạo khách mới',
              disabled: !canDeliver,
            },
          ]}
        />
        {errors.fulfillmentType && <p className="text-xs text-rose-600">{errors.fulfillmentType}</p>}
      </div>

      {draft.fulfillmentType === 'DELIVERY' && (
        <div className="space-y-2 p-3 rounded-lg bg-surface-container">
          {saved.length > 0 && (
            <select
              aria-label="Địa chỉ giao hàng đã lưu"
              className={`${inputClass} border-outline-variant`}
              value={a.addressId ?? ''}
              onChange={(e) => setAddress({ addressId: e.target.value || null })}
            >
              {saved.map((x) => (
                <option key={x.id} value={x.id}>
                  {[x.recipientName, x.addressLine, x.ward, x.district, x.province].filter(Boolean).join(', ')}
                  {x.isDefault ? ' (mặc định)' : ''}
                </option>
              ))}
              <option value="">Nhập địa chỉ khác...</option>
            </select>
          )}
          {!a.addressId && (
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['recipientName', 'Người nhận *', 'col-span-1'],
                  ['recipientPhone', 'SĐT người nhận *', 'col-span-1'],
                  ['addressLine', 'Số nhà, ấp, đường *', 'col-span-2'],
                  ['ward', 'Xã/phường', 'col-span-1'],
                  ['district', 'Huyện/quận', 'col-span-1'],
                  ['province', 'Tỉnh/thành phố *', 'col-span-2'],
                ] as const
              ).map(([key, ph, span]) => (
                <div key={key} className={span}>
                  <input aria-label={ph.replace(' *', '')} placeholder={ph} maxLength={300} className={`${inputClass} ${errors[key] ? 'border-rose-400' : 'border-outline-variant'}`} value={a[key]} onChange={(e) => setAddress({ [key]: e.target.value })} />
                  {errors[key] && <p className="text-[11px] text-rose-600 mt-0.5">{errors[key]}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <textarea
          aria-label="Ghi chú đơn hàng"
          rows={2}
          maxLength={MAX_NOTE}
          placeholder="Ghi chú (không bắt buộc), VD: Khách quay lại lấy chiều nay"
          className={`w-full px-3 py-2 rounded-lg border bg-surface-container-lowest text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.note ? 'border-rose-400' : 'border-outline-variant'}`}
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
        />
      </div>
    </section>
  )
}
