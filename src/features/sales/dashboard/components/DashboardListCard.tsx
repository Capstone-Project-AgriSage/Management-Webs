import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface DashboardListCardProps<T> {
  title: string
  linkTo: string
  items: T[]
  getKey: (item: T) => string
  renderRow: (item: T) => ReactNode
  emptyMessage: string
  maxItems?: number
}

/** Shared "header + Xem tất cả link + row list + empty state" card used by Dashboard's summary sections. */
export default function DashboardListCard<T>({ title, linkTo, items, getKey, renderRow, emptyMessage, maxItems = 5 }: DashboardListCardProps<T>) {
  const visibleItems = items.slice(0, maxItems)

  return (
    <div className="agrisage-dashboard-list min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <Link to={linkTo} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 shrink-0">
          Xem tất cả <ArrowRight size={12} />
        </Link>
      </div>
      <ul className="divide-y divide-slate-50">
        {visibleItems.length === 0 ? (
          <li className="py-6 text-center text-sm text-slate-500">{emptyMessage}</li>
        ) : (
          visibleItems.map((item) => <li key={getKey(item)}>{renderRow(item)}</li>)
        )}
      </ul>
    </div>
  )
}
