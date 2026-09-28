import type { DeliveryStatus } from '../../types'
import { DELIVERY_STATUS_BADGE_CLASSNAME, DELIVERY_STATUS_ICON, DELIVERY_STATUS_LABEL } from '../../config/deliveryStatus'

interface StatusBadgeProps {
  status: DeliveryStatus
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded font-label-sm text-label-sm whitespace-nowrap ${DELIVERY_STATUS_BADGE_CLASSNAME[status]} ${className}`}
    >
      <span className="material-symbols-outlined text-[14px]">{DELIVERY_STATUS_ICON[status]}</span>
      {DELIVERY_STATUS_LABEL[status]}
    </span>
  )
}
