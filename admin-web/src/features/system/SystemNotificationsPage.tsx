import { useState } from 'react'

import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import Pagination from '../../components/ui/Pagination'
import FormModal from '../../components/ui/FormModal'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { useFormValues } from '../../hooks/useFormValues'
import * as systemService from '../../services/systemService'
import type { SystemNotification, NotificationStatus, NotificationActionId, NotificationTarget } from '../../types'

export default function SystemNotificationsPage() {
  usePageHeader({ title: 'Thông báo', subtitle: 'Quản lý thông báo đẩy (Push Notifications)' })

  const [notificationList, setNotificationList] = useState<SystemNotification[]>(() => systemService.listNotifications())
  const { showToast } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const createForm = useFormValues({ title: '', content: '', target: 'Tất cả', type: 'Hệ thống', status: 'Bản nháp', scheduledFor: '' })

  const [editTarget, setEditTarget] = useState<SystemNotification | null>(null)
  const editForm = useFormValues({ title: '', content: '', target: 'Tất cả', type: 'Hệ thống', status: 'Bản nháp', scheduledFor: '' })

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredNotifs,
  } = useFilteredList(
    notificationList,
    '',
    (item, keyword, status) =>
      (!keyword ||
        item.title.toLowerCase().includes(keyword.toLowerCase()) ||
        item.content.toLowerCase().includes(keyword.toLowerCase())) &&
      (!status || item.status === (status as NotificationStatus)),
    '',
  )

  const {
    page,
    totalPages,
    paginated: paginatedNotifs,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredNotifs, 12)

  const handleAction = (notif: SystemNotification, actionId: NotificationActionId) => {
    switch (actionId) {
      case 'view':
      case 'edit':
        editForm.reset({ title: notif.title, content: notif.content, target: notif.target, type: notif.type, status: notif.status, scheduledFor: notif.scheduledFor })
        setEditTarget(notif)
        break
      case 'send-now':
        systemService.updateNotificationStatus(notif.id, 'Đã gửi')
        setNotificationList(systemService.listNotifications())
        showToast(`Đã gửi thông báo: ${notif.title}`)
        break
      case 'delete':
        systemService.deleteNotification(notif.id)
        setNotificationList(systemService.listNotifications())
        showToast(`Đã xóa thông báo`)
        break
    }
  }

  const handleCreate = () => {
    const { title, content, target, type, status, scheduledFor } = createForm.values
    systemService.createNotification({ title, content, target: target as NotificationTarget, type: type as any, status: status as NotificationStatus, scheduledFor })
    setNotificationList(systemService.listNotifications())
    showToast(`Đã tạo chiến dịch thông báo: ${title}`)
    setCreateOpen(false)
    createForm.reset({ title: '', content: '', target: 'Tất cả', type: 'Hệ thống', status: 'Bản nháp', scheduledFor: '' })
  }

  const handleEdit = () => {
    if (!editTarget) return
    const { title, content, target, type, status, scheduledFor } = editForm.values
    systemService.updateNotification(editTarget.id, { title, content, target: target as NotificationTarget, type: type as any, status: status as NotificationStatus, scheduledFor })
    setNotificationList(systemService.listNotifications())
    showToast(`Đã cập nhật thông báo: ${title}`)
    setEditTarget(null)
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8 w-full px-2">
      <div className="flex items-start justify-between mt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold text-on-surface">Thông báo Hệ thống</h1>
          <p className="text-on-surface-variant text-sm">Gửi thông báo đẩy (Push Notifications) tới các thiết bị của người dùng.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#171833] hover:bg-black text-white rounded font-medium text-sm shadow-sm transition-colors"
            onClick={() => setCreateOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">campaign</span>
            Tạo thông báo mới
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="relative w-[320px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input 
            type="text" 
            placeholder="Tìm kiếm nội dung thông báo..." 
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-on-surface">
            <span className="text-on-surface-variant font-medium">Trạng thái:</span>
            <select className="bg-transparent font-medium outline-none cursor-pointer border-b border-dashed border-outline-variant pb-0.5" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="Đã gửi">Đã gửi</option>
              <option value="Lên lịch">Lên lịch</option>
              <option value="Bản nháp">Bản nháp</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border border-outline-variant/60 rounded-xl overflow-hidden bg-white shadow-sm mt-2 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container-lowest border-b border-outline-variant/60">
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[20%] uppercase tracking-wider">Tiêu đề</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[35%] uppercase tracking-wider">Nội dung</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Đối tượng</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Thời gian</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[10%] uppercase tracking-wider">Trạng thái</th>
                <th className="py-3 px-2 w-[5%]"></th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/60">
              {filteredNotifs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant">Không tìm thấy thông báo.</td>
                </tr>
              )}
              {paginatedNotifs.map((notif) => {
                return (
                  <tr key={notif.id} className="transition-colors group hover:bg-surface-container-low">
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 
                          ${notif.type === 'Hệ thống' ? 'bg-blue-100 text-blue-700' : notif.type === 'Cảnh báo' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}
                        `}>
                          <span className="material-symbols-outlined text-[20px]">
                            {notif.type === 'Hệ thống' ? 'settings' : notif.type === 'Cảnh báo' ? 'warning' : 'sell'}
                          </span>
                        </div>
                        <div className="font-medium text-on-surface text-sm truncate">{notif.title}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="text-sm text-on-surface-variant truncate max-w-[350px]">
                        {notif.content}
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-outline-variant/60 bg-surface-container-lowest">
                        {notif.target}
                      </span>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center text-on-surface-variant">
                      <div className="flex flex-col gap-0.5">
                        <span>{notif.scheduledFor.split(' ')[0]}</span>
                        <span className="font-mono text-xs">{notif.scheduledFor.split(' ')[1] || ''}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className={`px-2.5 py-1 rounded-md border text-[11px] tracking-wider font-semibold shadow-sm whitespace-nowrap uppercase
                        ${notif.status === 'Đã gửi' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 
                          notif.status === 'Lên lịch' ? 'border-primary/30 text-primary bg-primary/5' : 
                          'border-outline-variant/60 text-on-surface-variant bg-surface-container-lowest'
                        }
                      `}>
                        {notif.status}
                      </span>
                      {notif.status === 'Đã gửi' && (
                        <div className="mt-1 text-[10px] text-on-surface-variant font-mono">
                          {notif.sentCount.toLocaleString()} nhận
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowActionsMenu
                          triggerLabel="Thao tác"
                          actions={systemService.notificationActionsFor(notif.status).map(a => ({ ...a, onClick: () => handleAction(notif, a.id) }))}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-white flex items-center justify-between text-sm text-on-surface-variant border-t border-outline-variant/40">
          <div>Hiển thị {startIndex + 1} đến {endIndex} của {totalCount} thông báo</div>
          <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="" goPrev={goPrev} goNext={goNext} setPage={setPage} />
        </div>
      </div>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo Chiến dịch Thông báo mới"
        values={createForm.values}
        onChange={createForm.update}
        onSubmit={handleCreate}
        submitLabel="Lưu thông báo"
        fields={[
          { key: 'title', label: 'Tiêu đề', placeholder: 'Nhập tiêu đề thông báo...', required: true },
          { key: 'type', label: 'Loại thông báo', type: 'select', options: ['Hệ thống', 'Cảnh báo', 'Khuyến mãi'] },
          { key: 'target', label: 'Đối tượng nhận', type: 'select', options: ['Tất cả', 'Nông dân', 'Đại lý', 'Chuyên gia'] },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ['Bản nháp', 'Lên lịch', 'Đã gửi'] },
          { key: 'scheduledFor', label: 'Thời gian gửi (YYYY-MM-DD HH:mm)', placeholder: '2024-04-10 15:30', type: 'text' },
          { key: 'content', label: 'Nội dung', type: 'text', placeholder: 'Nhập nội dung ngắn...' },
        ]}
      />

      <FormModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `Sửa thông báo: ${editTarget.title}` : 'Sửa thông báo'}
        values={editForm.values}
        onChange={editForm.update}
        onSubmit={handleEdit}
        submitLabel="Lưu thay đổi"
        fields={[
          { key: 'title', label: 'Tiêu đề', placeholder: 'Nhập tiêu đề thông báo...', required: true },
          { key: 'type', label: 'Loại thông báo', type: 'select', options: ['Hệ thống', 'Cảnh báo', 'Khuyến mãi'] },
          { key: 'target', label: 'Đối tượng nhận', type: 'select', options: ['Tất cả', 'Nông dân', 'Đại lý', 'Chuyên gia'] },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ['Bản nháp', 'Lên lịch', 'Đã gửi'] },
          { key: 'scheduledFor', label: 'Thời gian gửi (YYYY-MM-DD HH:mm)', placeholder: '2024-04-10 15:30', type: 'text' },
          { key: 'content', label: 'Nội dung', type: 'text', placeholder: 'Nhập nội dung ngắn...' },
        ]}
      />
    </div>
  )
}
