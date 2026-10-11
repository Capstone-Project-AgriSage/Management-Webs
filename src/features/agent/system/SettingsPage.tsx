import { usePageHeader } from '@/context/PageHeaderContext'
import AccountSettings from '@/features/auth/AccountSettings'

export default function SettingsPage() {
  usePageHeader({ title: 'Cài đặt', subtitle: 'Mật khẩu và các phiên đăng nhập của bạn' })
  return <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
    <AccountSettings />
    <p className="text-sm text-slate-500">Thông tin cấu hình cửa hàng chưa có API cập nhật trong backend hiện tại.</p>
  </div>
}
