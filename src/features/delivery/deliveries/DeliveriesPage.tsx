import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import { LIST_PAGE_SIZE } from '@/utils/pagination';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePageHeader } from '@/context/PageHeaderContext';
import { deliveriesApi } from '@/api/deliveriesApi';
import StatusBadge from '@/components/ui/StatusBadge'
import type { DeliveryListItem, DeliveryStatus } from '@/api/deliveriesApi';
import { DELIVERY_STATUS_LABEL, formatDate, labelOf } from '@/utils/deliveryLabels';

type TabKey = 'pending' | 'retry' | 'done'

// D1 of FE_GUIDE_FLOW_2: the server already limits the list to the signed-in driver.
// A driver can only start a trip once the store has dispatched it (OUT_FOR_DELIVERY).
const TABS: { key: TabKey; label: string; icon: string; statuses: DeliveryStatus[] }[] = [
  {
    key: 'pending',
    label: 'Cần giao',
    icon: 'local_shipping',
    statuses: ['OUT_FOR_DELIVERY'],
  },
  {
    key: 'retry',
    label: 'Chờ xuất phát',
    icon: 'replay',
    statuses: ['ASSIGNED', 'RETRY_PENDING', 'PARTIALLY_DELIVERED'],
  },
  {
    key: 'done',
    label: 'Đã giao',
    icon: 'check_circle',
    statuses: ['DELIVERED'],
  },
]

export default function DeliveriesPage() {
  usePageHeader({ title: 'Danh sách giao hàng', subtitle: 'Các đơn được phân công cho bạn' })

  const [orders, setOrders] = useState<DeliveryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tab, setTab] = useState<TabKey>('pending')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<DeliveryStatus>('OUT_FOR_DELIVERY')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState<Record<TabKey, number>>({ pending: 0, retry: 0, done: 0 })
  const debouncedSearch = useDebouncedValue(search.trim())

  const activeTab = TABS.find(t => t.key === tab)!
  const filtered = orders
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null)
    deliveriesApi.getDeliveries({ page, pageSize: LIST_PAGE_SIZE, status, search: debouncedSearch || undefined }, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return
        const lastPage = Math.max(1, data.totalPages)
        if (page > lastPage) { setPage(lastPage); return }
        setOrders(data.items); setTotalCount(data.totalCount); setTotalPages(lastPage)
      })
      .catch(err => { if (!controller.signal.aborted) { setOrders([]); setError(err instanceof Error ? err : new Error('Không tải được danh sách giao hàng')) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, status, debouncedSearch])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all(TABS.map(async item => {
      const results = await Promise.all(item.statuses.map(status => deliveriesApi.getDeliveries({ status, page: 1, pageSize: 1 }, controller.signal)))
      return [item.key, results.reduce((sum, result) => sum + result.totalCount, 0)] as const
    })).then(entries => { if (!controller.signal.aborted) setCounts(Object.fromEntries(entries) as Record<TabKey, number>) }).catch(() => {})
    return () => controller.abort()
  }, [])

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setStatus(t.statuses[0]); setPage(1) }}
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

      <ListToolbar search={{ value: search, onChange: value => { setSearch(value); setPage(1) }, placeholder: 'Tìm mã phiếu, mã đơn, tên hoặc SĐT người nhận...' }} onClear={() => { setSearch(''); setStatus(activeTab.statuses[0]); setPage(1) }}>
        <FilterSelect label="Lọc trạng thái giao hàng" value={status} onChange={value => { setStatus(value as DeliveryStatus); setPage(1) }} options={activeTab.statuses.map(value => ({ value, label: labelOf(DELIVERY_STATUS_LABEL, value) }))} />
      </ListToolbar>

      {/* Retry pending notice */}
      {tab === 'retry' && counts.retry > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0">warning</span>
          <span>Có <strong>{counts.retry}</strong> chuyến đang chờ cửa hàng xuất phát. Khi cửa hàng bấm xuất phát, chuyến sẽ chuyển sang mục "Cần giao".</span>
        </div>
      )}

      {/* List */}
      <div className="space-y-space-sm">
        {loading ? (
          <div className="bg-white rounded-lg border border-outline-variant/60 p-8 text-center text-on-surface-variant font-body-md">
            Đang tải dữ liệu...
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg border border-outline-variant/60 p-8 text-center text-error font-body-md">
            Đã có lỗi xảy ra. Vui lòng thử lại sau.
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-outline-variant/60 p-8 text-center text-on-surface-variant font-body-md">
            Không có đơn giao hàng nào trong mục này.
          </div>
        ) : null}

        {filtered.map((order) => (
          <Link
            key={order.id}
            to={`/delivery/deliveries/${order.id}`}
            className="block bg-white rounded-lg border border-outline-variant/60 shadow-2xs p-space-md hover:border-primary/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-space-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-title-md text-title-md text-on-surface font-bold">{order.recipientName || '--'}</span>
                  {order.status === 'RETRY_PENDING' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      Giao lại
                    </span>
                  )}
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{order.orderNumber} · {order.deliveryNumber}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 truncate max-w-md">
                  <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1">location_on</span>
                  {order.province || '--'}
                </p>
              </div>
              <StatusBadge label={labelOf(DELIVERY_STATUS_LABEL, order.status)} />
            </div>
            <div className="flex items-center justify-between mt-space-sm pt-space-sm border-t border-outline-variant/60">
              <span className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                Hẹn giao: {formatDate(order.scheduledAt)}
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">{order.itemCount} mặt hàng</span>
            </div>
          </Link>
        ))}
      </div>
      {!loading && !error && <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalCount={totalCount} totalPages={totalPages} unitLabel="chuyến giao" onPageChange={setPage} />}
    </div>
  )
}
