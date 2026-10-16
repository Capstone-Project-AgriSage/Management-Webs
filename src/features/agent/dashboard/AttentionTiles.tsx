import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ordersApi } from '@/api/ordersApi'
import { deliveriesApi } from '@/api/deliveriesApi'
import { diagnosisApi } from '@/api/diagnosisApi'
import { stockApi } from '@/api/stockApi'
import { reportsApi } from '@/api/reportsApi'
import { useAuth } from '@/context/AuthContext'
import { usePermission } from '@/context/PermissionContext'
import KpiCard from '@/components/ui/KpiCard'
import { useReportData } from '@/features/agent/reports/useReportData'
import { formatVnd } from '@/utils/money'

type Area = 'agent' | 'sales'

interface Tile {
  key: string
  title: string
  note: string
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
      key: 'orders', title: 'Đơn chờ xác nhận', note: 'Cần xác nhận hoặc từ chối', permission: 'ORDERS.READ', to: `/${area}/orders`,
      load: async signal => (await ordersApi.getOrders({ status: 'PENDING_CONFIRMATION', page: 1, pageSize: 1 }, signal)).totalCount,
    },
  ]
  if (area === 'agent' || canReviewAi) {
    tiles.push({
      key: 'diagnosis', title: 'Ca chẩn đoán chờ duyệt', note: 'AI đã chạy, chờ chuyên gia xem', permission: 'DIAGNOSIS.READ',
      to: area === 'agent' ? '/agent/ai-recommendations' : '/sales/ai-review',
      load: async () => (await diagnosisApi.list({ status: 'AI_COMPLETED', page: 1, pageSize: 1 })).totalCount,
    })
  }
  tiles.push(
    {
      key: 'deliveries', title: 'Chuyến chờ giao lại', note: 'Giao chưa thành công, cần xếp lại', permission: 'DELIVERIES.READ', to: `/${area}/deliveries`,
      load: async signal => (await deliveriesApi.getDeliveries({ status: 'RETRY_PENDING', page: 1, pageSize: 1 }, signal)).totalCount,
    },
    {
      key: 'stock', title: 'Cảnh báo kho', note: 'Hết hạn, sắp hết hạn hoặc tồn thấp', permission: 'INVENTORY.READ', to: `/${area}/inventory`,
      load: async () => (await stockApi.getAlerts({ page: 1, pageSize: 1 })).totalCount,
    },
    {
      key: 'debt', title: 'Nợ quá hạn', note: 'Tổng nợ đã quá hạn trả', permission: 'REPORTS.READ', to: `/${area}/debts`, money: true,
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

  return <section aria-label="Việc cần xử lý" className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-slate-900">Việc cần xử lý</h2>
      <button type="button" aria-label="Làm mới việc cần xử lý" onClick={refresh} disabled={loading} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Làm mới</button>
    </div>
    <div aria-busy={loading} className="agrisage-summary-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {tiles.map((tile, index) => {
        const value = data?.[index] ?? null
        const waiting = value !== null && value > 0
        return <Link key={tile.key} to={tile.to} aria-label={`${tile.title}: mở danh sách`} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary hover:shadow-md transition-shadow">
          <KpiCard
            className="border-slate-200 min-h-32"
            title={tile.title}
            valueClassName={waiting ? 'text-amber-700' : 'text-slate-900'}
            value={loading ? <span aria-hidden="true" className="inline-block h-7 w-16 rounded bg-slate-100 animate-pulse align-middle" /> : value === null ? '—' : tile.money ? formatVnd(value) : value.toLocaleString('vi-VN')}
            subtitle={tile.note}
          />
        </Link>
      })}
    </div>
  </section>
}
