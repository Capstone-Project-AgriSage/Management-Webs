import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ClipboardList, HandCoins, Microscope, PackageX, RefreshCw, Truck, type LucideIcon } from 'lucide-react'
import { ordersApi } from '@/api/ordersApi'
import { deliveriesApi } from '@/api/deliveriesApi'
import { diagnosisApi } from '@/api/diagnosisApi'
import { stockApi } from '@/api/stockApi'
import { reportsApi } from '@/api/reportsApi'
import { useAuth } from '@/context/AuthContext'
import { usePermission } from '@/context/PermissionContext'
import { useReportData } from '@/features/agent/reports/useReportData'
import { formatVnd } from '@/utils/money'

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
function tilesFor(area: Area, canReviewAi: boolean): Tile[] {
  const tiles: Tile[] = [
    {
      key: 'orders', title: 'Đơn chờ xác nhận', note: 'Cần xác nhận hoặc từ chối', icon: ClipboardList, permission: 'ORDERS.READ', to: `/${area}/orders`,
      load: async signal => (await ordersApi.getOrders({ status: 'PENDING_CONFIRMATION', page: 1, pageSize: 1 }, signal)).totalCount,
    },
  ]
  if (area === 'agent' || canReviewAi) {
    tiles.push({
      key: 'diagnosis', title: 'Ca chẩn đoán chờ duyệt', note: 'AI đã chạy, chờ chuyên gia xem', icon: Microscope, permission: 'DIAGNOSIS.READ',
      to: area === 'agent' ? '/agent/ai-recommendations' : '/sales/ai-review',
      load: async () => (await diagnosisApi.list({ status: 'AI_COMPLETED', page: 1, pageSize: 1 })).totalCount,
    })
  }
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
  return tiles
}

/** What needs doing now, one tile per queue the signed-in person may open. A tile that cannot load shows a dash and leaves the others alone. */
export default function AttentionTiles({ area }: { area: Area }) {
  const { has } = usePermission()
  const { user } = useAuth()
  const canReviewAi = Boolean(user?.canReviewAi)
  const tiles = useMemo(() => tilesFor(area, canReviewAi).filter(tile => has(tile.permission)), [area, canReviewAi, has])
  const load = useCallback((signal: AbortSignal) => Promise.all(tiles.map(tile => tile.load(signal).catch(() => null))), [tiles])
  const { data, loading, refresh } = useReportData(load, tiles.length ? null : 'Không có mục nào để hiển thị.')
  if (!tiles.length) return null

  // One strip with hairline dividers: icon, label and count per queue. The longer note moves to the tooltip, and the icon's
  // color says whether something is waiting (amber) or all clear (green), always next to the count itself.
  return <section aria-label="Việc cần xử lý" className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-slate-900">Việc cần xử lý</h2>
      <button type="button" aria-label="Làm mới việc cần xử lý" title="Làm mới việc cần xử lý" onClick={refresh} disabled={loading} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-[#fff] text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
    </div>
    <div aria-busy={loading} className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-[#fff] shadow-sm md:flex-row md:divide-x md:divide-y-0">
      {tiles.map((tile, index) => {
        const value = data?.[index] ?? null
        const waiting = value !== null && value > 0
        const Icon = tile.icon
        return <Link key={tile.key} to={tile.to} title={tile.note} aria-label={`${tile.title}: ${value === null ? 'chưa tải được' : tile.money ? formatVnd(value) : value.toLocaleString('vi-VN')}. Mở danh sách`}
          className="group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-green-50/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary md:flex-col md:items-stretch md:justify-between md:gap-2 md:px-5 md:py-4">
          <span className="flex min-w-0 flex-1 items-start gap-2 md:flex-none">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${waiting ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}><Icon size={15} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1 pt-0.5 text-sm leading-5 text-slate-500">{tile.title}</span>
            <ArrowUpRight size={16} aria-hidden="true" className="mt-0.5 hidden shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:block" />
          </span>
          <span className="block shrink-0 whitespace-nowrap text-lg font-semibold leading-7 text-slate-900 md:text-2xl md:leading-8">{loading ? <span aria-hidden="true" className="inline-block h-7 w-14 animate-pulse rounded bg-slate-100 align-middle" /> : value === null ? '—' : tile.money ? formatVnd(value) : value.toLocaleString('vi-VN')}</span>
        </Link>
      })}
    </div>
  </section>
}
