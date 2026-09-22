import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

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
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClassName}`}>
      <Icon size={18} />
    </div>
  )
  const titleEl = <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
  const valueEl = (
    <div className="flex items-baseline gap-2">
      <span className={`text-2xl font-bold tabular-nums ${valueClassName}`}>{value}</span>
      {valueSuffix}
    </div>
  )
  const subtitleEl = subtitle ? <p className={`text-xs mt-1 ${subtitleClassName}`}>{subtitle}</p> : null

  if (layout === 'header') {
    return (
      <div className={`bg-white rounded-xl p-4 shadow-sm border ${className}`}>
        <div className="flex items-center justify-between mb-1.5">
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
      <div className={`bg-white rounded-xl p-4 shadow-sm border flex items-start justify-between ${className}`}>
        <div className="space-y-1">
          {titleEl}
          {valueEl}
          {subtitleEl}
        </div>
        {iconBox}
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border ${className}`}>
      {iconBox}
      <h3 className="text-sm font-semibold text-slate-900 mt-3">{title}</h3>
      <p className={`text-xl font-bold mt-1 ${valueClassName}`}>
        {value}
        {valueSuffix}
      </p>
      {subtitleEl}
      {children}
    </div>
  )
}
