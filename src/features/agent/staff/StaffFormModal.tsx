import Select from '@/components/ui/Select'
import { useEffect, useId, useState } from 'react'
import { staffApi, type StaffProfileRequest, type StaffRole, type StaffResponse } from '@/api/staffApi'
import { describeError } from '@/api/client'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'

export type StaffFormMode = 'create' | 'edit' | 'view' | 'reset-password'
interface StaffFormModalProps {
  mode: StaffFormMode
  member?: StaffResponse
  roles: { value: StaffRole; label: string }[]
  onClose: () => void
  onSaved: (message: string) => void
}

const inputClass = 'w-full min-h-[42px] rounded-[10px] border border-slate-200 px-3 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary'
const titles: Record<StaffFormMode, string> = { create: 'Thêm nhân viên', edit: 'Cập nhật nhân viên', view: 'Thông tin nhân viên', 'reset-password': 'Đặt lại mật khẩu nhân viên' }
const statusLabels: Record<string, string> = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động', SUSPENDED: 'Tạm đình chỉ', LOCKED: 'Bị khóa' }
const roleLabels: Record<string, string> = { STORE_OWNER: 'Chủ cửa hàng', SALES_STAFF: 'Nhân viên bán hàng', DELIVERY_STAFF: 'Nhân viên giao hàng' }

export default function StaffFormModal({ mode, member, roles, onClose, onSaved }: StaffFormModalProps) {
  const formId = useId()
  const [profile, setProfile] = useState<StaffProfileRequest>({ fullName: '', phoneNumber: '', email: '', employeeCode: '', joinedAt: '' })
  const [role, setRole] = useState<StaffRole>(roles[0]?.value ?? 'SALES_STAFF')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [record, setRecord] = useState<StaffResponse | null>(null)
  const [loading, setLoading] = useState((mode === 'edit' || mode === 'view') && !!member)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!member || (mode !== 'edit' && mode !== 'view')) return
    const controller = new AbortController()
    staffApi.get(member.id, controller.signal).then(data => {
      if (controller.signal.aborted) return
      setRecord(data)
      setProfile({ fullName: data.fullName, phoneNumber: data.phoneNumber ?? '', email: data.email ?? '', employeeCode: data.employeeCode ?? '', joinedAt: data.joinedAt ?? '' })
    }).catch(err => { if (!controller.signal.aborted) setError(describeError(err, 'Không tải được thông tin nhân viên')) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [member, mode])

  const setField = (key: keyof StaffProfileRequest, value: string) => setProfile(previous => ({ ...previous, [key]: value }))
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || loading || mode === 'view') return
    setError('')
    if ((mode === 'create' || mode === 'edit') && !profile.phoneNumber?.trim() && !profile.email?.trim()) {
      setError('Nhập ít nhất một số điện thoại hoặc email để nhân viên đăng nhập.'); return
    }
    if ((mode === 'create' || mode === 'reset-password') && password !== confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.'); return
    }
    const body: StaffProfileRequest = { fullName: profile.fullName.trim(), phoneNumber: profile.phoneNumber?.trim() || null, email: profile.email?.trim() || null, employeeCode: profile.employeeCode?.trim() || null, joinedAt: profile.joinedAt || null }
    setSaving(true)
    try {
      if (mode === 'create') await staffApi.create({ ...body, role, password })
      else if (mode === 'edit' && member) await staffApi.update(member.id, body)
      else if (mode === 'reset-password' && member) await staffApi.resetPassword(member.id, password)
      onSaved(mode === 'create' ? 'Đã thêm nhân viên' : mode === 'edit' ? 'Đã cập nhật nhân viên' : 'Đã đặt lại mật khẩu nhân viên')
    } catch (err) { setError(describeError(err, 'Không lưu được thông tin nhân viên')) }
    finally { setSaving(false) }
  }

  return <DetailModal open onClose={onClose} busy={saving} widthClassName="max-w-2xl">
    <ModalLayout header={<h2 className="text-lg font-semibold text-slate-900">{titles[mode]}</h2>} footer={<div className="flex justify-end gap-3">
      <button type="button" onClick={onClose} disabled={saving} className="min-h-[42px] rounded-[10px] border border-slate-200 px-4 text-sm disabled:opacity-50">{mode === 'view' ? 'Đóng' : 'Hủy'}</button>
      {mode !== 'view' && <button type="submit" form={formId} disabled={saving || loading || ((mode === 'edit') && !!error && !record)} className="min-h-[42px] rounded-[10px] bg-primary-dark px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu...' : mode === 'create' ? 'Thêm nhân viên' : 'Lưu thay đổi'}</button>}
    </div>} bodyClassName="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Đang tải thông tin nhân viên...</p> : mode === 'view' && record ? <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {[['Họ và tên', record.fullName], ['Vai trò', roleLabels[record.role] ?? record.role], ['Số điện thoại', record.phoneNumber], ['Email', record.email], ['Mã nhân viên', record.employeeCode], ['Ngày vào làm', record.joinedAt], ['Trạng thái tài khoản', statusLabels[record.status] ?? record.status], ['Thành viên cửa hàng', record.memberStatus === 'LEFT' ? 'Đã nghỉ việc' : record.memberStatus === 'ACTIVE' ? 'Đang làm việc' : 'Ngừng hoạt động'], ['Ngày nghỉ việc', record.leftAt], ['Quyền duyệt AI', record.canReviewAi ? 'Được duyệt' : 'Chưa được duyệt']].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-medium break-words">{value || '—'}</dd></div>)}
      </dl> : error && !record && (mode === 'edit' || mode === 'view') ? null : <form id={formId} onSubmit={event => void submit(event)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <fieldset disabled={saving || (mode === 'edit' && !!error && !record)} className="contents">
          {mode !== 'reset-password' && <>
            <label className="space-y-1 text-sm sm:col-span-2">Họ và tên *<input className={inputClass} required maxLength={150} value={profile.fullName} onChange={event => setField('fullName', event.target.value)} /></label>
            {mode === 'create' && <label className="space-y-1 text-sm sm:col-span-2">Vai trò *<Select className={inputClass} required value={role} onChange={event => setRole(event.target.value as StaffRole)}>{roles.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>}
            <label className="space-y-1 text-sm">Số điện thoại<input className={inputClass} type="tel" autoComplete="tel" value={profile.phoneNumber ?? ''} onChange={event => setField('phoneNumber', event.target.value)} /></label>
            <label className="space-y-1 text-sm">Email<input className={inputClass} type="email" maxLength={254} autoComplete="email" value={profile.email ?? ''} onChange={event => setField('email', event.target.value)} /></label>
            <label className="space-y-1 text-sm">Mã nhân viên<input className={inputClass} maxLength={50} value={profile.employeeCode ?? ''} onChange={event => setField('employeeCode', event.target.value)} /></label>
            <label className="space-y-1 text-sm">Ngày vào làm<input className={inputClass} type="date" value={profile.joinedAt ?? ''} onChange={event => setField('joinedAt', event.target.value)} /></label>
          </>}
          {(mode === 'create' || mode === 'reset-password') && <>
            <p className="text-xs text-slate-500 sm:col-span-2">Mật khẩu có từ 8 đến 128 ký tự. Giao mật khẩu mới cho nhân viên sau khi lưu thành công.</p>
            <label className="space-y-1 text-sm">Mật khẩu mới *<input className={inputClass} type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></label>
            <label className="space-y-1 text-sm">Xác nhận mật khẩu *<input className={inputClass} type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>
          </>}
        </fieldset>
      </form>}
    </ModalLayout>
  </DetailModal>
}
