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
    <div className="px-space-md py-space-sm bg-surface-container-low border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-space-sm text-body-sm text-outline font-body-sm select-none">
      <div>
        Hiển thị <span className="font-semibold text-on-surface">{totalCount === 0 ? 0 : startIndex + 1} - {endIndex}</span> trong số{' '}
        <span className="font-semibold text-on-surface">{totalCount}</span> {unitLabel}
      </div>
      <div className="flex items-center gap-1">
        <button
          className="h-8 px-2.5 rounded border border-outline-variant bg-surface-container-lowest text-outline hover:text-on-surface hover:bg-surface-container flex items-center gap-1 disabled:opacity-40"
          onClick={goPrev}
          disabled={page === 1}
          type="button"
        >
          <span className="material-symbols-outlined text-base" data-icon="chevron_left">
            chevron_left
          </span>
          <span className="font-label-sm text-label-sm">Trước</span>
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
          <button
            key={pageNumber}
            onClick={() => setPage(pageNumber)}
            type="button"
            className={
              pageNumber === page
                ? 'h-8 w-8 rounded bg-primary text-on-primary font-semibold text-xs flex items-center justify-center'
                : 'h-8 w-8 rounded border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container text-xs flex items-center justify-center'
            }
          >
            {pageNumber}
          </button>
        ))}
        <button
          className="h-8 px-2.5 rounded border border-outline-variant bg-surface-container-lowest text-outline hover:text-on-surface hover:bg-surface-container flex items-center gap-1 disabled:opacity-40"
          onClick={goNext}
          disabled={page === totalPages}
          type="button"
        >
          <span className="font-label-sm text-label-sm">Sau</span>
          <span className="material-symbols-outlined text-base" data-icon="chevron_right">
            chevron_right
          </span>
        </button>
      </div>
    </div>
  )
}
