import { useCallback, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowUpRight, Banknote, CircleDollarSign, Clock, Coins, Globe, HandCoins, Landmark, LayoutDashboard, Minus, Package, PackageCheck,
  QrCode, Receipt, ShieldCheck, ShoppingCart, Smartphone, Sparkles, Store, TriangleAlert, Undo2, Wallet, type LucideIcon,
} from 'lucide-react'
import { businessReportsApi, type AdvisoryDiagnosisReport, type CreditExposureReport, type OrderMetrics, type PaymentMetrics, type PaymentTotals, type PeriodReport, type PurchaseMetrics, type RevenueMetrics, type RevenueReport, type RevenueSummary, type SalesMetrics } from '@/api/businessReportsApi'
import { reportsApi, type DebtAgingReport, type DebtByGroupReport, type DebtCollectionReport } from '@/api/reportsApi'
import { debtApi, type DebtDashboard } from '@/api/debtApi'
import { inventoryReportsApi, type InventoryValuationReport } from '@/api/inventoryReportsApi'
import { usePermission } from '@/context/PermissionContext'
import { cropLabel } from '@/features/diagnosis/diagnosisLabels'
import { useReportData } from '@/features/agent/reports/useReportData'
import { periodProblem } from '@/features/agent/reports/reportFilters'
import { formatQtyUnit, rangeDays } from '@/utils/units'
import { formatDay, todayVn } from '@/utils/creditLabels'
import { replenishmentApi, type ExpiryRiskPage, type VelocityItem, type VelocityPage } from '@/api/replenishmentApi'
import { formatVnd } from '@/utils/money'

export interface DashboardLinks {
  orders?: string; payments?: string; products?: string; debts?: string; planning?: string; expiry?: string; customers?: string
  inventory?: string; purchases?: string; advisory?: string; diagnosis?: string
}

// The project's green for every single-series mark (the user's rule: green is the main color), light zinc for context and
// tracks in the template's layout, and a status red only where the color means "overdue", always next to an icon and a
// label. Checked with the dataviz palette validator: green/red as a pair (deutan ΔE 10), and the funnel's four greens as an
// ordinal ramp (lightest step 2.28:1 on white).
const C = { accent: '#16a34a', track: '#dcfce7', quiet: '#d4d4d8', grid: '#e4e4e7', axis: '#71717a', overdue: '#be123c' }
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
const Skeleton = ({ className }: { className: string }) => <span aria-hidden="true" className={`inline-block animate-pulse rounded bg-zinc-100 align-middle ${className}`} />

/** The change as colored text, like "+15,8% so với kỳ trước": green when it goes the good way, red otherwise. */
function Delta({ value, upIsGood = true }: { value: number; upIsGood?: boolean }) {
  if (Math.abs(value) < 0.05) return <span className="inline-flex items-center gap-0.5 font-medium text-zinc-600"><Minus size={12} aria-hidden="true" />0%</span>
  const up = value > 0
  return <span className={`font-medium tabular-nums ${up === upIsGood ? 'text-green-700' : 'text-rose-700'}`}>{up ? '+' : '−'}{percent(Math.abs(value))}</span>
}

/** The change against the period just before; left out when that period had nothing, so empty history adds no text. */
function Versus({ current, previous, upIsGood, extra }: { current: number; previous: number; upIsGood?: boolean; extra?: ReactNode }) {
  if (previous <= 0 && !extra) return null
  return <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-zinc-500">
    {previous > 0 && <><Delta value={(current - previous) / previous * 100} upIsGood={upIsGood} /><span>so với kỳ trước</span></>}
    {extra && <span>{previous > 0 && '· '}{extra}</span>}
  </p>
}

/** A card in the style of the template: a quiet label, one headline that tells the story, then the chart; the arrow opens the full page. */
function Panel({ label, to, headline, sub, aside, className = '', children }: { label: string; to?: string; headline?: ReactNode; sub?: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  // A panel whose body is the one-line "nothing here" (Body's role="status") keeps its own height instead of stretching to
  // its neighbour's, so an empty panel never holds a large blank box.
  return <section aria-label={label} className={`flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-white p-4 has-[>[role=status]]:self-start ${className}`}>
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm text-zinc-500">{label}</h3>
        {headline !== undefined && <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xl font-medium leading-8 tracking-tight text-zinc-900">{headline}{sub && <span className="text-sm font-normal tracking-normal text-zinc-500">{sub}</span>}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {aside}
        {to && <Link to={to} aria-label={`Xem chi tiết: ${label}`} title="Xem chi tiết" className="grid h-8 w-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"><ArrowUpRight size={17} /></Link>}
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
    return state.loading ? <div aria-hidden="true" className={`mt-4 animate-pulse rounded-xl bg-zinc-50 ${skeleton}`} /> : null
  }
  // One short line, so a panel with nothing to show stays small instead of holding an empty box.
  if (empty?.(state.data)) return <p role="status" className="mt-3 rounded-lg bg-zinc-50 px-3 py-2.5 text-sm text-zinc-500">{emptyText}</p>
  return <div aria-busy={state.loading} className={`flex flex-1 flex-col transition-opacity ${state.stale ? 'opacity-60' : ''}`}>{children(state.data)}</div>
}

// ---- Overview: the period's figures next to the revenue curve ------------------------------------------------------------

interface Figure { label: string; icon: LucideIcon; value: ReactNode; foot: ReactNode; report: Report<unknown>; tag?: string }

/** A report's own error under its figure (a dash alone would not say why). */
const failure = (report: Report<unknown>) => (report.error && !report.data ? <p role="alert" className="text-xs text-rose-700">{friendly(report.error)}</p> : null)

/** Every headline figure of the period, so each row picks the ones it shows without computing them twice. */
function periodFigures(summary: Report<RevenueSummary>, sales: Report<PeriodReport<SalesMetrics>>, payments: Report<PeriodReport<PaymentMetrics, PaymentTotals>>) {
  const cur = summary.data?.current
  const prev = summary.data?.previous
  const sale = sales.data?.totals
  const paid = payments.data?.totals
  const fromSummary = (label: string, icon: LucideIcon, value: (m: RevenueMetrics) => number, show: (n: number) => string, upIsGood = true): Figure => ({
    label, icon, report: summary, value: cur ? show(value(cur)) : placeholder(summary, 'w-28'),
    foot: cur && prev ? <Versus current={value(cur)} previous={value(prev)} upIsGood={upIsGood} /> : failure(summary),
  })
  return {
    netSales: fromSummary('Doanh thu thuần', CircleDollarSign, m => m.netSales, formatVnd),
    grossProfit: { label: 'Lãi gộp', icon: Coins, report: sales, value: sale ? formatVnd(sale.grossProfit) : placeholder(sales, 'w-28'), foot: sale ? <div className="space-y-1">
      {prev && <Versus current={sale.grossProfit} previous={prev.grossProfit} />}
      <p className="text-[13px] text-zinc-500">Giá vốn {formatVnd(sale.costOfGoods)}</p>
      <p className="text-xs text-zinc-500">Trước trả hàng, chưa trừ chi phí vận hành.</p>
    </div> : failure(sales) } satisfies Figure,
    orders: fromSummary('Đơn giao thành công', PackageCheck, m => m.orderCount, n => `${num(n)} đơn`),
    averageOrder: fromSummary('Giá trị đơn trung bình', Receipt, m => m.averageOrderValue, formatVnd),
    received: { label: 'Tiền thực thu', icon: Wallet, report: payments, value: paid ? formatVnd(paid.netReceivedAmount) : placeholder(payments, 'w-28'),
      foot: paid ? <p className="text-[13px] text-zinc-500">Gồm thu nợ {formatVnd(paid.debtRepaymentAmount)}</p> : failure(payments) } satisfies Figure,
    returns: fromSummary('Hàng trả lại', Undo2, m => m.returnValue, formatVnd, false),
  }
}

/** Receivables today, with the overdue part beside them: the one current figure among the owner's four. */
function receivablesFigure(aging: Report<DebtAgingReport>): Figure {
  const totals = aging.data?.totals
  const overdue = totals ? Math.max(0, totals.total - totals.notDue) : 0
  return {
    label: 'Nợ phải thu', tag: 'Hiện tại', icon: HandCoins, report: aging, value: totals ? formatVnd(totals.total) : placeholder(aging, 'w-28'),
    foot: !totals ? failure(aging) : overdue > 0
      ? <p className="flex items-center gap-1 text-[13px] font-medium text-rose-700"><TriangleAlert size={13} aria-hidden="true" className="shrink-0" />Quá hạn {formatVnd(overdue)}</p>
      : <p className="flex items-center gap-1 text-[13px] text-green-700"><ShieldCheck size={13} aria-hidden="true" className="shrink-0" />Không có nợ quá hạn</p>,
  }
}

/** Joined cells with hairline borders, read left to right; each dims or pulses with its own report. */
function Figures({ label, figures, className, title }: { label: string; figures: Figure[]; className: string; title?: string }) {
  return <section aria-label={label} title={title} className={`grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 ${className}`}>
    {figures.map(figure => {
      const Icon = figure.icon
      // The label is the cell's heading and the cell holds everything about it, so "heading → parent" reads the whole figure.
      return <div key={figure.label} aria-busy={figure.report.loading} className={`relative flex min-w-0 flex-col gap-1 bg-[#fff] p-4 transition-opacity ${figure.report.stale ? 'opacity-60' : ''}`}>
        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-9 text-sm text-zinc-700">{figure.label}{figure.tag && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">{figure.tag}</span>}</h3>
        <span aria-hidden="true" className="absolute right-4 top-4 hidden h-7 w-7 place-items-center rounded-md bg-green-50 text-green-700 sm:grid"><Icon size={15} /></span>
        <span className="text-xl font-medium leading-8 tracking-tight tabular-nums text-zinc-900 [overflow-wrap:anywhere] sm:text-2xl">{figure.value}</span>
        {/* Right under the figure, so the change reads with its number even when a neighbour has more to say. */}
        <div className="min-h-6">{figure.foot}</div>
      </div>
    })}
  </section>
}

const comparedWith = (summary: Report<RevenueSummary>) => {
  const s = summary.data
  return s?.previousFromDate && s.previousToDate ? `So với kỳ trước: ${dayMonthYear(s.previousFromDate)} → ${dayMonthYear(s.previousToDate)}` : undefined
}

/** The admin's six figures beside the sales chart (two columns, three rows). */
function StatGrid({ summary, sales, payments }: { summary: Report<RevenueSummary>; sales: Report<PeriodReport<SalesMetrics>>; payments: Report<PeriodReport<PaymentMetrics, PaymentTotals>> }) {
  const f = periodFigures(summary, sales, payments)
  return <Figures label="Chỉ số kinh doanh trong kỳ" title={comparedWith(summary)} className="grid-cols-2" figures={[f.netSales, f.grossProfit, f.orders, f.averageOrder, f.received, f.returns]} />
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

function TrendTooltip({ active, payload, measure }: { active?: boolean; payload?: ReadonlyArray<{ payload?: TrendPoint }>; measure: 'sales' | 'orders' }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const sales = <strong className="text-sm font-semibold text-zinc-900">{formatVnd(point.netSales)}</strong>
  const orders = <span>{num(point.orders)} đơn giao</span>
  return <div className="rounded-lg border border-zinc-200 bg-[#fff] px-3 py-2 text-xs shadow-lg">
    <p className="text-zinc-500">{point.title}</p>
    <p className="mt-1 text-sm font-semibold text-zinc-900">{measure === 'sales' ? sales : <strong>{orders}</strong>}</p>
    <p className="mt-0.5 text-zinc-500">{measure === 'sales' ? orders : <>Doanh thu {formatVnd(point.netSales)}</>}</p>
  </div>
}

const pointsOf = (trend: Report<RevenueReport>, granularity: Granularity): TrendPoint[] =>
  (trend.data?.rows ?? []).map(row => ({ key: row.key, tick: tickOf(granularity, row.key), title: titleOf(granularity, row.key), netSales: row.netSales, orders: row.orderCount }))

type Measure = 'sales' | 'orders'
const MEASURES: [Measure, string][] = [['sales', 'Doanh thu'], ['orders', 'Số đơn']]

/**
 * Net sales or delivered orders over the period, from the same report: one series on one scale at a time (never two axes),
 * and a switch instead of a second chart for the same days. `ordersTo` links the orders view to the order list. `idle`: its
 * tab is hidden, so the chart is not drawn (it would measure 0 × 0); it draws again when the tab is shown.
 */
function TrendPanel({ trend, requested, ordersTo, idle = false }: { trend: Report<RevenueReport>; requested: Granularity; ordersTo?: string; idle?: boolean }) {
  const [measure, setMeasure] = useState<Measure>('sales')
  // Label by what the shown rows were grouped by: while the next period loads, the previous rows stay on screen.
  const granularity = (trend.data?.groupBy as Granularity | undefined) ?? requested
  const points = pointsOf(trend, granularity)
  const value = (point: TrendPoint) => (measure === 'sales' ? point.netSales : point.orders)
  const best = points.reduce<TrendPoint | null>((top, point) => (!top || value(point) > value(top) ? point : top), null)
  const label = `${measure === 'sales' ? 'Doanh thu thuần' : 'Đơn giao'} theo ${UNIT[granularity]}`
  const aside = <>
    {best && value(best) > 0 && <span className="hidden text-xs text-zinc-500 lg:inline">Cao nhất <strong className="font-semibold text-zinc-700">{best.tick}</strong> · {measure === 'sales' ? shortVnd(best.netSales) : `${num(best.orders)} đơn`}</span>}
    <div role="group" aria-label="Số liệu trên biểu đồ" className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
      {MEASURES.map(([key, name]) => <button key={key} type="button" aria-pressed={measure === key} onClick={() => setMeasure(key)}
        className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors ${measure === key ? 'bg-[#fff] text-green-800 shadow-sm ring-1 ring-green-200' : 'text-zinc-500 hover:text-zinc-900'}`}>{name}</button>)}
    </div>
  </>
  const axis = { tick: { fontSize: 12, fill: C.axis }, tickLine: false, axisLine: false }
  return <Panel label={label} to={measure === 'orders' ? ordersTo : undefined} aside={aside}>
    <Body state={trend} skeleton="h-72" empty={data => !data.rows.some(row => (measure === 'sales' ? row.netSales !== 0 : row.orderCount > 0))}
      emptyText={measure === 'sales' ? 'Chưa có doanh thu ghi nhận trong kỳ này.' : 'Chưa giao đơn nào trong kỳ này.'}>
      {() => <>
        {/* At least 15rem tall; beside other panels it grows with the row. The chart fills the box, so its height is always definite. */}
        <div className="relative mt-3 min-h-60 w-full min-w-0 flex-1">
          {!idle && <div className="absolute inset-0"><ResponsiveContainer width="100%" height="100%">
            {measure === 'sales' ? <AreaChart data={points} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="key" tickFormatter={key => tickOf(granularity, String(key))} {...axis} minTickGap={24} />
              <YAxis tickFormatter={value => shortVnd(Number(value))} {...axis} width={56} />
              <Tooltip cursor={{ stroke: C.axis, strokeWidth: 1 }} content={<TrendTooltip measure="sales" />} />
              <Area type="linear" dataKey="netSales" stroke={C.accent} strokeWidth={2} fill={C.accent} fillOpacity={0.06} isAnimationActive={false}
                dot={points.length === 1 ? { r: 4, fill: C.accent, stroke: '#fff', strokeWidth: 2 } : false} activeDot={{ r: 5, fill: C.accent, stroke: '#fff', strokeWidth: 2 }} />
              {best && best.netSales > 0 && points.length > 1 && <ReferenceDot x={best.key} y={best.netSales} r={4} fill={C.accent} stroke="#fff" strokeWidth={2} />}
            </AreaChart> : <BarChart data={points} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="key" tickFormatter={key => tickOf(granularity, String(key))} {...axis} minTickGap={24} />
              <YAxis allowDecimals={false} {...axis} width={56} />
              <Tooltip cursor={{ fill: C.track }} content={<TrendTooltip measure="orders" />} />
              <Bar dataKey="orders" fill={C.accent} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>}
          </ResponsiveContainer></div>}
        </div>
        {/* The screen-reader twin sits in a clipped div: a table ignores sr-only's 1px height and would stretch the page by a row per day. */}
        <div className="sr-only"><table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">Thời gian</th><th scope="col">Doanh thu thuần</th><th scope="col">Đơn giao</th></tr></thead>
          <tbody>{points.map(point => <tr key={point.key}><th scope="row">{point.title}</th><td>{formatVnd(point.netSales)}</td><td>{num(point.orders)}</td></tr>)}</tbody>
        </table></div>
        <p className="mt-auto pt-3 text-xs text-zinc-500">{measure === 'sales' ? 'Ghi nhận khi giao hàng, đã trừ hàng trả. Lãi gộp tính trước trả hàng và chưa trừ chi phí vận hành.' : 'Đơn có ghi nhận giao hàng trong kỳ.'}</p>
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
  return <Panel label="Nhóm sản phẩm bán chạy" to={to} headline={top && total > 0 ? percent(top.netSales / total * 100) : data ? undefined : placeholder(report, "w-20")} sub={top && total > 0 ? <>doanh thu từ <strong className="font-medium text-zinc-700">{top.label}</strong></> : undefined}>
    <Body state={report} empty={() => !top || total <= 0} emptyText="Chưa có doanh thu theo nhóm trong kỳ này.">
      {() => top && <>
        <div className="mt-4 flex h-2.5 w-full gap-0.5" role="img" aria-label={`Tỷ trọng doanh thu: ${segments.map(segment => `${segment.name} ${percent(segment.value / total * 100)}`).join(', ')}`}>
          {segments.map((segment, index) => <span key={segment.key} title={`${segment.name}: ${percent(segment.value / total * 100)}`} className="h-full rounded-full" style={{ flexGrow: segment.value, flexBasis: 0, minWidth: 4, backgroundColor: index === 0 ? C.accent : C.quiet }} />)}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: C.accent }} />{top.label}</li>
          {segments.length > 1 && <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: C.quiet }} />Các nhóm khác</li>}
        </ul>
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <div aria-hidden="true" className="grid grid-cols-[minmax(0,1fr)_3rem_4.5rem] gap-x-3 pb-2 text-xs text-zinc-500"><span>Nhóm</span><span className="text-right">Tỷ trọng</span><span className="text-right">Doanh thu</span></div>
          <ul className="space-y-2.5">
            {rows.slice(0, 4).map(row => <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_3rem_4.5rem] items-center gap-x-3 text-sm">
              <span className="min-w-0"><span title={row.label} className="block truncate font-medium text-zinc-900">{row.label}</span><span className="block text-xs text-zinc-500">{num(row.orderCount)} đơn</span></span>
              <span className="text-right tabular-nums text-zinc-600">{percent(row.netSales / total * 100)}</span>
              <span title={formatVnd(row.netSales)} className="text-right font-semibold tabular-nums text-zinc-900">{shortVnd(row.netSales)}</span>
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
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-green-50 text-green-700"><Icon size={17} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium text-zinc-900">{row.name}</span>
            <span className="shrink-0 tabular-nums"><strong className="font-semibold text-zinc-900">{num(row.value)}</strong> <span className="text-xs text-zinc-500">{row.unit} · {percent(share)}</span></span>
          </div>
          <div className="mt-1.5 h-2 w-full rounded-full" style={{ backgroundColor: C.track }}>
            <div className="h-full rounded-full" style={{ width: `${row.value ? Math.max(share, 1.5) : 0}%`, backgroundColor: C.accent }} />
          </div>
          {row.detail && <p className="mt-1 text-xs text-zinc-500">{row.detail}</p>}
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
              <span className="text-right text-sm font-semibold tabular-nums text-zinc-900">{num(stage.value)}</span>
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-10 w-full" aria-hidden="true">
                <polygon points={`${50 - top / 2},0 ${50 + top / 2},0 ${50 + bottom / 2},40 ${50 - bottom / 2},40`} fill={FUNNEL_RAMP[index]} />
              </svg>
              <span className="min-w-0 text-sm"><span className="block truncate text-zinc-700">{stage.name}</span><span className="block text-xs text-zinc-500">{percent(created ? stage.value / created * 100 : 0)}</span></span>
            </li>
          })}
        </ol>
        <p className="mt-auto flex flex-wrap gap-x-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
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

/** Receivables by age as columns (the template's traffic chart): not yet due in the project green, overdue buckets in the overdue red. */
function AgingBars({ totals }: { totals: DebtAgingReport['totals'] }) {
  const buckets = [
    { key: 'due', label: 'Trong hạn', value: totals.notDue, overdue: false },
    { key: '30', label: '1–30 ngày', value: totals.days1To30, overdue: true },
    { key: '60', label: '31–60', value: totals.days31To60, overdue: true },
    { key: '90', label: '61–90', value: totals.days61To90, overdue: true },
    { key: 'over', label: '> 90', value: totals.over90, overdue: true },
  ]
  const max = Math.max(...buckets.map(bucket => bucket.value), 1)
  return <div className="mt-4" role="img" aria-label={`Công nợ theo tuổi: ${buckets.map(bucket => `${bucket.label} ${formatVnd(bucket.value)}`).join(', ')}`}>
    <div className="flex h-28 items-end gap-2 border-b border-zinc-200">
      {buckets.map(bucket => <div key={bucket.key} title={`${bucket.label}: ${formatVnd(bucket.value)}`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
        <span className="mb-1 block truncate text-center text-[11px] tabular-nums text-zinc-500">{bucket.value > 0 ? shortVnd(bucket.value) : ''}</span>
        <span className="block w-full rounded-t-[3px]" style={{ height: `${bucket.value > 0 ? Math.max(bucket.value / max * 100, 4) : 0}%`, backgroundColor: bucket.overdue ? C.overdue : C.accent }} />
      </div>)}
    </div>
    <div aria-hidden="true" className="mt-1.5 flex gap-2">{buckets.map(bucket => <span key={bucket.key} className="min-w-0 flex-1 truncate text-center text-[11px] text-zinc-500">{bucket.label}</span>)}</div>
  </div>
}

function DebtPanel({ report, to, focusOverdue = false }: { report: Report<DebtAgingReport>; to?: string; focusOverdue?: boolean }) {
  const data = report.data
  const totals = data?.totals
  const total = totals?.total ?? 0
  const share = totals && total > 0 ? totals.notDue / total : 1
  const overdue = totals ? Math.max(0, total - totals.notDue) : 0
  const stats = totals ? [
    { label: 'Trong hạn', detail: 'chưa tới hạn', value: totals.notDue, icon: ShieldCheck, good: true },
    { label: 'Quá hạn', detail: 'đến 30 ngày', value: totals.days1To30, icon: Clock, good: false },
    { label: 'Quá hạn', detail: 'trên 30 ngày', value: totals.days31To60 + totals.days61To90 + totals.over90, icon: TriangleAlert, good: false },
  ] : []
  return <Panel label="Công nợ phải thu" to={to} headline={data ? <span className={focusOverdue && overdue > 0 ? 'text-rose-700' : undefined}>{formatVnd(focusOverdue ? overdue : total)}</span> : placeholder(report, "w-32")} sub={data ? focusOverdue ? 'đã quá hạn' : 'tính đến hôm nay' : undefined}>
    <Body state={report} empty={() => total <= 0} emptyText="Không có khoản nợ nào.">
      {() => <>
        {focusOverdue ? <div className="mt-2 space-y-3">
          <p className="text-xs text-zinc-500">Hiện tại · {data?.asOf ? dayMonthYear(data.asOf) : 'Hôm nay'} · Không theo kỳ báo cáo</p>
          {totals && <AgingBars totals={totals} />}
          <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 pb-3 text-sm"><span className="text-zinc-600">Tổng phải thu</span><strong className="font-semibold tabular-nums text-zinc-900">{formatVnd(total)}</strong></div>
          <p className={`flex items-start gap-2 text-sm ${overdue > 0 ? 'text-rose-700' : 'text-green-700'}`}>{overdue > 0 ? <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}{overdue > 0 ? 'Ưu tiên liên hệ khách có nợ quá hạn để thu hồi.' : 'Chưa có khoản nợ quá hạn.'}</p>
        </div> : <div className="relative mx-auto mt-4 w-full max-w-[260px]">
          <Gauge share={share} />
          <div className="absolute inset-x-0 bottom-0 text-center">
            <p className="text-3xl font-semibold leading-9 text-zinc-900">{percent(share * 100)}</p>
            <p className="text-xs text-zinc-500">nợ còn trong hạn</p>
          </div>
        </div>}
        <dl className="mt-auto grid grid-cols-3 divide-x divide-zinc-100 border-t border-zinc-100 pt-4 text-center">
          {stats.map(stat => {
            const Icon = stat.icon
            return <div key={stat.detail} className="flex min-w-0 flex-col items-center gap-1 px-2">
              <span className={`grid h-7 w-7 place-items-center rounded-lg ${stat.good ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'}`}><Icon size={14} aria-hidden="true" /></span>
              <dt className="text-xs leading-4 text-zinc-500"><span className="block font-medium text-zinc-700">{stat.label}</span>{stat.detail}</dt>
              <dd title={formatVnd(stat.value)} className="text-sm font-semibold text-zinc-900">{shortVnd(stat.value)}</dd>
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
              <span className="min-w-0 truncate font-medium text-zinc-900">{group.customerGroup?.name ?? 'Chưa phân nhóm'}</span>
              <span className="shrink-0 font-semibold tabular-nums text-zinc-900">{formatVnd(group.outstanding)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: C.track }}><div className="h-full rounded-full" style={{ width: `${Math.max(share, 1.5)}%`, backgroundColor: C.accent }} /></div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-500">{percent(share)}</span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
              <span>{num(group.customersWithDebt)} khách</span>
              {group.overdueAmount > 0 && <span className="inline-flex items-center gap-1 font-medium text-rose-700"><TriangleAlert size={12} aria-hidden="true" />Quá hạn {shortVnd(group.overdueAmount)}</span>}
            </p>
          </li>
        })}
      </ul>}
    </Body>
  </Panel>
}

// ---- What sells, what is about to expire, who buys -------------------------------------------------------------------------

/** Below this many days of stock (at the period's sales pace) a best seller is flagged before it runs out. */
const LOW_STOCK_DAYS = 14

function StockBadge({ item }: { item?: VelocityItem }) {
  if (!item) return null
  if (item.sellableBaseQuantity <= 0) return <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-700"><TriangleAlert size={12} aria-hidden="true" />Hết hàng</span>
  if (item.daysOfStock !== null && item.daysOfStock < LOW_STOCK_DAYS) return <span title={`Còn đủ bán khoảng ${num(item.daysOfStock)} ngày`} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800"><Clock size={12} aria-hidden="true" />Sắp hết · {num(item.daysOfStock)} ngày</span>
  return null
}

function TopProductsPanel({ report, velocity, to, limit = 10, className }: { report: Report<RevenueReport>; velocity: Report<VelocityPage>; to?: string; limit?: number; className?: string }) {
  const rows = (report.data?.rows ?? []).filter(row => row.netSales > 0)
  const top = rows[0]
  const pace = new Map((velocity.data?.items ?? []).map(item => [item.storeProductId, item]))
  const lowCount = rows.filter(row => { const item = pace.get(row.key); return item && (item.sellableBaseQuantity <= 0 || (item.daysOfStock !== null && item.daysOfStock < LOW_STOCK_DAYS)) }).length
  return <Panel label="Sản phẩm bán chạy" to={to} className={className}
    headline={limit === 5 ? undefined : top ? <span className="min-w-0 truncate" title={top.label}>{top.label}</span> : report.data ? undefined : placeholder(report, 'w-48')}
    sub={limit !== 5 && top ? <>dẫn đầu, {shortVnd(top.netSales)}</> : undefined}
    aside={lowCount > 0 ? <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"><Clock size={12} aria-hidden="true" />{num(lowCount)} sắp hết hàng</span> : undefined}>
    <Body state={report} empty={() => !top} emptyText="Chưa có sản phẩm bán ra trong kỳ này.">
      {() => <div className="mt-4">
        <div aria-hidden="true" className="grid grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_4.5rem] gap-x-3 border-b border-zinc-100 pb-2 text-xs text-zinc-500"><span>#</span><span>Sản phẩm</span><span className="text-right">Đã bán</span><span className="text-right">Doanh thu</span></div>
        <ol className="divide-y divide-zinc-50">
          {rows.slice(0, limit).map((row, index) => {
            const item = pace.get(row.key)
            return <li key={row.key} className="grid grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_4.5rem] items-center gap-x-3 py-2 text-sm">
              <span className="tabular-nums text-zinc-400">{index + 1}</span>
              <span className="min-w-0">
                <span className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"><span title={row.label} className="max-w-full font-medium text-zinc-900 [overflow-wrap:anywhere]">{row.label}</span><StockBadge item={item} /></span>
                <span className="block text-xs text-zinc-500">{num(row.orderCount)} đơn</span>
                {/* Revenue against the leader, so the ranking reads at a glance; the figure stays in the last column. */}
                <span aria-hidden="true" className="mt-1.5 block h-1.5 w-full max-w-64 rounded-full" style={{ backgroundColor: C.track }}><span className="block h-full rounded-full" style={{ width: `${Math.max(row.netSales / top.netSales * 100, 2)}%`, backgroundColor: C.accent }} /></span>
              </span>
              <span className="text-right text-xs tabular-nums text-zinc-600">{item ? formatQtyUnit(item.soldBaseQuantity, item.baseUnit) : '—'}</span>
              <span title={formatVnd(row.netSales)} className="text-right font-semibold tabular-nums text-zinc-900">{shortVnd(row.netSales)}</span>
            </li>
          })}
        </ol>
        <p className="mt-2 text-xs text-zinc-500">Doanh thu theo kỳ đã chọn. Số lượng bán và cảnh báo "sắp hết" tính theo tốc độ bán của {velocity.data ? `${num(rangeDays(velocity.data.fromDate, velocity.data.toDate))} ngày gần nhất` : 'các ngày gần nhất'}.</p>
      </div>}
    </Body>
  </Panel>
}

const EXPIRY_WINDOW_DAYS = 30
const utcDay = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
/** Whole days from today (Vietnam calendar) to a yyyy-MM-dd day; negative once it has passed. */
const daysUntil = (iso: string) => Math.round((utcDay(iso) - utcDay(todayVn())) / 86_400_000)

function ExpiryPanel({ report, to }: { report: Report<ExpiryRiskPage>; to?: string }) {
  const data = report.data
  const lots = data?.summary.lots ?? 0
  return <Panel label={`Lô sắp hết hạn (${EXPIRY_WINDOW_DAYS} ngày tới)`} to={to}
    headline={data ? (lots ? `${num(lots)} lô` : undefined) : placeholder(report, 'w-20')}
    sub={data && lots ? (data.summary.knownRiskValue > 0 ? <>có thể không bán kịp <strong className="font-medium text-rose-700">{shortVnd(data.summary.knownRiskValue)}</strong></> : 'cần kiểm tra hạn dùng') : undefined}>
    <p className="mt-2 text-xs text-zinc-500">Hiện tại · Không theo kỳ báo cáo</p>
    <Body state={report} empty={() => !lots} emptyText={`Không có lô nào hết hạn trong ${EXPIRY_WINDOW_DAYS} ngày tới.`}>
      {page => <ul className="mt-4 space-y-3">
        {page.items.slice(0, 3).map(lot => {
          const left = daysUntil(lot.expiryDate)
          return <li key={lot.inventoryLotId} className="text-sm">
            <span title={lot.productName} className="block truncate font-medium text-zinc-900">{lot.productName}</span>
            <span className="mt-0.5 flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-zinc-500" title={`Lô ${lot.lotNumber ?? '—'}, còn ${formatQtyUnit(lot.onHandBaseQuantity, lot.baseUnit)}`}>Lô {lot.lotNumber ?? '—'} · {formatQtyUnit(lot.onHandBaseQuantity, lot.baseUnit)}</span>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 font-medium tabular-nums ${left < 0 ? 'bg-rose-50 text-rose-700' : left <= 7 ? 'bg-amber-50 text-amber-800' : 'bg-zinc-100 text-zinc-700'}`} title={`Hạn dùng ${formatDay(lot.expiryDate)}`}>
                {left < 0 ? `Hết hạn ${formatDay(lot.expiryDate).slice(0, 5)}` : left === 0 ? 'Hết hạn hôm nay' : `còn ${num(left)} ngày`}
              </span>
            </span>
          </li>
        })}
      </ul>}
    </Body>
    {(data?.summary.unknownRiskLots ?? 0) > 0 && <p className="mt-3 text-xs text-amber-800">{num(data!.summary.unknownRiskLots)} lô chưa đủ dữ liệu ước tính giá trị rủi ro.</p>}
    {!!lots && <p className="mt-auto pt-4 text-xs leading-5 text-zinc-500">Tách riêng lô đã hết hạn; ưu tiên xuất lô còn hạn gần nhất.</p>}
  </Panel>
}

function TopCustomersPanel({ report, to }: { report: Report<RevenueReport>; to?: string }) {
  const data = report.data
  const total = data?.totals.netSales ?? 0
  const rows = (data?.rows ?? []).filter(row => row.netSales > 0)
  const top = rows[0]
  const topName = top?.key === 'WALK_IN' ? 'khách lẻ' : top?.label
  return <Panel label="Khách hàng mua nhiều" to={to}
    headline={top && total > 0 ? percent(top.netSales / total * 100) : data ? undefined : placeholder(report, 'w-20')}
    sub={top && total > 0 ? <>doanh thu từ <strong className="font-medium text-zinc-700">{topName}</strong></> : undefined}>
    <Body state={report} empty={() => !top} emptyText="Chưa có khách mua trong kỳ này.">
      {() => <ul className="mt-4 space-y-3">
        {rows.slice(0, 5).map(row => {
          const share = total ? row.netSales / total * 100 : 0
          return <li key={row.key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span title={row.label} className="min-w-0 truncate font-medium text-zinc-900">{row.key === 'WALK_IN' ? 'Khách lẻ (không đăng ký)' : row.label}</span>
              <span title={formatVnd(row.netSales)} className="shrink-0 font-semibold tabular-nums text-zinc-900">{shortVnd(row.netSales)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: C.track }}><div className="h-full rounded-full" style={{ width: `${Math.max(share, 1.5)}%`, backgroundColor: C.accent }} /></div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-zinc-500">{num(row.orderCount)} đơn</span>
            </div>
          </li>
        })}
      </ul>}
    </Body>
  </Panel>
}

// ---- Where the money sits and what the advice brings (manager view, 2026-11-23) -------------------------------------------

const NOW_NOTE = 'Hiện tại · Không theo kỳ báo cáo'

/** One bar per entry, labelled with its amount and its share of the total, so the bars need no color legend. */
function AmountBars({ rows, total }: { rows: { key: string; name: string; value: number; detail?: string }[]; total: number }) {
  return <ul className="mt-4 space-y-3">
    {rows.map(row => {
      const share = total > 0 ? row.value / total * 100 : 0
      return <li key={row.key}>
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span title={row.name} className="min-w-0 truncate font-medium text-zinc-900">{row.name}</span>
          <span title={formatVnd(row.value)} className="shrink-0 font-semibold tabular-nums text-zinc-900">{shortVnd(row.value)}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: C.track }}><div className="h-full rounded-full" style={{ width: `${row.value > 0 ? Math.max(share, 1.5) : 0}%`, backgroundColor: C.accent }} /></div>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-500">{percent(share)}</span>
        </div>
        {row.detail && <p className="mt-1 text-xs text-zinc-500">{row.detail}</p>}
      </li>
    })}
  </ul>
}

function InventoryValuePanel({ report, to }: { report: Report<InventoryValuationReport>; to?: string }) {
  const data = report.data
  const total = data?.totals.stockValue ?? 0
  const expired = data?.totals.expiredValue ?? 0
  const groups = (data?.byCategory ?? []).filter(group => group.stockValue > 0).sort((a, b) => b.stockValue - a.stockValue)
  return <Panel label="Giá trị tồn kho" to={to} headline={data ? formatVnd(total) : placeholder(report, 'w-32')} sub={data ? 'theo giá vốn bình quân' : undefined}>
    <p className="mt-2 text-xs text-zinc-500">{NOW_NOTE}</p>
    <Body state={report} empty={() => total <= 0} emptyText="Kho chưa có hàng.">
      {() => <>
        {expired > 0 && <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-rose-700"><TriangleAlert size={14} aria-hidden="true" />Trong đó đã hết hạn {formatVnd(expired)}</p>}
        <AmountBars total={total} rows={groups.slice(0, 5).map(group => ({ key: group.categoryId, name: group.name, value: group.stockValue }))} />
        {groups.length > 5 && <p className="mt-3 text-xs text-zinc-500">và {num(groups.length - 5)} nhóm hàng khác</p>}
      </>}
    </Body>
  </Panel>
}

function PurchasesPanel({ report, summary, to }: { report: Report<PeriodReport<PurchaseMetrics>>; summary: Report<RevenueSummary>; to?: string }) {
  const data = report.data
  const total = data?.totals.purchaseAmount ?? 0
  const suppliers = (data?.rows ?? []).filter(row => row.purchaseAmount > 0).sort((a, b) => b.purchaseAmount - a.purchaseAmount)
  const netSales = summary.data?.current.netSales ?? 0
  return <Panel label="Nhập hàng trong kỳ" to={to} headline={data ? formatVnd(total) : placeholder(report, 'w-32')} sub={data ? `${num(data.totals.receiptCount)} phiếu nhập đã xác nhận` : undefined}>
    <Body state={report} empty={() => total <= 0} emptyText="Chưa nhập hàng trong kỳ này.">
      {() => <>
        <AmountBars total={total} rows={suppliers.slice(0, 5).map(row => ({ key: row.key, name: row.label, value: row.purchaseAmount, detail: `${num(row.receiptCount)} phiếu` }))} />
        {suppliers.length > 5 && <p className="mt-3 text-xs text-zinc-500">và {num(suppliers.length - 5)} nhà cung cấp khác</p>}
        {netSales > 0 && <p className="mt-auto pt-3 text-xs text-zinc-500">Tiền nhập bằng {percent(total / netSales * 100)} doanh thu thuần cùng kỳ.</p>}
      </>}
    </Body>
  </Panel>
}

function CreditPanel({ exposure, debt, to }: { exposure: Report<CreditExposureReport>; debt: Report<DebtDashboard>; to?: string }) {
  const totals = exposure.data?.totals
  const limit = totals?.creditLimit ?? 0
  const share = totals && limit > 0 ? totals.exposure / limit * 100 : null
  const width = (value: number) => (limit > 0 ? Math.min(100, value / limit * 100) : 0)
  const alerts = debt.data?.creditLimitAlerts ?? []
  const alertCount = debt.data?.creditLimitAlertCount ?? alerts.length
  const dueSoon = debt.data?.dueSoonAmount ?? 0
  return <Panel label="Hạn mức tín dụng" to={to} headline={totals ? (share !== null ? percent(share) : formatVnd(totals.exposure)) : placeholder(exposure, 'w-20')} sub={totals ? (share !== null ? 'tổng hạn mức đang dùng' : 'đang dùng tín dụng') : undefined}>
    <p className="mt-2 text-xs text-zinc-500">{NOW_NOTE}</p>
    <Body state={exposure} empty={() => limit <= 0 && (totals?.exposure ?? 0) <= 0} emptyText="Chưa có khách nào được cấp hạn mức.">
      {() => totals && <>
        <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100" role="img"
          aria-label={`Đã dùng ${formatVnd(totals.exposure)} trên tổng hạn mức ${formatVnd(limit)}: dư nợ ${formatVnd(totals.outstanding)}, giữ chỗ ${formatVnd(totals.reservedCredit)}`}>
          <span className="h-full" style={{ width: `${width(totals.outstanding)}%`, backgroundColor: C.accent }} />
          <span className="h-full" style={{ width: `${width(totals.reservedCredit)}%`, backgroundColor: FUNNEL_RAMP[3] }} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt className="flex items-center gap-1.5 text-xs text-zinc-500"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: C.accent }} />Dư nợ</dt><dd className="mt-0.5 font-semibold tabular-nums text-zinc-900">{formatVnd(totals.outstanding)}</dd></div>
          <div><dt className="flex items-center gap-1.5 text-xs text-zinc-500"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: FUNNEL_RAMP[3] }} />Giữ chỗ cho đơn chưa giao</dt><dd className="mt-0.5 font-semibold tabular-nums text-zinc-900">{formatVnd(totals.reservedCredit)}</dd></div>
          <div><dt className="text-xs text-zinc-500">Còn được mua chịu</dt><dd className="mt-0.5 font-semibold tabular-nums text-zinc-900">{formatVnd(totals.availableCredit)}</dd></div>
          <div><dt className="text-xs text-zinc-500">Tổng hạn mức</dt><dd className="mt-0.5 font-semibold tabular-nums text-zinc-900">{formatVnd(limit)}</dd></div>
        </dl>
        {alertCount > 0 && <div className="mt-4 border-t border-zinc-100 pt-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800"><TriangleAlert size={14} aria-hidden="true" />{num(alertCount)} khách gần hoặc chạm hạn mức</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {alerts.slice(0, 3).map(alert => <li key={alert.farmerProfileId} className="flex items-baseline justify-between gap-2">
              <span title={alert.fullName} className="min-w-0 truncate text-zinc-700">{alert.fullName}</span>
              <span className="shrink-0 text-xs text-zinc-500">{alert.state === 'AT_LIMIT' ? 'Chạm hạn mức' : 'Gần hạn mức'} · còn {shortVnd(alert.availableCredit)}</span>
            </li>)}
          </ul>
        </div>}
        {dueSoon > 0 && <p className="mt-auto pt-3 text-xs text-zinc-500">Sắp đến hạn thu <strong className="font-semibold text-zinc-700">{formatVnd(dueSoon)}</strong></p>}
      </>}
    </Body>
  </Panel>
}

function CollectionsPanel({ report, debt, to }: { report: Report<DebtCollectionReport>; debt: Report<DebtDashboard>; to?: string }) {
  const data = report.data
  const rows: ShareRow[] = METHODS.map(method => {
    const found = (data?.rows ?? []).filter(row => row.key === method.key || (row.key !== null && method.aliases?.includes(row.key)))
    return { key: method.key, name: method.name, icon: method.icon, value: found.reduce((sum, row) => sum + row.paymentCount, 0), unit: 'lần', detail: formatVnd(found.reduce((sum, row) => sum + row.collectedAmount, 0)) }
  })
  return <Panel label="Thu nợ trong kỳ" to={to} headline={data ? formatVnd(data.totals.collectedAmount) : placeholder(report, 'w-32')} sub={data ? `${num(data.totals.paymentCount)} lần thu` : undefined}>
    <Body state={report} empty={d => !d.totals.paymentCount} emptyText="Chưa thu nợ khoản nào trong kỳ này.">{() => <ShareBars rows={rows} />}</Body>
    {typeof debt.data?.collectedToday === 'number' && <p className="mt-auto flex flex-wrap gap-x-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
      <span>Hôm nay thu {formatVnd(debt.data!.collectedToday)}</span><span>Tháng này {formatVnd(debt.data!.collectedThisMonth)}</span>
    </p>}
  </Panel>
}

/** F3.23: overdue customers nobody reminded lately (disputed debt left out), and customers whose latest reminder is a promise
 * that passed unpaid with nobody following it up. Current figures, not the period. */
function FollowUpPanel({ debt, to }: { debt: Report<DebtDashboard>; to?: string }) {
  const follow = debt.data?.followUp
  return <Panel label="Theo dõi nhắc nợ" to={to}
    headline={follow ? `${num(follow.notContactedCount)} khách` : debt.loading ? placeholder(debt, 'w-24') : '—'}
    sub={follow ? `quá hạn mà chưa được nhắc trong ${num(follow.windowDays)} ngày` : undefined}>
    <p className="mt-2 text-xs text-slate-500">{NOW_NOTE}</p>
    <Body state={debt} empty={d => !d.followUp} emptyText="Máy chủ chưa có số liệu nhắc nợ.">
      {d => {
        const f = d.followUp!
        const reminded = Math.max(0, f.overdueCustomerCount - f.notContactedCount)
        return <>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-xs text-slate-500">Khách đang quá hạn</dt><dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{num(f.overdueCustomerCount)}</dd></div>
            <div><dt className="text-xs text-slate-500">Lỡ hẹn, chưa nhắc lại</dt>
              <dd className={`mt-0.5 flex items-center gap-1 font-semibold tabular-nums ${f.brokenPromiseCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{f.brokenPromiseCount > 0 && <TriangleAlert size={14} aria-hidden="true" />}{num(f.brokenPromiseCount)}</dd></div>
          </dl>
          {f.overdueCustomerCount > 0 && <div className="mt-4">
            <div className="h-2 w-full rounded-full" style={{ backgroundColor: C.track }} role="img" aria-label={`Đã nhắc trong ${f.windowDays} ngày: ${reminded} trên ${f.overdueCustomerCount} khách quá hạn`}>
              <div className="h-full rounded-full" style={{ width: `${reminded ? Math.max(reminded / f.overdueCustomerCount * 100, 1.5) : 0}%`, backgroundColor: C.accent }} />
            </div>
            <p className="mt-1.5 text-xs text-slate-600">Đã nhắc trong {num(f.windowDays)} ngày: <strong className="font-semibold text-slate-900">{num(reminded)}/{num(f.overdueCustomerCount)}</strong> khách</p>
          </div>}
          <p className="mt-auto pt-3 text-xs leading-5 text-slate-500">Không tính khoản đang tranh chấp. Cửa hàng tự nhắc khách rồi ghi lại trên trang công nợ của khách; hệ thống chỉ lưu lại, không tự gửi gì.</p>
        </>
      }}
    </Body>
  </Panel>
}

function AdvisoryPanel({ report, to }: { report: Report<AdvisoryDiagnosisReport>; to?: string }) {
  const data = report.data
  const advice = data?.advisory
  const days = data?.attributionDays ?? 7
  const stages = advice ? [
    { name: 'Lượt tư vấn', value: advice.sessionCount, detail: `${num(advice.farmerCount)} nông dân` },
    { name: 'Có gợi ý sản phẩm', value: advice.sessionsWithProducts, detail: `ước tính ${shortVnd(advice.estimatedValue)}` },
    { name: `Ra đơn trong ${num(days)} ngày`, value: advice.convertedSessions, detail: `đơn ${shortVnd(advice.convertedOrderValue)}` },
  ] : []
  const max = advice?.sessionCount ?? 0
  return <Panel label="Tư vấn ra đơn" to={to} className="xl:col-span-2"
    headline={advice ? (advice.conversionPercent !== null ? percent(advice.conversionPercent) : `${num(advice.sessionCount)} lượt`) : placeholder(report, 'w-20')}
    sub={advice ? (advice.conversionPercent !== null ? 'lượt tư vấn có gợi ý đã ra đơn' : 'tư vấn trong kỳ') : undefined}>
    <Body state={report} empty={d => !d.advisory?.sessionCount} emptyText="Chưa có lượt tư vấn nào trong kỳ này.">
      {d => <>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <ol className="space-y-3">
              {stages.map((stage, index) => <li key={stage.name}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 text-zinc-700">{stage.name}</span>
                  <span className="shrink-0 tabular-nums"><strong className="font-semibold text-zinc-900">{num(stage.value)}</strong> <span className="text-xs text-zinc-500">· {stage.detail}</span></span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full" style={{ backgroundColor: C.track }}>
                  <div className="h-full rounded-full" style={{ width: `${max ? Math.max(stage.value / max * 100, stage.value ? 1.5 : 0) : 0}%`, backgroundColor: FUNNEL_RAMP[index + 1] }} />
                </div>
              </li>)}
            </ol>
            <p className="mt-3 text-xs text-zinc-500">Gõ tìm {num(d.advisory.textSessionCount)} lượt · Từ ảnh chẩn đoán {num(d.advisory.diagnosisSessionCount)} lượt</p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-zinc-500">Vấn đề được hỏi nhiều</h4>
            <ol className="mt-2 space-y-2">
              {(d.topProblems ?? []).map((item, index) => <li key={item.diseaseId} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-x-2 text-sm">
                <span className="tabular-nums text-zinc-400">{index + 1}</span>
                <span className="min-w-0"><span title={item.name} className="block truncate font-medium text-zinc-900">{item.name}</span><span className="block text-xs text-zinc-500">{cropLabel(item.cropType)}</span></span>
                <span className="text-xs tabular-nums text-zinc-600">{num(item.sessionCount)} lượt</span>
              </li>)}
            </ol>
          </div>
        </div>
        <p className="mt-auto pt-4 text-xs leading-5 text-zinc-500">"Ra đơn": cùng nông dân đặt đơn không bị hủy có sản phẩm đã gợi ý, trong {num(days)} ngày sau lượt tư vấn. Đây là cách ước tính: đơn hàng không ghi lại lượt tư vấn nào dẫn tới nó.</p>
      </>}
    </Body>
  </Panel>
}

// AI certainty is a state, so it takes the fixed status steps (good, warning) and grey for no result; the legend names each.
const CERTAINTY_SEGMENTS = [
  { key: 'sure', name: 'Chắc chắn', color: '#0aac23' },
  { key: 'unsure', name: 'Chưa chắc', color: '#fbb315' },
  { key: 'none', name: 'Chưa có kết quả', color: C.quiet },
] as const

function DiagnosisPanel({ report, to }: { report: Report<AdvisoryDiagnosisReport>; to?: string }) {
  const diagnosis = report.data?.diagnosis
  return <Panel label="Chẩn đoán ảnh theo cây" to={to} headline={diagnosis ? `${num(diagnosis.caseCount)} ca` : placeholder(report, 'w-20')} sub={diagnosis ? 'gửi trong kỳ' : undefined}>
    <Body state={report} empty={d => !d.diagnosis?.caseCount} emptyText="Chưa có ca chẩn đoán ảnh nào trong kỳ này.">
      {d => <>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
          {CERTAINTY_SEGMENTS.map(segment => <li key={segment.key} className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />{segment.name}</li>)}
        </ul>
        <ul className="mt-4 space-y-3">
          {d.diagnosis.byCrop.map(crop => {
            const values = { sure: crop.confidentCount + crop.verifiedCount, unsure: crop.uncertainCount, none: crop.noResultCount }
            const label = CERTAINTY_SEGMENTS.map(segment => `${segment.name} ${num(values[segment.key])}`).join(', ')
            return <li key={crop.cropType}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-zinc-900">{crop.cropName}</span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-600">{num(crop.caseCount)} ca · {num(values.sure)} chắc chắn</span>
              </div>
              <div className="mt-1.5 flex h-2 w-full gap-0.5" role="img" aria-label={`${crop.cropName}: ${label}`}>
                {CERTAINTY_SEGMENTS.filter(segment => values[segment.key] > 0).map(segment => <span key={segment.key} title={`${segment.name}: ${num(values[segment.key])}`} className="h-full rounded-full" style={{ flexGrow: values[segment.key], flexBasis: 0, minWidth: 4, backgroundColor: segment.color }} />)}
              </div>
            </li>
          })}
        </ul>
        <p className="mt-auto pt-4 text-xs leading-5 text-zinc-500">Theo kết quả AI nông dân thấy. "Chưa có kết quả": đang xử lý, lỗi hoặc đã hủy.</p>
      </>}
    </Body>
  </Panel>
}

// ---- The owner's tabs ------------------------------------------------------------------------------------------------------

type TabId = 'overview' | 'sales' | 'debt' | 'stock' | 'advice'
const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'sales', label: 'Bán hàng', icon: ShoppingCart },
  { id: 'debt', label: 'Công nợ', icon: HandCoins },
  { id: 'stock', label: 'Kho hàng', icon: Package },
  { id: 'advice', label: 'Tư vấn & AI', icon: Sparkles },
]
const isTab = (value: string | null): value is TabId => TABS.some(tab => tab.id === value)

/**
 * The topics as a tinted bar of tabs, each with its icon; the open one is filled with the project green so it reads at a
 * glance (green-700 keeps white text above 4.5:1). Arrow keys, Home and End move between them (WAI-ARIA tabs pattern).
 */
function TabBar({ tab, mounted, onChange }: { tab: TabId; mounted: ReadonlySet<TabId>; onChange: (tab: TabId) => void }) {
  const keys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key]
    if (next === undefined) return
    event.preventDefault()
    onChange(TABS[next].id)
    document.getElementById(`dashboard-tab-${TABS[next].id}`)?.focus()
  }
  return <div className="overflow-x-auto">
    <div role="tablist" aria-label="Nhóm số liệu" className="flex min-w-max gap-1 rounded-xl border border-zinc-200 bg-zinc-100/80 p-1">
      {TABS.map((item, index) => {
        const selected = item.id === tab
        const Icon = item.icon
        return <button key={item.id} id={`dashboard-tab-${item.id}`} type="button" role="tab" aria-selected={selected} aria-controls={mounted.has(item.id) ? `dashboard-panel-${item.id}` : undefined} tabIndex={selected ? 0 : -1}
          onClick={() => onChange(item.id)} onKeyDown={event => keys(event, index)}
          className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${selected ? 'bg-green-700 text-white shadow-sm' : 'text-zinc-700 hover:bg-white hover:text-zinc-900'}`}>
          <Icon size={17} aria-hidden="true" className={selected ? 'text-white' : 'text-green-700'} />{item.label}
        </button>
      })}
    </div>
  </div>
}

/** Where a tab mixes figures of the chosen period with figures as of today, each kind sits under its own heading. */
function Scope({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return <section aria-label={title} className="flex flex-col gap-3">
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h3 className="text-sm font-medium text-zinc-900">{title}</h3>
      <p className="text-xs text-zinc-500">{note}</p>
    </div>
    {children}
  </section>
}

/**
 * The owner's and the admin's dashboard below the period filter: every panel reads a report API for the same period.
 * The owner's view is split into tabs: "Tổng quan" fits one screen (four figures, the trend beside the best sellers, then
 * `overview`, the recent orders); the other panels sit in a tab by topic. A tab's reports load the first time it opens and
 * stay loaded, so arriving asks for the overview only. The open tab is kept in `?tab=`.
 */
export default function DashboardCharts({ fromDate, toDate, links = {}, manager = false, overview }: { fromDate: string; toDate: string; links?: DashboardLinks; manager?: boolean; overview?: ReactNode }) {
  const { has } = usePermission()
  const problem = periodProblem(fromDate, toDate)
  const granularity = granularityFor(rangeDays(fromDate, toDate))
  const [params, setParams] = useSearchParams()
  const asked = params.get('tab')
  const tab: TabId = manager && isTab(asked) ? asked : 'overview'
  const [visited, setVisited] = useState<ReadonlySet<TabId>>(() => new Set([tab]))
  if (!visited.has(tab)) setVisited(new Set([...visited, tab]))
  const choose = (next: TabId) => setParams(current => {
    const query = new URLSearchParams(current)
    if (next === 'overview') query.delete('tab')
    else query.set('tab', next)
    return query
  }, { replace: true })
  // A report is asked for once a tab that shows it has been opened (the admin's single page shows all of them).
  const opened = (...tabs: TabId[]) => (!manager || tabs.some(item => visited.has(item)) ? null : 'Mục này chưa được mở.')
  const inPeriod = (...tabs: TabId[]) => problem ?? opened(...tabs)

  // Fetch the headline figures and current risks before secondary breakdowns.
  const summary = useReport(useCallback((signal: AbortSignal) => businessReportsApi.revenueSummary({ fromDate, toDate }, signal), [fromDate, toDate]), inPeriod('overview', 'sales', 'stock'))
  const sales = useReport(useCallback((signal: AbortSignal) => businessReportsApi.sales({ fromDate, toDate, groupBy: 'DAY' }, signal), [fromDate, toDate]), inPeriod('overview'))
  const trend = useReport(useCallback((signal: AbortSignal) => businessReportsApi.revenue({ fromDate, toDate, groupBy: granularity, page: 1, pageSize: 100 }, signal), [fromDate, toDate, granularity]), inPeriod('overview'))
  const payments = useReport(useCallback((signal: AbortSignal) => businessReportsApi.payments({ fromDate, toDate, groupBy: 'METHOD' }, signal), [fromDate, toDate]), inPeriod('overview', 'sales'))
  const aging = useReport(useCallback((signal: AbortSignal) => reportsApi.getDebtAging({}, signal), []), opened('overview', 'debt'))
  const expiry = useReport(useCallback((signal: AbortSignal) => replenishmentApi.expiryRisk({ withinDays: EXPIRY_WINDOW_DAYS, page: 1, pageSize: 3 }, signal), []), opened('stock'))
  const topProducts = useReport(useCallback((signal: AbortSignal) => businessReportsApi.revenue({ fromDate, toDate, groupBy: 'PRODUCT', page: 1, pageSize: 10 }, signal), [fromDate, toDate]), inPeriod('overview'))
  // Sales pace over the period's length (the API takes 14 to 365 days, counted back from today), for the units sold and the
  // days of stock left next to each best seller.
  const paceDays = Math.min(365, Math.max(14, rangeDays(fromDate, toDate)))
  const velocity = useReport(useCallback((signal: AbortSignal) => replenishmentApi.velocity({ historyDays: paceDays, page: 1, pageSize: 100 }, signal), [paceDays]), inPeriod('overview'))
  // The manager view's money and advice panels (2026-11-23). The admin dashboard does not show them, so it does not ask.
  const managerOnly = manager ? null : 'Chỉ có ở dashboard chủ cửa hàng.'
  const valuation = useReport(useCallback((signal: AbortSignal) => inventoryReportsApi.getValuation({}, signal), []), managerOnly ?? opened('stock'))
  const purchases = useReport(useCallback((signal: AbortSignal) => businessReportsApi.purchases({ fromDate, toDate, groupBy: 'SUPPLIER' }, signal), [fromDate, toDate]), managerOnly ?? inPeriod('stock'))
  const exposure = useReport(useCallback((signal: AbortSignal) => businessReportsApi.creditExposure(signal), []), managerOnly ?? opened('debt'))
  const debtDashboard = useReport(useCallback((signal: AbortSignal) => debtApi.getDashboard(signal), []), managerOnly ?? (has('DEBT.READ_DASHBOARD') ? opened('debt') : 'Cần quyền xem tổng quan công nợ.'))
  const collections = useReport(useCallback((signal: AbortSignal) => reportsApi.getDebtCollections({ fromDate, toDate, groupBy: 'METHOD' }, signal), [fromDate, toDate]), managerOnly ?? inPeriod('debt'))
  const advice = useReport(useCallback((signal: AbortSignal) => businessReportsApi.advisoryDiagnosis({ fromDate, toDate }, signal), [fromDate, toDate]), managerOnly ?? inPeriod('advice'))
  const categories = useReport(useCallback((signal: AbortSignal) => businessReportsApi.revenue({ fromDate, toDate, groupBy: 'CATEGORY', page: 1, pageSize: 5 }, signal), [fromDate, toDate]), inPeriod('sales'))
  const sources = useReport(useCallback((signal: AbortSignal) => businessReportsApi.orders({ fromDate, toDate, groupBy: 'SOURCE' }, signal), [fromDate, toDate]), inPeriod('sales'))
  const statuses = useReport(useCallback((signal: AbortSignal) => businessReportsApi.orders({ fromDate, toDate, groupBy: 'STATUS' }, signal), [fromDate, toDate]), inPeriod('sales'))
  const debtGroups = useReport(useCallback((signal: AbortSignal) => reportsApi.getDebtByGroup(signal), []), opened('debt'))
  const topCustomers = useReport(useCallback((signal: AbortSignal) => businessReportsApi.revenue({ fromDate, toDate, groupBy: 'CUSTOMER', page: 1, pageSize: 5 }, signal), [fromDate, toDate]), inPeriod('sales'))

  if (manager) {
    const figures = periodFigures(summary, sales, payments)
    const now = 'Tính đến hôm nay, không theo kỳ báo cáo'
    const period = `${formatDay(fromDate)} – ${formatDay(toDate)}`
    const content: Record<TabId, () => ReactNode> = {
      // Read left to right: the four figures, then the trend beside what sells, then the latest orders.
      overview: () => <>
        <Figures label="Chỉ số chính" title={comparedWith(summary)} className="grid-cols-2 xl:grid-cols-4" figures={[figures.netSales, figures.grossProfit, figures.received, receivablesFigure(aging)]} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <TrendPanel trend={trend} requested={granularity} ordersTo={links.orders} idle={tab !== 'overview'} />
          <TopProductsPanel report={topProducts} velocity={velocity} to={links.planning} limit={5} />
        </div>
        {overview}
      </>,
      sales: () => <>
        <Figures label="Đơn hàng trong kỳ" title={comparedWith(summary)} className="grid-cols-1 sm:grid-cols-3" figures={[figures.orders, figures.averageOrder, figures.returns]} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SourcesPanel report={sources} to={links.orders} />
          <MethodsPanel report={payments} to={links.payments} />
          <FunnelPanel report={statuses} to={links.orders} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <CategoryPanel report={categories} to={links.products} />
          <TopCustomersPanel report={topCustomers} to={links.customers} />
        </div>
      </>,
      debt: () => <>
        <Scope title="Hiện tại" note={now}>
          <div className="grid gap-4 md:grid-cols-2">
            <DebtPanel report={aging} to={links.debts} focusOverdue />
            <CreditPanel exposure={exposure} debt={debtDashboard} to={links.debts} />
            <FollowUpPanel debt={debtDashboard} to={links.debts} />
            <DebtGroupsPanel report={debtGroups} to={links.debts} />
          </div>
        </Scope>
        <Scope title="Trong kỳ" note={period}>
          <div className="grid gap-4 md:grid-cols-2"><CollectionsPanel report={collections} debt={debtDashboard} to={links.debts} /></div>
        </Scope>
      </>,
      stock: () => <>
        <Scope title="Hiện tại" note={now}>
          <div className="grid gap-4 md:grid-cols-2">
            <InventoryValuePanel report={valuation} to={links.inventory} />
            <ExpiryPanel report={expiry} to={links.expiry} />
          </div>
        </Scope>
        <Scope title="Trong kỳ" note={period}>
          <div className="grid gap-4 md:grid-cols-2"><PurchasesPanel report={purchases} summary={summary} to={links.purchases} /></div>
        </Scope>
      </>,
      advice: () => <div className="grid gap-4 xl:grid-cols-3">
        <AdvisoryPanel report={advice} to={links.advisory} />
        <DiagnosisPanel report={advice} to={links.diagnosis} />
      </div>,
    }
    return <div className="flex flex-col gap-4">
      <TabBar tab={tab} mounted={visited} onChange={choose} />
      {/* Tabs opened once stay mounted, hidden, so going back shows them at once without asking again. */}
      {TABS.filter(item => visited.has(item.id)).map(item => <div key={item.id} id={`dashboard-panel-${item.id}`} role="tabpanel" aria-labelledby={`dashboard-tab-${item.id}`}
        hidden={item.id !== tab} className={item.id === tab ? 'flex flex-col gap-4' : 'hidden'}>{content[item.id]()}</div>)}
    </div>
  }

  return <div className="flex flex-col gap-5">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <StatGrid summary={summary} sales={sales} payments={payments} />
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
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <TopProductsPanel report={topProducts} velocity={velocity} to={links.planning} className="xl:col-span-2" />
      <ExpiryPanel report={expiry} to={links.expiry} />
      <TopCustomersPanel report={topCustomers} to={links.customers} />
    </div>
  </div>
}
