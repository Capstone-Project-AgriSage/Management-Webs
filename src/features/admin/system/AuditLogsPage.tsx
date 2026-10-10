import { useEffect, useRef, useState, type FormEvent } from 'react'
import { auditLogsApi, type AuditLogListParams, type AuditLogResponse } from '@/api/auditLogsApi'
import { ApiError, describeError } from '@/api/client'
import type { PagedResult } from '@/api/types'
import ModalLayout from '@/components/ui/ModalLayout'
import DetailModal from '@/components/ui/DetailModal'
import ServerPagination from '@/components/ui/ServerPagination'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { downloadCsv } from '@/utils/csv'
import { actionLabel, actionLabels, actorLabel, browserLabel, changeRows, entityLabels, eventStatus,
  resourceLabel, roleLabels, valueLabel } from './auditLogPresentation'

interface Filters {
  action: string
  entityType: string
  actorUserId: string
  entityId: string
  search: string
  actorRole: string
  status: string
  timeRange: '7days' | '30days' | 'all' | 'custom'
  fromDate: string
  toDate: string
}

const defaults: Filters = { action: '', entityType: '', actorUserId: '', entityId: '', search: '', actorRole: '',
  status: '', timeRange: '7days', fromDate: '', toDate: '' }
const pageSize = 15
const uuidPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const inputClass = 'w-full h-9 px-3 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface shadow-sm'
const buttonClass = 'flex items-center justify-center gap-1.5 px-3 py-2 border border-outline-variant rounded bg-white hover:bg-surface-container-low text-on-surface font-medium text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed'
const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function queryFor(filters: Filters): AuditLogListParams {
  const now = new Date()
  const days = filters.timeRange === '7days' ? 7 : 30
  return {
    action: filters.action.trim().toUpperCase(),
    entityType: filters.entityType.trim().toUpperCase(),
    actorUserId: filters.actorUserId.trim(),
    entityId: filters.entityId.trim(),
    search: filters.search.trim(),
    actorRole: filters.actorRole,
    status: filters.status,
    from: filters.timeRange === 'custom' ? (filters.fromDate ? new Date(filters.fromDate + 'T00:00:00+07:00').toISOString() : undefined)
      : filters.timeRange === 'all' ? undefined : new Date(now.getTime() - days * 86400000).toISOString(),
    // Exclude events with newer timestamps across the list pages and export.
    to: filters.timeRange === 'custom' && filters.toDate ? new Date(filters.toDate + 'T23:59:59.999+07:00').toISOString() : now.toISOString(),
  }
}

function auditError(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return 'Bạn không có quyền xem nhật ký hệ thống.'
  return describeError(error, 'Không thể tải nhật ký. Vui lòng thử lại.')
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  // Audit metadata can contain user input; keep it as text when opened in Excel.
  return /^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text
}

export default function AuditLogsPage() {
  const { currentRole } = useAuth()
  const ownerView = currentRole === 'agent'
  usePageHeader({ title: ownerView ? 'Nhật ký đại lý' : 'Nhật ký hệ thống (Audit Logs)', subtitle: 'Theo dõi lịch sử thao tác và thay đổi dữ liệu' })
  const { showToast } = useToast()
  const [draft, setDraft] = useState<Filters>(defaults)
  const [applied, setApplied] = useState(() => ({ filters: defaults, params: queryFor(defaults) }))
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PagedResult<AuditLogResponse> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [exporting, setExporting] = useState(false)
  const exportController = useRef<AbortController | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AuditLogResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailAttempt, setDetailAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    auditLogsApi.list({ ...applied.params, page, pageSize }, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return
        const lastPage = Math.max(1, data.totalPages)
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        setResult(data)
        setLoading(false)
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setLoadError(auditError(error))
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [applied, page])

  useEffect(() => {
    if (!detailId) return
    const controller = new AbortController()
    auditLogsApi.get(detailId, controller.signal)
      .then(data => { if (!controller.signal.aborted) setDetail(data) })
      .catch(error => { if (!controller.signal.aborted) setDetailError(auditError(error)) })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
  }, [detailId, detailAttempt])

  useEffect(() => () => exportController.current?.abort(), [])

  const prepareListLoad = () => {
    setLoading(true)
    setLoadError('')
    setResult(null)
  }

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    prepareListLoad()
    setPage(1)
    setApplied({ filters: { ...draft }, params: queryFor(draft) })
  }

  const resetFilters = () => {
    prepareListLoad()
    setDraft(defaults)
    setPage(1)
    setApplied({ filters: defaults, params: queryFor(defaults) })
  }

  const reload = () => {
    prepareListLoad()
    setApplied(previous => ({ ...previous, params: queryFor(previous.filters) }))
  }

  const changePage = (nextPage: number) => {
    if (nextPage === page) return
    prepareListLoad()
    setPage(nextPage)
  }

  const retryDetail = () => {
    setDetailLoading(true)
    setDetailError('')
    setDetail(null)
    setDetailAttempt(attempt => attempt + 1)
  }

  const exportCsv = async () => {
    if (exportController.current || !result?.totalCount || loading || loadError) return
    const controller = new AbortController()
    exportController.current = controller
    setExporting(true)
    try {
      const logs: AuditLogResponse[] = []
      let exportPage = 1
      let totalPages = 1
      do {
        const data = await auditLogsApi.list({ ...applied.params, page: exportPage, pageSize: 100 }, controller.signal)
        if (controller.signal.aborted) return
        logs.push(...data.items)
        totalPages = data.totalPages
        exportPage++
      } while (exportPage <= totalPages)
      if (logs.length === 0) {
        showToast('Không có dữ liệu để xuất.', 'info')
        return
      }
      downloadCsv('audit_logs_' + new Date().toISOString().replace(/[:.]/g, '-') + '.csv', logs.map(log => ({
        'ID': log.id,
        'Thời gian (UTC+7)': dateFormatter.format(new Date(log.occurredAt)),
        'ID cửa hàng': log.storeId ?? '',
        'ID người thực hiện': log.actorUserId ?? '',
        'Người thực hiện': csvCell(actorLabel(log)),
        'Email': csvCell(log.actorEmail),
        'Vai trò': csvCell(log.actorRole ? roleLabels[log.actorRole] ?? log.actorRole : ''),
        'Chi tiết hành động': csvCell(actionLabel(log)),
        'Hành động': csvCell(log.action),
        'Trạng thái': eventStatus(log) === 'FAILURE' ? 'Thất bại' : 'Thành công',
        'Loại tài nguyên': csvCell(log.entityType),
        'Đối tượng': csvCell(resourceLabel(log)),
        'ID tài nguyên': log.entityId ?? '',
        'IP': csvCell(log.ipAddress),
        'Lý do': csvCell(log.reason),
        'User Agent': csvCell(log.userAgent),
        'Trình duyệt': csvCell(browserLabel(log.userAgent)),
        'Correlation ID': csvCell(log.correlationId),
        'Giá trị trước': csvCell(log.oldValues == null ? '' : JSON.stringify(log.oldValues)),
        'Giá trị sau': csvCell(log.newValues == null ? '' : JSON.stringify(log.newValues)),
      })))
      showToast('Đã xuất ' + logs.length + ' nhật ký thành công!')
    } catch (error) {
      if (!controller.signal.aborted) showToast(describeError(error, 'Không thể xuất nhật ký. Vui lòng thử lại.'), 'error')
    } finally {
      exportController.current = null
      if (!controller.signal.aborted) setExporting(false)
    }
  }

  return (
    <div className="w-full min-w-0 max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-wrap items-start justify-between gap-3 mt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold text-on-surface">{ownerView ? 'Nhật ký đại lý' : 'Nhật ký Hệ thống'}</h1>
          <p className="text-on-surface-variant text-sm">Lưu vết thao tác, người thực hiện và thay đổi dữ liệu trong hệ thống.</p>
          <p className="text-xs text-on-surface-variant">{ownerView ? 'Chỉ hiển thị hoạt động của đại lý bạn quản lý.' : 'Hiển thị hoạt động trên toàn hệ thống.'} Nhật ký chỉ được đọc.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={reload} disabled={loading || exporting} className={buttonClass}>Tải lại</button>
          <button type="button" onClick={() => void exportCsv()} disabled={loading || exporting || !!loadError || !result?.totalCount} className={buttonClass}>
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">download</span>
            {exporting ? 'Đang xuất...' : 'Xuất CSV'}
          </button>
        </div>
      </div>

      <form onSubmit={applyFilters} className="mt-2 space-y-3">
        <fieldset disabled={exporting} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 disabled:opacity-60">
          <label className="text-sm text-on-surface space-y-1 block sm:col-span-2">
            <span className="font-medium">Tìm kiếm</span>
            <input type="search" className={inputClass} value={draft.search} maxLength={200} placeholder="Tên, email người thực hiện, mã hành động hoặc đối tượng" onChange={e => setDraft({ ...draft, search: e.target.value })} />
          </label>
          <label className="text-sm text-on-surface space-y-1 block">
            <span className="font-medium">Vai trò người thực hiện</span>
            <select aria-label="Vai trò người thực hiện" className={inputClass} value={draft.actorRole} onChange={e => setDraft({ ...draft, actorRole: e.target.value })}>
              <option value="">Tất cả vai trò</option>
              {Object.entries(roleLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm text-on-surface space-y-1 block">
            <span className="font-medium">Trạng thái hành động</span>
            <select aria-label="Trạng thái hành động" className={inputClass} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
              <option value="">Tất cả trạng thái</option><option value="SUCCESS">Thành công</option><option value="FAILURE">Thất bại</option>
            </select>
          </label>
          <label className="text-sm text-on-surface space-y-1 block">
            <span className="font-medium">Hành động</span>
            <input list="audit-actions" className={inputClass} value={draft.action} maxLength={100} placeholder="Ví dụ: STAFF_LOCKED" onChange={e => setDraft({ ...draft, action: e.target.value })} />
          </label>
          <datalist id="audit-actions">{Object.entries(actionLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</datalist>
          <label className="text-sm text-on-surface space-y-1 block">
            <span className="font-medium">Loại tài nguyên</span>
            <input className={inputClass} value={draft.entityType} maxLength={100} placeholder="Ví dụ: USER, ORDER" onChange={e => setDraft({ ...draft, entityType: e.target.value })} />
          </label>
          <label className="text-sm text-on-surface space-y-1 block">
            <span className="font-medium">ID người thực hiện</span>
            <input className={inputClass} value={draft.actorUserId} pattern={uuidPattern} title="Nhập ID người thực hiện theo định dạng UUID" placeholder="UUID người thực hiện" onChange={e => setDraft({ ...draft, actorUserId: e.target.value })} />
          </label>
          <label className="text-sm text-on-surface space-y-1 block">
            <span className="font-medium">ID tài nguyên</span>
            <input className={inputClass} value={draft.entityId} pattern={uuidPattern} title="Nhập ID tài nguyên theo định dạng UUID" placeholder="UUID tài nguyên" onChange={e => setDraft({ ...draft, entityId: e.target.value })} />
          </label>
          <div className="sm:col-span-2 xl:col-span-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-on-surface-variant">Tìm tên/email; bộ lọc hành động, loại tài nguyên và ID khớp chính xác.</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-on-surface">
                <span className="font-medium">Thời gian</span>
                <select aria-label="Thời gian" className="h-9 rounded border border-outline-variant bg-white px-2" value={draft.timeRange} onChange={e => setDraft({ ...draft, timeRange: e.target.value as Filters['timeRange'] })}>
                  <option value="7days">7 ngày qua</option>
                  <option value="30days">30 ngày qua</option>
                  <option value="all">Tất cả</option>
                  <option value="custom">Khoảng ngày</option>
                </select>
              </label>
              {draft.timeRange === 'custom' && <>
                <label className="text-sm text-on-surface">Từ ngày (UTC+7)<input type="date" className={inputClass} value={draft.fromDate} max={draft.toDate || undefined} onChange={e => setDraft({ ...draft, fromDate: e.target.value })} /></label>
                <label className="text-sm text-on-surface">Đến ngày (UTC+7)<input type="date" className={inputClass} value={draft.toDate} min={draft.fromDate || undefined} onChange={e => setDraft({ ...draft, toDate: e.target.value })} /></label>
              </>}
              <button type="button" onClick={resetFilters} className={buttonClass}>Xóa bộ lọc</button>
              <button type="submit" className={buttonClass + ' !bg-primary !text-white'}>Lọc</button>
            </div>
          </div>
        </fieldset>
      </form>

      <div className="min-w-0 max-w-full border border-outline-variant/60 rounded-xl overflow-hidden bg-white shadow-sm mt-2 flex flex-col" aria-busy={loading}>
        <div className="relative min-w-0 w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant/60 text-xs text-on-surface-variant uppercase tracking-wider">
                <th className="py-2.5 px-4 border-r border-outline-variant/40">Thời gian (UTC+7)</th>
                <th className="py-2.5 px-4 border-r border-outline-variant/40">Loại tài nguyên</th>
                <th className="py-2.5 px-4 border-r border-outline-variant/40">Người thực hiện (Actor)</th>
                <th className="py-2.5 px-4 border-r border-outline-variant/40">Hành động</th>
                <th className="py-2.5 px-4 border-r border-outline-variant/40">Đối tượng tác động</th>
                <th className="py-2.5 px-4 border-r border-outline-variant/40">Trạng thái</th>
                <th className="py-2.5 px-4 border-r border-outline-variant/40">IP / trình duyệt</th>
                <th className="py-2.5 px-2"><span className="sr-only">Chi tiết</span></th>
              </tr>
            </thead>
            <tbody className="text-[13px] divide-y divide-outline-variant/40">
              {loading ? <tr><td colSpan={8} className="py-12 text-center text-on-surface-variant font-sans"><p role="status">Đang tải nhật ký...</p></td></tr>
                : loadError ? <tr><td colSpan={8} className="py-10 text-center font-sans"><div role="alert" className="space-y-3"><p className="text-error">{loadError}</p><button type="button" onClick={reload} className={buttonClass + ' mx-auto'}>Thử lại</button></div></td></tr>
                : !result?.items.length ? <tr><td colSpan={8} className="py-12 text-center text-on-surface-variant font-sans"><p role="status">Không tìm thấy nhật ký phù hợp.</p></td></tr>
                : result.items.map(log => (
                  <tr key={log.id} data-audit-log-id={log.id} className="transition-colors hover:bg-surface-container-low">
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-on-surface-variant whitespace-nowrap"><time dateTime={log.occurredAt}>{dateFormatter.format(new Date(log.occurredAt))}</time></td>
                    <td className="py-3 px-4 border-r border-outline-variant/40"><span className="px-2 py-0.5 rounded text-xs bg-surface-container text-primary">{entityLabels[log.entityType] ?? log.entityType}</span></td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-on-surface"><div className="font-semibold">{actorLabel(log)}</div><div className="mt-1 text-xs text-on-surface-variant break-all">{log.actorEmail}</div>{log.actorRole && <span className="mt-1 inline-block rounded bg-surface-container px-2 py-0.5 text-xs">{roleLabels[log.actorRole] ?? log.actorRole}</span>}</td>
                    <td className="py-3 px-4 border-r border-outline-variant/40"><div className="text-primary font-medium">{actionLabel(log)}</div><div className="mt-1 text-[11px] text-on-surface-variant font-mono">{log.action}</div>{log.reason && <p className="mt-1 max-w-xs text-xs text-on-surface-variant line-clamp-2" title={log.reason}>Lý do: {log.reason}</p>}</td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-on-surface break-all">{resourceLabel(log)}</td>
                    <td className="py-3 px-4 border-r border-outline-variant/40"><StatusBadge log={log} /></td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-on-surface-variant"><div className="whitespace-nowrap font-mono">{log.ipAddress ?? '—'}</div><div className="mt-1 text-xs whitespace-nowrap">{browserLabel(log.userAgent)}</div></td>
                    <td className="py-3 px-2 text-center"><button type="button" aria-label={'Chi tiết nhật ký ' + log.id} onClick={() => { setDetail(null); setDetailError(''); setDetailLoading(true); setDetailId(log.id) }} className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container"><span className="material-symbols-outlined text-[18px]" aria-hidden="true">data_object</span></button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!loading && !loadError && result && <fieldset disabled={exporting} className="min-w-0 font-sans"><ServerPagination page={result.page} pageSize={result.pageSize} totalCount={result.totalCount} totalPages={result.totalPages} unitLabel="nhật ký" onPageChange={changePage} /></fieldset>}
      </div>

      <p className="text-xs text-on-surface-variant">Trạng thái phản ánh sự kiện đã ghi nhận; nhật ký không bao gồm mọi yêu cầu thất bại. Tên/email/vai trò lấy từ hồ sơ hiện tại.</p>

      <DetailModal open={detailId !== null} onClose={() => setDetailId(null)} widthClassName="max-w-5xl">
        <ModalLayout header={<h2 className="text-xl font-semibold text-on-surface">Chi tiết Audit Log</h2>} footer={<div className="flex justify-end"><button type="button" className={buttonClass} onClick={() => setDetailId(null)}>Đóng</button></div>}>
          <p className="text-sm text-on-surface-variant font-mono break-all">Mã tham chiếu: {detailId}</p>
          {detailLoading ? <p role="status" className="py-8 text-center text-on-surface-variant">Đang tải chi tiết...</p>
            : detailError ? <div role="alert" className="space-y-3"><p className="text-error">{detailError}</p><button type="button" className={buttonClass} onClick={retryDetail}>Thử lại</button></div>
            : detail && <AuditLogDetail log={detail} />}
        </ModalLayout>
      </DetailModal>
    </div>
  )
}

function StatusBadge({ log }: { log: AuditLogResponse }) {
  const failed = eventStatus(log) === 'FAILURE'
  return <span className={'inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ' + (failed ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>{failed ? 'Thất bại' : 'Thành công'}</span>
}

function AuditLogDetail({ log }: { log: AuditLogResponse }) {
  const changes = changeRows(log)
  return <div className="space-y-5 min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-surface-container-low p-4">
      <div><p className="font-semibold text-on-surface">{actorLabel(log)} · {actionLabel(log)}</p><p className="mt-1 text-sm text-on-surface-variant">{entityLabels[log.entityType] ?? log.entityType}: {resourceLabel(log)}</p></div>
      <StatusBadge log={log} />
    </div>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {[
        ['Người thực hiện', actorLabel(log)], ['Email', log.actorEmail ?? 'Không ghi nhận'],
        ['Vai trò', log.actorRole ? roleLabels[log.actorRole] ?? log.actorRole : 'Không ghi nhận'],
        ['Thời gian (UTC+7)', dateFormatter.format(new Date(log.occurredAt))],
        ['ID người thực hiện', log.actorUserId ?? 'Không ghi nhận'], ['Mã hành động', log.action],
        ['ID đối tượng', log.entityId ?? 'Không ghi nhận'], ['ID cửa hàng', log.storeId ?? 'Toàn hệ thống'],
        ['Địa chỉ IP', log.ipAddress ?? 'Không ghi nhận'], ['Trình duyệt / thiết bị', browserLabel(log.userAgent)],
        ['Correlation ID', log.correlationId ?? 'Không ghi nhận'], ['User Agent', log.userAgent ?? 'Không ghi nhận'],
      ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-1 break-all text-on-surface">{value}</dd></div>)}
    </dl>
    <div className="rounded-lg border border-outline-variant p-3"><h3 className="text-sm font-semibold text-on-surface">Lý do thay đổi</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-on-surface-variant">{log.reason || 'Không ghi nhận lý do.'}</p></div>
    <section aria-label="Lịch sử thay đổi">
      <h3 className="mb-3 text-base font-semibold text-on-surface">Dữ liệu trước và sau</h3>
      {changes.length === 0 ? <p className="text-sm text-on-surface-variant">Sự kiện này không ghi nhận dữ liệu trước/sau.</p>
        : <div className="overflow-x-auto rounded-lg border border-outline-variant"><table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-surface-container-low"><tr><th className="p-3">Trường dữ liệu</th><th className="p-3">Trước thay đổi</th><th className="p-3">Sau thay đổi</th></tr></thead>
          <tbody className="divide-y divide-outline-variant/40">{changes.map(change => <tr key={change.path} className={change.changed ? 'bg-amber-50/60' : ''}>
            <th className="p-3 align-top font-medium text-on-surface"><span>{change.label}</span>{change.changed && <span className="block mt-1 text-[11px] font-normal text-amber-700">Đã thay đổi</span>}</th>
            <td className="p-3 align-top whitespace-pre-wrap break-all text-on-surface-variant">{valueLabel(change.before)}</td>
            <td className="p-3 align-top whitespace-pre-wrap break-all text-on-surface">{valueLabel(change.after)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
    <details className="rounded-lg border border-outline-variant p-3"><summary className="cursor-pointer text-sm font-medium text-on-surface">Dữ liệu gốc (JSON)</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-surface-container-low p-3 text-xs font-mono">{JSON.stringify(log, null, 2)}</pre></details>
  </div>
}
