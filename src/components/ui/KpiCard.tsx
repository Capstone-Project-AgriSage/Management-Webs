import type { ReactNode } from 'react';

interface KpiCardProps {
  title: string
  value: ReactNode
  valueClassName?: string
  /** Rendered right after the value, e.g. a unit word or a small badge. */
  valueSuffix?: ReactNode
  subtitle?: ReactNode
  subtitleClassName?: string
  className?: string
  children?: ReactNode
}

export default function KpiCard({
  title,
  value,
  valueClassName = 'text-slate-900',
  valueSuffix,
  subtitle,
  subtitleClassName = 'text-slate-500',
  className = 'border-slate-200',
  children,
}: KpiCardProps) {
  return (
    <div className={`agrisage-kpi-card flex h-full min-w-0 flex-col justify-center bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)] border ${className}`}>
      <div className="agrisage-kpi-content grid w-full min-w-0 flex-1 grid-rows-[minmax(40px,auto)_minmax(32px,auto)_minmax(20px,1fr)] gap-2">
        <h3 className="agrisage-kpi-title flex min-h-10 items-end text-sm font-medium leading-5 text-slate-500">{title}</h3>
        <div className="agrisage-kpi-value flex min-h-8 min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`text-2xl font-bold leading-8 tracking-tight tabular-nums [overflow-wrap:anywhere] ${valueClassName}`}>{value}</span>
          {valueSuffix}
        </div>
        {subtitle ? <p className={`agrisage-kpi-note min-h-5 text-xs leading-5 ${subtitleClassName}`}>{subtitle}</p> : <div className="min-h-5" aria-hidden="true" />}
      </div>
      {children}
    </div>
  )
}
