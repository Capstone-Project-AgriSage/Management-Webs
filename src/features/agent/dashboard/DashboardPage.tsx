import OrderDashboard from '@/features/agent/dashboard/OrderDashboard'
import { usePageHeader } from '@/context/PageHeaderContext'
import { usePermission } from '@/context/PermissionContext'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Plus } from 'lucide-react'

export default function DashboardPage() {
  const { has } = usePermission()
  usePageHeader({ title: 'Tổng quan cửa hàng', subtitle: 'Theo dõi kinh doanh, dòng tiền và việc cần xử lý' })
  return <div className="max-w-[1440px] min-w-0 mx-auto space-y-6">
    {(has('EXCHANGES.READ') || has('EXCHANGES.CREATE')) && <section aria-label="Xử lý đổi hàng" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-green-50 text-green-700"><ArrowLeftRight size={17} /></span>
        <div className="min-w-0">
          <h2 className="font-medium text-zinc-900">Đổi hàng</h2>
          <p className="text-sm text-zinc-500">Duyệt yêu cầu, kiểm tra hàng thu hồi và quyết toán.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {has('EXCHANGES.READ') && <Link to="/agent/exchanges" className="inline-flex min-h-10 items-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50">Danh sách đổi hàng</Link>}
        {has('EXCHANGES.CREATE') && <Link to="/agent/exchanges/new" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary/90"><Plus size={16} aria-hidden="true" /> Tạo yêu cầu đổi</Link>}
      </div>
    </section>}
    <OrderDashboard reports ordersPath="/agent/orders" area="agent" />
  </div>
}
