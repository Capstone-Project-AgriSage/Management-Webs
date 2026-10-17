import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'

export interface StripStat {
  key: string
  label: string
  icon: LucideIcon
  /** null = the figure could not be loaded. */
  value: ReactNode | null
  /** Longer explanation, shown as a tooltip so the strip itself stays short. */
  note?: string
  to?: string
  /** Something is waiting: the icon turns amber instead of green. */
  attention?: boolean
}

function Cell({ stat, loading }: { stat: StripStat; loading: boolean }) {
  const Icon = stat.icon
  const value = loading ? <span aria-hidden="true" className="inline-block h-7 w-14 animate-pulse rounded bg-slate-100 align-middle" /> : stat.value ?? '—'
  const body = <>
    <span className="flex min-w-0 flex-1 items-start gap-2 md:flex-none">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${stat.attention ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}><Icon size={15} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1 pt-0.5 text-sm leading-5 text-slate-500">{stat.label}</span>
      {stat.to && <ArrowUpRight size={16} aria-hidden="true" className="mt-0.5 hidden shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:block" />}
    </span>
    <span className="block shrink-0 whitespace-nowrap text-lg font-semibold leading-7 text-slate-900 md:text-2xl md:leading-8">{value}</span>
  </>
  const className = 'group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 md:flex-col md:items-stretch md:justify-between md:gap-2 md:px-5 md:py-4'
  return stat.to
    ? <Link to={stat.to} title={stat.note} className={`${className} transition-colors hover:bg-green-50/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary`}>{body}</Link>
    : <div title={stat.note} className={className}>{body}</div>
}

/** One strip of headline counts with hairline dividers: a row per figure on a phone, a column per figure from tablet up. */
export default function StatStrip({ label, stats, loading }: { label: string; stats: StripStat[]; loading: boolean }) {
  return <section aria-label={label} aria-busy={loading} className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-[#fff] shadow-sm md:flex-row md:divide-x md:divide-y-0">
    {stats.map(stat => <Cell key={stat.key} stat={stat} loading={loading} />)}
  </section>
}
