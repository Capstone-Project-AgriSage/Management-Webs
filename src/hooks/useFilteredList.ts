import { useState } from 'react'

/**
 * Keeps a search keyword + a single status filter as state, and derives the
 * filtered list from them. `matches` decides per item whether it passes both
 * the keyword and the status filter — callers keep full control over which
 * fields are searched and how the "all statuses" sentinel is recognized.
 */
export function useFilteredList<T>(
  items: T[],
  defaultStatus: string,
  matches: (item: T, keyword: string, statusFilter: string) => boolean,
  /** Status value to reset to on "clear filters", if different from `defaultStatus` (e.g. an initial pre-filtered view that should reset to "show all"). */
  clearStatus: string = defaultStatus,
) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(defaultStatus)

  const keyword = search.trim().toLowerCase()
  const filtered = items.filter((item) => matches(item, keyword, statusFilter))

  const clearFilters = () => {
    setSearch('')
    setStatusFilter(clearStatus)
  }

  return { search, setSearch, statusFilter, setStatusFilter, filtered, clearFilters }
}
