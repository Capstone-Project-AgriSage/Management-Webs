import OrderDashboard from '@/features/agent/dashboard/OrderDashboard'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useAuth } from '@/context/AuthContext'

export default function DashboardPage() {
  const { user } = useAuth()
  usePageHeader({ title: 'Tổng quan', subtitle: user?.storeName ? `Đơn hàng tại ${user.storeName}` : 'Đơn hàng trong ngày' })
  return <OrderDashboard ordersPath="/sales/orders" area="sales" />
}
