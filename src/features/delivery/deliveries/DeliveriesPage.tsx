import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useDeliveries } from '@/context/DeliveryContext'
import StatusBadge from '@/components/ui/StatusBadge'
import type { DeliveryOrder } from '@/types'
import { formatDateLabel, isToday } from '@/utils/date'

type TabKey = 'active' | 'today' | 'redeliver'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'active', label: 'Được phân công', icon: 'assignment' },
  { key: 'today', label: 'Lịch giao hôm nay', icon: 'today' },
  { key: 'redeliver', label: 'Cần giao lại', icon: 'replay' },
]

function matchesTab(order: DeliveryOrder, tab: TabKey): boolean {
  if (tab === 'today') return isToday(order.scheduledDate) && order.status !== 'CANCELLED'
  if (tab === 'redeliver') return order.status === 'FAILED' && Boolean(order.redeliveryDate)
  return order.status === 'ASSIGNED' || order.status === 'OUT_FOR_DELIVERY' || order.status === 'FAILED'
}

export default function DeliveriesPage() {
  usePageHeader({ title: 'Danh sách giao hàng', subtitle: 'Các đơn được phân công cho bạn' })

  const { orders } = useDeliveries()
  const [tab, setTab] = useState<TabKey>('active')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return orders
      .filter((o) => matchesTab(o, tab))
      .filter(
        (o) =>
          !keyword ||
          o.orderCode.toLowerCase().includes(keyword) ||
          o.farmerName.toLowerCase().includes(keyword) ||
          o.deliveryAddress.toLowerCase().includes(keyword),
      )
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
  }, [orders, tab, search])

  const counts = useMemo(
    () => ({
      active: orders.filter((o) => matchesTab(o, 'active')).length,
      today: orders.filter((o) => matchesTab(o, 'today')).length,
      redeliver: orders.filter((o) => matchesTab(o, 'redeliver')).length,
    }),
    [orders],
  )

  return (
    <div className="space-y-space-md">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-space-md py-space-sm rounded font-label-md text-label-md border transition-colors ${
              tab === t.key
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-white text-on-surface-variant border-outline-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
            {t.label}
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                tab === t.key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">
          search
        </span>
        <input
          className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface transition-all placeholder:text-outline font-body-md"
          placeholder="Tìm mã đơn, tên Farmer hoặc địa chỉ..."
          aria-label="Tìm đơn giao hàng"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-space-sm">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-outline-variant/60 p-8 text-center text-on-surface-variant font-body-md">
            Không có đơn giao hàng phù hợp.
          </div>
        ) : null}
        {filtered.map((order) => (
          <Link
            key={order.id}
            to={`/deliveries/${order.id}`}
            className="block bg-white rounded-lg border border-outline-variant/60 shadow-2xs p-space-md hover:border-primary/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-space-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-title-md text-title-md text-on-surface font-bold">{order.farmerName}</span>
                  {order.isCreditPurchase ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary-fixed text-on-secondary-fixed-variant">
                      Mua chịu
                    </span>
                  ) : null}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{order.orderCode}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 truncate max-w-md" title={order.deliveryAddress}>
                  <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1">location_on</span>
                  {order.deliveryAddress}
                </p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="flex items-center justify-between mt-space-sm pt-space-sm border-t border-outline-variant/60">
              <span className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                {order.scheduledWindowLabel}
              </span>
              {order.status === 'FAILED' && order.redeliveryDate ? (
                <span className="font-label-md text-label-md text-error font-semibold">
                  Giao lại: {formatDateLabel(order.redeliveryDate)}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
