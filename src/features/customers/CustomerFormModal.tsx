import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { customersApi, type CustomerAddress, type CustomerResponse } from '@/api/customersApi'
import type { CustomerGroupResponse } from '@/api/customerGroupsApi'
import type { CreditTierResponse } from '@/api/creditTiersApi'
import { useToast } from '@/context/ToastContext'
import { ApiError } from '@/api/client'
import { formatVnd } from '@/utils/money'

interface CustomerFormModalProps {
  open: boolean
  /** null = create a REGISTERED customer. */
  customer: CustomerResponse | null
  groups: CustomerGroupResponse[]
  tiers: CreditTierResponse[]
  onClose: () => void
  onSaved: (customer: CustomerResponse) => void
}

const EMPTY = {
  fullName: '',
  phoneNumber: '',
  email: '',
  password: '',
  notes: '',
  customerGroupId: '',
  recipientName: '',
  recipientPhone: '',
  addressLine: '',
  ward: '',
  district: '',
  province: '',
  allowCreditPurchase: false,
  creditTierId: '',
  creditLimit: '',
  creditChangeReason: '',
}

// Same rule as Auth: Vietnamese mobile 0[35789]xxxxxxxx (or +84).
const PHONE_RE = /^(0|\+84)(3|5|7|8|9)\d{8}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputClassName =
  'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-600 ml-0.5">*</span>}
      </span>
      {children}
      {error && <span className="block text-xs text-rose-600">{error}</span>}
    </label>
  )
}

// CUSTOMER_MANAGEMENT.md: create (REGISTERED + password) or edit. Group and credit of an existing customer
// are changed from their own tabs (they need a reason), so the edit form leaves them untouched.
export default function CustomerFormModal({ open, customer, groups, tiers, onClose, onSaved }: CustomerFormModalProps) {
  const { showToast } = useToast()
  const [v, setV] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const isCreate = customer === null

  useEffect(() => {
    if (!open) return
    setErrors({})
    setV(
      customer
        ? {
            ...EMPTY,
            fullName: customer.fullName ?? '',
            phoneNumber: customer.phoneNumber ?? '',
            email: customer.email ?? '',
            notes: customer.notes ?? '',
            recipientName: customer.address?.recipientName ?? '',
            recipientPhone: customer.address?.recipientPhone ?? '',
            addressLine: customer.address?.addressLine ?? '',
            ward: customer.address?.ward ?? '',
            district: customer.address?.district ?? '',
            province: customer.address?.province ?? '',
          }
        : EMPTY,
    )
  }, [open, customer])

  const set = (key: keyof typeof EMPTY, value: string | boolean) => setV((prev) => ({ ...prev, [key]: value }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!v.fullName.trim()) e.fullName = 'Nhập họ tên'
    if (!v.phoneNumber.trim() && !v.email.trim()) e.phoneNumber = 'Cần ít nhất số điện thoại hoặc email'
    if (v.phoneNumber.trim() && !PHONE_RE.test(v.phoneNumber.trim())) e.phoneNumber = 'Số điện thoại di động không hợp lệ'
    if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) e.email = 'Email không hợp lệ'
    if (isCreate && (v.password.length < 8 || v.password.length > 128)) e.password = 'Mật khẩu 8–128 ký tự'
    const hasAddress = [v.recipientName, v.recipientPhone, v.addressLine, v.province, v.district, v.ward].some((x) => x.trim())
    if (hasAddress && !v.addressLine.trim()) e.addressLine = 'Nhập địa chỉ'
    if (hasAddress && !v.province.trim()) e.province = 'Nhập tỉnh/thành'
    if (isCreate && v.allowCreditPurchase && v.creditLimit && Number(v.creditLimit) < 0) e.creditLimit = 'Hạn mức ≥ 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    const hasAddress = v.addressLine.trim() && v.province.trim()
    const address: CustomerAddress | null = hasAddress
      ? {
          recipientName: v.recipientName.trim() || v.fullName.trim(),
          recipientPhone: v.recipientPhone.trim() || v.phoneNumber.trim() || null,
          addressLine: v.addressLine.trim(),
          province: v.province.trim(),
          district: v.district.trim() || null,
          ward: v.ward.trim() || null,
        }
      : null
    const common = {
      fullName: v.fullName.trim(),
      phoneNumber: v.phoneNumber.trim() || null,
      email: v.email.trim() || null,
      notes: v.notes.trim() || null,
      ...(address ? { address } : {}),
    }
    setSaving(true)
    try {
      const saved = isCreate
        ? await customersApi.createCustomer({
            ...common,
            password: v.password,
            customerType: 'REGISTERED',
            customerGroupId: v.customerGroupId || null,
            ...(v.allowCreditPurchase
              ? {
                  allowCreditPurchase: true,
                  creditTierId: v.creditTierId || null,
                  creditLimit: v.creditLimit ? Number(v.creditLimit) : null,
                  creditChangeReason: v.creditChangeReason.trim() || 'Mở tín dụng khi tạo khách',
                }
              : {}),
          })
        : await customersApi.updateCustomer(customer.id, common)
      showToast(isCreate ? `Đã tạo khách hàng ${saved.fullName}` : 'Đã cập nhật khách hàng', 'success')
      onSaved(saved)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ phoneNumber: 'Số điện thoại hoặc email đã được dùng' })
      showToast(err instanceof Error ? err.message : 'Lưu khách hàng thất bại', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isCreate ? 'Thêm khách hàng' : `Sửa khách hàng — ${customer?.fullName}`} widthClassName="max-w-2xl">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
      >
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Field label="Họ tên" required error={errors.fullName}>
              <input className={inputClassName} value={v.fullName} onChange={(e) => set('fullName', e.target.value)} />
            </Field>
          </div>
          <Field label="Số điện thoại" error={errors.phoneNumber}>
            <input className={inputClassName} inputMode="tel" value={v.phoneNumber} onChange={(e) => set('phoneNumber', e.target.value)} placeholder="09xxxxxxxx" />
          </Field>
          <Field label="Email" error={errors.email}>
            <input className={inputClassName} type="email" value={v.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          {isCreate && (
            <>
              <Field label="Mật khẩu đăng nhập" required error={errors.password}>
                <input className={inputClassName} type="password" autoComplete="new-password" value={v.password} onChange={(e) => set('password', e.target.value)} />
              </Field>
              <Field label="Nhóm khách hàng">
                <select className={inputClassName} value={v.customerGroupId} onChange={(e) => set('customerGroupId', e.target.value)}>
                  <option value="">Nhóm mặc định</option>
                  {groups.filter((g) => g.isActive).map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </section>

        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Địa chỉ mặc định</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Người nhận">
              <input className={inputClassName} value={v.recipientName} onChange={(e) => set('recipientName', e.target.value)} placeholder="Mặc định: họ tên khách" />
            </Field>
            <Field label="SĐT người nhận">
              <input className={inputClassName} inputMode="tel" value={v.recipientPhone} onChange={(e) => set('recipientPhone', e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Địa chỉ (số nhà, ấp...)" error={errors.addressLine}>
                <input className={inputClassName} value={v.addressLine} onChange={(e) => set('addressLine', e.target.value)} />
              </Field>
            </div>
            <Field label="Xã/Phường">
              <input className={inputClassName} value={v.ward} onChange={(e) => set('ward', e.target.value)} />
            </Field>
            <Field label="Quận/Huyện">
              <input className={inputClassName} value={v.district} onChange={(e) => set('district', e.target.value)} />
            </Field>
            <Field label="Tỉnh/Thành" error={errors.province}>
              <input className={inputClassName} value={v.province} onChange={(e) => set('province', e.target.value)} />
            </Field>
          </div>
        </section>

        <Field label="Ghi chú">
          <textarea className={`${inputClassName} h-auto py-2`} rows={2} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        {isCreate && (
          <section className="space-y-3 rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" className="accent-emerald-600 w-4 h-4" checked={v.allowCreditPurchase} onChange={(e) => set('allowCreditPurchase', e.target.checked)} />
              Cho phép mua chịu (mở tín dụng ngay)
            </label>
            {v.allowCreditPurchase && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Hạng tín dụng">
                  <select className={inputClassName} value={v.creditTierId} onChange={(e) => set('creditTierId', e.target.value)}>
                    <option value="">Theo nhóm khách</option>
                    {tiers.filter((t) => t.isActive).map((t) => (
                      <option key={t.id} value={t.id}>{t.name} — {formatVnd(t.defaultCreditLimit)}, {t.defaultPaymentTermDays} ngày</option>
                    ))}
                  </select>
                </Field>
                <Field label="Hạn mức (đ)" error={errors.creditLimit}>
                  <input className={inputClassName} type="number" min={0} value={v.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} placeholder="Mặc định theo hạng" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Lý do">
                    <input className={inputClassName} value={v.creditChangeReason} onChange={(e) => set('creditChangeReason', e.target.value)} />
                  </Field>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
            {saving ? 'Đang lưu...' : isCreate ? 'Tạo khách hàng' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
