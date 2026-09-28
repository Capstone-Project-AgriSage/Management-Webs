import type { OrderPaymentMethod } from '@/types'

interface PaymentMethodVisual {
  badgeClassName: string
  icon: string
  /** True when the method involves cash actually changing hands at the counter — gates a "Ghi nhận Cash" action. */
  isCash: boolean
}

/** Single source of truth for how each payment method is displayed, shared by OrdersPage and PaymentsPage
 * so the same method never renders in two different colors depending on which page you're on. */
export const PAYMENT_METHOD_VISUALS: Record<OrderPaymentMethod, PaymentMethodVisual> = {
  'Tiền mặt tại quầy': { badgeClassName: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'payments', isCash: true },
  VietQR: { badgeClassName: 'bg-blue-100 text-blue-800 border-blue-300', icon: 'qr_code_2', isCash: false },
  'Cọc 50%': { badgeClassName: 'bg-amber-100 text-amber-800 border-amber-300', icon: 'savings', isCash: true },
  'Gối nợ vụ mùa': { badgeClassName: 'bg-red-100 text-red-800 border-red-300', icon: 'schedule', isCash: false },
}
