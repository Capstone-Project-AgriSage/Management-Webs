import { useCallback, useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { businessReportsApi } from '@/api/businessReportsApi'
import { useReportData } from '@/features/agent/reports/useReportData'
import { periodProblem } from '@/features/agent/reports/reportFilters'
import { formatVnd, formatVndShort } from '@/utils/money'

// The revenue report pages its rows, so one request covers this many days; a longer period asks for a shorter one.
const MAX_DAYS = 100

/** Every day from `from` to `to` (inclusive, "YYYY-MM-DD"), so a day without sales shows as an empty bar and not as a gap. */
function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  const end = Date.parse(`${to}T00:00:00Z`)
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10))
  return days
}

const dayMonth = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`

/** Net sales per day for the period of the dashboard, from the same revenue report as the headline figure. */
export default function RevenueByDayChart({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const problem = periodProblem(fromDate, toDate)
  const load = useCallback((signal: AbortSignal) => businessReportsApi.revenue({ fromDate, toDate, groupBy: 'DAY', page: 1, pageSize: MAX_DAYS }, signal), [fromDate, toDate])
  const { data, loading, error } = useReportData(load, problem)
  const points = useMemo(() => {
    if (!data || data.totalPages > 1) return []
    const byDay = new Map(data.rows.map(row => [row.key, row.netSales]))
    return eachDay(fromDate, toDate).map(day => ({ day, netSales: byDay.get(day) ?? 0 }))
  }, [data, fromDate, toDate])
  const tooLong = !!data && data.totalPages > 1
  const total = points.reduce((sum, point) => sum + point.netSales, 0)
  const best = points.reduce<(typeof points)[number] | null>((top, point) => (!top || point.netSales > top.netSales ? point : top), null)

  return <section aria-label="Doanh thu thuần theo ngày" className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold text-slate-900">Doanh thu thuần theo ngày</h2>
      {points.length > 0 && best && total > 0 && <p className="text-xs text-slate-500">Ngày cao nhất: <strong className="font-semibold text-slate-700">{dayMonth(best.day)}</strong> ({formatVnd(best.netSales)})</p>}
    </div>
    {problem ? null
      : error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      : loading ? <div aria-hidden="true" className="h-64 animate-pulse rounded-lg bg-slate-50" />
      : tooLong ? <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Biểu đồ theo ngày chỉ hiển thị khoảng tối đa {MAX_DAYS} ngày. Hãy chọn khoảng ngắn hơn.</p>
      : total === 0 ? <p role="status" className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-600">Chưa có doanh thu ghi nhận trong kỳ này.</p>
      : <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="day" tickFormatter={dayMonth} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={12} />
            <YAxis tickFormatter={value => formatVndShort(Number(value))} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={64} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={value => [formatVnd(Number(value)), 'Doanh thu thuần']} labelFormatter={label => `Ngày ${String(label).slice(8, 10)}/${String(label).slice(5, 7)}/${String(label).slice(0, 4)}`} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="netSales" name="Doanh thu thuần" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>}
    <p className="text-xs text-slate-500">Doanh thu ghi nhận khi giao hàng, đã trừ hàng trả; cùng báo cáo với số liệu ở trên.</p>
  </section>
}
