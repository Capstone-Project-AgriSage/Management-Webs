import { Children, Fragment, isValidElement, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { BarChart3, Receipt, RefreshCw } from 'lucide-react';
import { usePermission } from '@/context/PermissionContext';
import KpiCard from '@/components/ui/KpiCard'
import { todayVn } from '@/utils/creditLabels';
import { formatVnd } from '@/utils/money';
import { firstOfMonthVn, periodProblem, reportInputClass } from './reportFilters';
import { useReportData } from './useReportData';
import { inlineReports, type InlineReportKind, type InlineReportResult, type ReportMetric } from './inlineReportConfig';

interface Props {
  kind: InlineReportKind
  fromDate?: string
  toDate?: string
  onFromDateChange?: (value: string) => void
  onToDateChange?: (value: string) => void
  searchResult?: { count: number; unit: string }
  leadingCards?: ReactNode
}

function SearchResult({ result }: { result: NonNullable<Props['searchResult']> }) {
  return <KpiCard icon={Receipt} iconClassName="bg-primary/10 text-primary" title="Kết quả tìm kiếm" value={result.count} valueSuffix={<span className="text-xs text-slate-500">{result.unit}</span>} subtitle="Tất cả kết quả theo bộ lọc" className="border-slate-200 min-h-40" />
}

function flattenCards(cards: ReactNode): ReactNode[] {
  return Children.toArray(cards).flatMap(card => isValidElement<{ children?: ReactNode }>(card) && card.type === Fragment ? flattenCards(card.props.children) : [card])
}

export default function BusinessReportCards(props: Props) {
  const { has } = usePermission()
  if (!has('REPORTS.READ')) {
    const leading = flattenCards(props.leadingCards)
    const labels = inlineReports[props.kind].labels
    const cards = [...leading, ...(props.searchResult ? [<SearchResult key="search" result={props.searchResult} />] : [])]
    return <section aria-label="Tổng hợp danh sách" className="space-y-3">
      <div className="agrisage-summary-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.slice(0, 4)}
        {Array.from({ length: Math.max(0, 4 - cards.length) }, (_, index) => <KpiCard key={labels[index] ?? index} icon={BarChart3} iconClassName="bg-slate-100 text-slate-400" title={labels[index] ?? 'Số liệu tổng hợp'} value="—" subtitle="Cần quyền xem báo cáo" className="border-slate-200 min-h-40" />)}
      </div>
    </section>
  }
  return <AuthorizedReportCards {...props} />
}

function AuthorizedReportCards({ kind, fromDate, toDate, onFromDateChange, onToDateChange, searchResult, leadingCards }: Props) {
  const config = inlineReports[kind]
  const [localFrom, setLocalFrom] = useState(firstOfMonthVn)
  const [localTo, setLocalTo] = useState(todayVn)
  const from = fromDate || (toDate ? `${toDate.slice(0, 8)}01` : localFrom)
  const to = toDate || (fromDate && fromDate > localTo ? fromDate : localTo)
  const problem = config.period ? periodProblem(from, to) : null
  const load = useCallback((signal: AbortSignal): Promise<InlineReportResult> => {
    return config.load({ fromDate: from, toDate: to }, signal)
  }, [config, from, to])
  const { data, loading, error, refresh } = useReportData(load, problem)
  const leading = flattenCards(leadingCards)
  const includeSearchCard = !!searchResult && leading.length + config.labels.length < 4
  const reportSlots = Math.max(0, 4 - leading.length - (includeSearchCard ? 1 : 0))
  const valueText = (metric: ReportMetric) => metric.value == null ? '—' : metric.kind === 'money' ? formatVnd(metric.value) : metric.kind === 'percent' ? `${metric.value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%` : metric.value.toLocaleString('vi-VN')

  return <section aria-label={config.title} className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{config.title}</h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {config.period && <>
          <input aria-label={`${config.title}: từ ngày`} type="date" className={reportInputClass} value={from} max={to} onChange={event => (onFromDateChange ?? setLocalFrom)(event.target.value)} />
          <span className="text-slate-400">→</span>
          <input aria-label={`${config.title}: đến ngày`} type="date" className={reportInputClass} value={to} min={from} onChange={event => (onToDateChange ?? setLocalTo)(event.target.value)} />
        </>}
        <button type="button" aria-label={`Làm mới ${config.title.toLowerCase()}`} onClick={refresh} disabled={loading || !!problem} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Làm mới</button>
      </div>
    </div>
    <div aria-busy={loading} className="agrisage-summary-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {leading.slice(0, 4)}
      {includeSearchCard && searchResult && <SearchResult result={searchResult} />}
      {config.labels.slice(0, reportSlots).map((label, index) => {
        const metric = data?.metrics[index]
        return <KpiCard key={label} className="border-slate-200 min-h-40" icon={BarChart3} iconClassName="bg-emerald-50 text-emerald-600" title={label} value={metric ? valueText(metric) : loading ? <span aria-hidden="true" className="inline-block h-7 w-28 rounded bg-slate-100 animate-pulse align-middle" /> : '—'} subtitle={<span className="block min-h-4">{metric?.note ?? '\u00a0'}</span>} />
      })}
    </div>
    {searchResult && !includeSearchCard && <p className="text-xs text-slate-500">Kết quả theo bộ lọc: <strong className="font-semibold text-slate-700">{searchResult.count.toLocaleString('vi-VN')} {searchResult.unit}</strong></p>}
    <p className="text-xs text-slate-500">{config.note} Độc lập với tìm kiếm và phân trang danh sách.</p>
    <p role="status" className="min-h-4 text-xs text-slate-500">{loading ? 'Đang tải số liệu tổng hợp…' : '\u00a0'}</p>
    {(problem || error) && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{problem ?? error}</p>}
  </section>
}
