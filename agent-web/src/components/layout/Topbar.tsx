import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageHeaderValue } from '../../context/PageHeaderContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { farmers } from '../../data/mockFarmers'
import { orders } from '../../data/mockOrders'
import { products } from '../../data/mockProducts'

interface TopbarProps {
  onMenuClick: () => void
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { title, subtitle, badge } = usePageHeaderValue()
  const { logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim().toLowerCase()
    if (!q) return

    const orderMatch = orders.find((o) => o.id.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q))
    const farmerMatch = farmers.find((f) => f.name.toLowerCase().includes(q) || f.phone.includes(q))
    const productMatch = products.find((p) => p.name.toLowerCase().includes(q))

    if (orderMatch) {
      navigate('/orders')
      showToast(`Tìm thấy đơn hàng #${orderMatch.id} (${orderMatch.customerName})`)
    } else if (farmerMatch) {
      navigate('/farmers')
      showToast(`Tìm thấy nông dân: ${farmerMatch.name}`)
    } else if (productMatch) {
      navigate('/products')
      showToast(`Tìm thấy sản phẩm: ${productMatch.name}`)
    } else {
      showToast(`Không tìm thấy kết quả cho "${searchQuery}"`)
    }
    setSearchQuery('')
  }

  const handleNotificationsClick = () => {
    if (hasUnreadNotifications) {
      setHasUnreadNotifications(false)
      showToast('Đã xem thông báo hệ thống')
    } else {
      showToast('Không có thông báo mới')
    }
  }

  return (
    <header className="h-header-height px-layout-margin-desktop bg-white border-b border-outline-variant/60 sticky top-0 z-40 relative flex items-center justify-between gap-space-lg shadow-2xs">
      <div className="flex items-center gap-space-lg min-w-0 shrink">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded border border-transparent hover:border-outline-variant/60 hover:bg-surface-container-low text-on-surface-variant transition-colors"
          aria-label="Mở menu điều hướng"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-title-lg text-title-lg text-on-surface font-bold truncate min-w-0 max-w-[280px]">{title}</h1>
            {badge ? (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-primary-fixed/50 text-on-primary-fixed-variant font-label-sm text-label-sm rounded border border-primary-fixed-dim/60 font-medium max-w-[110px] lg:max-w-[200px] overflow-hidden min-w-0">
                <span className="material-symbols-outlined text-[14px] text-primary shrink-0">agriculture</span>
                <span className="truncate">{badge}</span>
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-2 mt-0.5 truncate">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-space-md shrink-0">
        <form className="relative hidden lg:block w-72" onSubmit={handleSearchSubmit}>
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input
            className="w-full h-8 pl-9 pr-3 text-sm bg-surface-container-low border border-outline-variant/60 rounded focus:border-primary focus:ring-1 focus:ring-primary focus:bg-white text-on-surface transition-all placeholder:text-outline font-body-md"
            placeholder="Tìm nông dân, đơn hàng, vật tư (NPK, giống, thuốc BVTV)..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
        <div className="flex items-center gap-1">
          <button
            className="w-8 h-8 flex items-center justify-center rounded border border-transparent hover:border-outline-variant/60 hover:bg-surface-container-low text-on-surface-variant transition-colors"
            title="VietQR Quick Scanner"
            type="button"
            onClick={() => showToast('Chức năng quét mã VietQR đang được phát triển')}
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded border border-transparent hover:border-outline-variant/60 hover:bg-surface-container-low text-on-surface-variant relative transition-colors"
            title="Thông báo hệ thống"
            type="button"
            onClick={handleNotificationsClick}
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            {hasUnreadNotifications ? (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-error ring-2 ring-white"></span>
            ) : null}
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded border border-transparent hover:border-outline-variant/60 hover:bg-surface-container-low text-on-surface-variant transition-colors"
            title="Đăng xuất"
            type="button"
            onClick={handleLogout}
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
