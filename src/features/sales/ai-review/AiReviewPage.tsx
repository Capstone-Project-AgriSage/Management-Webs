import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, BrainCircuit } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { aiCases as INITIAL_CASES } from '@/features/agent/data/mockAiRecommendations'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

export default function AiReviewPage() {
  usePageHeader({ title: 'AI Review', subtitle: 'Phê duyệt gợi ý bán hàng từ AI' })
  const [cases] = useState(INITIAL_CASES)
  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(cases, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/sales">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Đánh giá AI</span>
      </nav>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4">Gợi ý AI</th>
                <th className="py-3 px-3">Nông dân</th>
                <th className="py-3 px-3">Độ tin cậy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="py-4 px-4 font-medium">{c.diseaseLabel}</td>
                  <td className="py-4 px-3">{c.farmerName}</td>
                  <td className="py-4 px-3 text-xs font-bold text-emerald-600">{c.confidencePercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="gợi ý" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
