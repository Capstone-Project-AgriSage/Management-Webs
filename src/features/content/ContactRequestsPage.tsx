import { useCallback, useState } from 'react'
import { contentApi, contactLabels, type ContactRequest, type ContactStatus } from '@/api/contentApi'
import { describeError } from '@/api/client'
import { useServerList } from '@/hooks/useServerList'
import { useContentRefresh } from '@/hooks/useContentRefresh'
import { usePageHeader } from '@/context/PageHeaderContext'
import { usePermission } from '@/context/PermissionContext'
import { useToast } from '@/context/ToastContext'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import StatusBadge from '@/components/ui/StatusBadge'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import FormModal from '@/components/ui/FormModal'
import { LIST_PAGE_SIZE } from '@/utils/pagination'
import { vnDateTime } from '@/utils/date'

export default function ContactRequestsPage() {
  usePageHeader({ title: 'Yêu cầu liên hệ', subtitle: 'Tiếp nhận và phản hồi yêu cầu hỗ trợ' })
  const { has } = usePermission()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const load = useCallback((page: number, signal: AbortSignal) => contentApi.contacts({ page, pageSize: LIST_PAGE_SIZE, search, status }, signal), [search, status])
  const list = useServerList(load)
  useContentRefresh(list.reload)
  const [target, setTarget] = useState<ContactRequest | null>(null)
  const [nextStatus, setNextStatus] = useState<ContactStatus>('OPEN')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const edit = (item: ContactRequest) => { setTarget(item); setNextStatus(item.status); setNote(item.resolutionNote ?? ''); setError('') }
  const save = async () => {
    if (!target || busy) return
    setBusy(true); setError('')
    try { await contentApi.updateContact(target.id, nextStatus, note.trim() || null); setTarget(null); list.reload(); showToast('Đã cập nhật yêu cầu liên hệ') }
    catch (err) { setError(describeError(err)) }
    finally { setBusy(false) }
  }
  return <div className="space-y-5">
    <h1 className="text-2xl font-semibold">Yêu cầu liên hệ</h1>
    <ListToolbar search={{ value: search, onChange: value => { setSearch(value); list.setPage(1) }, placeholder: 'Tìm mã, tên hoặc chủ đề...' }}
      onClear={() => { setSearch(''); setStatus(''); list.setPage(1) }} actions={<button onClick={list.reload}>Tải lại</button>}>
      <FilterSelect label="Trạng thái" value={status} onChange={value => { setStatus(value); list.setPage(1) }} options={[{ value: '', label: 'Mọi trạng thái' }, ...Object.entries(contactLabels).map(([value, label]) => ({ value, label }))]} />
    </ListToolbar>
    {list.error && <p role="alert" className="text-red-700">{list.error}</p>}
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm text-left"><thead className="bg-slate-50"><tr>
        {['Mã yêu cầu', 'Người liên hệ', 'Chủ đề', 'Trạng thái', 'Ngày gửi', 'Thao tác'].map(label => <th className="p-4 last:text-right" key={label}>{label}</th>)}
      </tr></thead><tbody>
        {list.loading ? <tr><td colSpan={6} className="p-8 text-center" role="status">Đang tải...</td></tr> : list.items.length === 0 ? <tr><td colSpan={6} className="p-8 text-center">Chưa có yêu cầu phù hợp.</td></tr> : list.items.map(item => <tr key={item.id} className="border-t border-slate-100">
          <td className="p-4">{item.requestNumber}</td><td className="p-4">{item.contactName}<p className="text-slate-500">{item.contactPhone || item.contactEmail}</p></td>
          <td className="p-4">{item.subject}</td><td className="p-4"><StatusBadge label={contactLabels[item.status]} /></td>
          <td className="p-4">{vnDateTime(item.createdAt)}</td><td className="p-4 text-right"><RowActionsMenu triggerLabel={`Thao tác ${item.requestNumber}`} actions={[{ label: 'Xem và xử lý', onClick: () => edit(item) }]} /></td>
        </tr>)}
      </tbody></table>
      <ServerPagination {...list} onPageChange={list.setPage} unitLabel="yêu cầu" />
    </div>
    <FormModal open={!!target} onClose={() => setTarget(null)} busy={busy} title={target?.requestNumber ?? 'Yêu cầu liên hệ'}>
      {target && <div className="space-y-4">
        <p className="font-semibold">{target.subject}</p><p>{target.contactName} · {target.contactPhone} · {target.contactEmail}</p>
        <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4">{target.message}</p>
        <label className="block">Trạng thái<select aria-label="Trạng thái" className="block w-full border rounded-lg p-2 mt-1" disabled={busy || !has('CONTACT_REQUESTS.MANAGE')} value={nextStatus} onChange={e => setNextStatus(e.target.value as ContactStatus)}>
          {Object.entries(contactLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="block">Phản hồi<textarea aria-label="Phản hồi" className="block w-full border rounded-lg p-3 mt-1" rows={5} maxLength={2000} disabled={busy || !has('CONTACT_REQUESTS.MANAGE')} value={note} onChange={e => setNote(e.target.value)} /></label>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="flex justify-end gap-3"><button disabled={busy} onClick={() => setTarget(null)}>Đóng</button>{has('CONTACT_REQUESTS.MANAGE') && <button disabled={busy || (nextStatus === 'RESOLVED' && !note.trim())} className="bg-primary text-white px-4 py-2 rounded-lg disabled:opacity-50" onClick={() => void save()}>{busy ? 'Đang lưu...' : 'Lưu phản hồi'}</button>}</div>
      </div>}
    </FormModal>
  </div>
}
