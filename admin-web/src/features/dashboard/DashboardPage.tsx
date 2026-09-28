import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import FormModal from '../../components/ui/FormModal'
import DetailModal from '../../components/ui/DetailModal'
import { downloadCsv } from '../../utils/csv'
import * as accountsService from '../../services/accountsService'
import { useFormValues } from '../../hooks/useFormValues'

export default function DashboardPage() {
  usePageHeader({ title: '', subtitle: '' })
  const navigate = useNavigate()
  const { showToast } = useToast()

  const accounts = accountsService.list()

  const totalAccounts = accounts.length
  const activeAgents = accounts.filter((a) => a.role === 'Store Owner' && a.status === 'Đang hoạt động').length
  const totalFarmers = accounts.filter((a) => a.role === 'Farmer').length
  const pendingAccounts = accounts.filter((a) => a.status === 'Chờ duyệt').length

  const [chartFilter, setChartFilter] = useState('Hàng tuần')
  const [allocationFilter, setAllocationFilter] = useState('Đại lý / Nông dân')

  const roleBreakdownDefault = [
    { label: 'Đại lý', count: accounts.filter((a) => a.role === 'Store Owner').length, percent: 52.2, color: 'bg-[#16a34a]', hex: '#16a34a' },
    { label: 'Nông dân', count: accounts.filter((a) => a.role === 'Farmer').length, percent: 36.3, color: 'bg-[#86efac]', hex: '#86efac' },
    { label: 'Quản trị viên', count: accounts.filter((a) => a.role === 'Admin').length, percent: 11.5, color: 'bg-[#465a46]', hex: '#465a46' },
  ]
  const roleBreakdownArea = [
    { label: 'Miền Nam', count: 12, percent: 60, color: 'bg-[#3b82f6]', hex: '#3b82f6' },
    { label: 'Miền Bắc', count: 5, percent: 25, color: 'bg-[#93c5fd]', hex: '#93c5fd' },
    { label: 'Miền Trung', count: 3, percent: 15, color: 'bg-[#1e3a8a]', hex: '#1e3a8a' },
  ]
  const roleBreakdownStatus = [
    { label: 'Hoạt động', count: 18, percent: 90, color: 'bg-[#10b981]', hex: '#10b981' },
    { label: 'Chờ duyệt', count: 2, percent: 10, color: 'bg-[#f59e0b]', hex: '#f59e0b' },
  ]

  const activeBreakdown = allocationFilter === 'Theo khu vực' ? roleBreakdownArea :
                          allocationFilter === 'Theo trạng thái' ? roleBreakdownStatus :
                          roleBreakdownDefault;

  let currentOffset = 0;

  const recentAccounts = accounts.slice(0, 4)

  // --- UI STATES FOR PREVIOUSLY NON-FUNCTIONAL BUTTONS ---
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsForm = useFormValues({ autoRefresh: '5 phút', defaultView: 'Mặc định' })

  const [updateNotesOpen, setUpdateNotesOpen] = useState(false)

  const handleExportData = () => {
    downloadCsv(`tong-quan-he-thong-${Date.now()}.csv`, [
      { 'Chỉ số': 'Tổng tài khoản', 'Giá trị': totalAccounts },
      { 'Chỉ số': 'Đại lý hoạt động', 'Giá trị': activeAgents },
      { 'Chỉ số': 'Nông dân', 'Giá trị': totalFarmers },
    ])
    showToast('Đã xuất báo cáo tổng quan hệ thống')
  }

  const handleSaveSettings = () => {
    showToast('Đã lưu cấu hình bảng điều khiển')
    setSettingsOpen(false)
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-8">
      {/* HEADER ROW */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-normal text-on-surface">Tổng quan hệ thống</h1>
        <p className="text-on-surface-variant text-sm">Chủ nhật, 20 Tháng 9 2026</p>
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center justify-end border-b border-outline-variant/60 pb-2">
        <div className="flex items-center gap-4 text-xs font-medium text-on-surface-variant">
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">refresh</span> Cập nhật 5 phút trước</span>
          <button 
            className="flex items-center gap-1 px-3 py-1.5 border border-outline-variant rounded-md hover:bg-surface-container-lowest bg-white text-on-surface transition-colors"
            onClick={() => setSettingsOpen(true)}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span> Cài đặt
          </button>
          <button 
            className="flex items-center gap-1 px-3 py-1.5 border border-outline-variant rounded-md hover:bg-surface-container-lowest bg-white text-on-surface transition-colors"
            onClick={handleExportData}
          >
            <span className="material-symbols-outlined text-[16px]">download</span> Xuất dữ liệu
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOP CARDS 2x2 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
            <span className="text-sm text-on-surface-variant font-medium">Tổng tài khoản</span>
            <div>
              <div className="text-3xl font-medium text-on-surface">{totalAccounts}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-on-surface-variant">{pendingAccounts > 0 ? `+${pendingAccounts} chờ duyệt tuần này` : 'Không có chờ duyệt'}</span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+8.4%</span>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
            <span className="text-sm text-on-surface-variant font-medium">Đại lý hoạt động</span>
            <div>
              <div className="text-3xl font-medium text-on-surface">{activeAgents}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-on-surface-variant">Trên toàn hệ thống</span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+3.2%</span>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
            <span className="text-sm text-on-surface-variant font-medium">Nông dân</span>
            <div>
              <div className="text-3xl font-medium text-on-surface">{totalFarmers}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-on-surface-variant">Sử dụng ứng dụng</span>
                <span className="text-xs font-semibold text-error bg-error-container/50 px-1.5 py-0.5 rounded">-1.2%</span>
              </div>
            </div>
          </div>
        </div>

        {/* WIDE CARD: ROLE BREAKDOWN & ALERT */}
        <div className="flex flex-col gap-4">
          <div className="p-5 rounded-xl border border-outline-variant bg-white shadow-sm flex flex-col h-32">
            <span className="text-sm text-on-surface-variant font-medium mb-4">Phân bổ tài khoản</span>
            <div className="flex gap-4 h-full">
              {roleBreakdownDefault.map((r, i) => (
                <div key={r.label} className={`flex-1 border-r border-dashed border-outline-variant last:border-r-0 ${i > 0 ? 'pl-4' : ''}`}>
                  <div className="text-xs text-on-surface-variant mb-1">{r.label} - {r.percent}%</div>
                  <div className="text-lg font-medium text-on-surface mb-2">{r.count}</div>
                  <div className={`h-2.5 rounded-full w-full ${r.color}`}></div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-outline-variant bg-white shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
              <div>
                <div className="text-sm font-medium text-on-surface">Cập nhật hệ thống</div>
                <div className="text-xs text-on-surface-variant">Hệ thống AI vừa được huấn luyện thêm 14 tập dữ liệu mới.</div>
              </div>
            </div>
            <button 
              className="text-xs font-medium border border-outline-variant rounded px-3 py-1.5 hover:bg-surface-container-low text-on-surface transition-colors"
              onClick={() => setUpdateNotesOpen(true)}
            >
              Xem chi tiết
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LINE CHART CARD */}
        <div className="lg:col-span-3 p-5 rounded-xl border border-outline-variant bg-white shadow-sm flex flex-col h-[280px]">
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm font-medium text-on-surface">Tổng quan hoạt động AI</span>
            <select 
              className="text-xs border border-outline-variant rounded px-2 py-1 hover:bg-surface-container-low text-on-surface outline-none cursor-pointer bg-white"
              value={chartFilter}
              onChange={e => setChartFilter(e.target.value)}
            >
              <option value="Hôm nay">Hôm nay</option>
              <option value="Hàng tuần">Hàng tuần</option>
              <option value="Hàng tháng">Hàng tháng</option>
            </select>
          </div>
          <div className="flex-1 relative w-full h-full flex items-end">
             {/* Mock Line Chart */}
             <svg viewBox="0 0 500 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
               <path d="M0 80 L30 60 L60 70 L90 40 L120 70 L150 60 L180 40 L210 60 L240 40 L270 30 L300 50 L330 20 L360 40 L390 40 L420 60 L450 30 L480 60 L500 40" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
               <line x1="0" y1="50" x2="500" y2="40" stroke="#c3dac3" strokeWidth="1" strokeDasharray="4 4" />
             </svg>
             <div className="absolute bottom-[-20px] w-full flex justify-between text-[10px] text-outline font-medium">
               <span>Thứ 2</span><span>Thứ 3</span><span>Thứ 4</span><span>Thứ 5</span><span>Thứ 6</span><span>Thứ 7</span><span>CN</span>
             </div>
          </div>
        </div>

        {/* DONUT CHART CARD */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-outline-variant bg-white shadow-sm flex flex-col h-[280px]">
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm font-medium text-on-surface">Tỉ lệ tài khoản</span>
            <select 
              className="text-xs border border-outline-variant rounded px-2 py-1 hover:bg-surface-container-low text-on-surface outline-none cursor-pointer bg-white max-w-[140px] truncate"
              value={allocationFilter}
              onChange={e => setAllocationFilter(e.target.value)}
            >
              <option value="Đại lý / Nông dân">Đại lý / Nông dân</option>
              <option value="Theo khu vực">Theo khu vực</option>
              <option value="Theo trạng thái">Theo trạng thái</option>
            </select>
          </div>
          <div className="flex-1 flex items-center justify-between">
            <div className="relative w-36 h-36 shrink-0">
               <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                 {/* Background circle */}
                 <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#daf0da" strokeWidth="4" />
                 {/* Segments */}
                 {activeBreakdown.map((r, i) => {
                   const offset = -currentOffset;
                   currentOffset += r.percent;
                   return (
                     <path 
                       key={i}
                       d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                       fill="none" 
                       stroke={r.hex} 
                       strokeWidth="4" 
                       strokeDasharray={`${r.percent}, 100`} 
                       strokeDashoffset={offset} 
                     />
                   )
                 })}
               </svg>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <span className="text-[10px] text-on-surface-variant">Tổng số</span>
                 <span className="text-sm font-semibold text-on-surface">{totalAccounts}</span>
               </div>
            </div>
            <div className="flex flex-col gap-3 min-w-[120px]">
              {activeBreakdown.map(r => (
                <div key={r.label}>
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mb-0.5">
                    <div className={`w-1 h-3 rounded-sm ${r.color}`}></div>
                    {r.label}
                  </div>
                  <div className="flex justify-between items-end text-sm">
                    <span className="font-semibold text-on-surface">{r.count}</span>
                    <span className="text-xs font-medium text-on-surface">{r.percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* RECENT ACCOUNTS (Wallet) */}
      <div className="p-5 rounded-xl border border-outline-variant bg-white shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-on-surface">Tài khoản mới nhất</h3>
          <Link to="/accounts" className="text-[11px] text-primary hover:underline font-medium">Xem tất cả</Link>
        </div>
        <div className="flex flex-col gap-4 flex-1">
          {recentAccounts.map(a => (
            <div 
              key={a.id} 
              className="flex items-center justify-between group cursor-pointer"
              onClick={() => navigate('/accounts')}
            >
              <div>
                <div className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">{a.fullName} • {a.phone}</div>
                <div className="inline-block text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded mt-0.5">{a.role}</div>
              </div>
              <div className="w-8 h-8 rounded border border-outline-variant flex items-center justify-center font-bold text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                {a.fullName.charAt(0)}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* DASHBOARD SETTINGS MODAL */}
      <FormModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Cài đặt bảng điều khiển"
        values={settingsForm.values}
        onChange={settingsForm.update}
        onSubmit={handleSaveSettings}
        submitLabel="Lưu cài đặt"
        fields={[
          { key: 'autoRefresh', label: 'Tự động làm mới dữ liệu', type: 'select', options: ['Không bao giờ', '5 phút', '15 phút', '30 phút'] },
          { key: 'defaultView', label: 'Chế độ hiển thị', type: 'select', options: ['Mặc định (Sáng)', 'Thu gọn (Tiết kiệm không gian)'] },
        ]}
      />

      {/* SYSTEM UPDATE DETAIL MODAL */}
      <DetailModal open={updateNotesOpen} onClose={() => setUpdateNotesOpen(false)} widthClassName="max-w-md">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">trending_up</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Cập nhật hệ thống</h2>
              <div className="text-sm text-outline font-medium">Phiên bản: AI Vision v2.4</div>
            </div>
          </div>
          
          <div className="space-y-4 text-sm text-on-surface-variant">
            <p>Hệ thống AI nhận diện bệnh lúa vừa được tự động cập nhật và huấn luyện thêm với <strong>14 tập dữ liệu hình ảnh mới</strong> từ khu vực Đồng Bằng Sông Cửu Long.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Tăng độ chính xác nhận diện Bệnh Đạo Ôn lên 94%.</li>
              <li>Tối ưu tốc độ phản hồi trên các thiết bị di động cũ của nông dân.</li>
              <li>Thêm khả năng nhận diện một số dấu hiệu thiếu dinh dưỡng ở lúa non.</li>
            </ul>
            <div className="mt-4 p-3 bg-surface-container-lowest border border-outline-variant rounded">
              <span className="font-semibold text-on-surface">Thời gian triển khai:</span> 02:00 AM, 20/09/2026<br/>
              <span className="font-semibold text-on-surface">Trạng thái:</span> Ổn định
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button className="px-4 py-2 bg-primary text-white rounded font-medium hover:bg-primary-container transition-colors" onClick={() => setUpdateNotesOpen(false)}>Đã hiểu</button>
          </div>
        </div>
      </DetailModal>
    </div>
  )
}
