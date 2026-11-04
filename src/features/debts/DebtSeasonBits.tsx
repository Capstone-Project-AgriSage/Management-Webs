import { AlertCircle, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import type { DebtEntrySeasonFields, DueState } from '@/api/debtApi'
import { formatDay } from '@/utils/creditLabels'

// Small pieces shared by the debt entry table and the entry detail (FE_GUIDE_FLOW_3 §3.1 mục 3, 4).

const DUE_STATE: Record<DueState, { label: string; className: string; Icon: typeof Clock }> = {
  NOT_DUE: { label: 'Chưa đến hạn', className: 'bg-slate-50 text-slate-600 border-slate-200', Icon: Clock },
  DUE_SOON: { label: 'Sắp đến hạn', className: 'bg-amber-50 text-amber-800 border-amber-200', Icon: AlertCircle },
  OVERDUE: { label: 'Quá hạn', className: 'bg-rose-50 text-rose-700 border-rose-200', Icon: AlertTriangle },
}

/** Icon plus text, never colour alone. A null state (fully paid) shows nothing. */
export function DueStateBadge({ state }: { state: DueState | null | undefined }) {
  if (!state) return null
  const { label, className, Icon } = DUE_STATE[state]
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}><Icon size={12} aria-hidden />{label}</span>
}

/** "Đã gia hạn N lần" and "Cần quyết định" markers of an entry. */
export function EntryFlags({ entry }: { entry: Pick<DebtEntrySeasonFields, 'isRolledOver' | 'rolloverCount' | 'needsDecision'> }) {
  if (!entry.isRolledOver && !entry.needsDecision) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entry.isRolledOver && <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800"><RefreshCw size={11} aria-hidden />Đã gia hạn {entry.rolloverCount} lần</span>}
      {entry.needsDecision && <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"><CheckCircle2 size={11} aria-hidden />Cần quyết định</span>}
    </div>
  )
}

/** The two seasons of an entry: where it was born (fixed) and where it is being collected (moves on rollover). */
export function SeasonPair({ entry }: { entry: Pick<DebtEntrySeasonFields, 'originSeason' | 'collectionSeason'> }) {
  const origin = entry.originSeason, collecting = entry.collectionSeason
  if (!origin && !collecting) return <span className="text-slate-400">Theo hạng tín dụng</span>
  return (
    <div className="text-xs leading-5">
      <div><span className="text-slate-500">Phát sinh: </span><span className="font-medium text-slate-800">{origin?.code ?? '—'}</span></div>
      <div><span className="text-slate-500">Đang thu: </span><span className="font-medium text-slate-800">{collecting?.code ?? '—'}</span></div>
    </div>
  )
}

/** Original due date only when the current one has moved. */
export function OriginalDue({ originalDueDate, dueDate }: { originalDueDate: string; dueDate: string }) {
  if (!originalDueDate || originalDueDate.slice(0, 10) === dueDate.slice(0, 10)) return null
  return <div className="text-xs text-slate-500">Hạn gốc {formatDay(originalDueDate)}</div>
}
