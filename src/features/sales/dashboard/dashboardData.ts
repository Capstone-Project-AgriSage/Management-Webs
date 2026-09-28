import { orders } from '@/features/sales/data/mockOrders'
import { debtCustomers } from '@/features/sales/data/mockDebts'
import { parseVnd } from '@/utils/money'
import type { DebtStatus, OrderStatus } from '@/types'

const VN_WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function dayLabel(dayIso: string): string {
  const [year, month, day] = dayIso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return `${VN_WEEKDAY[date.getDay()]} ${day}/${month}`
}

/** The latest order date in the mock data — stands in for "today" everywhere the dashboard needs it,
 * derived once here instead of being hardcoded separately in every chart/section that needs it. */
export const TODAY = orders.reduce((latest, order) => {
  const day = order.createdAt.slice(0, 10)
  return day > latest ? day : latest
}, '')

function ordersByDay() {
  const counts = new Map<string, number>()
  for (const order of orders) {
    if (order.status === 'Đã hủy') continue
    const day = order.createdAt.slice(0, 10)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ name: dayLabel(day), value }))
}

function revenueByDay() {
  const totals = new Map<string, number>()
  for (const order of orders) {
    if (order.status === 'Đã hủy') continue
    const day = order.createdAt.slice(0, 10)
    totals.set(day, (totals.get(day) ?? 0) + parseVnd(order.total))
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ name: dayLabel(day), value }))
}

function ordersByPaymentMethod() {
  const colors: Record<string, string> = {
    'Tiền mặt tại quầy': '#4caf50',
    VietQR: '#2e7d32',
    'Cọc 50%': '#81c784',
    'Gối nợ vụ mùa': '#ef5350',
  }
  const counts = new Map<string, number>()
  for (const order of orders) {
    if (order.status === 'Đã hủy') continue
    counts.set(order.paymentMethod, (counts.get(order.paymentMethod) ?? 0) + 1)
  }
  return [...counts.entries()].map(([name, value]) => ({ name, value, color: colors[name] ?? '#94a3b8' }))
}

const STATUS_FUNNEL_ORDER: { status: OrderStatus; color: string }[] = [
  { status: 'Chờ xác nhận', color: '#c8e6c9' },
  { status: 'Đã xác nhận', color: '#a5d6a7' },
  { status: 'Đang chuẩn bị', color: '#81c784' },
  { status: 'Hoàn thành', color: '#2e7d32' },
]

function orderStatusFunnel() {
  return STATUS_FUNNEL_ORDER.map(({ status, color }) => ({
    name: status,
    value: orders.filter((o) => o.status === status).length,
    color,
  }))
}

const DEBT_STATUS_GROUPS: { status: DebtStatus; color: string }[] = [
  { status: 'Bình thường', color: '#94a3b8' },
  { status: 'Sắp đến hạn', color: '#f59e0b' },
  { status: 'Đến hạn', color: '#fb923c' },
  { status: 'Quá hạn', color: '#e11d48' },
]

function debtByStatus() {
  return DEBT_STATUS_GROUPS.map(({ status, color }) => ({
    name: status,
    value: debtCustomers.filter((c) => c.status === status).reduce((sum, c) => sum + parseVnd(c.remaining), 0),
    color,
  })).filter((group) => group.value > 0)
}

export const ordersByDayData = ordersByDay()
export const revenueByDayData = revenueByDay()
export const ordersByPaymentMethodData = ordersByPaymentMethod()
export const orderStatusFunnelData = orderStatusFunnel()
export const debtByStatusData = debtByStatus()
