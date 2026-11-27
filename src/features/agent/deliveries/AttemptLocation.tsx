import { useEffect, useState } from 'react'
import { deliveriesApi, type GeoPoint, type LocationPoint } from '@/api/deliveriesApi'
import { LOCATION_POLL_MS, locationFreshness } from '@/utils/deliveryLocation'
import DeliveryMap, { type MapMarker } from './DeliveryMap'

interface AttemptLocationProps {
  deliveryId: string
  attemptId: string
  /** A running attempt is read again every 15 s; a finished one once. */
  live: boolean
  destination: GeoPoint | null
  driverName?: string
}

/** The driver's position and route for one attempt (FLOW_2 §9a), in the delivery detail. */
export default function AttemptLocation({ deliveryId, attemptId, live, destination, driverName }: AttemptLocationProps) {
  const [route, setRoute] = useState<LocationPoint[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const controller = new AbortController()
    const read = () => {
      deliveriesApi
        .getAttemptLocations(deliveryId, attemptId, controller.signal)
        .then((points) => {
          setRoute(points)
          setFailed(false)
          setNow(Date.now())
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true)
        })
    }
    read()
    const timer = live ? window.setInterval(read, LOCATION_POLL_MS) : undefined
    return () => {
      controller.abort()
      if (timer) window.clearInterval(timer)
    }
  }, [deliveryId, attemptId, live])

  if (failed && route === null) {
    return <div className="text-xs text-rose-600" data-testid="attempt-location-error">Không tải được vị trí tài xế.</div>
  }
  if (route === null) return <div className="text-xs text-slate-500">Đang tải vị trí…</div>

  const last = route.length > 0 ? route[route.length - 1] : null
  const freshness = locationFreshness(last, now)
  if (!live && route.length === 0) {
    return <div className="text-xs text-slate-500" data-testid="attempt-location-empty">Lần giao này không có dữ liệu vị trí.</div>
  }

  const markers: MapMarker[] = []
  if (destination) markers.push({ id: 'destination', position: destination, kind: 'destination', label: 'Địa chỉ giao' })
  if (last) {
    markers.push({
      id: 'driver',
      position: last,
      kind: live && !freshness.stale ? 'driver' : 'driver-stale',
      label: live ? `${driverName ?? 'Tài xế'} · ${freshness.label}` : 'Điểm cuối của lần giao',
    })
  }

  return (
    <div className="space-y-1.5">
      {live && (
        <div
          className={`text-xs font-medium ${freshness.stale ? 'text-amber-700' : 'text-emerald-700'}`}
          data-testid="attempt-location-status"
        >
          {freshness.label}
        </div>
      )}
      <DeliveryMap markers={markers} trail={route} height={240} />
    </div>
  )
}
