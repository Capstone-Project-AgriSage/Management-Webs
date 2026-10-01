import { Link } from 'react-router-dom'
import { ChevronRight, Settings } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'

export default function SettingsPage() {
  usePageHeader({ title: 'Cài đặt cá nhân', subtitle: 'Tùy chỉnh tài khoản Sales' })

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/sales">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Cài đặt</span>
      </nav>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <p className="text-sm text-slate-700">Trang cấu hình tài khoản nhân viên Sales.</p>
      </div>
    </div>
  )
}
