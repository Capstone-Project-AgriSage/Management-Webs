import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, MapPin, Truck, UserCircle } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { deliveriesApi, type LiveDelivery } from '@/api/deliveriesApi'
import { formatDateTime } from '@/utils/deliveryLabels'
import { LOCATION_POLL_MS, locationFreshness } from '@/utils/deliveryLocation'
import DeliveryMap, { type MapMarker } from './DeliveryMap'
import DeliveryDetailModal from './DeliveryDetailModal'

/**
 * "Bản đồ giao hàng" (FLOW_2 §9a, F2.8): every delivery attempt running now, with the driver's last position and the
 * address, read again every 15 seconds. A driver whose last position is older than 3 minutes is shown grey.
 */
export default function DeliveryMapPage() {
  usePageHeader({ title: 'Bản đồ giao hàng', subtitle: 'Các chuyến đang giao, tự cập nhật mỗi 15 giây' })
  const { pathname } = useLocation()
  const listPath = pathname.replace(/\/map\/?$/, '')
  const [live, setLive] = useState<LiveDelivery[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const read = useCallback((signal?: AbortSignal) => {
    deliveriesApi
      .getLiveDeliveries(signal)
      .then((rows) => {
        setLive(rows)
        setFailed(false)
        setNow(Date.now())
      })
      .catch(() => {
        if (!signal?.aborted) setFailed(true)
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    read(controller.signal)
    const timer = window.setInterval(() => read(controller.signal), LOCATION_POLL_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [read])

  const rows = useMemo(() => (live ?? []).map((d) => ({ delivery: d, freshness: locationFreshness(d.lastPoint, now) })), [live, now])

  const markers = useMemo(() => {
    const list: MapMarker[] = []
    for (const { delivery: d, freshness } of rows) {
      if (d.destination) {
        list.push({ id: `dest-${d.attemptId}`, position: d.destination, kind: 'destination', label: `${d.recipientName} · ${d.addressLine}` })
      }
      if (d.lastPoint) {
        list.push({
          id: `driver-${d.attemptId}`,
          position: d.lastPoint,
          kind: freshness.stale ? 'driver-stale' : 'driver',
          label: `${d.driver?.fullName ?? 'Tài xế'} · ${d.deliveryNumber} · ${freshness.label}`,
          onClick: () => setSelectedId(d.deliveryId),
        })
      }
    }
    return list
  }, [rows])

  const lost = rows.filter((r) => r.freshness.stale).length

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-md p-space-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={listPath} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ArrowLeft size={16} /> Danh sách phiếu giao
        </Link>
        {live && (
          <div className="text-sm text-slate-600" data-testid="live-summary">
            <span className="font-semibold text-slate-900">{live.length}</span> chuyến đang giao
            {lost > 0 && <span className="text-amber-700"> · {lost} chưa có hoặc mất tín hiệu</span>}
          </div>
        )}
      </div>

      {failed && live === null && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Không tải được các chuyến đang giao. Trang sẽ tự thử lại.</div>
      )}

      <div className="grid gap-space-md lg:grid-cols-[minmax(0,1fr)_340px]">
        <DeliveryMap markers={markers} height="min(70vh, 640px)" className="min-h-[360px] bg-white" />

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-slate-100 text-sm font-bold text-slate-900">Chuyến đang giao</div>
          {live === null && !failed && <p className="p-4 text-sm text-slate-500">Đang tải...</p>}
          {live !== null && live.length === 0 && (
            <p className="p-4 text-sm text-slate-500" data-testid="live-empty">Hiện không có chuyến nào đang giao.</p>
          )}
          <ul className="divide-y divide-slate-50 overflow-y-auto max-h-[640px]">
            {rows.map(({ delivery: d, freshness }) => (
              <li key={d.attemptId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(d.deliveryId)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                  data-testid="live-row"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-primary">{d.deliveryNumber}</span>
                    <span className="text-xs text-slate-500">Lần {d.attemptNumber}</span>
                  </div>
                  <div className="text-sm text-slate-900 mt-0.5 truncate">{d.recipientName}</div>
                  <div className="text-xs text-slate-500 flex items-start gap-1 mt-0.5">
                    <MapPin size={12} className="mt-0.5 shrink-0" /> <span className="break-words">{d.addressLine}</span>
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                    <UserCircle size={12} /> {d.driver?.fullName ?? '--'}
                    <span className="text-slate-400">· bắt đầu {formatDateTime(d.startedAt)}</span>
                  </div>
                  <div className={`text-xs mt-1 flex items-center gap-1 ${freshness.stale ? 'text-amber-700' : 'text-emerald-700'}`}>
                    <Truck size={12} /> {freshness.label}
                    {!d.destination && <span className="text-slate-400"> · địa chỉ chưa có tọa độ</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <DeliveryDetailModal deliveryId={selectedId} onClose={() => setSelectedId(null)} onChanged={() => read()} />
    </div>
  )
}
