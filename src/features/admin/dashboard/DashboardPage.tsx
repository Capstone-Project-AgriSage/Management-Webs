import OrderDashboard from '@/features/agent/dashboard/OrderDashboard'
import { usePageHeader } from '@/context/PageHeaderContext'

export default function DashboardPage() {
  usePageHeader({ title: 'Tổng quan hệ thống', subtitle: 'Báo cáo kinh doanh theo quyền truy cập' })
  return <OrderDashboard reports />
}
