import { useEffect, useMemo, useState } from 'react'

/**
 * Slices a list into pages. Resets to page 1 whenever the list's length changes
 * (e.g. after search/filter narrows the result set) so the page never goes stale.
 */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [items.length, pageSize])

  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const paginated = useMemo(() => items.slice(startIndex, startIndex + pageSize), [items, startIndex, pageSize])

  return {
    page: safePage,
    setPage,
    totalPages,
    paginated,
    startIndex,
    endIndex: Math.min(startIndex + pageSize, items.length),
    totalCount: items.length,
    goPrev: () => setPage((p) => Math.max(1, p - 1)),
    goNext: () => setPage((p) => Math.min(totalPages, p + 1)),
  }
}
