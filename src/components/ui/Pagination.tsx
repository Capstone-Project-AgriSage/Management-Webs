import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  startIndex: number
  endIndex: number
  totalCount: number
  unitLabel: string
  goPrev: () => void
  goNext: () => void
  setPage: (page: number) => void
}

export default function Pagination({ page, totalPages, startIndex, endIndex, totalCount, unitLabel, goPrev, goNext, setPage }: PaginationProps) {
  return (
    <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 font-medium select-none bg-white">
      <div>
        Hiển thị <span className="font-semibold text-slate-900">{totalCount === 0 ? 0 : startIndex + 1} - {endIndex}</span> trong số{' '}
        <span className="font-semibold text-slate-900">{totalCount}</span> {unitLabel}
      </div>
      <div className="flex items-center gap-1">
        <button
          className="h-7 px-2 rounded border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-1 disabled:opacity-40 transition-colors"
          onClick={goPrev}
          disabled={page === 1}
          type="button"
        >
          <ChevronLeft size={14} />
          <span className="text-[11px] font-semibold">Trước</span>
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
          <button
            key={pageNumber}
            onClick={() => setPage(pageNumber)}
            type="button"
            className={
              pageNumber === page
                ? 'h-7 w-7 rounded bg-emerald-600 text-white font-semibold text-[11px] flex items-center justify-center transition-colors'
                : 'h-7 w-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-[11px] flex items-center justify-center transition-colors'
            }
          >
            {pageNumber}
          </button>
        ))}
        <button
          className="h-7 px-2 rounded border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-1 disabled:opacity-40 transition-colors"
          onClick={goNext}
          disabled={page === totalPages}
          type="button"
        >
          <span className="text-[11px] font-semibold">Sau</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
