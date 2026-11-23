import { useNavigate } from 'react-router-dom';
import { usePageHeaderValue } from '@/context/PageHeaderContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import StoreAlertSettings from '@/features/alerts/StoreAlertSettings';
import GlobalSearch from './GlobalSearch';

interface TopbarProps {
  onMenuClick: () => void
  menuOpen: boolean
}

export default function Topbar({ onMenuClick, menuOpen }: TopbarProps) {
  const { title, badge } = usePageHeaderValue()
  const { logout, currentRole, user } = useAuth()
  const navigate = useNavigate()

  const { unreadCount } = useNotifications()
  const displayName = user.fullName || user.name || 'Tài khoản'
  const initials = user.initials || displayName.split(' ').filter(Boolean).slice(-2).map((part: string) => part[0]).join('')
  const roleLabel = ({ admin: 'Quản trị viên', agent: 'Chủ cửa hàng', sales_staff: 'Nhân viên bán hàng', delivery_staff: 'Nhân viên giao hàng' } as Record<string, string>)[currentRole || '']
  const handleLogout = () => {
    logout()
    navigate('/login')
  }
  const handleNotificationsClick = () => navigate('/notifications')

  const badgeIcon = currentRole === 'admin' ? 'verified_user' : 'agriculture'

  return (
    <header className="management-topbar bg-white border-b border-outline-variant sticky top-0 z-40 flex items-center justify-between gap-3">
      <div className="flex items-center gap-space-lg min-w-0 shrink">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden topbar-icon shrink-0 flex items-center justify-center rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors"
          aria-label="Mở menu điều hướng"
          aria-controls="management-sidebar"
          aria-expanded={menuOpen}
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-title-lg text-title-lg text-on-surface font-semibold truncate min-w-0 max-w-[280px]">{title}</h1>
            {badge ? (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-primary-fixed/50 text-on-primary-fixed-variant font-label-sm text-label-sm rounded border border-primary-fixed-dim/60 font-medium max-w-[110px] lg:max-w-[200px] overflow-hidden min-w-0">
                <span className="material-symbols-outlined text-[14px] text-primary shrink-0">{badgeIcon}</span>
                <span className="truncate">{badge}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-space-md shrink-0">
        <GlobalSearch />
        <div className="flex items-center gap-1">
          <StoreAlertSettings />
          <button
            className="topbar-icon flex items-center justify-center rounded-lg hover:bg-surface-container-low text-on-surface-variant relative transition-colors"
            title="Thông báo của tôi"
            aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
            type="button"
            onClick={handleNotificationsClick}
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            {unreadCount > 0 ? (
              <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-error text-white text-[10px] flex items-center justify-center ring-2 ring-white">{unreadCount > 99 ? '99+' : unreadCount}</span>
            ) : null}
          </button>
          <button
            className="topbar-icon flex items-center justify-center rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors"
            title="Đăng xuất"
            aria-label="Đăng xuất"
            type="button"
            onClick={handleLogout}
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
        <div className="flex items-center gap-2 border-l border-outline-variant pl-3" title={`${displayName} · ${roleLabel}`}>
            <span className="w-9 h-9 flex items-center justify-center rounded-full bg-primary-container text-on-primary-container text-xs font-semibold">{initials}</span>
            <span className="hidden xl:block text-left max-w-32"><span className="block text-xs font-semibold truncate">{displayName}</span><span className="block text-[11px] text-on-surface-variant">{roleLabel}</span></span>
        </div>
      </div>
    </header>
  )
}
