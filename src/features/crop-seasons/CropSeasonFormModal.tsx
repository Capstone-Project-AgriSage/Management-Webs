import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import Modal from '@/components/ui/Modal'
import ModalLayout from '@/components/ui/ModalLayout'
import Select from '@/components/ui/Select'
import type { CropSeason, CropSeasonWriteRequest } from '@/api/cropSeasonsApi'
import { formatDay } from '@/utils/creditLabels'
import { CROP_TYPES, DEFAULT_GRACE_DAYS, addDays, seasonDueDate, validateSeasonDates, type SeasonDates } from './seasonRules'

export type SeasonFormResult =
  | { mode: 'create'; body: CropSeasonWriteRequest & { code: string } }
  | { mode: 'edit'; body: CropSeasonWriteRequest & { applyNewDueDateToDebts: boolean } }

interface Props {
  open: boolean
  /** null creates a season. */
  season: CropSeason | null
  /** Pre-filled order window start for a new season, so it follows the latest one. */
  suggestedStart: string | null
  saving: boolean
  onClose: () => void
  onSubmit: (result: SeasonFormResult) => void
}

type Values = SeasonDates & { code: string; name: string; cropType: string; applyNewDueDateToDebts: boolean }

const input =
  'w-full h-10 px-3 rounded-lg border text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'

const initialValues = (season: CropSeason | null, suggestedStart: string | null): Values =>
  season
    ? {
        code: season.code,
        name: season.name,
        cropType: season.cropType,
        orderWindowStart: season.orderWindowStart.slice(0, 10),
        harvestStart: season.harvestStart.slice(0, 10),
        harvestEnd: season.harvestEnd.slice(0, 10),
        graceDays: String(season.graceDays),
        applyNewDueDateToDebts: false,
      }
    : { code: '', name: '', cropType: 'RICE', orderWindowStart: suggestedStart ?? '', harvestStart: '', harvestEnd: '', graceDays: String(DEFAULT_GRACE_DAYS), applyNewDueDateToDebts: false }

export default function CropSeasonFormModal({ open, season, suggestedStart, saving, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<Values>(() => initialValues(season, suggestedStart))
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues(initialValues(season, suggestedStart))
    setTouched(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const errors = useMemo(() => {
    const dateErrors: Partial<Record<keyof Values, string>> = validateSeasonDates(values)
    if (!season && !values.code.trim()) dateErrors.code = 'Nhập mã vụ.'
    if (!values.name.trim()) dateErrors.name = 'Nhập tên vụ.'
    return dateErrors
  }, [values, season])

  const dueDate = seasonDueDate(values.harvestEnd, Number(values.graceDays))
  const datesChanged = !!season && (values.harvestEnd !== season.harvestEnd.slice(0, 10) || Number(values.graceDays) !== season.graceDays)
  const hasDebt = !!season && season.openEntryCount > 0
  const set = (key: keyof Values, value: string | boolean) => setValues((prev) => ({ ...prev, [key]: value }))

  const submit = () => {
    setTouched(true)
    if (Object.keys(errors).length > 0 || saving) return
    const body: CropSeasonWriteRequest = {
      name: values.name.trim(),
      cropType: values.cropType,
      orderWindowStart: values.orderWindowStart,
      harvestStart: values.harvestStart,
      harvestEnd: values.harvestEnd,
      graceDays: Number(values.graceDays),
    }
    onSubmit(season ? { mode: 'edit', body: { ...body, applyNewDueDateToDebts: hasDebt && datesChanged && values.applyNewDueDateToDebts } } : { mode: 'create', body: { ...body, code: values.code.trim().toUpperCase() } })
  }

  const field = (key: keyof Values, label: string, control: ReactNode, hint?: string, wide = false) => {
    const error = touched ? errors[key] : undefined
    return (
      <div className={`space-y-1 ${wide ? 'sm:col-span-2' : ''}`}>
        <label htmlFor={`season-${key}`} className="text-sm font-medium text-slate-700">{label}</label>
        {control}
        {error ? <p id={`season-${key}-error`} className="text-xs text-rose-600">{error}</p> : hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    )
  }

  const textProps = (key: keyof Values, type = 'text') => ({
    id: `season-${key}`,
    type,
    value: String(values[key]),
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
    'aria-invalid': touched && !!errors[key],
    'aria-describedby': touched && errors[key] ? `season-${key}-error` : undefined,
    className: `${input} ${touched && errors[key] ? 'border-rose-300' : 'border-slate-200'}`,
  })

  return (
    <Modal open={open} onClose={onClose} title={season ? `Sửa vụ ${season.code}` : 'Tạo vụ mùa'} busy={saving}
      description={season ? undefined : 'Mỗi khoản nợ mua chịu trong khoảng nhận đơn của vụ sẽ có chung hạn trả của vụ.'}>
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={(e) => { e.preventDefault(); submit() }}>
        <ModalLayout
          bodyClassName="grid grid-cols-1 sm:grid-cols-2 gap-5"
          footer={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium" onClick={onClose}>Hủy</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Đang xử lý...' : season ? 'Lưu' : 'Tạo vụ'}
              </button>
            </div>
          }
        >
          {season
            ? field('code', 'Mã vụ', <p className="h-10 flex items-center font-mono text-sm text-slate-700">{season.code}</p>)
            : field('code', 'Mã vụ', <input {...textProps('code')} placeholder="VD: DX-2026" maxLength={30} />, 'Không đổi được sau khi tạo.')}
          {field('name', 'Tên vụ', <input {...textProps('name')} placeholder="VD: Đông Xuân 2026–2027" maxLength={100} />, 'Nông dân thấy tên này khi mua chịu.')}
          {field('cropType', 'Cây trồng', (
            <Select id="season-cropType" value={values.cropType} onChange={(e) => set('cropType', e.target.value)} className={`${input} border-slate-200`}>
              {CROP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          ))}
          {field('graceDays', 'Ân hạn sau thu hoạch (ngày)', <input {...textProps('graceDays', 'number')} min={0} max={365} inputMode="numeric" />, 'Thời gian để nông dân bán lúa trước khi tới hạn.')}
          {field('orderWindowStart', 'Bắt đầu nhận đơn', <input {...textProps('orderWindowStart', 'date')} />,
            'Thường là ngày vụ trước bắt đầu thu hoạch.')}
          {field('harvestStart', 'Bắt đầu thu hoạch (dự kiến)', <input {...textProps('harvestStart', 'date')} />,
            values.harvestStart ? `Đơn xác nhận từ ${formatDay(values.harvestStart)} tính cho vụ sau.` : 'Từ ngày này, đơn mới tính cho vụ sau.')}
          {field('harvestEnd', 'Kết thúc thu hoạch (dự kiến)', <input {...textProps('harvestEnd', 'date')} />)}

          <div className="sm:col-span-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3" aria-live="polite">
            <p className="text-xs text-slate-600">Hạn trả của vụ</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{dueDate ? formatDay(dueDate) : '—'}</p>
            <p className="text-xs text-slate-500">
              {dueDate
                ? `= kết thúc thu hoạch ${formatDay(values.harvestEnd)} + ${Number(values.graceDays)} ngày ân hạn. Nhắc nợ trước hạn từ ${formatDay(addDays(dueDate, -7))}.`
                : 'Nhập ngày kết thúc thu hoạch và ân hạn để tính hạn trả.'}
            </p>
          </div>

          {hasDebt && datesChanged && (
            <label className="sm:col-span-2 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={values.applyNewDueDateToDebts} onChange={(e) => set('applyNewDueDateToDebts', e.target.checked)} />
              <span>
                Áp hạn trả mới cho {season?.openEntryCount} khoản nợ đã ghi của vụ này.
                <span className="block text-xs text-amber-800 mt-0.5">Không chọn thì các khoản đã ghi giữ hạn cũ; chỉ khoản ghi sau mới theo hạn mới.</span>
              </span>
            </label>
          )}
        </ModalLayout>
      </form>
    </Modal>
  )
}
