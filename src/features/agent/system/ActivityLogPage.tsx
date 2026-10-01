import { useState } from 'react'
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
