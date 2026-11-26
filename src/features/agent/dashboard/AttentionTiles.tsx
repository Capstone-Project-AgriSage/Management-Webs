import { useCallback, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CircleCheck, ClipboardList, HandCoins, Microscope, PackageX, RefreshCw, Truck, type LucideIcon } from 'lucide-react'
import { ordersApi } from '@/api/ordersApi'
import { deliveriesApi } from '@/api/deliveriesApi'
import { diagnosisApi } from '@/api/diagnosisApi'
import { stockApi } from '@/api/stockApi'
import { reportsApi } from '@/api/reportsApi'
import { usePermission } from '@/context/PermissionContext'
import { useReportData } from '@/features/agent/reports/useReportData'
import { formatVnd } from '@/utils/money'
import { todayVn } from '@/utils/creditLabels'

type Area = 'agent' | 'sales'

interface Tile {
  key: string
  title: string
  note: string
  icon: LucideIcon
  /** The route is opened only for someone who may read the list, so the tile asks for the same permission. */
  permission: string
  to: string
  money?: boolean
  load: (signal: AbortSignal) => Promise<number>
}

// Each tile counts what is waiting for someone right now (not a period total), through the list API of its own area.
function tilesFor(area: Area): Tile[] {
  const tiles: Tile[] = [
    {
      key: 'orders', title: 'Đơn chờ xác nhận', note: 'Cần xác nhận hoặc từ chối', icon: ClipboardList, permission: 'ORDERS.READ', to: `/${area}/orders`,
      load: async signal => (await ordersApi.getOrders({ status: 'PENDING_CONFIRMATION', page: 1, pageSize: 1 }, signal)).totalCount,
    },
  ]
  // Nobody reviews the AI any more: the farmers worth a call are those it was not sure about this week.
  tiles.push({
    key: 'diagnosis', title: 'AI chưa chắc chắn (7 ngày)', note: 'Nông dân được khuyên chụp lại hoặc hỏi cửa hàng: nên gọi tư vấn',
    icon: Microscope, permission: 'DIAGNOSIS.READ',
    to: area === 'agent' ? '/agent/ai-recommendations' : '/sales/ai-review',
    load: async () => (await diagnosisApi.list({ aiPassed: false, from: weekAgo(), page: 1, pageSize: 1 })).totalCount,
  })
  tiles.push(
    {
      key: 'deliveries', title: 'Chuyến chờ giao lại', note: 'Giao chưa thành công, cần xếp lại', icon: Truck, permission: 'DELIVERIES.READ', to: `/${area}/deliveries`,
      load: async signal => (await deliveriesApi.getDeliveries({ status: 'RETRY_PENDING', page: 1, pageSize: 1 }, signal)).totalCount,
    },
    {
      key: 'stock', title: 'Cảnh báo kho', note: 'Hết hạn, sắp hết hạn hoặc tồn thấp', icon: PackageX, permission: 'INVENTORY.READ', to: `/${area}/inventory`,
      load: async () => (await stockApi.getAlerts({ page: 1, pageSize: 1 })).totalCount,
    },
    {
      key: 'debt', title: 'Nợ quá hạn', note: 'Tổng nợ đã quá hạn trả', icon: HandCoins, permission: 'REPORTS.READ', to: `/${area}/debts`, money: true,
      load: async signal => { const { totals } = await reportsApi.getDebtAging({}, signal); return totals.total - totals.notDue },
    },
  )
  if (area === 'agent') {
    const priority = ['orders', 'debt', 'stock', 'deliveries', 'diagnosis']
    tiles.sort((a, b) => priority.indexOf(a.key) - priority.indexOf(b.key))
  }
  return tiles
}

// yyyy-MM-dd of the day six days ago, so the range covers this day and the six before it.
function weekAgo(): string {
  return new Date(Date.parse(`${todayVn()}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10)
}

/** Each queue the signed-in person may open, with its count (null when it could not be read). */
function useAttention(area: Area) {
  const { has } = usePermission()
  const tiles = useMemo(() => tilesFor(area).filter(tile => has(tile.permission)), [area, has])
  const load = useCallback((signal: AbortSignal) => Promise.all(tiles.map(tile => tile.load(signal).catch(() => null))), [tiles])
  return { tiles, ...useReportData(load, tiles.length ? null : 'Không có mục nào để hiển thị.') }
}

const show = (tile: Tile, value: number | null) => (value === null ? '—' : tile.money ? formatVnd(value) : value.toLocaleString('vi-VN'))

/**
 * The owner's "needs doing now" as one line, as the large admin consoles do: only the queues with something waiting (or
 * that could not be read, since a dash is not a zero), each a link to its list; nothing else when every queue is clear.
 * `children` adds rows under it (the upcoming-season reminder), so everything to act on sits in one place.
 */
export function AttentionBar({ children }: { children?: ReactNode }) {
  const { tiles, data, loading, refresh } = useAttention('agent')
  if (!tiles.length) return <>{children}</>
  const waiting = tiles.map((tile, index) => ({ tile, value: data?.[index] ?? null })).filter(({ value }) => !data || value === null || value > 0)
  const unavailable = data?.some(value => value === null)
  return <section aria-label="Việc cần xử lý" className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-5">
      <div className="min-w-0 flex-1 sm:flex-none">
        <h2 className="text-base font-medium text-zinc-900">Việc cần xử lý</h2>
        <p className="text-xs text-zinc-500">Hiện tại · không theo kỳ báo cáo</p>
      </div>
      {/* On a phone the queues take their own line under the heading; from sm up they sit between it and the refresh. */}
      <ul aria-busy={loading} className="order-last flex w-full min-w-0 flex-wrap items-center gap-2 sm:order-none sm:w-auto sm:flex-1">
        {loading && !data ? [0, 1, 2].map(key => <li key={key} aria-hidden="true" className="h-9 w-40 animate-pulse rounded-lg bg-zinc-100" />)
          : waiting.length ? waiting.map(({ tile, value }) => {
            const Icon = tile.icon
            const known = value !== null
            return <li key={tile.key}>
              <Link to={tile.to} title={tile.note} aria-label={`${tile.title}: ${value === null ? 'chưa tải được' : show(tile, value)}. Mở danh sách`}
                className={`group inline-flex h-9 max-w-full items-center gap-2 rounded-lg border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-700 ${known ? 'border-amber-200 bg-amber-50/70 text-zinc-800 hover:bg-amber-50' : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'}`}>
                <Icon size={15} aria-hidden="true" className={known ? 'shrink-0 text-amber-700' : 'shrink-0 text-zinc-500'} />
                <span className="truncate">{tile.title}</span>
                <strong className={`font-semibold tabular-nums ${known ? tile.money ? 'text-rose-700' : 'text-amber-800' : 'text-zinc-600'}`}>{show(tile, value)}</strong>
                <ArrowUpRight size={14} aria-hidden="true" className="shrink-0 text-zinc-400 group-hover:text-zinc-700" />
              </Link>
            </li>
          }) : <li className="flex items-center gap-2 text-sm text-green-800"><CircleCheck size={16} aria-hidden="true" />Không có đơn, chuyến giao, cảnh báo kho hay nợ quá hạn nào đang chờ.</li>}
      </ul>
      <button type="button" aria-label="Làm mới việc cần xử lý" title="Làm mới việc cần xử lý" onClick={refresh} disabled={loading} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-[#fff] text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
    </div>
    {unavailable && <p role="status" className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-600 sm:px-5">Một số mục chưa tải được. Dấu — không có nghĩa là không có việc cần xử lý.</p>}
    {children}
  </section>
}

/** What needs doing now, one tile per queue the signed-in person may open. A tile that cannot load shows a dash and leaves the others alone. */
export default function AttentionTiles({ area }: { area: Area }) {
  const { tiles, data, loading, refresh } = useAttention(area)
  if (!tiles.length) return null
  const actionable = tiles.filter((_, index) => (data?.[index] ?? 0) > 0).length
  const unavailable = data?.some(value => value === null)

  // Joined cells with hairline borders, like the template's figures: the queue's name with its icon at the right, then the
  // count and what it means. The icon's color says whether something is waiting (amber) or all clear (green).
  return <section aria-label="Việc cần xử lý" className="space-y-3">
    <div className="flex items-end justify-between gap-2">
      <div>
        <h2 className="text-xl font-medium tracking-tight text-zinc-900 sm:text-2xl">Việc cần xử lý</h2>
        {area === 'agent' && <p className="mt-1 text-sm text-zinc-500">Hiện tại · Không phụ thuộc kỳ báo cáo bên dưới{!loading && data && ` · ${actionable} mục có việc cần xử lý`}</p>}
      </div>
      <button type="button" aria-label="Làm mới việc cần xử lý" title="Làm mới việc cần xử lý" onClick={refresh} disabled={loading} className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 bg-[#fff] text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
    </div>
    <div aria-busy={loading} className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 ${tiles.length >= 5 ? 'lg:grid-cols-5' : tiles.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
      {tiles.map((tile, index) => {
        const value = data?.[index] ?? null
        const waiting = value !== null && value > 0
        const Icon = tile.icon
        return <Link key={tile.key} to={tile.to} title={tile.note} aria-label={`${tile.title}: ${value === null ? 'chưa tải được' : tile.money ? formatVnd(value) : value.toLocaleString('vi-VN')}. Mở danh sách`}
          className={`group relative flex min-w-0 flex-col gap-1.5 bg-[#fff] p-4 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-700 sm:p-5 ${tiles.length % 2 === 1 && index === tiles.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`}>
          <span className="pr-9 text-sm leading-5 text-zinc-700">{tile.title}</span>
          <span className={`absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-md sm:right-5 sm:top-5 ${value === null || loading ? 'bg-zinc-100 text-zinc-500' : waiting ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}><Icon size={15} aria-hidden="true" /></span>
          <span className={`block text-xl font-medium leading-8 tracking-tight tabular-nums [overflow-wrap:anywhere] sm:text-[28px] sm:leading-9 ${waiting ? tile.money ? 'text-rose-700' : 'text-amber-800' : 'text-zinc-900'}`}>{loading ? <span aria-hidden="true" className="inline-block h-8 w-14 animate-pulse rounded bg-zinc-100 align-middle" /> : value === null ? '—' : tile.money ? formatVnd(value) : value.toLocaleString('vi-VN')}</span>
          {area === 'agent' && <span className="mt-auto hidden items-center gap-1 text-[13px] leading-5 text-zinc-500 sm:flex">{!loading && value === null ? 'Chưa tải được · Bấm làm mới để thử lại' : tile.note}<ArrowUpRight size={14} aria-hidden="true" className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" /></span>}
        </Link>
      })}
    </div>
    {area === 'agent' && unavailable && <p role="status" className="text-xs text-zinc-600">Một số mục chưa tải được. Dấu — không có nghĩa là không có việc cần xử lý.</p>}
  </section>
}
