import { Banknote, ClipboardList, AlertTriangle, HandCoins } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/ui/StatusBadge'
import KpiCard from '../../components/ui/KpiCard'
import DashboardListCard from './components/DashboardListCard'
import OrdersByDayChart from './components/OrdersByDayChart'
import RevenueTrendChart from './components/RevenueTrendChart'
import PaymentMethodChart from './components/PaymentMethodChart'
import OrderStatusFunnelChart from './components/OrderStatusFunnelChart'
import DebtByStatusChart from './components/DebtByStatusChart'
import { orders } from '../../data/mockOrders'
import { debtCustomers } from '../../data/mockDebts'
import { mockCreditRequests } from '../../data/mockCreditRequests'
import { formatVnd, parseVnd } from '../../utils/money'
import { TODAY } from './dashboardData'
import type { Order, DebtCustomer, CreditRequest } from '../../types'

export default function DashboardPage() {
  const { user } = useAuth()
  usePageHeader({ title: 'Tổng quan', subtitle: `Ca làm việc hôm nay tại ${user.storeName}` })

  const todayOrders = orders.filter((o) => o.createdAt.startsWith(TODAY) && o.status !== 'Đã hủy')
  const todayRevenue = todayOrders.reduce((sum, o) => sum + parseVnd(o.total), 0)

  const pendingOrders = orders.filter((o) => o.status === 'Chờ xác nhận')
  const preparingOrders = orders.filter((o) => o.status === 'Đang chuẩn bị')
  const toHandleOrders = [...pendingOrders, ...preparingOrders]

  const overdueDebts = debtCustomers.filter((c) => c.status === 'Quá hạn' || c.isDisputed)
  const overdueAmount = overdueDebts.reduce((sum, c) => sum + parseVnd(c.remaining), 0)

  const pendingCreditRequests = mockCreditRequests.filter((r) => r.status === 'PENDING_APPROVAL')
  const pendingCreditAmount = pendingCreditRequests.reduce((sum, r) => sum + r.requestedAmount, 0)

  const recentCompletedOrders = orders.filter((o) => o.status === 'Hoàn thành').slice(0, 5)

  return (
    <div className="space-y-4 pb-12">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={Banknote}
          iconClassName="bg-emerald-50 text-emerald-600"
          title="Doanh số hôm nay"
          value={formatVnd(todayRevenue)}
          subtitle={`${todayOrders.length} đơn đã tạo hôm nay`}
        >
          <OrdersByDayChart />
        </KpiCard>

        <KpiCard
          icon={ClipboardList}
          iconClassName="bg-indigo-50 text-indigo-600"
          title="Đơn cần xử lý"
          value={toHandleOrders.length}
          subtitle={`${pendingOrders.length} chờ xác nhận • ${preparingOrders.length} đang chuẩn bị`}
        />

        <KpiCard
          icon={AlertTriangle}
          iconClassName="bg-rose-50 text-rose-600"
          title="Công nợ quá hạn"
          value={formatVnd(overdueAmount)}
          subtitle={`${overdueDebts.length} hộ quá hạn / đang tranh chấp`}
        />

        <KpiCard
          icon={HandCoins}
          iconClassName="bg-amber-50 text-amber-600"
          title="Mua chịu chờ duyệt"
          value={formatVnd(pendingCreditAmount)}
          subtitle={`${pendingCreditRequests.length} yêu cầu đang chờ`}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Doanh thu theo ngày</h3>
          <p className="text-xs text-slate-500">4 ngày gần nhất</p>
          <RevenueTrendChart />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Đơn hàng theo phương thức thanh toán</h3>
          <PaymentMethodChart />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Tiến trình xử lý đơn</h3>
          <OrderStatusFunnelChart />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Công nợ theo trạng thái</h3>
          <DebtByStatusChart />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardListCard<Order>
          title="Đơn hàng cần xử lý"
          linkTo="/orders"
          items={toHandleOrders}
          getKey={(order) => order.id}
          emptyMessage="Không có đơn nào cần xử lý."
          renderRow={(order) => (
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{order.customerName}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {order.id} • {order.createdAgo}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-slate-900">{order.total}</span>
                <StatusBadge label={order.statusBadge.label} className={order.statusBadge.className} />
              </div>
            </div>
          )}
        />

        <DashboardListCard<DebtCustomer>
          title="Công nợ cần chú ý"
          linkTo="/debts"
          items={overdueDebts}
          getKey={(debt) => debt.id}
          emptyMessage="Không có khoản nợ cần chú ý."
          renderRow={(debt) => (
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{debt.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {debt.addressShort}
                  {debt.isDisputed ? ' • Đang tranh chấp' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-rose-700">{debt.remaining}</span>
                <StatusBadge label={debt.statusBadge.label} className={debt.statusBadge.className} />
              </div>
            </div>
          )}
        />
      </section>

      <DashboardListCard<CreditRequest>
        title="Yêu cầu mua chịu chờ duyệt"
        linkTo="/credit-requests"
        items={pendingCreditRequests}
        getKey={(request) => request.id}
        emptyMessage="Không có yêu cầu mua chịu đang chờ duyệt."
        renderRow={(request) => (
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{request.farmerName}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {request.farmerPhone} • {request.cropSeason}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-slate-900">{formatVnd(request.requestedAmount)}</p>
              <p className="text-xs text-slate-500">Còn lại: {formatVnd(request.remainingLimit)}</p>
            </div>
          </div>
        )}
      />

      <DashboardListCard<Order>
        title="Đơn hàng hoàn thành gần đây"
        linkTo="/orders"
        items={recentCompletedOrders}
        getKey={(order) => order.id}
        emptyMessage="Chưa có đơn nào hoàn thành."
        renderRow={(order) => (
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-mono font-medium text-slate-500">{order.id}</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{order.customerName}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge label={order.paymentBadge.label} className={order.paymentBadge.className} />
              <span className="text-sm font-bold text-slate-900">{order.total}</span>
            </div>
          </div>
        )}
      />
    </div>
  )
}
