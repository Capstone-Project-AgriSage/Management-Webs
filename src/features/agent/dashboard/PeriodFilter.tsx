import { RefreshCw } from 'lucide-react'
import { todayVn } from '@/utils/creditLabels'
import { reportInputClass } from '@/features/agent/reports/reportFilters'

/** "YYYY-MM-DD" moved by whole days; computed in UTC so the calendar day never shifts with the browser's time zone. */
function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

const PRESETS: { label: string; range: (today: string) => [string, string] }[] = [
  { label: 'Hôm nay', range: today => [today, today] },
  { label: '7 ngày', range: today => [addDays(today, -6), today] },
  { label: '30 ngày', range: today => [addDays(today, -29), today] },
  { label: 'Tháng này', range: today => [`${today.slice(0, 8)}01`, today] },
  { label: 'Năm nay', range: today => [`${today.slice(0, 4)}-01-01`, today] },
]

/** One row above everything the period scopes: quick ranges first, then the exact dates, then a refresh for every figure. */
export default function PeriodFilter({ title, fromDate, toDate, onChange, onRefresh }: { title: string; fromDate: string; toDate: string; onChange: (from: string, to: string) => void; onRefresh: () => void }) {
  const today = todayVn()
  return <div className="flex flex-wrap items-center justify-between gap-3">
    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <div role="group" aria-label="Chọn nhanh khoảng thời gian" className="grid w-full grid-cols-5 gap-0.5 rounded-xl bg-slate-100 p-1 sm:inline-flex sm:w-auto">
        {PRESETS.map(preset => {
          const [from, to] = preset.range(today)
          const selected = from === fromDate && to === toDate
          return <button key={preset.label} type="button" aria-pressed={selected} onClick={() => onChange(from, to)}
            className={`whitespace-nowrap rounded-lg px-1.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3 sm:text-sm ${selected ? 'bg-[#fff] text-green-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{preset.label}</button>
        })}
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <input aria-label="Từ ngày" type="date" className={`${reportInputClass} min-w-0 flex-1 sm:flex-none`} value={fromDate} max={toDate} onChange={event => onChange(event.target.value, toDate)} />
        <span aria-hidden="true" className="text-slate-400">→</span>
        <input aria-label="Đến ngày" type="date" className={`${reportInputClass} min-w-0 flex-1 sm:flex-none`} value={toDate} min={fromDate} onChange={event => onChange(fromDate, event.target.value)} />
        <button type="button" aria-label="Làm mới số liệu" title="Làm mới số liệu" onClick={onRefresh}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-[#fff] text-slate-600 hover:bg-slate-50 hover:text-slate-900"><RefreshCw size={16} /></button>
      </div>
    </div>
  </div>
}
