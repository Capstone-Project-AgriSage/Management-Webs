import { useState, useMemo } from 'react'

import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import DetailModal from '../../components/ui/DetailModal'
import Pagination from '../../components/ui/Pagination'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import * as systemService from '../../services/systemService'
import type { AuditLog, AuditLogLevel, AuditLogActionId } from '../../types'

export default function AuditLogsPage() {
  usePageHeader({ title: 'Nhật ký hệ thống (Audit Logs)', subtitle: 'Theo dõi các hoạt động của Quản trị viên và Lỗi hệ thống' })

  const [logList] = useState<AuditLog[]>(() => systemService.listAuditLogs())
  const { showToast } = useToast()

  const [timeFilter, setTimeFilter] = useState('7days')
  const [detailTarget, setDetailTarget] = useState<AuditLog | null>(null)

  // Giả lập lọc thời gian (vì dữ liệu mock đều nằm trong 1 ngày)
  const timeFilteredLogs = useMemo(() => {
    if (timeFilter === 'all') return logList
    // Giả lập luôn trả về all vì dữ liệu mock toàn bộ là ngày hôm nay.
    return logList
  }, [logList, timeFilter])

  const {
    search,
    setSearch,
    statusFilter: levelFilter,
    setStatusFilter: setLevelFilter,
    filtered: filteredLogs,
  } = useFilteredList(
    timeFilteredLogs,
    '',
    (item, keyword, level) =>
      (!keyword ||
        item.actor.toLowerCase().includes(keyword.toLowerCase()) ||
        item.targetResource.toLowerCase().includes(keyword.toLowerCase()) ||
        item.action.toLowerCase().includes(keyword.toLowerCase())) &&
      (!level || item.level === (level as AuditLogLevel)),
    '',
  )

  const {
    page,
    totalPages,
    paginated: paginatedLogs,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredLogs, 15) // Show more items per page for logs

  const handleAction = (log: AuditLog, actionId: AuditLogActionId) => {
    if (actionId === 'view-details') {
      setDetailTarget(log)
    }
  }

  const exportCsv = () => {
    if (filteredLogs.length === 0) {
      showToast('Không có dữ liệu để xuất!')
      return
    }
    const headers = ['ID', 'Thời gian', 'Mức độ', 'Người thực hiện', 'Hành động', 'Tài nguyên', 'IP']
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => 
        [log.id, log.timestamp, log.level, `"${log.actor}"`, `"${log.action}"`, `"${log.targetResource}"`, log.ipAddress].join(',')
      )
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit_logs_${new Date().getTime()}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast('Đã xuất file CSV thành công!')
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8 w-full px-2">
      <div className="flex items-start justify-between mt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold text-on-surface">Nhật ký Hệ thống</h1>
          <p className="text-on-surface-variant text-sm">Lưu vết (tracking) mọi thao tác thay đổi dữ liệu của Admin và cảnh báo hệ thống.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-outline-variant rounded bg-white hover:bg-surface-container-low text-on-surface font-medium text-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">download</span> Xuất CSV
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="relative w-[400px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input 
            type="text" 
            placeholder="Tìm kiếm tài khoản, hành động hoặc tài nguyên..." 
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-on-surface">
            <span className="text-on-surface-variant font-medium">Mức độ:</span>
            <select className="bg-transparent font-medium outline-none cursor-pointer border-b border-dashed border-outline-variant pb-0.5" value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="Info">Info (Thông tin)</option>
              <option value="Warning">Warning (Cảnh báo)</option>
              <option value="Error">Error (Lỗi)</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm text-on-surface">
            <span className="text-on-surface-variant font-medium">Thời gian:</span>
            <select className="bg-transparent font-medium outline-none cursor-pointer border-b border-dashed border-outline-variant pb-0.5" value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
              <option value="7days">7 ngày qua</option>
              <option value="30days">30 ngày qua</option>
              <option value="all">Tất cả</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border border-outline-variant/60 rounded-xl overflow-hidden bg-white shadow-sm mt-2 flex flex-col font-mono">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant/60">
                <th className="py-2.5 px-4 font-semibold text-xs text-on-surface-variant border-r border-outline-variant/40 w-[15%] uppercase tracking-wider">Thời gian</th>
                <th className="py-2.5 px-4 font-semibold text-xs text-on-surface-variant border-r border-outline-variant/40 w-[10%] uppercase tracking-wider text-center">Mức độ</th>
                <th className="py-2.5 px-4 font-semibold text-xs text-on-surface-variant border-r border-outline-variant/40 w-[25%] uppercase tracking-wider">Người thực hiện (Actor)</th>
                <th className="py-2.5 px-4 font-semibold text-xs text-on-surface-variant border-r border-outline-variant/40 w-[15%] uppercase tracking-wider text-center">Hành động</th>
                <th className="py-2.5 px-4 font-semibold text-xs text-on-surface-variant border-r border-outline-variant/40 w-[25%] uppercase tracking-wider">Tài nguyên (Target)</th>
                <th className="py-2.5 px-4 font-semibold text-xs text-on-surface-variant border-r border-outline-variant/40 w-[10%] uppercase tracking-wider text-center">IP</th>
                <th className="py-2.5 px-2 w-[5%]"></th>
              </tr>
            </thead>
            <tbody className="text-[13px] divide-y divide-outline-variant/40">
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant font-sans">Không tìm thấy nhật ký phù hợp.</td>
                </tr>
              )}
              {paginatedLogs.map((log) => {
                return (
                  <tr key={log.id} className="transition-colors group hover:bg-surface-container-low">
                    <td className="py-2 px-4 border-r border-outline-variant/40 text-on-surface-variant whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-2 px-4 border-r border-outline-variant/40 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider
                        ${log.level === 'Info' ? 'bg-blue-100 text-blue-700' : 
                          log.level === 'Warning' ? 'bg-amber-100 text-amber-700' : 
                          'bg-error/10 text-error'
                        }
                      `}>
                        {log.level}
                      </span>
                    </td>
                    <td className="py-2 px-4 border-r border-outline-variant/40 text-on-surface truncate">
                      {log.actor}
                    </td>
                    <td className="py-2 px-4 border-r border-outline-variant/40 text-center text-primary font-medium">
                      {log.action}
                    </td>
                    <td className="py-2 px-4 border-r border-outline-variant/40 text-on-surface truncate">
                      {log.targetResource}
                    </td>
                    <td className="py-2 px-4 border-r border-outline-variant/40 text-center text-on-surface-variant">
                      {log.ipAddress}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowActionsMenu
                          triggerLabel="Log"
                          actions={systemService.auditLogActionsFor().map(a => ({ ...a, onClick: () => handleAction(log, a.id) }))}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-white flex items-center justify-between text-xs text-on-surface-variant border-t border-outline-variant/40 font-sans">
          <div>Hiển thị {startIndex + 1} đến {endIndex} của {totalCount} logs</div>
          <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="" goPrev={goPrev} goNext={goNext} setPage={setPage} />
        </div>
      </div>

      <DetailModal open={detailTarget !== null} onClose={() => setDetailTarget(null)} widthClassName="max-w-2xl">
        {detailTarget && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-on-surface mb-2">Chi tiết Audit Log</h2>
            <div className="text-sm text-outline font-mono mb-6">Mã tham chiếu: {detailTarget.id}</div>
            
            <div className="bg-[#1e1e1e] rounded-lg p-4 font-mono text-sm overflow-x-auto text-green-400">
              <pre>
{`{
  "eventId": "${detailTarget.id}",
  "timestamp": "${detailTarget.timestamp}",
  "level": "${detailTarget.level}",
  "actor": {
    "identity": "${detailTarget.actor}",
    "ipAddress": "${detailTarget.ipAddress}",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
  },
  "action": {
    "type": "${detailTarget.action}",
    "status": "SUCCESS"
  },
  "target": {
    "resourceType": "System Resource",
    "resourceId": "${detailTarget.targetResource}"
  },
  "metadata": {
    "session_id": "sess_8f9a2b1c4d",
    "request_id": "req_559902a21b",
    "location": "Ho Chi Minh City, VN"
  }
}`}
              </pre>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button className="px-4 py-2 bg-surface-container-low text-on-surface rounded font-medium hover:bg-outline-variant/50 transition-colors" onClick={() => setDetailTarget(null)}>Đóng</button>
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  )
}
