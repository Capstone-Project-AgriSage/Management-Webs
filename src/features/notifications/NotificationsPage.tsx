import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import { LIST_PAGE_SIZE } from '@/utils/pagination';
import type { NotificationStatus } from '@/api/notificationsApi';
import { Link } from 'react-router-dom';
import { useNotificationInbox } from '../../hooks/useNotificationInbox';
import { notificationFilters, notificationIcon, notificationTarget, notificationTime } from './notificationLabels';
import { usePageHeader } from '../../context/PageHeaderContext';
import { useAuth } from '../../context/AuthContext';

export default function NotificationsPage() {
  usePageHeader({ title: 'Thông báo của tôi', subtitle: 'Cập nhật đơn hàng, giao hàng, tồn kho và công nợ' })
  const { currentRole } = useAuth()
  const inbox = useNotificationInbox()
  return (
    <div className=" text-on-surface">

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Thông báo</h1>

        </div>
        <ListToolbar onClear={() => inbox.changeFilter('')} disabled={Boolean(inbox.busy)} actions={<><button type="button" className="rounded border border-outline-variant/60 px-3 py-2 text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed" onClick={inbox.reload} disabled={inbox.loading || Boolean(inbox.busy)}>Tải lại</button><button type="button" className="rounded border border-outline-variant/60 px-3 py-2 text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed" disabled={inbox.disabled || inbox.unreadCount === 0} onClick={() => void inbox.markAllRead()}>
              {inbox.busy === 'all' ? 'Đang cập nhật...' : 'Đánh dấu tất cả đã đọc'}
            </button></>}>
          <FilterSelect label="Lọc thông báo" disabled={Boolean(inbox.busy)} value={inbox.filter} onChange={value => inbox.changeFilter(value as NotificationStatus | '')} options={notificationFilters.map(filter => ({ value: filter.value, label: filter.label }))} />
        </ListToolbar>
        {inbox.actionError && <div role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{inbox.actionError}</div>}
        <div className="bg-white border border-outline-variant/60 divide-y divide-outline-variant/60" aria-busy={inbox.loading}>
          {inbox.loading ? <p role="status" className="p-10 text-center text-on-surface-variant">Đang tải thông báo...</p>
            : inbox.loadError ? <div role="alert" className="p-8 text-center space-y-3"><p className="text-red-700">{inbox.loadError}</p><button type="button" className="rounded border border-outline-variant/60 px-3 py-2 text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed" onClick={inbox.reload}>Thử lại</button></div>
            : inbox.items.length === 0 ? <p role="status" className="p-10 text-center text-on-surface-variant">{inbox.filter ? 'Không có thông báo trong bộ lọc này.' : 'Bạn chưa có thông báo nào.'}</p>
            : inbox.items.map((item) => {
              const unread = item.status === 'UNREAD'
              const target = notificationTarget(item, currentRole)
              return <article key={item.id} data-notification-id={item.id} className={'p-4 sm:p-5 flex gap-4 ' + (unread ? 'bg-primary-fixed/30' : '')}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary-fixed/30 text-primary"><span className="material-symbols-outlined text-[20px]" aria-hidden="true">{notificationIcon(item.notificationType)}</span></div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <h2 className={'text-sm break-words ' + (unread ? 'font-semibold' : 'font-normal')}>{item.title}</h2>
                    <time dateTime={item.createdAt} className="text-xs text-on-surface-variant">{notificationTime(item.createdAt)}</time>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap break-words">{item.message}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-on-surface-variant">{unread ? 'Chưa đọc' : item.status === 'ARCHIVED' ? 'Đã lưu trữ' : 'Đã đọc'}</span>
                    {unread && <button type="button" className="text-primary hover:underline disabled:opacity-40" disabled={inbox.disabled} onClick={() => void inbox.markRead(item.id)}>Đánh dấu đã đọc</button>}
                    {target && <Link className="text-primary hover:underline" to={target}>Xem chi tiết</Link>}
                    {item.status !== 'ARCHIVED' && <button type="button" className="text-on-surface-variant hover:underline disabled:opacity-40" disabled={inbox.disabled} onClick={() => void inbox.archive(item.id)}>Lưu trữ</button>}
                    {inbox.busy === item.id && <span role="status" className="text-on-surface-variant">Đang cập nhật...</span>}
                  </div>
                </div>
                {unread && <span className="w-2 h-2 rounded-full bg-primary self-center shrink-0" aria-label="Thông báo chưa đọc" />}
              </article>
            })}
        </div>
        {!inbox.loading && !inbox.loadError && <fieldset disabled={inbox.disabled}><ServerPagination page={inbox.page} pageSize={LIST_PAGE_SIZE} totalCount={inbox.totalCount} totalPages={inbox.totalPages} unitLabel="thông báo" onPageChange={inbox.setPage} /></fieldset>}
      </div>
    </div>
  )
}
