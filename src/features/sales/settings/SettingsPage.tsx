import PlaceholderPage from '@/components/layout/PlaceholderPage'

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Cài đặt"
      subtitle="Tùy chọn tài khoản và cửa hàng"
      icon="settings"
      tasks={['Thông tin tài khoản', 'Đổi mật khẩu', 'Tùy chọn thông báo']}
    />
  )
}
