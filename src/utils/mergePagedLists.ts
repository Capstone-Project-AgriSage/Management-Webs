import type { Paged } from '@/api/types'
import { LIST_PAGE_SIZE } from './pagination'

/** Merge disjoint, sorted API lists without truncating any source to its first page. */
export async function mergePagedLists<T>(
  sources: ((page: number) => Promise<Paged<T>>)[],
  requestedPage: number,
  compare: (a: T, b: T) => number,
): Promise<Paged<T>> {
  const first = await Promise.all(sources.map(load => load(1)))
  const totalCount = first.reduce((sum, result) => sum + result.totalCount, 0)
  const totalPages = Math.ceil(totalCount / LIST_PAGE_SIZE)
  const page = Math.min(Math.max(1, requestedPage), Math.max(1, totalPages))
  // Each source's first N pages contain every record that could fall in merged page N.
  const lists = await Promise.all(sources.map(async (load, index) => {
    const pages = Math.min(page, first[index].totalPages)
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, offset) => load(offset + 2)))
    return [...first[index].items, ...rest.flatMap(result => result.items)]
  }))
  const items = lists.flat().sort(compare).slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE)
  return { items, page, pageSize: LIST_PAGE_SIZE, totalCount, totalPages }
}
