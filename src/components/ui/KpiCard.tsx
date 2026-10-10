import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface KpiCardProps {
  icon: LucideIcon
  /** Tailwind classes for the icon box's background + text color, e.g. "bg-emerald-50 text-emerald-600". */
  iconClassName: string
  title: string
  value: ReactNode
  valueClassName?: string
  /** Rendered right after the value, e.g. a unit word or a small badge. */
  valueSuffix?: ReactNode
  subtitle?: ReactNode
  subtitleClassName?: string
  /** Where the icon box sits relative to the title/value block. Matches the three layouts already in use:
   * 'stacked' (icon above everything, Dashboard-style), 'header' (icon beside the title, Farmers-style),
   * 'side' (icon beside the whole value block, Products-style). */
  layout?: 'stacked' | 'header' | 'side'
  className?: string
  children?: ReactNode
}

export default function KpiCard({
  icon: Icon,
  iconClassName,
  title,
  value,
  valueClassName = 'text-slate-900',
  valueSuffix,
  subtitle,
  subtitleClassName = 'text-slate-500',
  layout = 'stacked',
  className = 'border-slate-200',
  children,
}: KpiCardProps) {
  const iconBox = (
    <div className={`agrisage-kpi-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClassName}`}>
      <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
    </div>
  )
  const titleEl = <h3 className="text-sm font-medium leading-5 text-slate-500">{title}</h3>
  const valueEl = (
    <div className="flex min-h-8 min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={`text-2xl font-bold tracking-tight tabular-nums [overflow-wrap:anywhere] ${valueClassName}`}>{value}</span>
      {valueSuffix}
    </div>
  )
  const subtitleEl = subtitle ? <p className={`text-xs leading-5 mt-2 ${subtitleClassName}`}>{subtitle}</p> : null

  if (layout === 'header') {
    return (
      <div className={`agrisage-kpi-card min-w-0 bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)] border ${className}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          {titleEl}
          {iconBox}
        </div>
        {valueEl}
        {subtitleEl}
        {children}
      </div>
    )
  }

  if (layout === 'side') {
    return (
      <div className={`agrisage-kpi-card min-w-0 bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)] border flex items-start justify-between gap-3 ${className}`}>
        <div className="min-w-0 space-y-2">
          {titleEl}
          {valueEl}
          {subtitleEl}
        </div>
        {iconBox}
      </div>
    )
  }

  return (
    <div className={`agrisage-kpi-card min-w-0 bg-white rounded-xl p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)] border ${className}`}>
      {iconBox}
      <h3 className="text-sm font-medium leading-5 text-slate-500 mt-4">{title}</h3>
      <div className={`flex min-h-8 min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-2xl font-bold tracking-tight tabular-nums mt-2 [overflow-wrap:anywhere] ${valueClassName}`}>
        {value}
        {valueSuffix}
      </div>
      {subtitleEl}
      {children}
    </div>
  )
}
