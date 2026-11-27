import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { LatLngTuple } from 'leaflet'
import type { GeoPoint, LocationPoint } from '@/api/deliveriesApi'
import { MIN_MAP_ZOOM, STORE_REGION } from '@/utils/deliveryLocation'

export type MapMarkerKind = 'driver' | 'driver-stale' | 'destination'

export interface MapMarker {
  id: string
  position: GeoPoint
  kind: MapMarkerKind
  label: string
  onClick?: () => void
}

interface DeliveryMapProps {
  markers: MapMarker[]
  /** The driver's route, oldest point first. */
  trail?: LocationPoint[]
  height?: number | string
  className?: string
}

// Can Tho: where the store is, when there is nothing to show yet.
const DEFAULT_CENTER: LatLngTuple = [10.0341, 105.7880]

const STYLE: Record<MapMarkerKind, { color: string; fillColor: string; radius: number }> = {
  driver: { color: '#166534', fillColor: '#22c55e', radius: 9 },
  'driver-stale': { color: '#475569', fillColor: '#94a3b8', radius: 9 },
  destination: { color: '#991b1b', fillColor: '#ef4444', radius: 7 },
}

const toTuple = (p: GeoPoint): LatLngTuple => [p.latitude, p.longitude]

/** Fits the view to what is shown when the set of markers changes, not on every refresh (the user may have moved). */
function FitToContent({ points, fitKey }: { points: LatLngTuple[]; fitKey: string }) {
  const map = useMap()
  const fitted = useRef<string | null>(null)
  useEffect(() => {
    if (points.length === 0 || fitted.current === fitKey) return
    fitted.current = fitKey
    if (points.length === 1) map.setView(points[0], 15)
    else map.fitBounds(points, { padding: [32, 32], maxZoom: 16 })
  }, [map, points, fitKey])
  return null
}

/**
 * OpenStreetMap with the drivers, the destinations and a route (FLOW_2 §9a). No API key; markers are drawn circles,
 * so no image asset is needed.
 */
export default function DeliveryMap({ markers, trail = [], height = 280, className = '' }: DeliveryMapProps) {
  const route = useMemo(() => trail.map((p) => [p.latitude, p.longitude] as LatLngTuple), [trail])
  const points = useMemo(() => [...markers.map((m) => toTuple(m.position)), ...route], [markers, route])
  const fitKey = markers.map((m) => m.id).sort().join('|') + (route.length > 0 ? '|route' : '')

  return (
    // `isolate` keeps Leaflet's panes (z-index 400-1000) inside the map, so a modal opened over the page stays on top.
    <div className={`relative isolate overflow-hidden rounded-lg border border-slate-200 ${className}`} style={{ height }} data-testid="delivery-map">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={12}
        minZoom={MIN_MAP_ZOOM}
        maxBounds={STORE_REGION}
        maxBoundsViscosity={1}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          bounds={STORE_REGION}
          noWrap
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.8 }} />}
        {markers.map((m) => (
          <CircleMarker
            key={m.id}
            center={toTuple(m.position)}
            radius={STYLE[m.kind].radius}
            pathOptions={{ color: STYLE[m.kind].color, fillColor: STYLE[m.kind].fillColor, fillOpacity: 0.95, weight: 2 }}
            eventHandlers={m.onClick ? { click: m.onClick } : undefined}
          >
            <Tooltip direction="top" offset={[0, -8]}>{m.label}</Tooltip>
          </CircleMarker>
        ))}
        <FitToContent points={points} fitKey={fitKey} />
      </MapContainer>
    </div>
  )
}
