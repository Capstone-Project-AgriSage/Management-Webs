import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { NavItem } from '../../types'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const navItems: NavItem[] = [
  { label: 'Tổng quan', to: '/', icon: 'dashboard', iconTone: 'primary' },
  { label: 'Danh sách giao hàng', to: '/deliveries', icon: 'local_shipping' },
]

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth()

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
                Delivery
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
            <span className="material-symbols-outlined text-primary text-[16px] flex-shrink-0">storefront</span>
            <span className="font-label-md text-label-md text-on-surface truncate font-semibold">
              {user.hubName}
            </span>
          </div>
        </div>
      </div>

      <nav aria-label="Main Delivery Navigation" className="flex-1 min-h-0 overflow-y-auto space-y-0.5 px-space-xs">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between px-space-md py-space-sm font-label-md text-label-md rounded transition-all ${
                  isActive
                    ? 'bg-surface-container text-primary font-title-md text-title-md border-r-2 border-primary rounded-l'
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
                  {isActive ? <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> : null}
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
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{user.role}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-outline-variant/60 flex items-center justify-between text-[11px] text-on-surface-variant font-medium">
            <span className="flex items-center gap-1 text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              Syncing Can Tho Node
            </span>
            <span className="tabular-nums text-outline">v0.1.0</span>
          </div>
        </div>
      </div>
      </aside>
    </>
  )
}
