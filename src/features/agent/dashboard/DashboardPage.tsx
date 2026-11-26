import OrderDashboard from '@/features/agent/dashboard/OrderDashboard'
import { usePageHeader } from '@/context/PageHeaderContext'
import { usePermission } from '@/context/PermissionContext'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Plus } from 'lucide-react'

export default function DashboardPage() {
  const { has } = usePermission()
  usePageHeader({ title: 'Tổng quan cửa hàng', subtitle: 'Theo dõi kinh doanh, dòng tiền và việc cần xử lý' })
  // One slim line for the exchange shortcuts, so the dashboard's own content starts high on the page.
  return <div className="max-w-[1440px] min-w-0 mx-auto space-y-4">
    {(has('EXCHANGES.READ') || has('EXCHANGES.CREATE')) && <section aria-label="Xử lý đổi hàng" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-green-50 text-green-700"><ArrowLeftRight size={16} /></span>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 className="font-medium text-zinc-900">Đổi hàng</h2>
          <p className="text-sm text-zinc-500">Duyệt yêu cầu, kiểm tra hàng thu hồi và quyết toán.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {has('EXCHANGES.READ') && <Link to="/agent/exchanges" className="inline-flex min-h-9 items-center rounded-lg border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50">Danh sách đổi hàng</Link>}
        {has('EXCHANGES.CREATE') && <Link to="/agent/exchanges/new" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-on-primary hover:bg-primary/90"><Plus size={16} aria-hidden="true" /> Tạo yêu cầu đổi</Link>}
      </div>
    </section>}
    <OrderDashboard reports ordersPath="/agent/orders" area="agent" />
  </div>
}
