import { Link } from 'react-router-dom'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useDeliveries } from '../../context/DeliveryContext'
import { isToday } from '../../utils/date'

export default function DashboardPage() {
  usePageHeader({ title: 'Tổng quan', subtitle: 'Trang chủ Nhân viên giao hàng' })

  const { orders } = useDeliveries()

  const assignedCount = orders.filter((o) => o.status === 'ASSIGNED' || o.status === 'OUT_FOR_DELIVERY').length
  const todayCount = orders.filter((o) => isToday(o.scheduledDate) && o.status !== 'CANCELLED').length
  const redeliverCount = orders.filter((o) => o.status === 'FAILED' && o.redeliveryDate).length
  const deliveredTodayCount = orders.filter((o) => o.status === 'DELIVERED' && isToday(o.scheduledDate)).length

  const cards = [
    { label: 'Đơn được phân công', value: assignedCount, icon: 'assignment', to: '/deliveries', tone: 'primary' as const },
    { label: 'Lịch giao hôm nay', value: todayCount, icon: 'today', to: '/deliveries', tone: 'default' as const },
    { label: 'Cần giao lại', value: redeliverCount, icon: 'replay', to: '/deliveries', tone: 'error' as const },
    { label: 'Đã giao hôm nay', value: deliveredTodayCount, icon: 'check_circle', to: '/deliveries', tone: 'primary' as const },
  ]

  const toneClassName: Record<(typeof cards)[number]['tone'], string> = {
    primary: 'bg-primary-fixed/50 text-primary',
    default: 'bg-surface-container text-on-surface-variant',
    error: 'bg-error-container text-error',
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
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
