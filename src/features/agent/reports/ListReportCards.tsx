import { BarChart3, Receipt } from 'lucide-react';
import KpiCard from '@/components/ui/KpiCard'
import { formatVnd } from '@/utils/money';

interface ListMetric {
  label: string
  value: number | null
  kind?: 'money' | 'count'
}

interface Props {
  title: string
  totalCount: number | null
  unit: string
  loading: boolean
  error?: boolean
  metrics: ListMetric[]
}

/** Reuses the authorized list response: totalCount covers all matches; metrics cover only the visible page. */
export default function ListReportCards({ title, totalCount, unit, loading, error = false, metrics }: Props) {
  const unavailable = error || totalCount === null
  const display = (value: number | null, money = false) => loading
    ? <span aria-hidden="true" className="inline-block h-7 w-28 rounded bg-slate-100 animate-pulse align-middle" />
    : unavailable || value === null ? '—' : money ? formatVnd(value) : value.toLocaleString('vi-VN')

  return <section aria-label={title} className="space-y-3">
    <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
    <div aria-busy={loading} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard className="border-slate-200 min-h-40" icon={Receipt} iconClassName="bg-primary/10 text-primary" title="Kết quả tìm kiếm" value={display(totalCount ?? 0)} valueSuffix={!loading && !unavailable ? <span className="ml-1 text-xs text-slate-500">{unit}</span> : undefined} subtitle="Tất cả kết quả theo bộ lọc" />
      {metrics.map(metric => <KpiCard key={metric.label} className="border-slate-200 min-h-40" icon={BarChart3} iconClassName="bg-emerald-50 text-emerald-600" title={metric.label} value={display(metric.value, metric.kind === 'money')} subtitle="Trên trang đang hiển thị" />)}
    </div>
  </section>
}
