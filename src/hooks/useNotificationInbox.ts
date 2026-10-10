import { LIST_PAGE_SIZE } from '@/utils/pagination'
import { useEffect, useState } from 'react'
import { notificationsApi, type NotificationItem, type NotificationStatus } from '../api/notificationsApi'
import { useNotifications } from './useNotifications'
import { describeApiError } from '../utils/apiError'

interface InboxSnapshot {
  key: string
  items: NotificationItem[]
  totalCount: number
  totalPages: number
  error: string
}

export function useNotificationInbox() {
  const { revision, unreadCount, notifyChanged } = useNotifications()
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<NotificationStatus | ''>('')
  const [snapshot, setSnapshot] = useState<InboxSnapshot>({ key: '', items: [], totalCount: 0, totalPages: 1, error: '' })
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState('')
  const [retry, setRetry] = useState(0)
  const key = [page, filter, revision, retry].join(':')
  const loading = snapshot.key !== key
  const loadError = loading ? '' : snapshot.error

  useEffect(() => {
    const controller = new AbortController()
    notificationsApi.list({ page, pageSize: LIST_PAGE_SIZE, status: filter || undefined }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        const lastPage = Math.max(1, response.totalPages)
        if (page > lastPage) { setPage(lastPage); return }
        setSnapshot({ key, items: response.items, totalCount: response.totalCount, totalPages: lastPage, error: '' })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setSnapshot({ key, items: [], totalCount: 0, totalPages: 1,
          error: describeApiError(error, 'Không tải được thông báo. Vui lòng thử lại.') })
      })
    return () => controller.abort()
  }, [page, filter, revision, retry, key])

  const run = async (operationKey: string, operation: () => Promise<void>) => {
    if (busy) return
    setBusy(operationKey)
    setActionError('')
    try { await operation(); notifyChanged() }
    catch (error) { setActionError(describeApiError(error, 'Không cập nhật được thông báo. Vui lòng thử lại.')) }
    finally { setBusy('') }
  }
  return {
    items: snapshot.items, totalCount: snapshot.totalCount, totalPages: snapshot.totalPages,
    page, filter, loading, loadError, actionError, busy, unreadCount,
    disabled: loading || Boolean(busy) || Boolean(loadError),
    setPage,
    changeFilter: (status: NotificationStatus | '') => { setFilter(status); setPage(1); setActionError('') },
    reload: () => { setRetry((value) => value + 1); notifyChanged() },
    markRead: (id: string) => run(id, () => notificationsApi.markRead(id)),
    markAllRead: () => run('all', () => notificationsApi.markAllRead()),
    archive: (id: string) => run(id, () => notificationsApi.archive(id)),
  }
}
