import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { NavItem } from '../../types'
import { products } from '../../data/mockProducts'
import { inventoryItems } from '../../data/mockInventory'
import { orders } from '../../data/mockOrders'
import { payments } from '../../data/mockPayments'
import { debtCustomers } from '../../data/mockDebts'
import { aiCases } from '../../data/mockAiRecommendations'
import { parseVnd, formatVndShort } from '../../utils/money'

function badgeClasses(tone: NavItem['badgeTone']) {
  switch (tone) {
    case 'error':
      return 'bg-error-container text-on-error-container font-bold'
    case 'primary':
      return 'bg-surface-container-high text-primary font-semibold'
    case 'warning':
      return 'bg-secondary-fixed text-on-secondary-fixed-variant font-semibold'
    default:
      return 'bg-surface-container text-on-surface-variant font-semibold'
  }
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth()

  const inventoryAlertCount = inventoryItems.filter((i) => i.stockLabel !== 'Tồn kho tốt').length
  const unpaidPaymentCount = payments.filter((p) => p.statusBadge.label !== 'Đã thanh toán').length
  const totalDebtRemaining = debtCustomers.reduce((sum, c) => sum + parseVnd(c.remaining), 0)
  const pendingAiCount = aiCases.filter((c) => c.statusBadge.label === 'Chờ duyệt').length

  const navGroups: { title: string, items: NavItem[] }[] = [
    {
      title: 'Chung',
      items: [
        { label: 'Tổng quan', to: '/', icon: 'dashboard', iconTone: 'primary' },
        { label: 'Đơn hàng', to: '/orders', icon: 'receipt_long', badge: String(orders.length), badgeTone: 'primary' },
        { label: 'Thanh toán VietQR', to: '/payments', icon: 'payments', badge: `${unpaidPaymentCount} chờ`, badgeTone: 'primary' },
        ...(user.can_review_ai ? [{ label: 'Hàng đợi AI', to: '/ai-recommendations', icon: 'psychology', badge: String(pendingAiCount), badgeTone: 'error' as const, iconTone: 'primary' as const }] : [])
      ]
    },
    {
      title: 'Quản lý kho & Sản phẩm',
      items: [
        { label: 'Sản phẩm', to: '/products', icon: 'category', badge: String(products.length) },
        { label: 'Tồn kho', to: '/inventory', icon: 'inventory_2', badge: String(inventoryAlertCount), badgeTone: 'error' },
        { label: 'Biến động kho', to: '/inventory/movements', icon: 'sync_alt' },
        { label: 'Kiểm kê', to: '/inventory/stocktake', icon: 'fact_check' },
        { label: 'Giao hàng', to: '/deliveries', icon: 'local_shipping' },
      ]
    },
    {
      title: 'Mua hàng & Công nợ',
      items: [
        { label: 'Nhà cung cấp', to: '/purchases/suppliers', icon: 'storefront' },
        { label: 'Phiếu nhập hàng', to: '/purchases/orders', icon: 'shopping_cart' },
        { label: 'Mua chịu (Seasonal)', to: '/debts/seasonal-credit', icon: 'credit_score' },
        { label: 'Sổ nợ mùa vụ', to: '/debts', icon: 'pending_actions', badge: formatVndShort(totalDebtRemaining), badgeTone: 'warning' },
      ]
    },
    {
      title: 'Cộng đồng & Quản trị',
      items: [
        { label: 'Nông dân', to: '/farmers', icon: 'groups' },
        { label: 'Đánh giá sản phẩm', to: '/products/reviews', icon: 'reviews' },
        { label: 'Nhân sự', to: '/staff', icon: 'manage_accounts' },
        { label: 'Nhật ký kiểm toán', to: '/activity-log', icon: 'history_toggle_off' },
        { label: 'Cài đặt', to: '/settings', icon: 'settings' },
      ]
    }
  ]

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 bg-inverse-surface/40 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}
      <aside
        className={`sidebar-drawer fixed left-0 top-0 h-screen w-nav-sidebar-width flex flex-col py-space-md px-space-xs z-50 bg-surface-container-lowest border-r border-outline-variant select-none ${
          open ? 'is-open' : ''
        }`}
      >
      <div className="shrink-0">
        <div className="px-space-md mb-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-sm flex-shrink-0">
              <span className="material-symbols-outlined text-[20px]">eco</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight">
                AgriSage
              </span>
              <span className="bg-surface-container text-primary font-label-sm text-label-sm px-1.5 py-0.5 rounded border border-outline-variant">
                OS
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden shrink-0 w-7 h-7 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-low"
              aria-label="Đóng menu"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div className="mt-space-sm p-space-xs bg-surface-container-low rounded border border-outline-variant flex items-center gap-1.5 overflow-hidden">
            <span className="material-symbols-outlined text-primary text-[16px] flex-shrink-0">warehouse</span>
            <span className="font-label-md text-label-md text-on-surface truncate font-semibold">
              {user.hub}
            </span>
          </div>
        </div>
      </div>

      <nav aria-label="Main Operations Navigation" className="flex-1 min-h-0 overflow-y-auto px-space-xs pb-4">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className={groupIdx > 0 ? 'mt-4' : ''}>
            {group.title && (
              <div className="px-space-md py-2 text-[10px] font-bold uppercase tracking-wider text-outline">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={true}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-space-md py-space-sm font-label-md text-label-md rounded transition-all overflow-hidden ${
                      isActive
                        ? 'bg-surface-container text-primary font-bold border-r-2 border-primary rounded-l'
                        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-medium'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-space-sm flex-1 min-w-0">
                        <span
                          className={`material-symbols-outlined text-[20px] flex-shrink-0 ${
                            isActive || item.iconTone === 'primary' ? 'text-primary' : ''
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge ? (
                        <span
                          className={`ml-2 px-1.5 py-0.5 rounded text-[11px] tabular-nums flex-shrink-0 ${badgeClasses(item.badgeTone)}`}
                        >
                          {item.badge}
                        </span>
                      ) : isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 px-space-xs pt-space-sm border-t border-outline-variant">
        <div className="p-space-sm bg-surface-container-low rounded border border-outline-variant">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs">
                {user.initials}
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-primary ring-1 ring-white"></span>
            </div>
            <div className="overflow-hidden">
              <h4 className="font-title-md text-title-md text-on-surface truncate">{user.name}</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{user.role}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-outline-variant/60 flex items-center justify-between text-[11px] text-on-surface-variant font-medium">
            <span className="flex items-center gap-1 text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              Syncing Can Tho Node
            </span>
            <span className="tabular-nums text-outline">v2.4.1</span>
          </div>
        </div>
      </div>
      </aside>
    </>
  )
}
