import { useEffect, useMemo, useState } from 'react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Select from '@/components/ui/Select'
import { ApiError } from '@/api/client'
import { cropSeasonsApi, type CropSeason, type SeasonRolloverResponse } from '@/api/cropSeasonsApi'
import { debtApi, type DebtEntry, type RolloverReasonCode } from '@/api/debtApi'
import { useToast } from '@/context/ToastContext'
import { describeApiError } from '@/utils/apiError'
import { DEBT_REASON_CODE_LABEL, ROLLOVER_REASON_CODES, ROLLOVER_SKIP_LABEL, formatDay, label, useCanManage } from '@/utils/creditLabels'
import { formatVnd } from '@/utils/money'

// FE_GUIDE_FLOW_3 §4.5, §4.6: extending a debt only moves its due date and collecting season; the amount never changes.
// Staff may do it once per entry (DEBT.ROLLOVER); from the second time only the owner can, and only the owner may go
// past the policy's total extension limit.

const field = 'w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'

function useIsOwner() { return useCanManage(['DEBT.ADJUST']) }

/** Seasons a debt can move to: not closed and not already due before the given date. */
function targetSeasons(seasons: CropSeason[], currentDue: string) {
  return seasons.filter(s => s.status !== 'CLOSED' && s.paymentDueDate.slice(0, 10) > currentDue.slice(0, 10)).sort((a, b) => a.paymentDueDate.localeCompare(b.paymentDueDate))
}

function useSeasons() {
  const [seasons, setSeasons] = useState<CropSeason[]>([])
  useEffect(() => {
    let active = true
    cropSeasonsApi.getSeasons({ pageSize: 100 }).then(r => { if (active) setSeasons(r.items) }).catch(() => { if (active) setSeasons([]) })
    return () => { active = false }
  }, [])
  return seasons
}

function explain(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) return 'Cần Chủ cửa hàng quyết định gia hạn tiếp: nhân viên đã hết lượt gia hạn khoản này.'
  return describeApiError(err, 'Không gia hạn được')
}

interface FormProps {
  seasons: CropSeason[]
  currentDue: string
  reasonCode: RolloverReasonCode | ''
  note: string
  target: string
  override: boolean
  showOverride: boolean
  disabled: boolean
  onChange: (patch: Partial<{ reasonCode: RolloverReasonCode | ''; note: string; target: string; override: boolean }>) => void
}

function RolloverFields({ seasons, currentDue, reasonCode, note, target, override, showOverride, disabled, onChange }: FormProps) {
  const options = targetSeasons(seasons, currentDue)
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="rollover-target" className="text-sm font-medium text-slate-700">Gia hạn sang vụ</label>
        <Select id="rollover-target" value={target} disabled={disabled} onChange={e => onChange({ target: e.target.value })} className={`${field} h-10`}>
          <option value="">Tự chọn vụ kế tiếp còn mở</option>
          {options.map(s => <option key={s.id} value={s.id}>{s.name} — hạn trả {formatDay(s.paymentDueDate)}</option>)}
        </Select>
        <p className="text-xs text-slate-500">Hạn trả mới là hạn trả của vụ đích. Số tiền nợ, vụ phát sinh và hạn gốc không đổi.</p>
      </div>
      <div className="space-y-1">
        <label htmlFor="rollover-reason" className="text-sm font-medium text-slate-700">Lý do <span className="text-rose-600">*</span></label>
        <Select id="rollover-reason" value={reasonCode} disabled={disabled} onChange={e => onChange({ reasonCode: e.target.value as RolloverReasonCode | '' })} className={`${field} h-10`}>
          <option value="">Chọn lý do</option>
          {ROLLOVER_REASON_CODES.map(code => <option key={code} value={code}>{label(DEBT_REASON_CODE_LABEL, code)}</option>)}
        </Select>
      </div>
      <div className="space-y-1">
        <label htmlFor="rollover-note" className="text-sm font-medium text-slate-700">Ghi chú <span className="text-rose-600">*</span></label>
        <textarea id="rollover-note" rows={3} maxLength={1000} value={note} disabled={disabled} onChange={e => onChange({ note: e.target.value })} className={`${field} py-2`} placeholder="VD: Khách mất mùa do lũ, hẹn trả sau vụ tới" />
      </div>
      {showOverride && (
        <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={override} disabled={disabled} onChange={e => onChange({ override: e.target.checked })} />
          <span>Cho phép vượt tổng thời gian gia hạn tối đa.<span className="block text-xs text-amber-800">Chỉ Chủ cửa hàng được vượt; hãy chắc chắn trước khi xác nhận.</span></span>
        </label>
      )}
    </div>
  )
}

// ---------- one entry ----------

export function RolloverEntryModal({ entry, onClose, onDone }: { entry: DebtEntry; onClose: () => void; onDone: (updated: DebtEntry) => void }) {
  const { showToast } = useToast()
  const isOwner = useIsOwner()
  const seasons = useSeasons()
  const [values, setValues] = useState<{ reasonCode: RolloverReasonCode | ''; note: string; target: string; override: boolean }>({ reasonCode: '', note: '', target: '', override: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [limitHit, setLimitHit] = useState(false)
  const valid = values.reasonCode !== '' && values.note.trim() !== ''

  const submit = async () => {
    if (!valid || busy || values.reasonCode === '') return
    setBusy(true); setError('')
    try {
      const updated = await debtApi.rollover(entry.id, {
        reasonCode: values.reasonCode,
        note: values.note.trim(),
        ...(values.target ? { targetCropSeasonId: values.target } : {}),
        ...(isOwner && values.override ? { overrideExtensionLimit: true } : {}),
      })
      showToast(`Đã gia hạn khoản nợ ${entry.entryNumber} đến ${formatDay(updated.dueDate)}`, 'success')
      onDone(updated)
    } catch (err) {
      setError(explain(err))
      if (err instanceof ApiError && err.status === 422) setLimitHit(true)
    } finally { setBusy(false) }
  }

  return (
    <ConfirmModal open title={`Gia hạn khoản nợ ${entry.entryNumber}`} confirmLabel="Gia hạn" busy={busy} confirmDisabled={!valid} onClose={onClose} onConfirm={() => void submit()}
      message={<>Còn nợ <strong>{formatVnd(entry.outstandingAmount)}</strong>, hạn hiện tại <strong>{formatDay(entry.dueDate)}</strong>. Gia hạn chỉ dời hạn trả, không tính lãi hay phạt.</>}>
      <RolloverFields seasons={seasons} currentDue={entry.dueDate} {...values} showOverride={isOwner && limitHit} disabled={busy} onChange={patch => { setValues(prev => ({ ...prev, ...patch })); setError('') }} />
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </ConfirmModal>
  )
}

// ---------- a whole season ----------

type Step = 'form' | 'preview'

export function SeasonRolloverModal({ season, onClose, onDone }: { season: CropSeason; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast()
  const isOwner = useIsOwner()
  const seasons = useSeasons()
  const [values, setValues] = useState<{ reasonCode: RolloverReasonCode | ''; note: string; target: string; override: boolean }>({ reasonCode: '', note: '', target: '', override: false })
  const [step, setStep] = useState<Step>('form')
  const [preview, setPreview] = useState<SeasonRolloverResponse | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const valid = values.reasonCode !== '' && values.note.trim() !== ''
  // The preview only lists what would move; anything the owner un-ticks is left out of the real run.
  const chosen = useMemo(() => (preview?.rolledOver ?? []).filter(e => !excluded.has(e.entryId)), [preview, excluded])
  const chosenTotal = chosen.reduce((sum, e) => sum + e.outstandingAmount, 0)
  const hasLimitSkips = !!preview?.skipped.some(s => s.reason === 'EXCEEDS_TOTAL_EXTENSION')

  const request = (dryRun: boolean, entryIds?: string[]) => {
    if (values.reasonCode === '') throw new Error('missing reason')
    return cropSeasonsApi.rolloverDebt(season.id, {
      reasonCode: values.reasonCode, note: values.note.trim(), dryRun,
      ...(values.target ? { targetCropSeasonId: values.target } : {}),
      ...(entryIds ? { entryIds } : {}),
      ...(isOwner && values.override ? { overrideExtensionLimit: true } : {}),
    })
  }

  const runPreview = async () => {
    if (!valid || busy) return
    setBusy(true); setError('')
    try { setPreview(await request(true)); setExcluded(new Set()); setStep('preview') } catch (err) { setError(explain(err)) } finally { setBusy(false) }
  }

  const confirm = async () => {
    if (busy || chosen.length === 0) return
    setBusy(true); setError('')
    try {
      const everything = chosen.length === preview?.rolledOver.length
      const result = await request(false, everything ? undefined : chosen.map(e => e.entryId))
      const moved = result.rolledOver.length, left = result.skipped.length
      showToast(left > 0 ? `Đã gia hạn ${moved} khoản sang ${result.targetSeason.name}; ${left} khoản bị bỏ qua` : `Đã gia hạn ${moved} khoản sang ${result.targetSeason.name}`, left > 0 ? 'info' : 'success')
      onDone()
    } catch (err) {
      // The preview is only a forecast: the real run is checked again and can fail or differ.
      setError(`${explain(err)} Kết quả thật có thể khác bản xem trước; hãy xem trước lại.`)
    } finally { setBusy(false) }
  }

  const toggle = (id: string) => setExcluded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  if (step === 'form' || !preview) {
    return (
      <ConfirmModal open title={`Gia hạn nợ cả vụ ${season.name}`} confirmLabel="Xem trước" busy={busy} confirmDisabled={!valid} onClose={onClose} onConfirm={() => void runPreview()}
        message="Chuyển các khoản nợ đang thu của vụ này sang vụ sau. Bạn sẽ xem danh sách trước khi xác nhận; chưa có gì được ghi.">
        <RolloverFields seasons={seasons} currentDue={season.paymentDueDate} {...values} showOverride={isOwner} disabled={busy} onChange={patch => { setValues(prev => ({ ...prev, ...patch })); setError('') }} />
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </ConfirmModal>
    )
  }

  return (
    <ConfirmModal open title="Xác nhận gia hạn cả vụ" confirmLabel={`Gia hạn ${chosen.length} khoản`} busy={busy} confirmDisabled={chosen.length === 0} onClose={onClose} onConfirm={() => void confirm()}
      message={<>Sang <strong>{preview.targetSeason.name}</strong>, hạn trả mới <strong>{formatDay(preview.newDueDate)}</strong>.</>}>
      <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Đây là bản xem trước. Kết quả thật được kiểm tra lại lúc xác nhận và có thể khác (ví dụ có khoản vừa bị khiếu nại hoặc vừa được trả).</p>
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">Sẽ gia hạn: {chosen.length}/{preview.rolledOver.length} khoản, tổng {formatVnd(chosenTotal)}</p>
        {preview.rolledOver.length === 0
          ? <p className="text-sm text-slate-500">Không có khoản nào đủ điều kiện gia hạn.</p>
          : <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
              {preview.rolledOver.map(e => (
                <li key={e.entryId}><label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                  <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={!excluded.has(e.entryId)} disabled={busy} onChange={() => toggle(e.entryId)} />
                  <span className="flex-1 font-mono text-xs">{e.entryNumber}</span>
                  <span className="text-xs text-slate-500">{formatDay(e.oldDueDate)} → {formatDay(e.newDueDate)}</span>
                  <span className="w-28 text-right tabular-nums">{formatVnd(e.outstandingAmount)}</span>
                </label></li>
              ))}
            </ul>}
      </div>
      {preview.skipped.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">Bị bỏ qua: {preview.skipped.length} khoản</p>
          <ul className="max-h-36 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
            {preview.skipped.map(s => <li key={s.entryId} className="flex items-center justify-between gap-3 px-3 py-2"><span className="font-mono text-xs">{s.entryNumber ?? s.entryId.slice(0, 8)}</span><span className="text-xs text-slate-600">{label(ROLLOVER_SKIP_LABEL, s.reason)}</span></li>)}
          </ul>
          {hasLimitSkips && isOwner && !values.override && <button type="button" className="text-xs font-medium text-emerald-700 underline" onClick={() => { setValues(prev => ({ ...prev, override: true })); setStep('form'); setPreview(null) }}>Cho phép vượt giới hạn và xem trước lại</button>}
        </div>
      )}
      <button type="button" disabled={busy} className="text-xs font-medium text-slate-600 underline" onClick={() => { setStep('form'); setError('') }}>Quay lại chỉnh lý do, vụ đích</button>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </ConfirmModal>
  )
}
