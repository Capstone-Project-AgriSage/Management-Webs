import { ChevronLeft, ChevronRight } from 'lucide-react';

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

function getPageItems(page: number, totalPages: number): (number | 'start-ellipsis' | 'end-ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const start = page <= 4 ? 2 : page >= totalPages - 3 ? totalPages - 4 : page - 1
  const end = page <= 4 ? 5 : page >= totalPages - 3 ? totalPages - 1 : page + 1
  const items: (number | 'start-ellipsis' | 'end-ellipsis')[] = [1]

  if (start > 2) items.push('start-ellipsis')
  for (let pageNumber = start; pageNumber <= end; pageNumber++) items.push(pageNumber)
  if (end < totalPages - 1) items.push('end-ellipsis')
  items.push(totalPages)

  return items
}

export default function Pagination({ page, totalPages, startIndex, endIndex, totalCount, unitLabel, goPrev, goNext, setPage }: PaginationProps) {
  return (
    <div className="agrisage-pagination min-w-0 px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium select-none bg-white">
      <div className="shrink-0 max-w-full text-center sm:text-left leading-5">
        Hiển thị <span className="font-semibold text-slate-900">{totalCount === 0 ? 0 : startIndex + 1} - {endIndex}</span> trong số{' '}
        <span className="font-semibold text-slate-900">{totalCount}</span> {unitLabel}
      </div>
      <nav aria-label="Phân trang" className="flex max-w-full flex-wrap items-center justify-center gap-1">
        <button
          className="h-8 shrink-0 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-green-800 hover:border-green-300 hover:bg-green-50 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={goPrev}
          disabled={page <= 1}
          type="button"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          <span className="sr-only sm:not-sr-only text-xs font-semibold">Trước</span>
        </button>
        {getPageItems(page, totalPages).map((pageNumber) => typeof pageNumber === 'string' ? (
          <span key={pageNumber} aria-hidden="true" className="h-8 w-8 shrink-0 flex items-center justify-center">…</span>
        ) : (
          <button
            key={pageNumber}
            onClick={() => setPage(pageNumber)}
            type="button"
            aria-label={`Trang ${pageNumber}`}
            aria-current={pageNumber === page ? 'page' : undefined}
            className={
              pageNumber === page
                ? 'h-8 min-w-8 shrink-0 px-1 rounded-lg border border-primary bg-primary text-white font-semibold text-xs tabular-nums flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                : 'h-8 min-w-8 shrink-0 px-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-green-800 hover:border-green-300 hover:bg-green-50 text-xs tabular-nums flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            }
          >
            {pageNumber}
          </button>
        ))}
        <button
          className="h-8 shrink-0 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-green-800 hover:border-green-300 hover:bg-green-50 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={goNext}
          disabled={page >= totalPages}
          type="button"
        >
          <span className="sr-only sm:not-sr-only text-xs font-semibold">Sau</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </nav>
    </div>
  )
}
