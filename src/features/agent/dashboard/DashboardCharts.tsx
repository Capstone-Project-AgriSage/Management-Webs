import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowDownRight, ArrowUpRight, Banknote, CircleDollarSign, Clock, Coins, Globe, Landmark, Minus, PackageCheck, QrCode, Receipt,
  ShieldCheck, Smartphone, Store, TriangleAlert, Undo2, Wallet, type LucideIcon,
} from 'lucide-react'
import { businessReportsApi, type OrderMetrics, type PaymentMetrics, type PaymentTotals, type PeriodReport, type RevenueReport, type RevenueSummary } from '@/api/businessReportsApi'
import { reportsApi, type DebtAgingReport, type DebtByGroupReport } from '@/api/reportsApi'
import { useReportData } from '@/features/agent/reports/useReportData'
import { periodProblem } from '@/features/agent/reports/reportFilters'
import { rangeDays } from '@/utils/units'
import { formatVnd } from '@/utils/money'

export interface DashboardLinks { orders?: string; payments?: string; products?: string; debts?: string }

// One accent (the project's green) for every single-series mark, slate for the quiet parts, and a status red only where the
// color means "overdue", always next to an icon and a label. Checked with the dataviz palette validator: green/red as a pair
// (deutan ΔE 10), and the funnel's four greens as an ordinal ramp (lightest step 2.28:1 on white).
const C = { accent: '#16a34a', track: '#dcfce7', quiet: '#cbd5e1', grid: '#e2e8f0', axis: '#61746c', overdue: '#be123c' }
const FUNNEL_RAMP = ['#22c55e', '#16a34a', '#15803d', '#166534']

// The database behind the API allows few connections at once, and the tiles and the order list ask in parallel too,
// so the charts queue their requests and keep at most this many open.
const MAX_PARALLEL = 3
let active = 0
const waiting: (() => void)[] = []
function queued<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // Promise.resolve().then turns a synchronous throw into a rejection, so a failing call can never keep its slot.
    const start = () => { active++; Promise.resolve().then(run).then(resolve, reject).finally(() => { active--; waiting.shift()?.() }) }
    if (active < MAX_PARALLEL) start()
    else waiting.push(start)
  })
}

interface Report<T> { data: T | null; loading: boolean; error: string | null; stale: boolean }

/** A queued report that keeps showing its last result, dimmed, while the next one loads, so a filter change never flashes the layout. */
function useReport<T>(load: (signal: AbortSignal) => Promise<T>, problem: string | null = null): Report<T> {
  const queuedLoad = useCallback((signal: AbortSignal) => queued(() => load(signal)), [load])
  const result = useReportData(queuedLoad, problem)
  const [shown, setShown] = useState<T | null>(null)
  if (result.data && result.data !== shown) setShown(result.data)
  return { data: result.data ?? (result.loading ? shown : null), loading: result.loading, error: result.error, stale: result.loading && shown !== null }
}

const num = (value: number, digits = 0) => value.toLocaleString('vi-VN', { maximumFractionDigits: digits })
const percent = (value: number) => `${num(value, Math.abs(value) < 10 ? 1 : 0)}%`
/** Short money for axes and secondary figures: 1,2 tỷ · 25,3 tr · 751K. */
function shortVnd(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${num(value / 1e9, 1)} tỷ`
  if (abs >= 1e6) return `${num(value / 1e6, 1)} tr`
  if (abs >= 1e3) return `${num(value / 1e3)}K`
  return num(value)
}

/** What a headline shows without data: a pulse while the report loads, a dash when it failed (never a pulse that never ends). */
const placeholder = (report: { loading: boolean }, width: string) => (report.loading ? <Skeleton className={`h-7 ${width}`} /> : '—')
const Skeleton = ({ className }: { className: string }) => <span aria-hidden="true" className={`inline-block animate-pulse rounded bg-slate-100 align-middle ${className}`} />

function Delta({ value, upIsGood = true }: { value: number; upIsGood?: boolean }) {
  if (Math.abs(value) < 0.05) return <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600"><Minus size={12} aria-hidden="true" />0%</span>
  const up = value > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${up === upIsGood ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'}`}>
    <Icon size={12} aria-hidden="true" />{up ? '+' : '−'}{percent(Math.abs(value))}
  </span>
}

/** The change against the period just before; left out when that period had nothing, so empty history adds no text. */
function Versus({ current, previous, upIsGood, extra }: { current: number; previous: number; upIsGood?: boolean; extra?: ReactNode }) {
  if (previous <= 0 && !extra) return null
  return <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
    {previous > 0 && <><Delta value={(current - previous) / previous * 100} upIsGood={upIsGood} /><span>so với kỳ trước</span></>}
    {extra && <span>{previous > 0 && '· '}{extra}</span>}
  </p>
}

/** A card in the style of the dashboard: a quiet label, one headline that tells the story, then the chart. */
function Panel({ label, to, headline, sub, aside, className = '', children }: { label: string; to?: string; headline?: ReactNode; sub?: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  return <section aria-label={label} className={`flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-slate-500">{label}</h3>
        {headline !== undefined && <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold leading-8 text-slate-900">{headline}{sub && <span className="text-sm font-normal text-slate-500">{sub}</span>}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {aside}
        {to && <Link to={to} aria-label={`Xem chi tiết: ${label}`} title="Xem chi tiết" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"><ArrowUpRight size={18} /></Link>}
      </div>
    </header>
    {children}
  </section>
}

/** A browser network failure reads "Failed to fetch" (or similar); say it in Vietnamese. API errors already carry the server's own text. */
const friendly = (message: string) => (/failed to fetch|networkerror|load failed|network request failed/i.test(message) ? 'Không kết nối được máy chủ. Hãy kiểm tra mạng rồi bấm làm mới.' : message)

/** Loading, error and empty states shared by every panel; the panel itself only draws its data. */
function Body<T>({ state, empty, emptyText = 'Chưa có dữ liệu trong kỳ này.', skeleton = 'h-40', children }: { state: Report<T>; empty?: (data: T) => boolean; emptyText?: string; skeleton?: string; children: (data: T) => ReactNode }) {
  if (!state.data) {
    if (state.error) return <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{friendly(state.error)}</p>
    return state.loading ? <div aria-hidden="true" className={`mt-4 animate-pulse rounded-xl bg-slate-50 ${skeleton}`} /> : null
  }
  if (empty?.(state.data)) return <p role="status" className="mt-4 rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">{emptyText}</p>
  return <div aria-busy={state.loading} className={`flex flex-1 flex-col transition-opacity ${state.stale ? 'opacity-60' : ''}`}>{children(state.data)}</div>
}

// ---- Overview: the period's figures next to the revenue curve ------------------------------------------------------------

function StatGrid({ summary, payments }: { summary: Report<RevenueSummary>; payments: Report<PeriodReport<PaymentMetrics, PaymentTotals>> }) {
  const s = summary.data
  const cur = s?.current
  const prev = s?.previous
  const stats: { label: string; icon: LucideIcon; value: ReactNode; foot: ReactNode }[] = [
    { label: 'Doanh thu thuần', icon: CircleDollarSign, value: cur && formatVnd(cur.netSales), foot: cur && prev && <Versus current={cur.netSales} previous={prev.netSales} /> },
    { label: 'Lãi gộp', icon: Coins, value: cur && formatVnd(cur.grossProfit), foot: cur && prev && <Versus current={cur.grossProfit} previous={prev.grossProfit} extra={cur.grossMarginPercent != null ? `Biên lãi gộp ${percent(cur.grossMarginPercent)}` : undefined} /> },
    { label: 'Đơn giao thành công', icon: PackageCheck, value: cur && `${num(cur.orderCount)} đơn`, foot: cur && prev && <Versus current={cur.orderCount} previous={prev.orderCount} /> },
    { label: 'Giá trị đơn trung bình', icon: Receipt, value: cur && formatVnd(cur.averageOrderValue), foot: cur && prev && <Versus current={cur.averageOrderValue} previous={prev.averageOrderValue} /> },
    { label: 'Tiền thực thu', icon: Wallet, value: payments.data && formatVnd(payments.data.totals.netReceivedAmount), foot: payments.data && <p className="text-xs text-slate-500">Gồm thu nợ {formatVnd(payments.data.totals.debtRepaymentAmount)}</p> },
    { label: 'Hàng trả lại', icon: Undo2, value: cur && formatVnd(cur.returnValue), foot: cur && prev && <Versus current={cur.returnValue} previous={prev.returnValue} upIsGood={false} /> },
  ]
  const failed = (summary.error && !s) || (payments.error && !payments.data)
  return <section aria-label="Chỉ số kinh doanh trong kỳ" title={s?.previousFromDate && s.previousToDate ? `So với kỳ trước: ${dayMonthYear(s.previousFromDate)} → ${dayMonthYear(s.previousToDate)}` : undefined} className={`grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm transition-opacity ${summary.stale ? 'opacity-60' : ''}`}>
    {stats.map(stat => {
      const Icon = stat.icon
      return <div key={stat.label} className="flex min-w-0 flex-col gap-2 bg-[#fff] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm text-slate-500">{stat.label}</span>
          <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg bg-green-50 text-green-700 sm:grid"><Icon size={16} aria-hidden="true" /></span>
        </div>
        <span className="text-lg font-semibold leading-7 text-slate-900 [overflow-wrap:anywhere] sm:text-2xl sm:leading-8">{stat.value ?? (failed ? '—' : <Skeleton className="h-7 w-28" />)}</span>
        <div className="min-h-6">{stat.foot}</div>
      </div>
    })}
  </section>
}

type Granularity = 'DAY' | 'WEEK' | 'MONTH'
const UNIT: Record<Granularity, string> = { DAY: 'ngày', WEEK: 'tuần', MONTH: 'tháng' }
// The curve keeps one point per day for a month or so, then folds into weeks and months so it never turns into noise.
const granularityFor = (days: number): Granularity => (days <= 45 ? 'DAY' : days <= 182 ? 'WEEK' : 'MONTH')
const dayMonth = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`
const dayMonthYear = (key: string) => `${dayMonth(key)}/${key.slice(0, 4)}`
const tickOf = (g: Granularity, key: string) => (g === 'MONTH' ? `T${Number(key.slice(5, 7))}` : dayMonth(key))
const titleOf = (g: Granularity, key: string) => (g === 'MONTH' ? `Tháng ${Number(key.slice(5, 7))}/${key.slice(0, 4)}` : `${g === 'WEEK' ? 'Tuần từ' : 'Ngày'} ${dayMonth(key)}/${key.slice(0, 4)}`)

interface TrendPoint { key: string; tick: string; title: string; netSales: number; orders: number }

function TrendTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: TrendPoint }> }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return <div className="rounded-xl border border-slate-200 bg-[#fff] px-3 py-2 text-xs shadow-lg">
    <p className="text-slate-500">{point.title}</p>
    <p className="mt-1 flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: C.accent }} /><strong className="text-sm font-semibold text-slate-900">{formatVnd(point.netSales)}</strong></p>
    <p className="mt-0.5 pl-5 text-slate-500">{num(point.orders)} đơn giao</p>
  </div>
}

function TrendPanel({ trend, requested }: { trend: Report<RevenueReport>; requested: Granularity }) {
  // Label by what the shown rows were grouped by: while the next period loads, the previous rows stay on screen.
  const granularity = (trend.data?.groupBy as Granularity | undefined) ?? requested
  const points: TrendPoint[] = (trend.data?.rows ?? []).map(row => ({ key: row.key, tick: tickOf(granularity, row.key), title: titleOf(granularity, row.key), netSales: row.netSales, orders: row.orderCount }))
  const best = points.reduce<TrendPoint | null>((top, point) => (!top || point.netSales > top.netSales ? point : top), null)
  const label = `Doanh thu thuần theo ${UNIT[granularity]}`
  return <Panel label={label} aside={best && best.netSales > 0 ? <span className="text-xs text-slate-500">Cao nhất <strong className="font-semibold text-slate-700">{best.tick}</strong> · {shortVnd(best.netSales)}</span> : undefined}>
    <Body state={trend} skeleton="h-72" empty={data => !data.rows.some(row => row.netSales !== 0)} emptyText="Chưa có doanh thu ghi nhận trong kỳ này.">
      {() => <>
        <div className="mt-4 h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="key" tickFormatter={key => tickOf(granularity, String(key))} tick={{ fontSize: 12, fill: C.axis }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={24} />
              <YAxis tickFormatter={value => shortVnd(Number(value))} tick={{ fontSize: 12, fill: C.axis }} tickLine={false} axisLine={false} width={56} />
              <Tooltip cursor={{ stroke: C.axis, strokeWidth: 1 }} content={<TrendTooltip />} />
              <Area type="monotone" dataKey="netSales" stroke={C.accent} strokeWidth={2} fill={C.accent} fillOpacity={0.1} isAnimationActive={false}
                dot={points.length === 1 ? { r: 4, fill: C.accent, stroke: '#fff', strokeWidth: 2 } : false} activeDot={{ r: 5, fill: C.accent, stroke: '#fff', strokeWidth: 2 }} />
              {best && best.netSales > 0 && points.length > 1 && <ReferenceDot x={best.key} y={best.netSales} r={4} fill={C.accent} stroke="#fff" strokeWidth={2} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only">
          <caption>{label}</caption>
          <thead><tr><th scope="col">Thời gian</th><th scope="col">Doanh thu thuần</th><th scope="col">Đơn giao</th></tr></thead>
          <tbody>{points.map(point => <tr key={point.key}><th scope="row">{point.title}</th><td>{formatVnd(point.netSales)}</td><td>{num(point.orders)}</td></tr>)}</tbody>
        </table>
        <p className="mt-auto pt-3 text-xs text-slate-500">Ghi nhận khi giao hàng, đã trừ hàng trả. Lãi gộp tính trước trả hàng và chưa trừ chi phí vận hành.</p>
      </>}
    </Body>
  </Panel>
}

// ---- Sales mix ------------------------------------------------------------------------------------------------------------

function CategoryPanel({ report, to }: { report: Report<RevenueReport>; to?: string }) {
  const data = report.data
  const total = data?.totals.netSales ?? 0
  const rows = (data?.rows ?? []).filter(row => row.netSales > 0)
  const top = rows[0]
  const rest = total - rows.reduce((sum, row) => sum + row.netSales, 0)
  const segments = [...rows.map(row => ({ key: row.key, name: row.label, value: row.netSales })), ...(rest > 0 ? [{ key: 'rest', name: 'Nhóm khác', value: rest }] : [])]
  return <Panel label="Nhóm sản phẩm bán chạy" to={to} headline={top && total > 0 ? percent(top.netSales / total * 100) : data ? undefined : placeholder(report, "w-20")} sub={top && total > 0 ? <>doanh thu từ <strong className="font-medium text-slate-700">{top.label}</strong></> : undefined}>
    <Body state={report} empty={() => !top || total <= 0} emptyText="Chưa có doanh thu theo nhóm trong kỳ này.">
      {() => top && <>
        <div className="mt-4 flex h-2.5 w-full gap-0.5" role="img" aria-label={`Tỷ trọng doanh thu: ${segments.map(segment => `${segment.name} ${percent(segment.value / total * 100)}`).join(', ')}`}>
          {segments.map((segment, index) => <span key={segment.key} title={`${segment.name}: ${percent(segment.value / total * 100)}`} className="h-full rounded-full" style={{ flexGrow: segment.value, flexBasis: 0, minWidth: 4, backgroundColor: index === 0 ? C.accent : C.quiet }} />)}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: C.accent }} />{top.label}</li>
          {segments.length > 1 && <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: C.quiet }} />Các nhóm khác</li>}
        </ul>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div aria-hidden="true" className="grid grid-cols-[minmax(0,1fr)_3rem_4.5rem] gap-x-3 pb-2 text-xs text-slate-500"><span>Nhóm</span><span className="text-right">Tỷ trọng</span><span className="text-right">Doanh thu</span></div>
          <ul className="space-y-2.5">
            {rows.slice(0, 4).map(row => <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_3rem_4.5rem] items-center gap-x-3 text-sm">
              <span className="min-w-0"><span title={row.label} className="block truncate font-medium text-slate-900">{row.label}</span><span className="block text-xs text-slate-500">{num(row.orderCount)} đơn</span></span>
              <span className="text-right tabular-nums text-slate-600">{percent(row.netSales / total * 100)}</span>
              <span title={formatVnd(row.netSales)} className="text-right font-semibold tabular-nums text-slate-900">{shortVnd(row.netSales)}</span>
            </li>)}
          </ul>
        </div>
      </>}
    </Body>
  </Panel>
}

interface ShareRow { key: string; name: string; icon: LucideIcon; value: number; unit: string; detail?: string }

/** One single-color bar per entry, each named and labeled with its count and share, so the bars never need a color legend. */
function ShareBars({ rows }: { rows: ShareRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return <ul className="mt-5 space-y-4">
    {rows.map(row => {
      const Icon = row.icon
      const share = total ? row.value / total * 100 : 0
      return <li key={row.key} className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700"><Icon size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium text-slate-900">{row.name}</span>
            <span className="shrink-0 tabular-nums"><strong className="font-semibold text-slate-900">{num(row.value)}</strong> <span className="text-xs text-slate-500">{row.unit} · {percent(share)}</span></span>
          </div>
          <div className="mt-1.5 h-2 w-full rounded-full" style={{ backgroundColor: C.track }}>
            <div className="h-full rounded-full" style={{ width: `${row.value ? Math.max(share, 1.5) : 0}%`, backgroundColor: C.accent }} />
          </div>
          {row.detail && <p className="mt-1 text-xs text-slate-500">{row.detail}</p>}
        </div>
      </li>
    })}
  </ul>
}

const SOURCES: { key: string; name: string; icon: LucideIcon }[] = [
  { key: 'COUNTER', name: 'Tại quầy', icon: Store },
  { key: 'FARMER_WEB', name: 'Web nông dân', icon: Globe },
  { key: 'FARMER_MOBILE', name: 'App nông dân', icon: Smartphone },
]
const METHODS: { key: string; name: string; icon: LucideIcon; aliases?: string[] }[] = [
  { key: 'CASH', name: 'Tiền mặt', icon: Banknote },
  { key: 'PAY_OS', name: 'payOS', icon: QrCode, aliases: ['PAYOS'] },
  { key: 'BANK_TRANSFER', name: 'Chuyển khoản', icon: Landmark },
]

function SourcesPanel({ report, to }: { report: Report<PeriodReport<OrderMetrics>>; to?: string }) {
  const data = report.data
  const byKey = new Map((data?.rows ?? []).map(row => [row.key, row]))
  const rows: ShareRow[] = SOURCES.map(source => ({ key: source.key, name: source.name, icon: source.icon, value: byKey.get(source.key)?.orderCount ?? 0, unit: 'đơn', detail: `Giá trị đơn ${formatVnd(byKey.get(source.key)?.orderValue ?? 0)}` }))
  return <Panel label="Kênh bán hàng" to={to} headline={data ? `${num(data.totals.orderCount)} đơn` : placeholder(report, "w-24")} sub={data ? 'tạo trong kỳ' : undefined}>
    <Body state={report} empty={d => !d.totals.orderCount} emptyText="Chưa có đơn nào trong kỳ này.">{() => <ShareBars rows={rows} />}</Body>
  </Panel>
}

function MethodsPanel({ report, to }: { report: Report<PeriodReport<PaymentMetrics, PaymentTotals>>; to?: string }) {
  const data = report.data
  const rows: ShareRow[] = METHODS.map(method => {
    const found = (data?.rows ?? []).filter(row => row.key === method.key || method.aliases?.includes(row.key))
    const amount = found.reduce((sum, row) => sum + row.receivedAmount, 0)
    return { key: method.key, name: method.name, icon: method.icon, value: found.reduce((sum, row) => sum + row.paymentCount, 0), unit: 'lần', detail: formatVnd(amount) }
  })
  return <Panel label="Phương thức thanh toán" to={to} headline={data ? `${num(data.totals.paymentCount)} lần thu` : placeholder(report, "w-28")} sub={data ? 'trong kỳ' : undefined}>
    <Body state={report} empty={d => !d.totals.paymentCount} emptyText="Chưa thu khoản nào trong kỳ này.">{() => <ShareBars rows={rows} />}</Body>
  </Panel>
}

// ---- Orders and debt ------------------------------------------------------------------------------------------------------

// A real funnel: each stage counts the orders created in the period that got at least that far (cancelled ones dropped out).
// PARTIALLY_CANCELLED is where an order ends when part of it was cancelled at fulfilment, so it counts as finished.
const REACHED = {
  confirmed: ['CONFIRMED', 'PREPARING', 'READY_FOR_FULFILLMENT', 'PARTIALLY_FULFILLED', 'COMPLETED', 'PARTIALLY_CANCELLED'],
  ready: ['READY_FOR_FULFILLMENT', 'PARTIALLY_FULFILLED', 'COMPLETED', 'PARTIALLY_CANCELLED'],
  done: ['COMPLETED', 'PARTIALLY_CANCELLED'],
}

function FunnelPanel({ report, to }: { report: Report<PeriodReport<OrderMetrics>>; to?: string }) {
  const data = report.data
  const byKey = new Map((data?.rows ?? []).map(row => [row.key, row.orderCount]))
  const count = (keys: string[]) => keys.reduce((sum, key) => sum + (byKey.get(key) ?? 0), 0)
  const created = data?.totals.orderCount ?? 0
  const stages = [
    { name: 'Đơn tạo', value: created },
    { name: 'Đã xác nhận', value: count(REACHED.confirmed) },
    { name: 'Sẵn sàng giao', value: count(REACHED.ready) },
    { name: 'Hoàn thành', value: count(REACHED.done) },
  ]
  const width = (value: number) => Math.max(created ? value / created * 100 : 0, 4)
  return <Panel label="Tỷ lệ hoàn thành đơn" to={to} headline={data ? (created ? percent(stages[3].value / created * 100) : undefined) : placeholder(report, "w-20")} sub={data && created ? 'đơn tạo trong kỳ đã hoàn thành' : undefined}>
    <Body state={report} empty={() => !created} emptyText="Chưa có đơn nào trong kỳ này.">
      {() => <>
        <ol className="mt-5 space-y-0.5">
          {stages.map((stage, index) => {
            const top = width(stage.value)
            const bottom = index + 1 < stages.length ? width(stages[index + 1].value) : top * 0.8
            return <li key={stage.name} className="grid grid-cols-[3rem_minmax(0,1fr)_7rem] items-center gap-3">
              <span className="text-right text-sm font-semibold tabular-nums text-slate-900">{num(stage.value)}</span>
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-10 w-full" aria-hidden="true">
                <polygon points={`${50 - top / 2},0 ${50 + top / 2},0 ${50 + bottom / 2},40 ${50 - bottom / 2},40`} fill={FUNNEL_RAMP[index]} />
              </svg>
              <span className="min-w-0 text-sm"><span className="block truncate text-slate-700">{stage.name}</span><span className="block text-xs text-slate-500">{percent(created ? stage.value / created * 100 : 0)}</span></span>
            </li>
          })}
        </ol>
        <p className="mt-auto flex flex-wrap gap-x-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>{num(byKey.get('CANCELLED') ?? 0)} đơn bị hủy</span>
          <span>{num(byKey.get('PENDING_CONFIRMATION') ?? 0)} đơn chờ xác nhận</span>
        </p>
      </>}
    </Body>
  </Panel>
}

function Gauge({ share }: { share: number }) {
  const ticks = 32
  const filled = Math.round(share * ticks)
  return <svg viewBox="0 0 240 124" className="block w-full" aria-hidden="true">
    {Array.from({ length: ticks }, (_, index) => {
      const angle = Math.PI - (index + 0.5) * Math.PI / ticks
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      return <line key={index} x1={120 + 72 * cos} y1={118 - 72 * sin} x2={120 + 104 * cos} y2={118 - 104 * sin} stroke={index < filled ? C.accent : C.overdue} strokeWidth={6} strokeLinecap="round" />
    })}
  </svg>
}

function DebtPanel({ report, to }: { report: Report<DebtAgingReport>; to?: string }) {
  const data = report.data
  const totals = data?.totals
  const total = totals?.total ?? 0
  const share = totals && total > 0 ? totals.notDue / total : 1
  const stats = totals ? [
    { label: 'Trong hạn', detail: 'chưa tới hạn', value: totals.notDue, icon: ShieldCheck, good: true },
    { label: 'Quá hạn', detail: 'đến 30 ngày', value: totals.days1To30, icon: Clock, good: false },
    { label: 'Quá hạn', detail: 'trên 30 ngày', value: totals.days31To60 + totals.days61To90 + totals.over90, icon: TriangleAlert, good: false },
  ] : []
  return <Panel label="Công nợ phải thu" to={to} headline={data ? formatVnd(total) : placeholder(report, "w-32")} sub={data ? 'tính đến hôm nay' : undefined}>
    <Body state={report} empty={() => total <= 0} emptyText="Không có khoản nợ nào.">
      {() => <>
        <div className="relative mx-auto mt-4 w-full max-w-[260px]">
          <Gauge share={share} />
          <div className="absolute inset-x-0 bottom-0 text-center">
            <p className="text-3xl font-semibold leading-9 text-slate-900">{percent(share * 100)}</p>
            <p className="text-xs text-slate-500">nợ còn trong hạn</p>
          </div>
        </div>
        <dl className="mt-auto grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-4 text-center">
          {stats.map(stat => {
            const Icon = stat.icon
            return <div key={stat.detail} className="flex min-w-0 flex-col items-center gap-1 px-2">
              <span className={`grid h-7 w-7 place-items-center rounded-lg ${stat.good ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'}`}><Icon size={14} aria-hidden="true" /></span>
              <dt className="text-xs leading-4 text-slate-500"><span className="block font-medium text-slate-700">{stat.label}</span>{stat.detail}</dt>
              <dd title={formatVnd(stat.value)} className="text-sm font-semibold text-slate-900">{shortVnd(stat.value)}</dd>
            </div>
          })}
        </dl>
      </>}
    </Body>
  </Panel>
}

function DebtGroupsPanel({ report, to }: { report: Report<DebtByGroupReport>; to?: string }) {
  const groups = (report.data?.rows ?? []).filter(row => row.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding)
  const total = groups.reduce((sum, row) => sum + row.outstanding, 0)
  const customers = groups.reduce((sum, row) => sum + row.customersWithDebt, 0)
  return <Panel label="Công nợ theo nhóm khách" to={to} headline={report.data ? (groups.length ? `${num(customers)} khách đang nợ` : undefined) : placeholder(report, "w-36")} sub={groups.length ? `trong ${num(groups.length)} nhóm` : undefined}>
    <Body state={report} empty={() => !groups.length} emptyText="Chưa có khách nào đang nợ.">
      {() => <ul className="mt-5 space-y-4">
        {groups.slice(0, 5).map(group => {
          const share = total ? group.outstanding / total * 100 : 0
          return <li key={group.customerGroup?.id ?? 'none'}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium text-slate-900">{group.customerGroup?.name ?? 'Chưa phân nhóm'}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatVnd(group.outstanding)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: C.track }}><div className="h-full rounded-full" style={{ width: `${Math.max(share, 1.5)}%`, backgroundColor: C.accent }} /></div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500">{percent(share)}</span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span>{num(group.customersWithDebt)} khách</span>
              {group.overdueAmount > 0 && <span className="inline-flex items-center gap-1 font-medium text-rose-700"><TriangleAlert size={12} aria-hidden="true" />Quá hạn {shortVnd(group.overdueAmount)}</span>}
            </p>
          </li>
        })}
      </ul>}
    </Body>
  </Panel>
}

/** The owner's and the admin's dashboard below the period filter: every panel reads a report API for the same period. */
export default function DashboardCharts({ fromDate, toDate, links = {} }: { fromDate: string; toDate: string; links?: DashboardLinks }) {
  const problem = periodProblem(fromDate, toDate)
  const granularity = granularityFor(rangeDays(fromDate, toDate))

  // Declared in reading order, so the queue fetches what is on screen first.
  const summary = useReport(useCallback((signal: AbortSignal) => businessReportsApi.revenueSummary({ fromDate, toDate }, signal), [fromDate, toDate]), problem)
  const trend = useReport(useCallback((signal: AbortSignal) => businessReportsApi.revenue({ fromDate, toDate, groupBy: granularity, page: 1, pageSize: 100 }, signal), [fromDate, toDate, granularity]), problem)
  const payments = useReport(useCallback((signal: AbortSignal) => businessReportsApi.payments({ fromDate, toDate, groupBy: 'METHOD' }, signal), [fromDate, toDate]), problem)
  const categories = useReport(useCallback((signal: AbortSignal) => businessReportsApi.revenue({ fromDate, toDate, groupBy: 'CATEGORY', page: 1, pageSize: 5 }, signal), [fromDate, toDate]), problem)
  const sources = useReport(useCallback((signal: AbortSignal) => businessReportsApi.orders({ fromDate, toDate, groupBy: 'SOURCE' }, signal), [fromDate, toDate]), problem)
  const statuses = useReport(useCallback((signal: AbortSignal) => businessReportsApi.orders({ fromDate, toDate, groupBy: 'STATUS' }, signal), [fromDate, toDate]), problem)
  const aging = useReport(useCallback((signal: AbortSignal) => reportsApi.getDebtAging({}, signal), []))
  const debtGroups = useReport(useCallback((signal: AbortSignal) => reportsApi.getDebtByGroup(signal), []))

  return <div className="flex flex-col gap-5">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <StatGrid summary={summary} payments={payments} />
      <TrendPanel trend={trend} requested={granularity} />
    </div>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <CategoryPanel report={categories} to={links.products} />
      <SourcesPanel report={sources} to={links.orders} />
      <MethodsPanel report={payments} to={links.payments} />
    </div>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <FunnelPanel report={statuses} to={links.orders} />
      <DebtPanel report={aging} to={links.debts} />
      <DebtGroupsPanel report={debtGroups} to={links.debts} />
    </div>
  </div>
}
