import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePermission } from '../../context/PermissionContext'
import type { NavItem } from '../../types'
import * as accountsService from '../../services/accountsService'

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
  const { hasPermission } = usePermission()

  const pendingAccountCount = accountsService.list().filter((a) => a.status === 'Chờ duyệt').length

  const allNavItems: NavItem[] = [
    { label: 'Tổng quan hệ thống', to: '/', icon: 'monitoring', iconTone: 'primary', permissionModule: 'reports' },
    { label: 'Quản lý tài khoản', to: '/accounts', icon: 'group', badge: pendingAccountCount ? String(pendingAccountCount) : undefined, badgeTone: 'warning', permissionModule: 'accounts' },
    { label: 'Phân quyền', to: '/roles', icon: 'admin_panel_settings', permissionModule: 'roles' },
    
    // Products
    { label: 'Danh mục', to: '/products/categories', icon: 'category', permissionModule: 'products' },
    { label: 'Sản phẩm gốc', to: '/products/master', icon: 'inventory_2', permissionModule: 'products' },
    { label: 'Hoạt chất', to: '/products/ingredients', icon: 'science', permissionModule: 'products' },
    
    // AI
    { label: 'AI Models', to: '/ai/models', icon: 'model_training', permissionModule: 'ai-config' },
    { label: 'AI Policy', to: '/ai/policies', icon: 'settings_suggest', permissionModule: 'ai-config' },
    
    // Content
    { label: 'Bài viết', to: '/articles', icon: 'article', permissionModule: 'articles' },
    
    // System
    { label: 'Thông báo', to: '/notifications', icon: 'notifications', permissionModule: 'notifications' },
    { label: 'Nhật ký', to: '/audit-logs', icon: 'manage_search', permissionModule: 'audit-logs' },
  ]
  
  const navItems = allNavItems.filter((item) => hasPermission(item.permissionModule, 'view'))

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
              <span className="material-symbols-outlined text-[20px]">shield_person</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight">
                AgriSage
              </span>
              <span className="bg-surface-container text-primary font-label-sm text-label-sm px-1.5 py-0.5 rounded border border-outline-variant">
                ADMIN
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
        </div>
      </div>

      <nav aria-label="Admin Navigation" className="flex-1 min-h-0 overflow-y-auto space-y-1 px-space-xs">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-2 font-label-md text-label-md rounded transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary font-title-md text-title-md font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-space-sm">
                    <span
                      className={`material-symbols-outlined text-[20px] ${
                        isActive || item.iconTone === 'primary' ? 'text-primary' : ''
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && item.badge !== '0' ? (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] tabular-nums ${badgeClasses(item.badgeTone)}`}
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
        </div>
      </div>
      </aside>
    </>
  )
}
