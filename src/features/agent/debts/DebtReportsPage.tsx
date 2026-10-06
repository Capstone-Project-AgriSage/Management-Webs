import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { reportsApi, type DebtAgingReport, type DebtCollectionReport, type DebtByGroupReport } from '@/api/reportsApi'
import { formatVnd, formatVndShort } from '@/utils/money'
import { formatDay, todayVn } from '@/utils/creditLabels'

// Chart chrome per the data-viz spec: one series → one hue (validated), thin bars with a 4px data-end,
// hairline solid grid, axis text in muted ink, hover tooltip; every chart has a table beside it.
const SERIES = '#2a78d6'
const GRID = '#e7e5e4'
const AXIS_TEXT = '#6b6a66'
const BAR_SIZE = 24

const AGING_BUCKETS: { key: 'notDue' | 'days1To30' | 'days31To60' | 'days61To90' | 'over90'; label: string }[] = [
  { key: 'notDue', label: 'Trong hạn' },
  { key: 'days1To30', label: '1–30 ngày' },
  { key: 'days31To60', label: '31–60 ngày' },
  { key: 'days61To90', label: '61–90 ngày' },
  { key: 'over90', label: 'Trên 90 ngày' },
]

const GROUP_BY_OPTIONS = [
  { value: 'DAY', label: 'Theo ngày' },
  { value: 'METHOD', label: 'Theo phương thức' },
  { value: 'STAFF', label: 'Theo nhân viên' },
] as const

const METHOD_LABEL: Record<string, string> = { CASH: 'Tiền mặt', PAYOS: 'payOS', BANK_TRANSFER: 'Chuyển khoản' }

const firstOfMonth = () => `${todayVn().slice(0, 8)}01`

function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: { count?: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs">
      <div className="font-semibold text-slate-900">{label}</div>
      <div className="text-slate-700 tabular-nums mt-0.5">{formatVnd(p.value)}</div>
      {p.payload.count != null && <div className="text-slate-500">{p.payload.count} lần thu</div>}
    </div>
  )
}

function ColumnChart({ data, ariaLabel }: { data: { name: string; value: number; count?: number }[]; ariaLabel: string }) {
  return (
    <div className="h-64" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS_TEXT, fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 11 }} tickFormatter={(v: number) => formatVndShort(v)} width={56} />
          <Tooltip cursor={{ fill: '#f1f5f9' }} content={<MoneyTooltip />} />
          <Bar dataKey="value" fill={SERIES} maxBarSize={BAR_SIZE} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Stat({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

// FLOW_3 §8 (Manage): debt aging, collections and debt by customer group.
export default function DebtReportsPage() {
  usePageHeader({ title: 'Báo cáo công nợ', subtitle: 'Tuổi nợ, thu hồi nợ và nợ theo nhóm khách' })
  const { showToast } = useToast()

  const [asOf, setAsOf] = useState(todayVn())
  const [fromDate, setFromDate] = useState(firstOfMonth())
  const [toDate, setToDate] = useState(todayVn())
  const [groupBy, setGroupBy] = useState<'DAY' | 'METHOD' | 'STAFF'>('DAY')
  const [loading, setLoading] = useState(false)
  const [aging, setAging] = useState<DebtAgingReport | null>(null)
  const [collections, setCollections] = useState<DebtCollectionReport | null>(null)
  const [byGroup, setByGroup] = useState<DebtByGroupReport | null>(null)

  const fetchData = async () => {
    if (fromDate > toDate) {
      showToast('Ngày bắt đầu phải trước ngày kết thúc', 'warning')
      return
    }
    setLoading(true)
    try {
      const [a, c, g] = await Promise.all([
        reportsApi.getDebtAging({ asOf }),
        reportsApi.getDebtCollections({ fromDate, toDate, groupBy }),
        reportsApi.getDebtByGroup(),
      ])
      setAging(a)
      setCollections(c)
      setByGroup(g)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi tải báo cáo công nợ', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOf, fromDate, toDate, groupBy])

  const totals = aging?.totals
  const overdue = totals ? totals.total - totals.notDue : 0
  const agingChart = AGING_BUCKETS.map((b) => ({ name: b.label, value: totals?.[b.key] ?? 0 }))
  const collectionChart = (collections?.rows ?? []).map((r) => ({
    name: groupBy === 'DAY' ? formatDay(r.key).slice(0, 5) : groupBy === 'METHOD' ? (METHOD_LABEL[r.key ?? ''] ?? r.label ?? r.key ?? '--') : (r.label ?? r.key ?? '--'),
    value: r.collectedAmount,
    count: r.paymentCount,
  }))

  const inputClassName = 'h-9 px-2 rounded-lg border border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
  const th = 'py-2.5 px-3 text-[12px] font-bold text-slate-900'

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-space-lg p-space-md">
      {/* Aging */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Tuổi nợ</h3>
            <p className="text-xs text-slate-500">Dư nợ chia theo số ngày quá hạn, tính tại một ngày (chọn ngày cũ để xem lại quá khứ).</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 flex items-center gap-2">
              Tại ngày
              <input type="date" className={inputClassName} value={asOf} max={todayVn()} onChange={(e) => setAsOf(e.target.value)} />
            </label>
            <button type="button" className="h-9 px-3 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5" onClick={fetchData} disabled={loading}>
              <RefreshCw size={14} /> Làm mới
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          <div className="space-y-5">
            <Stat title="Tổng dư nợ" value={formatVnd(totals?.total ?? 0)} />
            <Stat title="Đã quá hạn" value={formatVnd(overdue)} sub={totals?.total ? `${Math.round((overdue / totals.total) * 100)}% dư nợ` : undefined} />
          </div>
          <ColumnChart data={agingChart} ariaLabel="Biểu đồ dư nợ theo số ngày quá hạn" />
        </div>
        <div className="overflow-x-auto border-t border-slate-100 pt-3">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left border-b border-slate-100">
                <th className={th}>Khách hàng</th>
                {AGING_BUCKETS.map((b) => (
                  <th key={b.key} className={`${th} text-right`}>{b.label}</th>
                ))}
                <th className={`${th} text-right`}>Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(aging?.rows ?? []).length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-slate-500">{loading ? 'Đang tải...' : 'Không có dư nợ tại ngày này.'}</td></tr>
              ) : (
                aging!.rows.map((r) => (
                  <tr key={r.farmerProfileId}>
                    <td className="py-2 px-3">
                      <div className="font-medium">{r.fullName ?? '--'}</div>
                      <div className="text-xs text-slate-500">{r.customerGroup?.name ?? ''}</div>
                    </td>
                    {AGING_BUCKETS.map((b) => (
                      <td key={b.key} className={`py-2 px-3 text-right tabular-nums ${r[b.key] > 0 ? (b.key === 'notDue' ? 'text-slate-900' : 'text-rose-600 font-medium') : 'text-slate-300'}`}>
                        {r[b.key] > 0 ? formatVnd(r[b.key]) : '–'}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right tabular-nums font-semibold">{formatVnd(r.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Collections */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Thu hồi nợ</h3>
            <p className="text-xs text-slate-500">Tiền trả nợ đã ghi vào sổ trong khoảng thời gian (tối đa 366 ngày).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" aria-label="Từ ngày" className={inputClassName} value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} />
            <span className="text-slate-400">→</span>
            <input type="date" aria-label="Đến ngày" className={inputClassName} value={toDate} min={fromDate} max={todayVn()} onChange={(e) => setToDate(e.target.value)} />
            <div className="flex bg-slate-100 p-1 rounded-lg text-sm" role="tablist">
              {GROUP_BY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="tab"
                  aria-selected={groupBy === o.value}
                  className={`px-2.5 py-1 rounded-md font-medium ${groupBy === o.value ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
                  onClick={() => setGroupBy(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          <div className="space-y-5">
            <Stat title="Đã thu" value={formatVnd(collections?.totals.collectedAmount ?? 0)} sub={`${collections?.totals.paymentCount ?? 0} lần thu`} />
          </div>
          {collectionChart.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">{loading ? 'Đang tải...' : 'Chưa thu được khoản nợ nào trong kỳ.'}</div>
          ) : (
            <ColumnChart data={collectionChart} ariaLabel="Biểu đồ tiền thu nợ" />
          )}
        </div>
        {collectionChart.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-emerald-700 font-medium">Xem bảng số liệu</summary>
            <table className="w-full mt-2">
              <tbody className="divide-y divide-slate-50">
                {collectionChart.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1.5 px-3">{r.name}</td>
                    <td className="py-1.5 px-3 text-right text-slate-500">{r.count} lần</td>
                    <td className="py-1.5 px-3 text-right tabular-nums font-medium">{formatVnd(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      {/* By group */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Nợ theo nhóm khách</h3>
          <p className="text-xs text-slate-500">Mức sử dụng = dư nợ ÷ tổng hạn mức của nhóm.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left border-b border-slate-100">
                <th className={th}>Nhóm</th>
                <th className={`${th} text-right`}>Khách đang nợ</th>
                <th className={`${th} text-right`}>Dư nợ</th>
                <th className={`${th} text-right`}>Quá hạn</th>
                <th className={`${th} text-right`}>Tổng hạn mức</th>
                <th className={`${th} w-56`}>Mức sử dụng hạn mức</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(byGroup?.rows ?? []).length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">{loading ? 'Đang tải...' : 'Chưa có dữ liệu.'}</td></tr>
              ) : (
                byGroup!.rows.map((r, i) => {
                  const pct = r.utilization == null ? null : Math.round(r.utilization * 100)
                  return (
                    <tr key={r.customerGroup?.id ?? i}>
                      <td className="py-2 px-3 font-medium">{r.customerGroup?.name ?? 'Nhóm mặc định'}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{r.customersWithDebt}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatVnd(r.outstanding)}</td>
                      <td className={`py-2 px-3 text-right tabular-nums ${r.overdueAmount > 0 ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>{formatVnd(r.overdueAmount)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatVnd(r.totalCreditLimit)}</td>
                      <td className="py-2 px-3">
                        {pct == null ? (
                          <span className="text-xs text-slate-400">Chưa có hạn mức</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Mức sử dụng hạn mức">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: SERIES }} />
                            </div>
                            <span className="text-xs tabular-nums text-slate-700 w-10 text-right">{pct}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
