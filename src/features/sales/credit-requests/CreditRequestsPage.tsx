import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { mockCreditRequests as INITIAL_REQUESTS } from '@/features/agent/data/mockDebts'
import { formatVndShort } from '@/utils/money'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

export default function CreditRequestsPage() {
  usePageHeader({ title: 'Yêu cầu mua chịu', subtitle: 'Theo dõi yêu cầu mua chịu của nông dân' })
  const [requests] = useState(INITIAL_REQUESTS)
  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(requests, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/sales">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Mua chịu mùa vụ</span>
      </nav>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-3 text-right">Số tiền yêu cầu</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-4 px-4 font-medium">{r.farmerName}</td>
                  <td className="py-4 px-3 text-right font-mono font-semibold">{formatVndShort(r.requestedAmount)}</td>
                  <td className="py-4 px-3 text-center text-xs font-bold">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="yêu cầu" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
