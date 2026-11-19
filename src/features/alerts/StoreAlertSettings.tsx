import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { usePermission } from '@/context/PermissionContext'
import { ALERT_SOUNDS, playAlertSound, unlockAlertAudio, type AlertSound } from './alertAudio'
import { setAlertSound, setDesktopAlerts, setSoundBlocked, useAlertState } from './alertStore'

const ROWS: { sound: AlertSound; label: string }[] = [
  { sound: 'newOrder', label: 'Khi có đơn hàng mới' },
  { sound: 'pending', label: 'Nhắc lại mỗi 2 phút khi còn đơn trực tuyến chờ xác nhận' },
  { sound: 'paid', label: 'Khi khách thanh toán online (payOS)' },
  { sound: 'cancelled', label: 'Khi khách tự huỷ đơn' },
  { sound: 'returnRequested', label: 'Khi có yêu cầu trả hàng' },
]

// Topbar control of the store alerts (StoreAlerts): one switch and a test button per sound, Windows notifications and
// the browser settings that keep a background tab able to ring.
export default function StoreAlertSettings() {
  const { currentRole } = useAuth()
  const { has } = usePermission()
  const { settings, soundBlocked } = useAlertState()
  const [open, setOpen] = useState(false)
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !panel.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  if (!(currentRole === 'agent' || currentRole === 'sales_staff') || !has('ORDERS.READ')) return null

  const anySound = Object.values(settings.sounds).some(Boolean)
  const test = async (sound: AlertSound) => {
    await unlockAlertAudio()
    setSoundBlocked((await playAlertSound(sound)) === 'blocked')
  }
  const allowDesktop = async () => {
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') setDesktopAlerts(true)
  }
  const state = !anySound ? 'đang tắt' : soundBlocked ? 'đang bị trình duyệt chặn' : 'đang bật'

  return (
    <div className="relative" ref={panel}>
      <button
        type="button"
        className="topbar-icon flex items-center justify-center rounded-lg hover:bg-surface-container-low text-on-surface-variant relative transition-colors"
        title="Âm thanh thông báo của cửa hàng"
        aria-label={`Âm thanh thông báo: ${state}`}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span className="material-symbols-outlined text-[18px]">{anySound && !soundBlocked ? 'volume_up' : 'volume_off'}</span>
        {anySound && soundBlocked ? <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" /> : null}
      </button>
      {open && (
        <div role="dialog" aria-label="Cài đặt âm thanh thông báo" className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] space-y-3 rounded-xl border border-outline-variant bg-white p-4 text-sm shadow-xl">
          <p className="font-semibold text-on-surface">Âm thanh thông báo</p>
          <ul className="space-y-2">
            {ROWS.map(row => (
              <li key={row.sound} className="flex items-start gap-2">
                <label className="flex flex-1 items-start gap-2">
                  <input type="checkbox" className="mt-0.5" checked={settings.sounds[row.sound]} onChange={e => setAlertSound(row.sound, e.target.checked)} />
                  <span>{row.label} <span className="text-on-surface-variant">— “{ALERT_SOUNDS[row.sound].text}”</span></span>
                </label>
                <button type="button" onClick={() => { void test(row.sound) }} aria-label={`Nghe thử: ${ALERT_SOUNDS[row.sound].text}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-low">
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                </button>
              </li>
            ))}
          </ul>
          {permission === 'granted' ? (
            <label className="flex items-start gap-2 border-t border-outline-variant pt-3">
              <input type="checkbox" className="mt-0.5" checked={settings.desktop} onChange={e => setDesktopAlerts(e.target.checked)} />
              <span>Hiện thông báo của Windows khi đang ở cửa sổ khác</span>
            </label>
          ) : permission === 'default' ? (
            <button type="button" onClick={() => { void allowDesktop() }} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-left hover:bg-surface-container-low">
              Cho phép thông báo của Windows khi đang ở cửa sổ khác
            </button>
          ) : permission === 'denied' ? (
            <p className="text-xs text-on-surface-variant">Thông báo của Windows đang bị chặn trong cài đặt trình duyệt cho trang này.</p>
          ) : null}
          <p className="text-xs leading-relaxed text-on-surface-variant">
            Để luôn nghe được khi trang mở ở tab nền: cho phép trang này tự phát âm thanh và không cho tab ngủ (Edge: Cài đặt ›
            Hệ thống và hiệu suất › Không bao giờ đặt các trang này vào chế độ ngủ). Tắt hẳn trình duyệt thì không báo được.
          </p>
        </div>
      )}
    </div>
  )
}
