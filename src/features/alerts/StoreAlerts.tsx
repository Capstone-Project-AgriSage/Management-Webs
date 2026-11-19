import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellRing, CircleX, Undo2, Wallet, X, type LucideIcon } from 'lucide-react'
import { notificationsApi, type NotificationItem } from '@/api/notificationsApi'
import { ordersApi } from '@/api/ordersApi'
import { paymentsApi } from '@/api/paymentsApi'
import { returnsApi } from '@/api/returnsApi'
import { useAuth } from '@/context/AuthContext'
import { usePermission } from '@/context/PermissionContext'
import { useNotifications } from '@/hooks/useNotifications'
import { useRoleBase } from '@/utils/creditLabels'
import { formatVnd } from '@/utils/money'
import { isAlertAudioUnlocked, playAlertSound, playAlertSounds, unlockAlertAudio, type AlertSound } from './alertAudio'
import { NEW_ORDER_EVENT, getAlertState, lastRingAt, markRing, readRang, setSoundBlocked, useAlertState, writeRang } from './alertStore'

// Spoken alerts for the store team (owner and sale staff) whenever the management web is open, also in a background tab.
// They come from the notifications the server already writes for them, picked up from the realtime signal with a poll
// as a backup:
//   ORDER_PLACED (Farmer checkout)                         → "Có đơn hàng mới"
//   PAYMENT_CONFIRMED / DEBT_PAYMENT_CONFIRMED, payOS only → "Khách đã thanh toán" (staff record cash themselves)
//   order cancelled by the Farmer who placed it            → "Khách đã huỷ đơn" (not when staff cancel)
//   RETURN_REQUESTED                                       → "Có yêu cầu trả hàng"
// and every two minutes while online orders wait for confirmation → "Còn đơn hàng chưa xác nhận".
// One tab of the computer plays the sound; every open tab shows the card.
const POLL_MS = 45_000
const REMIND_MS = 120_000
const FRESH_MS = 12 * 3600_000
const JUST_RANG_MS = 60_000
const LOCK = 'agrisage-store-alerts'
const ONLINE_SOURCES = ['FARMER_WEB', 'FARMER_MOBILE']
const WATCHED = new Set(['ORDER_PLACED', 'PAYMENT_CONFIRMED', 'DEBT_PAYMENT_CONFIRMED', 'ORDER_STATUS_CHANGED', 'RETURN_REQUESTED'])

type CardKind = Exclude<AlertSound, 'pending'>

interface AlertCard {
  notificationId: string
  kind: CardKind
  title: string
  line: string
  amount?: number
  action: string
  href: string
}

const LOOK: Record<CardKind, { icon: LucideIcon; border: string; color: string }> = {
  newOrder: { icon: BellRing, border: 'border-amber-300', color: 'text-amber-600' },
  paid: { icon: Wallet, border: 'border-emerald-300', color: 'text-emerald-600' },
  cancelled: { icon: CircleX, border: 'border-rose-300', color: 'text-rose-600' },
  returnRequested: { icon: Undo2, border: 'border-sky-300', color: 'text-sky-600' },
}

async function withLock(run: () => Promise<void>) {
  if (navigator.locks) await navigator.locks.request(LOCK, run)
  else await run()
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')
const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ')

// Reads what the card shows; null when the notification is not one to announce (cash payment, staff cancellation...).
async function describe(notification: NotificationItem, base: string): Promise<AlertCard | null> {
  const data = notification.data ?? {}
  const entityId = text(data.entityId)
  const orderId = text(data.orderId) || (data.entityType === 'ORDER' ? entityId : '')
  const orderHref = `${base}/orders?open=${encodeURIComponent(orderId)}`
  const card = { notificationId: notification.id }
  switch (notification.notificationType) {
    case 'ORDER_PLACED': {
      if (!orderId) return null
      const order = await ordersApi.getById(orderId).catch(() => null)
      return { ...card, kind: 'newOrder', title: 'Có đơn hàng mới', line: join(order?.orderNumber, order?.customerName) || 'Đơn hàng trực tuyến',
        amount: order?.totalAmount, action: 'Xem & xác nhận', href: orderHref }
    }
    case 'PAYMENT_CONFIRMED':
    case 'DEBT_PAYMENT_CONFIRMED': {
      if (data.entityType !== 'PAYMENT' || !entityId) return null
      const payment = await paymentsApi.getPayment(entityId).catch(() => null)
      if (payment?.paymentMethod !== 'PAYOS') return null
      const orderNumber = payment.allocations.find(a => a.orderNumber)?.orderNumber
      return { ...card, kind: 'paid', title: 'Khách đã thanh toán', line: join(orderNumber || payment.paymentNumber, payment.payerName),
        amount: payment.amount, action: orderId ? 'Xem đơn' : 'Xem thanh toán', href: orderId ? orderHref : `${base}/payments` }
    }
    case 'ORDER_STATUS_CHANGED': {
      // The server's cancellation text, then the order itself: cancelled by the Farmer who placed it online.
      if (!orderId || !notification.title.normalize('NFC').toLowerCase().includes('hủy'.normalize('NFC'))) return null
      const order = await ordersApi.getById(orderId).catch(() => null)
      if (!order || order.status !== 'CANCELLED' || !ONLINE_SOURCES.includes(order.source)
        || !order.cancelledBy || order.cancelledBy !== order.createdBy) return null
      return { ...card, kind: 'cancelled', title: 'Khách đã huỷ đơn', line: join(order.orderNumber, order.customerName),
        amount: order.totalAmount, action: 'Xem đơn', href: orderHref }
    }
    case 'RETURN_REQUESTED': {
      if (data.entityType !== 'SALES_RETURN' || !entityId) return null
      const request = await returnsApi.get(entityId).catch(() => null)
      return { ...card, kind: 'returnRequested', title: 'Có yêu cầu trả hàng', line: join(request?.returnNumber, request?.customerName) || 'Yêu cầu trả hàng mới',
        amount: request?.totalReturnAmount, action: 'Xem yêu cầu', href: `${base}/returns/${encodeURIComponent(entityId)}` }
    }
    default:
      return null
  }
}

export default function StoreAlerts() {
  const { currentRole, user } = useAuth()
  const { has } = usePermission()
  const { notifyChanged } = useNotifications()
  const navigate = useNavigate()
  const base = useRoleBase()
  const { settings, soundBlocked } = useAlertState()
  const userId = typeof user?.id === 'string' ? user.id : ''
  const enabled = userId !== '' && (currentRole === 'agent' || currentRole === 'sales_staff') && has('ORDERS.READ')
  const anySound = Object.values(settings.sounds).some(Boolean)
  const [cards, setCards] = useState<AlertCard[]>([])
  const [flashing, setFlashing] = useState<{ count: number; title: string } | null>(null)
  const shown = useRef(new Set<string>())
  const running = useRef<Promise<void> | null>(null)
  const again = useRef(false)

  const remove = (card: AlertCard) => setCards(current => current.filter(c => c.notificationId !== card.notificationId))
  const open = (card: AlertCard) => {
    remove(card)
    void notificationsApi.markRead(card.notificationId).then(notifyChanged, () => undefined)
    navigate(card.href)
  }
  const openRef = useRef(open)
  useEffect(() => { openRef.current = open })

  const announce = useEffectEvent(async (items: NotificationItem[], ringIds: Set<string>) => {
    const found = (await Promise.all(items.map(item => describe(item, base).catch(() => null)))).filter((c): c is AlertCard => c !== null)
    if (found.length === 0) return
    const current = getAlertState().settings
    const ring = found.filter(card => ringIds.has(card.notificationId))
    const sounds = [...new Set(ring.map(card => card.kind))].filter(kind => current.sounds[kind])
    if (sounds.length > 0) void playAlertSounds(sounds).then(result => setSoundBlocked(result === 'blocked'))
    setCards(previous => [...found, ...previous].slice(0, 20))
    if (ring.length > 0 && current.desktop && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      for (const card of ring.slice(0, 3)) {
        const desktop = new Notification(card.title, {
          body: join(card.line, card.amount == null ? undefined : formatVnd(card.amount)),
          tag: `alert-${card.notificationId}`, icon: `${import.meta.env.BASE_URL}favicon.png`,
        })
        desktop.onclick = () => { window.focus(); openRef.current(card); desktop.close() }
      }
    }
    if (document.hidden) setFlashing(previous => ({ count: (previous?.count ?? 0) + found.length, title: found[0].title }))
    if (found.some(card => card.kind === 'newOrder' || card.kind === 'cancelled')) window.dispatchEvent(new Event(NEW_ORDER_EVENT))
  })

  const checkOnce = useEffectEvent(async () => {
    if (!enabled) return
    const page = await notificationsApi.list({ status: 'UNREAD', pageSize: 20 })
    const now = Date.now()
    const fresh = page.items.filter(n => WATCHED.has(n.notificationType) && !shown.current.has(n.id)
      && now - Date.parse(n.createdAt) < FRESH_MS)
    if (fresh.length === 0) return
    const ring = new Set<string>()
    let show: NotificationItem[] = []
    await withLock(async () => {
      const rang = readRang(userId)
      for (const n of fresh) if (!rang[n.id]) ring.add(n.id)
      show = fresh.filter(n => ring.has(n.id) || now - rang[n.id] < JUST_RANG_MS)
      if (ring.size === 0) return
      for (const id of ring) rang[id] = now
      writeRang(userId, rang)
      markRing()
    })
    fresh.forEach(n => shown.current.add(n.id))
    if (show.length > 0) await announce(show, ring)
  })

  // One check at a time per tab; a signal during a check runs one more after it.
  const check = useEffectEvent(() => {
    if (running.current) { again.current = true; return }
    running.current = (async () => {
      do {
        again.current = false
        try { await checkOnce() } catch { /* the next signal or poll tries again */ }
      } while (again.current)
      running.current = null
    })()
  })

  const remind = useEffectEvent(async () => {
    if (!enabled || !getAlertState().settings.sounds.pending) return
    try {
      await withLock(async () => {
        if (Date.now() - lastRingAt() < REMIND_MS - 5_000) return
        const pages = await Promise.all(ONLINE_SOURCES.map(source =>
          ordersApi.getOrders({ page: 1, pageSize: 1, status: 'PENDING_CONFIRMATION', source })))
        if (pages.every(page => page.totalCount === 0)) return
        markRing()
        setSoundBlocked((await playAlertSound('pending')) === 'blocked')
      })
    } catch { /* tried again at the next reminder */ }
  })

  useEffect(() => {
    if (!enabled) return
    check()
    const onRealtime = (event: Event) => {
      const topic = (event as CustomEvent<{ topic: string }>).detail?.topic
      if (topic === 'notifications' || topic === 'resync') check()
    }
    window.addEventListener('agrisage-realtime-change', onRealtime)
    const poll = window.setInterval(check, POLL_MS)
    const reminder = window.setInterval(() => { void remind() }, REMIND_MS)
    return () => {
      window.removeEventListener('agrisage-realtime-change', onRealtime)
      window.clearInterval(poll)
      window.clearInterval(reminder)
    }
  }, [enabled])

  // Browsers allow sound after a click or key press on the page: use the first one.
  useEffect(() => {
    if (!enabled) return
    const unlock = () => {
      if (isAlertAudioUnlocked()) return
      void unlockAlertAudio().then(ok => { if (ok) setSoundBlocked(false) })
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    return () => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
  }, [enabled])

  // A hidden tab blinks its title until someone looks at it.
  useEffect(() => {
    if (!flashing) return
    const original = document.title
    let on = false
    const timer = window.setInterval(() => {
      on = !on
      document.title = on ? `(${flashing.count}) ${flashing.title}` : original
    }, 1000)
    const stop = () => { if (!document.hidden) setFlashing(null) }
    document.addEventListener('visibilitychange', stop)
    return () => {
      window.clearInterval(timer)
      document.title = original
      document.removeEventListener('visibilitychange', stop)
    }
  }, [flashing])

  if (!enabled) return null
  return <>
    {soundBlocked && anySound && (
      <div role="alert" className="fixed left-1/2 top-header-height z-60 flex w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-lg">
        <span>Trình duyệt đang chặn âm thanh thông báo của cửa hàng.</span>
        <button type="button" onClick={() => { void unlockAlertAudio().then(ok => { if (ok) setSoundBlocked(false) }) }}
          className="h-8 rounded-lg bg-amber-600 px-3 font-medium text-white hover:bg-amber-700">Bật âm thanh</button>
      </div>
    )}
    {cards.length > 0 && (
      <section aria-label="Thông báo cửa hàng" className="fixed right-4 top-header-height z-60 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {cards.slice(0, 3).map(card => {
          const look = LOOK[card.kind]
          const Icon = look.icon
          return (
            <article key={card.notificationId} role="alert" className={`rounded-xl border ${look.border} bg-white p-3 shadow-lg`}>
              <div className="flex items-start gap-2">
                <Icon size={18} className={`mt-0.5 shrink-0 ${look.color}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">{card.title}</p>
                  <p className="truncate text-sm text-on-surface-variant">{card.line}</p>
                  {card.amount != null && <p className="text-sm font-semibold text-primary">{formatVnd(card.amount)}</p>}
                </div>
                <button type="button" aria-label={`Đóng thông báo: ${card.title}`} onClick={() => remove(card)}
                  className="rounded p-1 text-outline hover:bg-surface-container-low hover:text-on-surface">
                  <X size={16} />
                </button>
              </div>
              <button type="button" onClick={() => open(card)}
                className="mt-2 h-9 w-full rounded-lg bg-primary px-3 text-sm font-medium text-white hover:opacity-90">{card.action}</button>
            </article>
          )
        })}
        {cards.length > 3 && (
          <button type="button" onClick={() => { setCards([]); navigate('/notifications') }}
            className="rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm font-medium text-on-surface shadow-lg hover:bg-surface-container-low">
            Và {cards.length - 3} thông báo khác · Xem tất cả
          </button>
        )}
      </section>
    )}
  </>
}
