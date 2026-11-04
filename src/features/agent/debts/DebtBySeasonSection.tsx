import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import FilterSelect from '@/components/ui/FilterSelect'
import StatusBadge from '@/components/ui/StatusBadge'
import { reportsApi, type DebtBySeasonItem } from '@/api/reportsApi'
import { describeApiError } from '@/utils/apiError'
import { formatDay, todayVn } from '@/utils/creditLabels'
import { formatVnd } from '@/utils/money'
import { SEASON_STATUS } from '@/features/crop-seasons/seasonRules'

// FE_GUIDE_FLOW_3 §3.1 mục 8. Each season has two blocks: debt that ARISE in it (origin, never changes) and debt being
// COLLECTED in it now (moves with rollovers). They answer different questions and are never merged into one "season".

function Line({ label, value, strong, sign }: { label: string; value: number; strong?: boolean; sign?: '−' | '=' }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 text-sm ${strong ? 'border-t border-slate-200 pt-2 font-semibold text-slate-900' : 'text-slate-700'}`}>
      <dt>{sign && <span className="mr-1.5 inline-block w-3 text-slate-400" aria-hidden>{sign}</span>}{label}</dt>
      <dd className="tabular-nums">{formatVnd(value)}</dd>
    </div>
  )
}

function SeasonCard({ item }: { item: DebtBySeasonItem }) {
  const { origin, collection } = item
  const meta = SEASON_STATUS[item.status]
  return (
    <article className="rounded-xl border border-slate-200 p-4" aria-label={`Nợ theo vụ ${item.season.name}`}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-slate-900">{item.season.name} <span className="ml-1 font-mono text-xs font-normal text-slate-500">{item.season.code}</span></h4>
          <p className="text-xs text-slate-500">Thu hoạch từ {formatDay(item.harvestStart)} · hạn trả {formatDay(item.paymentDueDate)}</p>
        </div>
        <StatusBadge label={meta?.label ?? item.status} className={meta?.className} />
      </header>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <section>
          <h5 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Theo vụ phát sinh</h5>
          <dl>
            <Line label="Nợ phát sinh" value={origin.originatedAmount} />
            <Line label="Đã thu" value={origin.collectedAmount} sign="−" />
            <Line label="Trả hàng" value={origin.returnedAmount} sign="−" />
            <Line label="Đã giảm" value={origin.reducedAmount} sign="−" />
            <Line label="Đã xóa" value={origin.cancelledAmount} sign="−" />
            <Line label="Còn nợ" value={origin.outstandingAmount} sign="=" strong />
          </dl>
          <p className="mt-1 text-xs text-slate-500">
            {origin.entryCount} khoản · {origin.customerCount} khách
            {origin.carriedOverAmount > 0 && <> · trong số còn nợ, <strong className="text-slate-700">{formatVnd(origin.carriedOverAmount)}</strong> đã chuyển sang vụ sau</>}
          </p>
        </section>
        <section>
          <h5 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Theo vụ đang thu</h5>
          <dl>
            <Line label="Nợ chuyển đến từ vụ khác" value={collection.carriedInAmount} />
            <Line label="Còn phải thu trong vụ" value={collection.toCollectAmount} strong />
          </dl>
          <p className="mt-1 text-xs text-slate-500">{collection.openEntryCount} khoản đang thu</p>
        </section>
      </div>
      {item.isFrozen && <p className="mt-3 text-xs text-slate-500">Số liệu chốt khi đóng vụ{item.closedAt ? ` ngày ${formatDay(item.closedAt)}` : ''}; không đổi sau đó.</p>}
    </article>
  )
}

export default function DebtBySeasonSection() {
  const thisYear = Number(todayVn().slice(0, 4))
  const [year, setYear] = useState('')
  const [items, setItems] = useState<DebtBySeasonItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('')
    try {
      const result = await reportsApi.getDebtBySeason({ year: year ? Number(year) : undefined, pageSize: 100 }, signal)
      if (!signal?.aborted) setItems(result.items)
    } catch (err) {
      if (!signal?.aborted) { setItems(null); setError(describeApiError(err, 'Không tải được báo cáo nợ theo vụ')) }
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [year])

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => load(controller.signal))
    return () => controller.abort()
  }, [load])

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4" aria-busy={loading}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Nợ theo vụ mùa</h3>
          <p className="text-xs text-slate-500">Nợ phát sinh trong từng vụ và nợ đang được thu trong vụ. Phát sinh − đã thu − trả hàng − giảm − xóa = còn nợ.</p>
        </div>
        <div className="flex items-end gap-2">
          <FilterSelect label="Năm thu hoạch" value={year} onChange={setYear} options={[{ value: '', label: 'Tất cả các năm' }, ...[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map(y => ({ value: String(y), label: String(y) }))]} />
          <button type="button" disabled={loading} onClick={() => void load()} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Làm mới</button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {!error && loading && !items && <p role="status" className="py-6 text-center text-sm text-slate-500">Đang tải…</p>}
      {!error && items && items.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Chưa có vụ nào trong khoảng này.</p>}
      {items && items.length > 0 && <div className="space-y-4">{items.map(item => <SeasonCard key={item.season.id} item={item} />)}</div>}
    </section>
  )
}
