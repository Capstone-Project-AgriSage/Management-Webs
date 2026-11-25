import { useEffect, useState } from 'react'
import { CalendarClock, MessageSquareText } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import ModalLayout from '@/components/ui/ModalLayout'
import Select from '@/components/ui/Select'
import DateInput from '@/components/ui/DateInput'
import { debtApi, type DebtFollowUp, type DebtFollowUpChannel, type DebtFollowUpOutcome, type DebtFollowUpSummary, type DebtPromiseStatus } from '@/api/debtApi'
import { formatDay, formatDayTime, todayVn } from '@/utils/creditLabels'
import { formatVnd } from '@/utils/money'

// F3.23 (FLOW_3 §8j, team task 3): the store reminds a customer itself (a call, a visit, a message) and logs it here.
// Logging only: nothing is sent and no debt changes. The Farmer never sees these notes.

export const FOLLOW_UP_CHANNEL_LABEL: Record<DebtFollowUpChannel, string> = {
  PHONE_CALL: 'Gọi điện', VISIT: 'Đến nhà/ruộng', AT_STORE: 'Khách ghé cửa hàng', MESSAGE: 'Nhắn tin/Zalo', OTHER: 'Khác',
}
export const FOLLOW_UP_OUTCOME_LABEL: Record<DebtFollowUpOutcome, string> = {
  PROMISED: 'Hứa trả', ASKED_MORE_TIME: 'Xin thêm thời gian', NO_ANSWER: 'Không liên lạc được', REFUSED: 'Không chịu trả', OTHER: 'Khác',
}
const PROMISE: Record<DebtPromiseStatus, { text: string; className: string }> = {
  WAITING: { text: 'Chờ đến hẹn', className: 'border-slate-200 bg-slate-50 text-slate-700' },
  KEPT: { text: 'Đã trả theo hẹn', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  LATE: { text: 'Trả trễ hẹn', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  CLEARED: { text: 'Hết nợ', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  BROKEN: { text: 'Quá hẹn', className: 'border-rose-200 bg-rose-50 text-rose-700' },
}

export function PromiseBadge({ status }: { status: DebtPromiseStatus | null | undefined }) {
  if (!status || !PROMISE[status]) return null
  const badge = PROMISE[status]
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>{badge.text}</span>
}

const dayMonth = (iso: string) => formatDay(iso).slice(0, 5)

/** "Nhắc gần nhất: 20/11 · Gọi điện · Hứa trả 30/11 [Quá hẹn]" or "Chưa nhắc", for the decision list and the entries table. */
export function LastFollowUp({ summary, compact = false }: { summary: DebtFollowUpSummary | null | undefined; compact?: boolean }) {
  if (summary === undefined) return null // older server: say nothing rather than "never reminded"
  if (!summary) return <p className="mt-1 text-xs text-slate-500">{compact ? 'Chưa nhắc' : 'Chưa ghi nhận lần nhắc nợ nào'}</p>
  const contacted = dayMonth(new Date(summary.contactedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }))
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-600" title={summary.byName ? `Người nhắc: ${summary.byName}` : undefined}>
      <MessageSquareText size={12} aria-hidden="true" className="shrink-0 text-slate-400" />
      <span>{compact ? '' : 'Nhắc gần nhất: '}{contacted} · {FOLLOW_UP_CHANNEL_LABEL[summary.channel] ?? summary.channel} · {FOLLOW_UP_OUTCOME_LABEL[summary.outcome] ?? summary.outcome}{summary.promisedDate ? ` ${dayMonth(summary.promisedDate)}` : ''}</span>
      <PromiseBadge status={summary.promiseStatus} />
    </p>
  )
}

const inputClassName = 'w-full px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const nowTimeVn = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
const MAX_BACKDATING_DAYS = 30

interface ModalProps {
  open: boolean
  farmerProfileId: string
  customerName: string
  outstanding: number
  onClose: () => void
  onRecorded: (followUp: DebtFollowUp) => void
}

/** The form: how and when the customer was reminded, what came of it, and the promise to pay if any. */
export function DebtFollowUpModal({ open, farmerProfileId, customerName, outstanding, onClose, onRecorded }: ModalProps) {
  const [channel, setChannel] = useState<DebtFollowUpChannel | ''>('')
  const [outcome, setOutcome] = useState<DebtFollowUpOutcome | ''>('')
  const [contactDate, setContactDate] = useState(todayVn())
  const [contactTime, setContactTime] = useState(nowTimeVn())
  const [promisedDate, setPromisedDate] = useState('')
  const [promisedAmount, setPromisedAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setChannel(''); setOutcome(''); setContactDate(todayVn()); setContactTime(nowTimeVn())
    setPromisedDate(''); setPromisedAmount(''); setNote(''); setError(null)
  }, [open])

  const today = todayVn()
  const promised = outcome === 'PROMISED'
  const amount = promisedAmount.trim() ? Number(promisedAmount) : null
  const problem = (() => {
    if (!channel || !outcome) return 'Chọn hình thức và kết quả.'
    if (!contactDate || contactDate > today || contactDate < addDays(today, -MAX_BACKDATING_DAYS)) return `Ngày liên hệ phải trong ${MAX_BACKDATING_DAYS} ngày gần nhất.`
    if (!/^\d{2}:\d{2}$/.test(contactTime)) return 'Nhập giờ liên hệ.'
    if (contactDate === today && contactTime > nowTimeVn()) return 'Thời điểm liên hệ không được ở tương lai.'
    if ((channel === 'OTHER' || outcome === 'OTHER') && !note.trim()) return 'Ghi chú là bắt buộc khi chọn "Khác".'
    if (promised && !promisedDate) return 'Nhập ngày khách hẹn trả.'
    if (promised && (promisedDate < contactDate || promisedDate > addDays(contactDate, 365))) return 'Ngày hẹn trả phải từ ngày liên hệ đến tối đa 1 năm sau.'
    if (promised && amount !== null && (!(amount > 0) || amount > outstanding)) return `Số tiền hẹn phải lớn hơn 0 và không quá dư nợ ${formatVnd(outstanding)}.`
    return null
  })()

  const submit = async () => {
    if (problem || busy || !channel || !outcome) return
    setBusy(true); setError(null)
    try {
      const recorded = await debtApi.recordFollowUp(farmerProfileId, {
        channel, outcome, note: note.trim() || null,
        contactedAt: `${contactDate}T${contactTime}:00+07:00`,
        promisedDate: promised ? promisedDate : null,
        promisedAmount: promised ? amount : null,
      })
      onRecorded(recorded)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Không ghi nhận được lần nhắc nợ.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} busy={busy} title={`Ghi nhận nhắc nợ — ${customerName}`}
      description="Ghi lại việc cửa hàng đã tự nhắc khách (gọi, đến nhà, nhắn tin…). Hệ thống chỉ lưu lại: không gửi tin nhắn, không đổi khoản nợ.">
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); void submit() }}>
        <ModalLayout bodyClassName="grid grid-cols-1 gap-5 sm:grid-cols-2" footer={<div className="flex flex-wrap items-center justify-end gap-3">
          {problem && channel && outcome && <p role="status" className="mr-auto text-xs text-rose-700">{problem}</p>}
          <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose}>Hủy</button>
          <button type="submit" disabled={!!problem || busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? 'Đang lưu...' : 'Ghi nhận'}</button>
        </div>}>
          <div className="space-y-1">
            <label htmlFor="follow-up-channel" className="text-sm font-medium text-slate-700">Hình thức<span className="ml-0.5 text-rose-600">*</span></label>
            <Select id="follow-up-channel" value={channel} onChange={event => setChannel(event.target.value as DebtFollowUpChannel)} className={`${inputClassName} h-10`}>
              <option value="">-- Chọn --</option>
              {Object.entries(FOLLOW_UP_CHANNEL_LABEL).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="follow-up-outcome" className="text-sm font-medium text-slate-700">Kết quả<span className="ml-0.5 text-rose-600">*</span></label>
            <Select id="follow-up-outcome" value={outcome} onChange={event => setOutcome(event.target.value as DebtFollowUpOutcome)} className={`${inputClassName} h-10`}>
              <option value="">-- Chọn --</option>
              {Object.entries(FOLLOW_UP_OUTCOME_LABEL).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="follow-up-date" className="text-sm font-medium text-slate-700">Ngày liên hệ</label>
            <DateInput id="follow-up-date" aria-label="Ngày liên hệ" value={contactDate} min={addDays(today, -MAX_BACKDATING_DAYS)} max={today} onChange={event => setContactDate(event.target.value)} className={`${inputClassName} h-10`} />
            <p className="text-xs text-slate-500">Đi nhắc hôm trước thì chọn lại ngày (tối đa {MAX_BACKDATING_DAYS} ngày).</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="follow-up-time" className="text-sm font-medium text-slate-700">Giờ liên hệ</label>
            <input id="follow-up-time" type="time" value={contactTime} onChange={event => setContactTime(event.target.value)} className={`${inputClassName} h-10`} />
          </div>
          {promised && <>
            <div className="space-y-1">
              <label htmlFor="follow-up-promised-date" className="text-sm font-medium text-slate-700">Ngày hẹn trả<span className="ml-0.5 text-rose-600">*</span></label>
              <DateInput id="follow-up-promised-date" aria-label="Ngày hẹn trả" value={promisedDate} min={contactDate} max={addDays(contactDate, 365)} onChange={event => setPromisedDate(event.target.value)} className={`${inputClassName} h-10`} />
            </div>
            <div className="space-y-1">
              <label htmlFor="follow-up-promised-amount" className="text-sm font-medium text-slate-700">Số tiền hẹn trả (đ)</label>
              <input id="follow-up-promised-amount" type="number" min="1" max={outstanding} value={promisedAmount} onChange={event => setPromisedAmount(event.target.value)} className={`${inputClassName} h-10`} />
              <p className="text-xs text-slate-500">Để trống nếu khách hẹn trả hết phần đang quá hạn.</p>
            </div>
          </>}
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="follow-up-note" className="text-sm font-medium text-slate-700">Ghi chú{(channel === 'OTHER' || outcome === 'OTHER') && <span className="ml-0.5 text-rose-600">*</span>}</label>
            <textarea id="follow-up-note" rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="Ví dụ: hẹn bán lúa xong trả, nhờ con trai nhắn lại…" className={`${inputClassName} py-2`} />
          </div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{error}</p>}
        </ModalLayout>
      </form>
    </Modal>
  )
}

/** The customer's reminder history, latest contact first, with the promise label the server works out. */
export function DebtFollowUpList({ items, loading }: { items: DebtFollowUp[] | null; loading: boolean }) {
  if (!items) return <p className="px-4 py-6 text-center text-sm text-slate-500">{loading ? 'Đang tải...' : 'Không tải được lịch sử nhắc nợ.'}</p>
  if (items.length === 0) return <p className="px-4 py-6 text-center text-sm text-slate-500">Chưa ghi nhận lần nhắc nợ nào.</p>
  return (
    <ol aria-label="Lịch sử nhắc nợ" className="divide-y divide-slate-100">
      {items.map(item => (
        <li key={item.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <CalendarClock size={14} aria-hidden="true" className="shrink-0 text-slate-400" />
              <span className="font-medium text-slate-900">{formatDayTime(item.contactedAt)}</span>
              <span className="text-slate-600">· {FOLLOW_UP_CHANNEL_LABEL[item.channel] ?? item.channel}</span>
              <span className="font-medium text-slate-900">· {FOLLOW_UP_OUTCOME_LABEL[item.outcome] ?? item.outcome}{item.promisedDate ? ` ${formatDay(item.promisedDate)}` : ''}{item.promisedAmount ? ` · ${formatVnd(item.promisedAmount)}` : ''}</span>
              <PromiseBadge status={item.promiseStatus} />
              {item.promiseStatus && item.hasLaterContact && <span className="text-xs text-slate-500">· đã có lần nhắc sau</span>}
            </p>
            {item.note && <p className="mt-1 whitespace-pre-line text-sm text-slate-700 [overflow-wrap:anywhere]">{item.note}</p>}
            <p className="mt-1 text-xs text-slate-500">
              Lúc ghi: còn nợ {formatVnd(item.outstandingAmount)}{item.overdueAmount > 0 ? ` · quá hạn ${formatVnd(item.overdueAmount)}` : ''}
              {item.promiseStatus && ` · đã trả từ lúc nhắc ${formatVnd(item.paidSinceContact)}`}
            </p>
          </div>
          <p className="shrink-0 text-xs text-slate-500 sm:text-right">{item.createdBy.name ?? '--'}</p>
        </li>
      ))}
    </ol>
  )
}
