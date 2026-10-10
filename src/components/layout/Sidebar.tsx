import { canAccessRoute } from '@/components/auth/PermissionRoute'
import { usePermission } from '@/context/PermissionContext'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { NavItem } from '@/types'

/* ── Admin-only imports (used for dynamic badges) ── */
import * as accountsService from '@/features/admin/services/accountsService'


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

function useNavConfig() {
  const { user, currentRole } = useAuth()

  if (currentRole === 'admin') {
    const pendingAccountCount = accountsService.list().filter((a) => a.status === 'Chờ duyệt').length
    const items: NavItem[] = [
      { label: 'Tổng quan hệ thống', to: '/', icon: 'monitoring', iconTone: 'primary' },
      { label: 'Cấu hình Tín dụng', to: '/admin/credit-config', icon: 'credit_score' },
      { label: 'Quản lý tài khoản', to: '/admin/accounts', icon: 'group', badge: pendingAccountCount ? String(pendingAccountCount) : undefined, badgeTone: 'warning' },
      { label: 'Phân quyền', to: '/admin/roles', icon: 'admin_panel_settings' },
      { label: 'Danh mục', to: '/admin/products/categories', icon: 'category' },
      { label: 'Sản phẩm gốc', to: '/admin/products/master', icon: 'inventory_2' },
      { label: 'Hoạt chất', to: '/admin/products/ingredients', icon: 'science' },
      { label: 'AI Models', to: '/admin/ai/models', icon: 'model_training' },
      { label: 'AI Policy', to: '/admin/ai/policies', icon: 'settings_suggest' },
      { label: 'Bài viết', to: '/admin/articles', icon: 'article' },
      { label: 'Thông báo', to: '/admin/notifications', icon: 'notifications' },
      { label: 'Nhật ký', to: '/admin/audit-logs', icon: 'manage_search' },
    ]
    return { groups: [{ title: '', items }], brandIcon: 'shield_person', brandLabel: 'ADMIN', hubLabel: undefined }
  }

  if (currentRole === 'agent') {

    const groups = [
      {
        title: 'Chung',
        items: [
          { label: 'Tổng quan', to: '/', icon: 'dashboard', iconTone: 'primary' as const },
          { label: 'Bán tại quầy', to: '/agent/counter-sales', icon: 'point_of_sale' },
          { label: 'Đơn hàng', to: '/agent/orders', icon: 'receipt_long' },
          { label: 'Thanh toán', to: '/agent/payments', icon: 'payments' },
          { label: 'Trả hàng', to: '/agent/returns', icon: 'assignment_return' },
          { label: 'Hoàn tiền', to: '/agent/refunds', icon: 'currency_exchange' },
          // The owner always sees the queue (supervision); deciding a case needs the review right, checked by the API.
          { label: 'Chẩn đoán AI', to: '/agent/ai-recommendations', icon: 'psychology', iconTone: 'primary' as const }
        ]
      },
      {
        title: 'Quản lý kho & Sản phẩm',
        items: [
          { label: 'Sản phẩm', to: '/agent/products', icon: 'category' },
          { label: 'Tồn kho', to: '/agent/inventory', icon: 'inventory_2' },
          { label: 'Biến động kho', to: '/agent/inventory/movements', icon: 'sync_alt' },
          { label: 'Thẻ kho', to: '/agent/inventory/stock-card', icon: 'menu_book' },
          { label: 'Kiểm kê', to: '/agent/inventory/stocktake', icon: 'fact_check' },
          { label: 'Giao hàng', to: '/agent/deliveries', icon: 'local_shipping' },
        ]
      },
      {
        title: 'Mua hàng & Công nợ',
        items: [
          { label: 'Nhà cung cấp', to: '/agent/purchases/suppliers', icon: 'storefront' },
          { label: 'Phiếu nhập hàng', to: '/agent/purchases/receipts', icon: 'shopping_cart' },
          { label: 'Công nợ', to: '/agent/debts', icon: 'pending_actions' },
          { label: 'Nhóm khách & tín dụng', to: '/agent/credit-config', icon: 'credit_score' },
          { label: 'Bảng giá', to: '/agent/price-lists', icon: 'price_change' },
        ]
      },
      {
        title: 'Cộng đồng & Quản trị',
        items: [
          { label: 'Khách hàng', to: '/agent/farmers', icon: 'groups' },
          { label: 'Đánh giá sản phẩm', to: '/agent/products/reviews', icon: 'reviews' },
          { label: 'Nhân sự', to: '/agent/staff', icon: 'manage_accounts' },
          { label: 'Nhật ký kiểm toán', to: '/agent/activity-log', icon: 'history_toggle_off' },
          { label: 'Cài đặt', to: '/agent/settings', icon: 'settings' },
        ]
      }
    ]
    return { groups, brandIcon: 'eco', brandLabel: 'OS', hubLabel: user.hub }
  }

  if (currentRole === 'sales_staff') {
    const items: NavItem[] = [
      { label: 'Tổng quan', to: '/', icon: 'dashboard', iconTone: 'primary' },
      { label: 'Bán tại quầy', to: '/sales/counter-sales', icon: 'point_of_sale' },
      { label: 'Khách hàng', to: '/sales/farmers', icon: 'groups' },
      { label: 'Sản phẩm', to: '/sales/products', icon: 'category' },
      { label: 'Đơn hàng', to: '/sales/orders', icon: 'receipt_long' },
      { label: 'Giao hàng', to: '/sales/deliveries', icon: 'local_shipping' },
      { label: 'Thanh toán', to: '/sales/payments', icon: 'payments' },
      { label: 'Trả hàng', to: '/sales/returns', icon: 'assignment_return' },
      { label: 'Công nợ', to: '/sales/debts', icon: 'pending_actions' },
      { label: 'Kho', to: '/sales/inventory', icon: 'inventory_2' },
      { label: 'Kiểm kê', to: '/sales/inventory/stocktake', icon: 'fact_check' },
      { label: 'Bảng giá', to: '/sales/price-lists', icon: 'price_change' },
      ...(user.canReviewAi ? [{ label: 'Duyệt chẩn đoán AI', to: '/sales/ai-review', icon: 'psychology', iconTone: 'primary' as const }] : []),
      { label: 'Cài đặt', to: '/sales/settings', icon: 'settings' },
    ]
    items.push(
      { label: 'Hoàn tiền', to: '/agent/refunds', icon: 'currency_exchange' },
      { label: 'Nhà cung cấp', to: '/agent/purchases/suppliers', icon: 'storefront' },
      { label: 'Phiếu nhập hàng', to: '/agent/purchases/receipts', icon: 'shopping_cart' },
      { label: 'Nhóm khách & tín dụng', to: '/agent/credit-config', icon: 'credit_score' },
    )
    return { groups: [{ title: '', items }], brandIcon: 'eco', brandLabel: 'Sales', hubLabel: user.storeName }
  }

  // delivery_staff
  const items: NavItem[] = [
    { label: 'Tổng quan', to: '/', icon: 'dashboard', iconTone: 'primary' },
    { label: 'Danh sách giao hàng', to: '/delivery/deliveries', icon: 'local_shipping' },
  ]
  return { groups: [{ title: '', items }], brandIcon: 'eco', brandLabel: 'Delivery', hubLabel: user.hubName }
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth()
  const { groups: allGroups, brandIcon, brandLabel, hubLabel } = useNavConfig()
  const { has } = usePermission()
  const groups = allGroups.map(group => ({ ...group, items: group.items.filter(item => canAccessRoute(item.to, has)) })).filter(group => group.items.length > 0)

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
              <span className="material-symbols-outlined text-[20px]">{brandIcon}</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight">
                AgriSage
              </span>
              <span className="bg-surface-container text-primary font-label-sm text-label-sm px-1.5 py-0.5 rounded border border-outline-variant">
                {brandLabel}
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
          {hubLabel ? (
            <div className="mt-space-sm p-space-xs bg-surface-container-low rounded border border-outline-variant flex items-center gap-1.5 overflow-hidden">
              <span className="material-symbols-outlined text-primary text-[16px] flex-shrink-0">warehouse</span>
              <span className="font-label-md text-label-md text-on-surface truncate font-semibold">
                {hubLabel}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <nav aria-label="Main Navigation" className="flex-1 min-h-0 overflow-y-auto px-space-xs pb-4">
        {groups.map((group, groupIdx) => (
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
                  end={item.to === '/' || item.to === '/agent/inventory' || item.to === '/agent/debts' || item.to === '/agent/products'}
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
                          aria-hidden="true"
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
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{user.roleLabel}</p>
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
