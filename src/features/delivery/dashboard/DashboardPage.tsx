import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '@/context/PageHeaderContext'
import { deliveriesApi, type DeliveryListItem } from '@/api/deliveriesApi'
import { isToday } from '@/utils/date'

export default function DashboardPage() {
  usePageHeader({ title: 'Tổng quan', subtitle: 'Trang chủ Nhân viên giao hàng' })

  const [orders, setOrders] = useState<DeliveryListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchOrders = async () => {
      try {
        setLoading(true)
        const data = await deliveriesApi.getDeliveries()
        if (mounted) {
          setOrders(data.items || [])
        }
      } catch (err) {
        // error handling
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    fetchOrders()
    return () => {
      mounted = false
    }
  }, [])

  // Only OUT_FOR_DELIVERY can be started by the driver; the rest wait for the store to dispatch (§D1).
  const assignedCount = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length
  const todayCount = orders.filter((o) => isToday(o.scheduledAt || '') && o.status !== 'CANCELLED').length
  const redeliverCount = orders.filter((o) => o.status === 'RETRY_PENDING' || o.status === 'PARTIALLY_DELIVERED').length
  const deliveredTodayCount = orders.filter((o) => o.status === 'DELIVERED' && isToday(o.completedAt || '')).length

  const cards = [
    { label: 'Chuyến cần giao', value: assignedCount, icon: 'assignment', to: '/delivery/deliveries', tone: 'primary' as const },
    { label: 'Lịch giao hôm nay', value: todayCount, icon: 'today', to: '/delivery/deliveries', tone: 'default' as const },
    { label: 'Chờ giao lại', value: redeliverCount, icon: 'replay', to: '/delivery/deliveries', tone: 'error' as const },
    { label: 'Đã giao hôm nay', value: deliveredTodayCount, icon: 'check_circle', to: '/delivery/deliveries', tone: 'primary' as const },
  ]

  const toneClassName: Record<(typeof cards)[number]['tone'], string> = {
    primary: 'bg-primary-fixed/50 text-primary',
    default: 'bg-surface-container text-on-surface-variant',
    error: 'bg-error-container text-error',
  }

  if (loading) {
    return <div className="p-4 text-center">Đang tải dữ liệu...</div>
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      {cards.map((card) => (
        <Link
          key={card.label}
          to={card.to}
          className="bg-white rounded-lg border border-outline-variant/60 shadow-2xs p-space-lg hover:border-primary/60 transition-colors"
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${toneClassName[card.tone]}`}>
            <span className="material-symbols-outlined text-[22px]">{card.icon}</span>
          </div>
          <div className="mt-space-md">
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold tabular-nums">{card.value}</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{card.label}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
