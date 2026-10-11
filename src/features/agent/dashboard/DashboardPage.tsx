import OrderDashboard from '@/features/agent/dashboard/OrderDashboard'
import { usePageHeader } from '@/context/PageHeaderContext'

export default function DashboardPage() {
  usePageHeader({ title: 'Tổng quan bán hàng', subtitle: 'Báo cáo doanh thu và đơn hàng thực tế' })
  return <OrderDashboard reports ordersPath="/agent/orders" />
}
