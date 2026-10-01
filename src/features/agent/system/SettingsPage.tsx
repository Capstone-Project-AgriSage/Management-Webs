import { Link } from 'react-router-dom'
import { ChevronRight, Settings } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'

export default function SettingsPage() {
  usePageHeader({ title: 'Cài đặt hệ thống', subtitle: 'Cấu hình thông số ứng dụng' })
  const { showToast } = useToast()

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Cài đặt</span>
      </nav>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 max-w-2xl">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2 text-slate-700 font-semibold bg-slate-50/50">
          <Settings size={18} /> Cấu hình chung
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-900">Tên cửa hàng / Đại lý</label>
            <input type="text" defaultValue="Đại lý Hai Thắng" className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-900">Email liên hệ</label>
            <input type="email" defaultValue="contact@haithang.com" className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-900">Địa chỉ</label>
            <input type="text" defaultValue="Huyện Thoại Sơn, Tỉnh An Giang" className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700" />
          </div>
          <div className="pt-4 flex justify-end">
            <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm text-sm" onClick={() => showToast('Lưu cấu hình thành công')}>
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
