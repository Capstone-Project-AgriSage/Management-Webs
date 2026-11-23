import OrderDashboard from '@/features/agent/dashboard/OrderDashboard'
import { usePageHeader } from '@/context/PageHeaderContext'

export default function DashboardPage() {
  usePageHeader({ title: 'Tổng quan cửa hàng', subtitle: 'Theo dõi kinh doanh, dòng tiền và việc cần xử lý' })
  return <OrderDashboard reports ordersPath="/agent/orders" area="agent" />
}
