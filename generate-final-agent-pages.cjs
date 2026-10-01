const fs = require('fs');
const path = require('path');

const seasonalCreditContent = `import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, AccountBalanceWallet, Clock, CheckCircle2, RefreshCw } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { usePagination } from '@/hooks/usePagination'
import { mockCreditRequests as INITIAL_REQUESTS } from '@/features/agent/data/mockDebts'
import { formatVndShort } from '@/utils/money'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' }
]

function getStatusBadge(status: string) {
  switch (status) {
    case 'PENDING_APPROVAL': return { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'APPROVED': return { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'REJECTED': return { label: 'Từ chối', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    default: return { label: status, className: 'bg-slate-100 text-slate-600' }
  }
}

export default function SeasonalCreditPage() {
  usePageHeader({ title: 'Mua chịu (Seasonal)', subtitle: 'Phê duyệt hạn mức mua chịu nông dân' })
  const { showToast } = useToast()
  const [requests] = useState(INITIAL_REQUESTS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái')

  const keyword = search.trim().toLowerCase()
  const filtered = requests.filter((r) => {
    const matchesSearch =
      !keyword ||
      r.id.toLowerCase().includes(keyword) ||
      r.farmerName.toLowerCase().includes(keyword) ||
      r.orderCode.toLowerCase().includes(keyword)

    const filterObj = STATUS_OPTIONS.find(opt => opt.label === statusFilter)
    const filterVal = filterObj ? filterObj.value : 'ALL'
    const matchesStatus = filterVal === 'ALL' || r.status === filterVal

    return matchesSearch && matchesStatus
  })

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filtered, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Mua chịu mùa vụ</span>
        </nav>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng yêu cầu</span>
            <div className="p-2.5 bg-slate-100 rounded-lg text-emerald-600">
              <AccountBalanceWallet size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{requests.length}</div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Chờ duyệt</span>
            <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 tabular-nums">{requests.filter(r => r.status === 'PENDING_APPROVAL').length}</div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã, nông dân..." className="relative flex-1 max-w-md" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS.map(o => o.label)} className="relative min-w-[200px]" />
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Mã YC / Thời gian</th>
                <th className="py-3 px-3" scope="col">Khách hàng</th>
                <th className="py-3 px-3 text-right" scope="col">Số tiền (VNĐ)</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-4 text-center w-28" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? <EmptyTableRow colSpan={5} message="Không có yêu cầu mua chịu nào." /> : null}
              {paginated.map((r) => {
                const badge = getStatusBadge(r.status)
                return (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-mono font-semibold text-slate-900">{r.id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{r.createdAt}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-700">{r.farmerName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Đơn: {r.orderCode}</div>
                    </td>
                    <td className="py-4 px-3 text-right">
                      <span className="font-mono font-semibold text-slate-900">{formatVndShort(r.requestedAmount)}</span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className={\`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border \${badge.className}\`}>{badge.label}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <RowActionsMenu
                        triggerLabel="Thao tác"
                        actions={[
                          { label: 'Phê duyệt', icon: 'check', onClick: () => showToast('Đã phê duyệt') },
                          { label: 'Từ chối', icon: 'close', onClick: () => showToast('Đã từ chối') }
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="yêu cầu" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
`

const reviewsContent = `import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Star, RefreshCw } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { usePagination } from '@/hooks/usePagination'
import { productReviews as INITIAL_REVIEWS } from '@/features/agent/data/mockReviews'

const STATUS_OPTIONS = ['Tất cả trạng thái', 'VISIBLE', 'HIDDEN']

export default function ProductReviewsPage() {
  usePageHeader({ title: 'Đánh giá sản phẩm', subtitle: 'Phản hồi từ nông dân' })
  const { showToast } = useToast()
  const [reviews] = useState(INITIAL_REVIEWS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái')

  const keyword = search.trim().toLowerCase()
  const filtered = reviews.filter((r) => {
    const matchesSearch = !keyword || r.productName.toLowerCase().includes(keyword) || r.farmerName.toLowerCase().includes(keyword)
    const matchesStatus = statusFilter === 'Tất cả trạng thái' || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(filtered, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Đánh giá sản phẩm</span>
      </nav>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng đánh giá</span>
            <Star size={20} className="text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">{reviews.length}</div>
        </div>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm sản phẩm, nông dân..." className="relative flex-1 max-w-md" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[200px]" />
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Sản phẩm / Nông dân</th>
                <th className="py-3 px-3" scope="col">Đánh giá</th>
                <th className="py-3 px-3" scope="col">Nội dung</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-4 text-center w-28" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? <EmptyTableRow colSpan={5} message="Không có đánh giá nào." /> : null}
              {paginated.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-900">{r.productName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{r.farmerName}</div>
                  </td>
                  <td className="py-4 px-3 flex text-amber-500">
                    {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={i < r.rating ? 'currentColor' : 'none'} />)}
                  </td>
                  <td className="py-4 px-3">
                    <div className="text-slate-700">{r.comment}</div>
                    {r.reply && <div className="mt-1 text-xs text-emerald-700 bg-emerald-50 p-2 rounded line-clamp-2">{r.reply}</div>}
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span className={\`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold \${r.status === 'VISIBLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}\`}>{r.status}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <RowActionsMenu triggerLabel="Thao tác" actions={r.actions.map(a => ({ ...a, onClick: () => showToast(\`Đã thực hiện: \${a.label}\`) }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="đánh giá" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
`

const staffContent = `import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Users, Plus, RefreshCw } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { usePagination } from '@/hooks/usePagination'
import { staffMembers as INITIAL_STAFF } from '@/features/agent/data/mockStaff'

export default function StaffPage() {
  usePageHeader({ title: 'Quản lý nhân sự', subtitle: 'Danh sách và phân quyền nhân viên' })
  const { showToast } = useToast()
  const [staff] = useState(INITIAL_STAFF)
  const [search, setSearch] = useState('')

  const keyword = search.trim().toLowerCase()
  const filtered = staff.filter((s) =>
    !keyword || s.name.toLowerCase().includes(keyword) || s.phone.toLowerCase().includes(keyword)
  )

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(filtered, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Nhân sự</span>
        </nav>
        <button
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          type="button"
          onClick={() => showToast('Mở form thêm nhân sự mới')}
        >
          <Plus size={16} />
          <span>Thêm nhân sự</span>
        </button>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên, số điện thoại..." className="relative flex-1 max-w-md" />
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Họ tên / SĐT</th>
                <th className="py-3 px-3" scope="col">Vai trò</th>
                <th className="py-3 px-3" scope="col">Ngày tham gia</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-4 text-center w-28" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? <EmptyTableRow colSpan={5} message="Không có nhân sự nào." /> : null}
              {paginated.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="font-mono text-xs text-slate-500 mt-0.5">{s.phone}</div>
                  </td>
                  <td className="py-4 px-3">
                    <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">{s.role}</span>
                  </td>
                  <td className="py-4 px-3 text-slate-600 text-xs">{s.joinedAt.substring(0, 10)}</td>
                  <td className="py-4 px-3 text-center">
                    <span className={\`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold \${s.status === 'Đang làm việc' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}\`}>{s.status}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <RowActionsMenu triggerLabel="Thao tác" actions={s.actions.map(a => ({ ...a, onClick: () => showToast(\`Đã thực hiện: \${a.label}\`) }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="nhân sự" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
`

const activityLogContent = `import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, History } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { usePagination } from '@/hooks/usePagination'
import { logEntries as INITIAL_LOGS } from '@/features/agent/data/mockActivityLog'
import Pagination from '@/components/ui/Pagination'

export default function ActivityLogPage() {
  usePageHeader({ title: 'Nhật ký hoạt động', subtitle: 'Lịch sử thao tác trên hệ thống' })
  const [logs] = useState(INITIAL_LOGS)
  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(logs, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Nhật ký hoạt động</span>
      </nav>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-center gap-2 text-slate-700 font-semibold mb-4 border-b border-slate-100 pb-2">
          <History size={18} /> Nhật ký hệ thống
        </div>
        <div className="space-y-4">
          {paginated.map(log => (
            <div key={log.id} className="flex gap-4 border-b border-slate-50 pb-4 last:border-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-xs bg-slate-100 text-slate-700">
                {log.actorInitials}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{log.actorName} <span className="text-xs font-normal text-slate-500">({log.actorRole})</span></div>
                <div className="text-[13px] text-slate-700 mt-1">{log.description}</div>
                <div className="text-[11px] text-slate-400 mt-1">{log.time} - {log.timeNote}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-2">
          <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="nhật ký" goPrev={goPrev} goNext={goNext} setPage={setPage} />
        </div>
      </div>
    </div>
  )
}
`

const settingsContent = `import { Link } from 'react-router-dom'
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
`

const files = [
  { path: 'src/features/agent/debts/SeasonalCreditPage.tsx', content: seasonalCreditContent },
  { path: 'src/features/agent/products/ProductReviewsPage.tsx', content: reviewsContent },
  { path: 'src/features/agent/staff/StaffPage.tsx', content: staffContent },
  { path: 'src/features/agent/system/ActivityLogPage.tsx', content: activityLogContent },
  { path: 'src/features/agent/system/SettingsPage.tsx', content: settingsContent }
]

files.forEach(f => {
  const fullPath = path.join(__dirname, f.path);
  fs.writeFileSync(fullPath, f.content, 'utf8');
  console.log('Written: ' + f.path);
});
