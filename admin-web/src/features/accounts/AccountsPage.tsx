import { useState } from 'react'

import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import DetailModal from '../../components/ui/DetailModal'
import FormModal from '../../components/ui/FormModal'
import Pagination from '../../components/ui/Pagination'
import { useSelectableList } from '../../hooks/useSelectableList'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { useFormValues } from '../../hooks/useFormValues'
import * as accountsService from '../../services/accountsService'
import { downloadCsv } from '../../utils/csv'
import type { Account, AccountActionId, AccountRole, AccountStatus } from '../../types'

export default function AccountsPage() {
  usePageHeader({ title: '', subtitle: '' })

  const [accountList, setAccountList] = useState<Account[]>(() => accountsService.list())
  const { showToast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const createForm = useFormValues({ fullName: '', email: '', phone: '', role: 'Đại lý', region: '' })

  const [roleChangeTarget, setRoleChangeTarget] = useState<Account | null>(null)
  const roleChangeForm = useFormValues({ role: 'Đại lý' })

  const [roleFilter, setRoleFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredAccounts,
  } = useFilteredList(
    accountList,
    '',
    (item, keyword, status) =>
      (!keyword ||
        item.id.toLowerCase().includes(keyword) ||
        item.fullName.toLowerCase().includes(keyword) ||
        item.email.toLowerCase().includes(keyword) ||
        item.phone.includes(keyword)) &&
      (!status || item.status === (status as AccountStatus)) &&
      (!roleFilter || item.role === (roleFilter as AccountRole)) &&
      (!regionFilter || item.region === regionFilter),
    '',
  )

  const {
    page,
    totalPages,
    paginated: paginatedAccounts,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredAccounts, 12)

  const { selectedId, setSelectedId, selected } = useSelectableList(accountList, (a) => a.id)

  const totalAccounts = accountList.length
  const activeCount = accountList.filter((a) => a.status === 'Đang hoạt động').length
  const lockedCount = accountList.filter((a) => a.status === 'Bị khóa').length
  const pendingAccounts = accountList.filter((a) => a.status === 'Chờ duyệt')
  const pendingCount = pendingAccounts.length

  const setAccountStatus = (id: string, status: AccountStatus, logNote: string, toastMessage: string) => {
    accountsService.setStatus(id, status, logNote)
    setAccountList(accountsService.list())
    showToast(toastMessage)
  }

  const handleAccountAction = (account: Account, actionId: AccountActionId) => {
    switch (actionId) {
      case 'view':
        setSelectedId(account.id)
        break
      case 'lock':
        setAccountStatus(account.id, 'Bị khóa', 'Khóa tài khoản', `Đã khóa tài khoản ${account.fullName}`)
        break
      case 'unlock':
        setAccountStatus(account.id, 'Đang hoạt động', 'Mở khóa tài khoản', `Đã mở khóa tài khoản ${account.fullName}`)
        break
      case 'approve':
        setAccountStatus(account.id, 'Đang hoạt động', 'Phê duyệt tài khoản', `Đã phê duyệt tài khoản ${account.fullName}`)
        break
      case 'reject':
        setAccountStatus(account.id, 'Bị khóa', 'Từ chối đăng ký', `Đã từ chối đăng ký của ${account.fullName}`)
        break
      case 'reset-password':
        accountsService.resetPassword(account.id)
        showToast(`Đã gửi email đặt lại mật khẩu cho ${account.email}`)
        break
      case 'change-role':
        roleChangeForm.reset({ role: account.role })
        setRoleChangeTarget(account)
        break
    }
  }

  const handleChangeRole = () => {
    if (!roleChangeTarget) return
    const newRole = roleChangeForm.values.role as AccountRole
    accountsService.setRole(roleChangeTarget.id, newRole)
    setAccountList(accountsService.list())
    showToast(`Đã đổi vai trò của ${roleChangeTarget.fullName} thành "${newRole}"`)
    setRoleChangeTarget(null)
  }

  const handleCreateAccount = () => {
    const { fullName, email, phone, role, region } = createForm.values
    accountsService.create({ fullName, email, phone, role: role as AccountRole, region })
    setAccountList(accountsService.list())
    showToast(`Đã tạo tài khoản mới cho ${fullName}`)
    setCreateOpen(false)
    createForm.reset({ fullName: '', email: '', phone: '', role: 'Đại lý', region: '' })
  }

  const mapAccessLevel = (role: string) => {
    if (role === 'Admin') return 'Full'
    if (role === 'Store Owner') return 'Scoped'
    return 'Read only'
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8 w-full px-2">
      {/* HEADER ROW */}
      <div className="flex items-start justify-between mt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold text-on-surface">Quản lý tài khoản</h1>
          <p className="text-on-surface-variant text-sm">Quản lý quyền truy cập và tài khoản trên toàn bộ hệ thống Agrisage.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-1.5 px-3 py-1.5 border border-outline-variant rounded bg-white hover:bg-surface-container-low text-on-surface font-medium text-sm shadow-sm"
            onClick={() => downloadCsv('tai-khoan.csv', filteredAccounts.map(a => ({
              ID: a.id,
              'Họ và tên': a.fullName,
              Email: a.email,
              'SĐT': a.phone,
              'Vai trò': a.role,
              'Trạng thái': a.status,
              'Ngày tạo': a.createdAt
            })))}
          >
            <span className="material-symbols-outlined text-[16px]">download</span> Xuất danh sách
          </button>
          <button 
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#171833] hover:bg-black text-white rounded font-medium text-sm shadow-sm transition-colors"
            onClick={() => setCreateOpen(true)}
          >
            Tạo tài khoản mới
          </button>
        </div>
      </div>



      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Tổng số tài khoản</span>
          <div>
            <div className="text-3xl font-medium text-on-surface">{totalAccounts}</div>
            <div className="text-xs text-on-surface-variant mt-1">Đại lý, nông dân, quản trị viên</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Đang hoạt động</span>
          <div>
            <div className="text-3xl font-medium text-emerald-700">{activeCount}</div>
            <div className="text-xs text-emerald-700/80 mt-1">Hệ thống ghi nhận bình thường</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border-2 border-amber-400/80 bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-amber-700 font-medium">Chờ duyệt</span>
          <div>
            <div className="text-3xl font-medium text-on-surface">{pendingCount}</div>
            <div className="text-xs text-amber-700 mt-1">Cần xem xét ngay</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Bị khóa</span>
          <div>
            <div className="text-3xl font-medium text-on-surface">{lockedCount}</div>
            <div className="text-xs text-on-surface-variant mt-1">Vi phạm hoặc tạm khóa</div>
          </div>
        </div>
      </div>

      {/* ALERT BANNER */}
      {pendingCount > 0 && (
        <div className="bg-[#fff9e6] border border-[#fce69a] rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
            <span className="text-sm font-medium text-amber-900">Yêu cầu phê duyệt</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-amber-800">{pendingCount} tài khoản mới đang chờ phê duyệt. Vui lòng sử dụng bộ lọc "Trạng thái: Chờ duyệt" để xem.</span>
          </div>
        </div>
      )}

      {/* TOOLBAR */}
      <div className="flex items-center justify-between mt-2">
        <div className="relative w-[320px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input 
            type="text" 
            placeholder="Tìm kiếm tài khoản..." 
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-on-surface">
            <span className="text-on-surface-variant font-medium">Vai trò:</span>
            <select className="bg-transparent font-medium outline-none cursor-pointer border-b border-dashed border-outline-variant pb-0.5" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="Admin">Quản trị viên</option>
              <option value="Store Owner">Chủ cửa hàng</option>
              <option value="Sales Staff">NV Bán hàng</option>
              <option value="Delivery Staff">NV Giao hàng</option>
              <option value="Farmer">Nông dân</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm text-on-surface">
            <span className="text-on-surface-variant font-medium">Khu vực:</span>
            <select className="bg-transparent font-medium outline-none cursor-pointer border-b border-dashed border-outline-variant pb-0.5" value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="Cần Thơ">Cần Thơ</option>
              <option value="Đồng Tháp">Đồng Tháp</option>
              <option value="Hà Nội">Hà Nội</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm text-on-surface">
            <span className="text-on-surface-variant font-medium">Trạng thái:</span>
            <select className="bg-transparent font-medium outline-none cursor-pointer border-b border-dashed border-outline-variant pb-0.5" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="Đang hoạt động">Đang hoạt động</option>
              <option value="Chờ duyệt">Chờ duyệt</option>
              <option value="Bị khóa">Bị khóa</option>
            </select>
          </div>
        </div>
      </div>

      {/* FLAT DATA TABLE */}
      <div className="border border-outline-variant/60 rounded-xl overflow-hidden bg-white shadow-sm mt-2 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container-lowest border-b border-outline-variant/60">
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[25%] uppercase tracking-wider">Tài khoản</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[10%] uppercase tracking-wider">Vai trò</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[8%] uppercase tracking-wider">Cấp bậc</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[20%] uppercase tracking-wider">Thông tin liên hệ</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[12%] uppercase tracking-wider">Ngày tạo</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[12%] uppercase tracking-wider">Khu vực</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[10%] uppercase tracking-wider">Trạng thái</th>
                <th className="py-3 px-2 w-[3%]"></th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/60">
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-on-surface-variant">Không tìm thấy tài khoản phù hợp với bộ lọc.</td>
                </tr>
              )}
              {paginatedAccounts.map((account) => {
                const isSelected = account.id === selectedId
                return (
                  <tr key={account.id} className={`transition-colors group hover:bg-surface-container-low ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {account.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div 
                            className="font-medium text-on-surface text-sm cursor-pointer hover:underline truncate"
                            onClick={() => setSelectedId(account.id)}
                          >
                            {account.fullName}
                          </div>
                          <div className="text-[11px] text-outline font-mono mt-0.5 truncate">#{account.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className="text-xs font-medium text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">{account.role}</span>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className="px-2.5 py-1 rounded-md border border-outline-variant/60 text-xs font-medium text-on-surface bg-white shadow-sm whitespace-nowrap">
                        {mapAccessLevel(account.role)}
                      </span>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                          <span className="material-symbols-outlined text-[14px]">mail</span>
                          <span className="truncate max-w-[140px]">{account.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-mono">
                          <span className="material-symbols-outlined text-[14px]">call</span>
                          <span>{account.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center text-sm text-on-surface-variant whitespace-nowrap">
                      {account.createdAt}
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center text-sm text-on-surface font-medium">
                      {account.region || 'Hệ thống'}
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className={`px-2.5 py-1 rounded-md border text-[11px] uppercase tracking-wider font-semibold bg-white shadow-sm whitespace-nowrap
                        ${account.status === 'Chờ duyệt' ? 'border-amber-400 text-amber-700' : ''}
                        ${account.status === 'Đang hoạt động' ? 'border-outline-variant/60 text-on-surface' : ''}
                        ${account.status === 'Bị khóa' ? 'border-error/40 text-error' : ''}
                      `}>
                        {account.status === 'Chờ duyệt' ? 'Needs review' : account.status === 'Đang hoạt động' ? 'Active' : 'Locked'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowActionsMenu
                          triggerLabel="Thao tác"
                          actions={accountsService.actionsFor(account.status, account.role).map(a => ({ ...a, onClick: () => handleAccountAction(account, a.id) }))}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {/* FOOTER PAGINATION */}
        <div className="px-4 py-3 bg-white flex items-center justify-between text-sm text-on-surface-variant">
          <div>
            Hiển thị {startIndex + 1} đến {endIndex} của {totalCount} tài khoản
          </div>
          <div className="flex items-center gap-6">
            <Pagination
              page={page}
              totalPages={totalPages}
              startIndex={startIndex}
              endIndex={endIndex}
              totalCount={totalCount}
              unitLabel=""
              goPrev={goPrev}
              goNext={goNext}
              setPage={setPage}
            />
          </div>
        </div>
      </div>

      {/* CREATE ACCOUNT MODAL */}
      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo tài khoản mới"
        values={createForm.values}
        onChange={createForm.update}
        onSubmit={handleCreateAccount}
        submitLabel="Tạo tài khoản"
        fields={[
          { key: 'fullName', label: 'Họ và tên', placeholder: 'Nguyễn Văn A', group: 'name' },
          { key: 'phone', label: 'Số điện thoại', placeholder: '09xx xxx xxx', group: 'name' },
          { key: 'email', label: 'Email', placeholder: 'ten@agrisage.vn', group: 'contact' },
          { key: 'role', label: 'Vai trò', type: 'select', options: ['Admin', 'Store Owner', 'Sales Staff', 'Delivery Staff', 'Farmer'], group: 'contact' },
          { key: 'region', label: 'Khu vực / Địa chỉ', placeholder: 'VD: Cần Thơ' },
        ]}
      />

      {/* CHANGE ROLE MODAL */}
      <FormModal
        open={roleChangeTarget !== null}
        onClose={() => setRoleChangeTarget(null)}
        title={roleChangeTarget ? `Đổi vai trò — ${roleChangeTarget.fullName}` : 'Đổi vai trò'}
        values={roleChangeForm.values}
        onChange={roleChangeForm.update}
        onSubmit={handleChangeRole}
        submitLabel="Xác nhận đổi vai trò"
        fields={[
          { key: 'role', label: 'Vai trò mới', type: 'select', options: ['Admin', 'Store Owner', 'Sales Staff', 'Delivery Staff', 'Farmer'] },
        ]}
      />
      
      {/* DETAIL MODAL */}
      <DetailModal open={selected !== null} onClose={() => setSelectedId(null)} widthClassName="max-w-md">
        {selected && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-lg shrink-0">
                {selected.fullName.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-on-surface">{selected.fullName}</h2>
                <div className="text-sm text-outline font-mono">#{selected.id}</div>
              </div>
            </div>
            
            <div className="space-y-4 text-sm text-on-surface">
              <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant font-medium">Trạng thái:</span>
                <span className={`px-2.5 py-1 rounded font-semibold text-xs border ${
                  selected.status === 'Chờ duyệt' ? 'border-amber-400 text-amber-700 bg-amber-50' : 
                  selected.status === 'Đang hoạt động' ? 'border-outline-variant/60 text-on-surface bg-surface-container-lowest' : 'border-error/40 text-error bg-error/5'
                }`}>{selected.status}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant font-medium">Vai trò:</span>
                <span>{selected.role}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant font-medium">Khu vực:</span>
                <span>{selected.region}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant font-medium">Email:</span>
                <span>{selected.email}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant font-medium">Số ĐT:</span>
                <span className="font-mono">{selected.phone}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant font-medium">Ngày tham gia:</span>
                <span>{selected.createdAt}</span>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button className="px-4 py-2 bg-surface-container-low text-on-surface rounded font-medium hover:bg-outline-variant/50 transition-colors" onClick={() => setSelectedId(null)}>Đóng</button>
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  )
}
