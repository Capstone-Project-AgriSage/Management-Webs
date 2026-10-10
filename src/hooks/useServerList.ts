import { useEffect, useState } from 'react'
import type { Paged } from '@/api/types'
import { describeError } from '@/api/client'
import { LIST_PAGE_SIZE } from '@/utils/pagination'

/** The loader must be stable (useCallback) and return backend pagination metadata. */
export function useServerList<T>(load: (page: number, signal: AbortSignal) => Promise<Paged<T>>) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<Paged<T>>({ items: [], page: 1, pageSize: LIST_PAGE_SIZE, totalCount: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    load(page, controller.signal).then(result => {
      if (controller.signal.aborted) return
      const lastPage = Math.max(1, result.totalPages)
      if (page > lastPage) { setPage(lastPage); return }
      setData(result)
    }).catch(err => {
      if (!controller.signal.aborted) { setData(previous => ({ ...previous, items: [] })); setError(describeError(err, 'Không tải được danh sách')) }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [load, page, revision])
  return { ...data, page, setPage, loading, error, reload: () => setRevision(value => value + 1) }
}
