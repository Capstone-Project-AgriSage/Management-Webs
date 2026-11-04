import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BellRing, Lock } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { usePageHeader } from '@/context/PageHeaderContext'
import { usePermission } from '@/context/PermissionContext'
import { useToast } from '@/context/ToastContext'
import { ApiError } from '@/api/client'
import { debtPolicyApi, type DebtPolicy, type ReminderInitializeResult } from '@/api/debtPolicyApi'
import { describeApiError } from '@/utils/apiError'
import { formatDay } from '@/utils/creditLabels'

// FE_GUIDE_FLOW_3 §4.2: every debt rule the owner tunes in one place. Staff can read it; only the owner saves it and
// starts the reminders.

interface Values {
  defaultGraceDays: string
  remindBefore: string
  remindAfterFirst: string
  remindAfterSecond: string
  staffRolloverLimit: string
  ownerReviewAfterRollovers: string
  onTimeSeasonsForLimitRaise: string
  maxCreditTermDays: string
  maxTotalExtensionDays: string
  reason: string
}

const toValues = (p: DebtPolicy): Values => ({
  defaultGraceDays: String(p.defaultGraceDays),
  remindBefore: String(-p.reminderOffsets.n2),
  remindAfterFirst: String(p.reminderOffsets.n4),
  remindAfterSecond: String(p.reminderOffsets.n5),
  staffRolloverLimit: String(p.staffRolloverLimit),
  ownerReviewAfterRollovers: String(p.ownerReviewAfterRollovers),
  onTimeSeasonsForLimitRaise: String(p.onTimeSeasonsForLimitRaise),
  maxCreditTermDays: p.maxCreditTermDays === null ? '' : String(p.maxCreditTermDays),
  maxTotalExtensionDays: String(p.maxTotalExtensionDays),
  reason: '',
})

const whole = (text: string) => (text.trim() !== '' && Number.isInteger(Number(text)) ? Number(text) : null)

/** The server's rules (FE_GUIDE_FLOW_3 §4.2), in Vietnamese. An empty object means the form can be saved. */
function validatePolicy(v: Values): Partial<Record<keyof Values, string>> {
  const errors: Partial<Record<keyof Values, string>> = {}
  const grace = whole(v.defaultGraceDays)
  if (grace === null || grace < 0 || grace > 365) errors.defaultGraceDays = 'Số ngày nguyên từ 0 đến 365.'
  const before = whole(v.remindBefore)
  if (before === null || before < 1) errors.remindBefore = 'Ít nhất 1 ngày trước hạn.'
  const first = whole(v.remindAfterFirst)
  if (first === null || first < 1) errors.remindAfterFirst = 'Ít nhất 1 ngày sau hạn.'
  const second = whole(v.remindAfterSecond)
  if (second === null || (first !== null && second <= first)) errors.remindAfterSecond = 'Phải lớn hơn mốc nhắc lần đầu sau hạn.'
  const staff = whole(v.staffRolloverLimit)
  if (staff === null || staff < 0) errors.staffRolloverLimit = 'Số lần từ 0 trở lên.'
  const review = whole(v.ownerReviewAfterRollovers)
  if (review === null || review < Math.max(staff ?? 0, 1)) errors.ownerReviewAfterRollovers = 'Không nhỏ hơn số lần nhân viên được gia hạn và ít nhất 1.'
  const onTime = whole(v.onTimeSeasonsForLimitRaise)
  if (onTime === null || onTime < 1) errors.onTimeSeasonsForLimitRaise = 'Ít nhất 1 vụ.'
  if (v.maxCreditTermDays.trim() !== '') {
    const cap = whole(v.maxCreditTermDays)
    if (cap === null || cap < 1) errors.maxCreditTermDays = 'Để trống nếu không giới hạn, hoặc ít nhất 1 ngày.'
  }
  const total = whole(v.maxTotalExtensionDays)
  if (total === null || total < 1) errors.maxTotalExtensionDays = 'Ít nhất 1 ngày.'
  return errors
}

const input = 'w-full h-10 px-3 rounded-lg border text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-500'

export default function DebtPolicyPage() {
  const { has } = usePermission()
  const canManage = has('DEBT_POLICY.MANAGE')
  usePageHeader({ title: 'Chính sách công nợ', subtitle: canManage ? 'Quy tắc gia hạn, nhắc nợ và hạn trả của cửa hàng' : 'Quy tắc gia hạn, nhắc nợ và hạn trả của cửa hàng (chỉ xem)' })
  const { showToast } = useToast()

  const [policy, setPolicy] = useState<DebtPolicy | null>(null)
  const [values, setValues] = useState<Values | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<ReminderInitializeResult | null>(null)
  const [reminderBusy, setReminderBusy] = useState(false)

  const apply = (next: DebtPolicy) => { setPolicy(next); setValues(toValues(next)); setTouched(false) }

  const load = useCallback(async () => {
    setLoading(true); setLoadError('')
    try { apply(await debtPolicyApi.get()) } catch (err) { setLoadError(describeApiError(err, 'Không tải được chính sách công nợ')) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const errors = useMemo(() => (values ? validatePolicy(values) : {}), [values])
  const dirty = !!policy && !!values && JSON.stringify({ ...values, reason: '' }) !== JSON.stringify(toValues(policy))
  const set = (key: keyof Values, value: string) => setValues(prev => (prev ? { ...prev, [key]: value } : prev))

  const save = async () => {
    if (!policy || !values || saving) return
    setTouched(true)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    try {
      const saved = await debtPolicyApi.update({
        defaultGraceDays: Number(values.defaultGraceDays),
        reminderOffsets: { n2: -Number(values.remindBefore), n4: Number(values.remindAfterFirst), n5: Number(values.remindAfterSecond) },
        staffRolloverLimit: Number(values.staffRolloverLimit),
        ownerReviewAfterRollovers: Number(values.ownerReviewAfterRollovers),
        onTimeSeasonsForLimitRaise: Number(values.onTimeSeasonsForLimitRaise),
        maxCreditTermDays: values.maxCreditTermDays.trim() === '' ? null : Number(values.maxCreditTermDays),
        maxTotalExtensionDays: Number(values.maxTotalExtensionDays),
        version: policy.version,
        ...(values.reason.trim() ? { reason: values.reason.trim() } : {}),
      })
      apply(saved)
      showToast('Đã lưu chính sách công nợ', 'success')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        showToast('Chính sách vừa được người khác sửa. Đã tải lại bản mới, hãy kiểm tra rồi lưu lại.', 'error')
        await load()
      } else showToast(describeApiError(err), 'error')
    } finally { setSaving(false) }
  }

  const openReminderPreview = async () => {
    setReminderBusy(true)
    try { setPreview(await debtPolicyApi.initializeReminders(true)) } catch (err) { showToast(describeApiError(err), 'error') } finally { setReminderBusy(false) }
  }
  const startReminders = async () => {
    setReminderBusy(true)
    try {
      const result = await debtPolicyApi.initializeReminders(false)
      setPreview(null)
      showToast(result.alreadyStarted ? 'Nhắc nợ đã được bắt đầu từ trước' : `Đã bắt đầu nhắc nợ từ ${formatDay(result.startDate)}`, 'success')
      await load()
    } catch (err) { showToast(describeApiError(err), 'error') } finally { setReminderBusy(false) }
  }

  const field = (key: keyof Values, labelText: string, hint: string, unit?: string): ReactNode => {
    if (!values) return null
    const error = touched ? errors[key] : undefined
    return (
      <div className="space-y-1">
        <label htmlFor={`policy-${key}`} className="text-sm font-medium text-slate-700">{labelText}</label>
        <div className="flex items-center gap-2">
          <input id={`policy-${key}`} type="number" inputMode="numeric" value={values[key]} disabled={!canManage || saving}
            onChange={e => set(key, e.target.value)} aria-invalid={!!error} aria-describedby={error ? `policy-${key}-error` : undefined}
            className={`${input} ${error ? 'border-rose-300' : 'border-slate-200'}`} />
          {unit && <span className="shrink-0 text-sm text-slate-500">{unit}</span>}
        </div>
        {error ? <p id={`policy-${key}-error`} className="text-xs text-rose-600">{error}</p> : <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    )
  }

  const section = (title: string, children: ReactNode) => (
    <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )

  if (loading && !policy) return <div role="status" className="mx-auto max-w-[1100px] p-space-md text-sm text-slate-500">Đang tải chính sách công nợ…</div>
  if (!policy || !values) return (
    <div role="alert" className="mx-auto max-w-[1100px] p-space-md">
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{loadError || 'Không tải được chính sách công nợ'}
        <button type="button" className="ml-3 underline" onClick={() => void load()}>Thử lại</button></div>
    </div>
  )

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-space-lg p-space-md">
      {policy.remindersStartDate === null ? (
        <div role="status" className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start gap-3"><BellRing size={20} className="mt-0.5 shrink-0" />
            <div className="text-sm"><p className="font-semibold">Nhắc nợ chưa bắt đầu</p>
              <p className="mt-0.5">Hệ thống chưa gửi nhắc nợ nào cho nông dân. {canManage ? 'Chủ cửa hàng bắt đầu một lần; ngày bắt đầu không đổi được.' : 'Hãy báo chủ cửa hàng bắt đầu nhắc nợ.'}</p></div></div>
          {canManage && <button type="button" disabled={reminderBusy} onClick={() => void openReminderPreview()} className="h-9 shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{reminderBusy ? 'Đang kiểm tra…' : 'Bắt đầu nhắc nợ'}</button>}
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-slate-700"><BellRing size={16} className="text-emerald-700" />Nhắc nợ đã bắt đầu từ <strong className="tabular-nums text-slate-900">{formatDay(policy.remindersStartDate)}</strong>.</p>
      )}

      {policy.isDefault && <p className="text-xs text-slate-500">Cửa hàng chưa lưu chính sách nào: đang dùng giá trị mặc định.</p>}
      {!canManage && <p className="flex items-center gap-2 text-xs text-slate-500"><Lock size={14} />Chỉ Chủ cửa hàng được sửa chính sách này.</p>}

      {section('Hạn trả', <>
        {field('defaultGraceDays', 'Ân hạn mặc định sau thu hoạch', 'Số ngày ân hạn mặc định của cửa hàng; mỗi vụ vẫn chỉnh được riêng.', 'ngày')}
        {field('maxCreditTermDays', 'Trần kỳ hạn mua chịu', 'Để trống nếu không giới hạn kỳ hạn.', 'ngày')}
      </>)}
      {section('Nhắc nợ', <>
        {field('remindBefore', 'Nhắc trước hạn', 'Gửi nhắc trước ngày đến hạn.', 'ngày')}
        {field('remindAfterFirst', 'Nhắc quá hạn lần đầu', 'Tính từ ngày đến hạn.', 'ngày')}
        {field('remindAfterSecond', 'Nhắc quá hạn lần hai', 'Từ mốc này khoản nợ vào mục "Cần quyết định".', 'ngày')}
      </>)}
      {section('Gia hạn', <>
        {field('staffRolloverLimit', 'Số lần nhân viên được gia hạn', 'Vượt số này chỉ Chủ gia hạn được. Đặt 0 nếu chỉ Chủ gia hạn.', 'lần')}
        {field('ownerReviewAfterRollovers', 'Chủ xem lại sau', 'Khoản đã gia hạn đủ số lần này vào mục "Cần quyết định".', 'lần')}
        {field('maxTotalExtensionDays', 'Tổng thời gian gia hạn tối đa', 'Tính từ hạn gốc. Chủ vượt được khi xác nhận.', 'ngày')}
      </>)}
      {section('Hạn mức tín dụng', <>
        {field('onTimeSeasonsForLimitRaise', 'Số vụ trả đúng hạn để gợi ý tăng hạn mức', 'Chỉ là gợi ý cho Chủ; hệ thống không tự đổi hạn mức.', 'vụ')}
      </>)}

      {canManage && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-[260px] flex-1 space-y-1">
            <label htmlFor="policy-reason" className="text-sm font-medium text-slate-700">Lý do thay đổi (không bắt buộc)</label>
            <input id="policy-reason" type="text" maxLength={1000} value={values.reason} disabled={saving} onChange={e => set('reason', e.target.value)} className={`${input} border-slate-200`} />
          </div>
          <div className="flex gap-3">
            <button type="button" disabled={!dirty || saving} onClick={() => { setValues(toValues(policy)); setTouched(false) }} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hoàn tác</button>
            <button type="button" disabled={!dirty || saving} onClick={() => void save()} className="h-10 rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Đang lưu…' : 'Lưu chính sách'}</button>
          </div>
        </div>
      )}

      <ConfirmModal open={preview !== null} title="Bắt đầu nhắc nợ?" confirmLabel="Bắt đầu nhắc nợ" busy={reminderBusy} onClose={() => setPreview(null)} onConfirm={() => void startReminders()}
        message={preview && (preview.alreadyStarted ? 'Nhắc nợ đã được bắt đầu từ trước.' : <>Nhắc nợ sẽ bắt đầu từ hôm nay (<strong>{formatDay(preview.startDate)}</strong>). Ngày này đặt một lần và không đổi được.</>)}>
        {preview && !preview.alreadyStarted && (
          <div className="space-y-2 text-sm text-slate-700">
            <p>{preview.farmers} nông dân, {preview.activeGroups} nhóm nợ đang theo dõi; {preview.groupsWithLaterMilestones} nhóm sẽ được nhắc từ nay.</p>
            {preview.skippedTotal > 0
              ? <p>Có <strong>{preview.skippedTotal}</strong> mốc nhắc cũ sẽ được bỏ qua, không gửi bù ({Object.entries(preview.skipped).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(', ')}). Các khoản nợ đó vẫn hiện đầy đủ trên màn công nợ.</p>
              : <p>Không có mốc nhắc cũ nào bị bỏ qua.</p>}
            <p className="text-xs text-slate-500">Khoản nợ đã qua mốc quá hạn lần hai trước ngày bắt đầu không được nhắc tự động; xem ở mục "Cần quyết định" và nhắc riêng.</p>
          </div>
        )}
      </ConfirmModal>
    </div>
  )
}
