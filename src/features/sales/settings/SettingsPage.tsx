import { usePageHeader } from '@/context/PageHeaderContext'
import AccountSettings from '@/features/auth/AccountSettings'

export default function SettingsPage() {
  usePageHeader({ title: 'Cài đặt cá nhân', subtitle: 'Mật khẩu và các phiên đăng nhập của bạn' })
  return <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg"><AccountSettings /></div>
}
