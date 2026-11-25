import OrderDashboard from '@/features/agent/dashboard/OrderDashboard'
import { usePageHeader } from '@/context/PageHeaderContext'
import { usePermission } from '@/context/PermissionContext'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Plus } from 'lucide-react'

export default function DashboardPage() {
  const { has } = usePermission()
  usePageHeader({ title: 'Tổng quan cửa hàng', subtitle: 'Theo dõi kinh doanh, dòng tiền và việc cần xử lý' })
  return <div className="max-w-[1440px] min-w-0 mx-auto space-y-5">
    {(has('EXCHANGES.READ') || has('EXCHANGES.CREATE')) && <section aria-label="Xử lý đổi hàng" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-on-surface"><ArrowLeftRight size={18} aria-hidden="true" /> Đổi hàng</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Duyệt yêu cầu, kiểm tra hàng thu hồi và quyết toán.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {has('EXCHANGES.READ') && <Link to="/agent/exchanges" className="inline-flex min-h-11 items-center rounded-lg border border-outline-variant px-4 text-sm font-semibold text-on-surface hover:bg-surface-container">Danh sách đổi hàng</Link>}
        {has('EXCHANGES.CREATE') && <Link to="/agent/exchanges/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary/90"><Plus size={16} aria-hidden="true" /> Tạo yêu cầu đổi</Link>}
      </div>
    </section>}
    <OrderDashboard reports ordersPath="/agent/orders" area="agent" />
  </div>
}
