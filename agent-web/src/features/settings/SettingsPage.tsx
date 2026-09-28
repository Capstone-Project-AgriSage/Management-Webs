import { useState } from 'react'
import { Mail, Pencil, MoreHorizontal, CheckCircle2, CalendarDays, Network, Clock } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'

const DEFAULT_PROFILE = {
  name: 'Nguyễn Văn Minh',
  phone: '0918.234.567',
  email: 'minh.nguyen@agrisage.vn',
}

type TabKey = 'overview' | 'personal' | 'employment' | 'compensation' | 'timeoff' | 'documents'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'personal', label: 'Cá nhân' },
  { key: 'employment', label: 'Công tác' },
  { key: 'compensation', label: 'Thu nhập' },
  { key: 'timeoff', label: 'Nghỉ phép' },
  { key: 'documents', label: 'Tài liệu' },
]

export default function SettingsPage() {
  // Clear the global header since we are doing a full-page custom layout
  usePageHeader({ title: '' })

  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [profileDraft, setProfileDraft] = useState(DEFAULT_PROFILE)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSaveProfile = () => {
    setProfile(profileDraft)
    showToast('Đã lưu thay đổi hồ sơ cá nhân')
  }

  const handleCancelProfile = () => {
    setProfileDraft(profile)
  }

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('Vui lòng nhập đầy đủ các trường mật khẩu')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('Mật khẩu mới và xác nhận không khớp')
      return
    }
    if (newPassword.length < 8) {
      showToast('Mật khẩu mới cần tối thiểu 8 ký tự')
      return
    }
    showToast('Đã đổi mật khẩu thành công')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="bg-white -m-4 lg:-m-6 p-4 lg:p-8 min-h-[calc(100vh-4rem)] text-slate-900">
      
      {/* Breadcrumb */}
      <div className="text-[13px] text-slate-500 font-medium mb-6">
        Trang chủ <span className="mx-1.5">›</span> Hệ thống <span className="mx-1.5">›</span> Danh bạ đại lý <span className="mx-1.5">›</span> Nguyễn Văn Minh <span className="mx-1.5">›</span> <span className="text-slate-900 font-semibold">Hồ sơ chi tiết</span>
      </div>

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-[84px] h-[84px] rounded-full border-[3px] border-emerald-500 p-0.5">
              <div className="w-full h-full rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-2xl font-bold overflow-hidden">
                <img src="/agent_avatar.jpg" alt="Avatar" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
          <div className="pt-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{profile.name}</h1>
            <p className="text-sm text-slate-500 mt-1.5">
              {profile.email} · Đại lý vật tư nông nghiệp
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-50 text-orange-600 text-xs font-semibold">
                92% Hoàn chỉnh
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500 text-white text-xs font-semibold">
                <CheckCircle2 size={14} />
                Đã xác thực
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold">
                Đại lý chính thức
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold">
                Cần Thơ
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold">
                UTC+7
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:pt-2">
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50/50 text-slate-700 rounded-md text-[13px] font-semibold transition-colors shadow-sm"
            onClick={() => showToast('Mở trình soạn email')}
          >
            <Mail size={15} />
            <span>Email</span>
          </button>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[13px] font-semibold transition-colors shadow-sm border border-slate-900"
            onClick={() => setActiveTab('personal')}
          >
            <Pencil size={14} />
            <span>Chỉnh sửa hồ sơ</span>
          </button>
          <button onClick={() => showToast('Tính năng Thay đổi ảnh đại diện đang được phát triển')} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50/50 rounded-md text-slate-600 shadow-sm transition-colors">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="mt-10 border-b border-slate-200 flex items-center gap-6 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row mt-8">
        
        {/* LEFT COLUMN */}
        <div className="flex-1 lg:pr-10 space-y-8 pb-10">
          
          {/* --- TAB: TỔNG QUAN --- */}
          {activeTab === 'overview' && (
            <>
              {/* About section */}
              <div className="pb-8 border-b border-slate-200">
                <h3 className="text-[15px] font-bold text-slate-900 mb-3">Giới thiệu</h3>
                <p className="text-[13px] text-slate-500 leading-relaxed max-w-4xl">
                  Nguyễn Văn Minh là Đại lý vật tư nông nghiệp thuộc phân hệ Mekong Delta Hub. 
                  Trực tiếp cung cấp thuốc BVTV, phân bón và tư vấn phác đồ điều trị sâu bệnh (hỗ trợ bởi AI) cho hơn 240 hộ nông dân tại khu vực Cần Thơ. 
                  Tập trung vào việc chuyển đổi quy trình bán hàng truyền thống sang mô hình cung ứng số hóa, giúp nông dân tiếp cận vật tư nhanh chóng và theo dõi dư nợ minh bạch.
                </p>
              </div>
              
              {/* Work details section */}
              <div className="pb-8 border-b border-slate-200">
                <h3 className="text-[15px] font-bold text-slate-900 mb-5">Chi tiết công tác</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Mã đại lý</p>
                    <p className="text-[13px] font-medium text-slate-900">#AGT-8804</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Phân hệ</p>
                    <p className="text-[13px] font-medium text-slate-900">Mekong Delta Hub</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Ngày bắt đầu</p>
                    <p className="text-[13px] font-medium text-slate-900">18 tháng 3, 2022</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Trạng thái</p>
                    <p className="text-[13px] font-medium text-slate-900">Đang hoạt động</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Nhóm khu vực</p>
                    <p className="text-[13px] font-medium text-slate-900">Cần Thơ</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Thời gian công tác</p>
                    <p className="text-[13px] font-medium text-slate-900">4 năm, 4 tháng</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Cấp độ</p>
                    <p className="text-[13px] font-medium text-slate-900">Cao cấp (Senior)</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 mb-1">Dự án / Vụ mùa hiện tại</p>
                    <p className="text-[13px] font-medium text-slate-900">Vụ Thu Đông 2024</p>
                  </div>
                </div>
              </div>

              {/* Reporting line */}
              <div className="pb-8 border-b border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[15px] font-bold text-slate-900">Tuyến báo cáo</h3>
                  <button onClick={() => showToast('Chức năng Xem sơ đồ tổ chức đang được phát triển')} className="inline-flex items-center gap-1.5 px-3 py-1 border border-slate-200 rounded-md text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50/50 transition-colors">
                    <Network size={14} />
                    <span>Sơ đồ tổ chức</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-4">Quản lý trực tiếp</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-500 border border-slate-200">PK</div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">Phạm Kiệt</p>
                    <p className="text-xs text-slate-400">Giám đốc vùng</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* --- TAB: CÁ NHÂN --- */}
          {activeTab === 'personal' && (
            <div className="max-w-2xl">
              <div className="pb-8 border-b border-slate-200">
                <h3 className="text-[15px] font-bold text-slate-900 mb-5">Thông tin cơ bản</h3>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Họ và tên</label>
                      <input type="text" className="w-full text-[13px] border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-slate-500" value={profileDraft.name} onChange={e => setProfileDraft(p => ({...p, name: e.target.value}))}/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Số điện thoại</label>
                      <input type="text" className="w-full text-[13px] border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-slate-500" value={profileDraft.phone} onChange={e => setProfileDraft(p => ({...p, phone: e.target.value}))}/>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email liên hệ</label>
                      <input type="email" className="w-full text-[13px] border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-slate-500" value={profileDraft.email} onChange={e => setProfileDraft(p => ({...p, email: e.target.value}))}/>
                    </div>
                  </div>
                  <div className="pt-4">
                    <button className="px-4 py-2 bg-slate-900 text-white rounded-md text-[13px] font-semibold hover:bg-slate-800" onClick={handleSaveProfile}>Lưu thay đổi</button>
                    <button className="px-4 py-2 bg-transparent text-slate-600 rounded-md text-[13px] font-semibold ml-2 hover:bg-slate-50/50" onClick={handleCancelProfile}>Hủy</button>
                  </div>
                </div>
              </div>

              <div className="py-8 border-b border-slate-200">
                <h3 className="text-[15px] font-bold text-slate-900 mb-5">Đổi mật khẩu</h3>
                <div className="space-y-4 max-w-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mật khẩu hiện tại</label>
                    <input type="password" placeholder="Nhập mật khẩu cũ..." className="w-full text-[13px] border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-slate-500" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mật khẩu mới</label>
                    <input type="password" placeholder="Nhập mật khẩu mới..." className="w-full text-[13px] border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-slate-500" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Xác nhận mật khẩu</label>
                    <input type="password" placeholder="Nhập lại mật khẩu mới..." className="w-full text-[13px] border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-slate-500" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  </div>
                  <div className="pt-2">
                    <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-[13px] font-semibold hover:bg-slate-50/50 shadow-sm" onClick={handleChangePassword}>Cập nhật mật khẩu</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fallback for other tabs */}
          {['employment', 'compensation', 'timeoff', 'documents'].includes(activeTab) && (
             <div className="pb-8">
               <h3 className="text-[15px] font-bold text-slate-900 mb-2">Chưa có dữ liệu</h3>
               <p className="text-[13px] text-slate-500">Thông tin ở phân mục này đang được cập nhật từ hệ thống nhân sự.</p>
             </div>
          )}

        </div>

        {/* RIGHT COLUMN (SIDEBAR) */}
        <div className="lg:w-[320px] shrink-0 lg:pl-10 lg:border-l lg:border-slate-200 space-y-8 pt-8 lg:pt-0">
          
          <div>
             <h3 className="text-[13px] font-bold text-slate-900 mb-4">Trạng thái hồ sơ</h3>
             <div className="flex items-start gap-2">
               <CheckCircle2 size={16} className="text-slate-500 mt-0.5 shrink-0" />
               <div>
                 <p className="text-[13px] font-semibold text-slate-900">Đại lý đang hoạt động</p>
                 <p className="text-[11px] text-slate-400 mt-1">Hợp đồng và quyền truy cập khả dụng</p>
               </div>
             </div>
             <div className="mt-4 pt-3 border-t border-slate-100">
               <p className="text-[11px] text-slate-400">Cập nhật ngày 08 tháng 08, 2026 bởi Hệ thống</p>
             </div>
          </div>

          <div className="pt-2">
             <h3 className="text-[13px] font-bold text-slate-900 mb-4">Sự kiện sắp tới</h3>
             <div className="space-y-5">
               <div className="flex items-start gap-2">
                 <CalendarDays size={16} className="text-slate-400 mt-0.5 shrink-0" />
                 <div>
                   <p className="text-[13px] font-semibold text-slate-900">Nghỉ phép thường niên</p>
                   <p className="text-[11px] text-slate-400 mt-1">24–28 tháng 08, 2026</p>
                 </div>
               </div>
               <div className="flex items-start gap-2">
                 <Clock size={16} className="text-slate-400 mt-0.5 shrink-0" />
                 <div>
                   <p className="text-[13px] font-semibold text-slate-900">Ngày làm việc cuối năm</p>
                   <p className="text-[11px] text-slate-400 mt-1">03 tháng 10, 2026</p>
                 </div>
               </div>
             </div>
          </div>

        </div>

      </div>

    </div>
  )
}
