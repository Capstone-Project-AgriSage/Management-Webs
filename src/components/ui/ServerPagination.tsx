import Pagination from '@/components/ui/Pagination'

interface ServerPaginationProps {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  unitLabel: string
  onPageChange: (page: number) => void
}

/** Pagination for lists the API pages itself (PagedResult). */
export default function ServerPagination({ page, pageSize, totalCount, totalPages, unitLabel, onPageChange }: ServerPaginationProps) {
  const pages = Math.max(1, totalPages)
  return (
    <Pagination
      page={page}
      totalPages={pages}
      startIndex={(page - 1) * pageSize}
      endIndex={Math.min(page * pageSize, totalCount)}
      totalCount={totalCount}
      unitLabel={unitLabel}
      goPrev={() => onPageChange(Math.max(1, page - 1))}
      goNext={() => onPageChange(Math.min(pages, page + 1))}
      setPage={onPageChange}
    />
  )
}
