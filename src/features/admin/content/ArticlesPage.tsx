import { useCallback, useState } from 'react'
import { contentApi, articleLabels, type Article, type ArticleInput, type ArticleStatus } from '@/api/contentApi'
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
import ConfirmModal from '@/components/ui/ConfirmModal'
import ImageUploader from '@/features/products/ImageUploader'
import { LIST_PAGE_SIZE } from '@/utils/pagination'
import { vnDateTime } from '@/utils/date'

const empty: ArticleInput = { title: '', slug: '', summary: '', content: '', thumbnailUrl: '' }
export default function ArticlesPage() {
  usePageHeader({ title: 'Bài viết & Tin tức', subtitle: 'Quản lý nội dung kiến thức nông nghiệp' })
  const { has } = usePermission()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const load = useCallback((page: number, signal: AbortSignal) => contentApi.articles({ page, pageSize: LIST_PAGE_SIZE, search, status }, signal), [search, status])
  const list = useServerList(load)
  useContentRefresh(list.reload)
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<Article | null>(null)
  const [form, setForm] = useState<ArticleInput>(empty)
  const [pending, setPending] = useState<{ item: Article; status?: ArticleStatus } | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const edit = (item: Article | null) => { setTarget(item); setForm(item ? { title: item.title, slug: item.slug, summary: item.summary, content: item.content, thumbnailUrl: item.thumbnailUrl } : empty); setError(''); setOpen(true) }
  const save = async () => {
    if (busy || uploading) return
    if (!form.thumbnailUrl) { setError('Vui lòng tải ảnh đại diện cho bài viết.'); return }
    setBusy(true); setError('')
    const data = { ...form, title: form.title.trim(), summary: form.summary?.trim() || null, thumbnailUrl: form.thumbnailUrl?.trim() || null }
    try {
      if (target) await contentApi.updateArticle(target.id, data)
      else await contentApi.createArticle(data)
      setOpen(false); list.reload(); showToast('Đã lưu bài viết')
    } catch (err) { setError(describeError(err)) }
    finally { setBusy(false) }
  }
  const apply = async () => {
    if (!pending || busy) return
    setBusy(true); setError('')
    try {
      if (pending.status) await contentApi.articleStatus(pending.item.id, pending.status)
      else await contentApi.deleteArticle(pending.item.id)
      setPending(null); list.reload(); showToast('Đã cập nhật bài viết')
    } catch (err) { setError(describeError(err)) }
    finally { setBusy(false) }
  }
  return <div className="space-y-5">
    <h1 className="text-2xl font-semibold">Bài viết & Tin tức</h1>
    <ListToolbar search={{ value: search, onChange: value => { setSearch(value); list.setPage(1) }, placeholder: 'Tìm tiêu đề, tóm tắt...' }} onClear={() => { setSearch(''); setStatus(''); list.setPage(1) }} actions={<><button onClick={list.reload}>Tải lại</button>{has('ARTICLES.MANAGE') && <button className="rounded-lg bg-primary text-white px-4 py-2" onClick={() => edit(null)}>Viết bài mới</button>}</>}>
      <FilterSelect label="Trạng thái" value={status} onChange={value => { setStatus(value); list.setPage(1) }} options={[{ value: '', label: 'Mọi trạng thái' }, ...Object.entries(articleLabels).map(([value, label]) => ({ value, label }))]} />
    </ListToolbar>
    {list.error && <p role="alert" className="text-red-700">{list.error}</p>}
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50"><tr>{['Tiêu đề', 'Tác giả', 'Ngày xuất bản', 'Trạng thái', 'Thao tác'].map(label => <th key={label} className="p-4 last:text-right">{label}</th>)}</tr></thead><tbody>
      {list.loading ? <tr><td colSpan={5} className="p-8 text-center" role="status">Đang tải...</td></tr> : !list.items.length ? <tr><td colSpan={5} className="p-8 text-center">Chưa có bài viết phù hợp.</td></tr> : list.items.map(item => <tr key={item.id} className="border-t border-slate-100">
        <td className="p-4"><div className="flex items-center gap-3">{item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="w-16 h-12 rounded object-cover shrink-0" />}<div><button className="font-medium hover:underline text-left" onClick={() => edit(item)}>{item.title}</button><p className="text-xs text-slate-500 mt-1">{item.slug}</p></div></div></td><td className="p-4">{item.authorName}</td><td className="p-4">{item.publishedAt ? vnDateTime(item.publishedAt) : '—'}</td><td className="p-4"><StatusBadge label={articleLabels[item.status]} /></td>
        <td className="p-4 text-right"><RowActionsMenu disabled={busy} triggerLabel={`Thao tác bài viết ${item.title}`} actions={[
          { label: has('ARTICLES.MANAGE') ? 'Chỉnh sửa' : 'Xem bài viết', onClick: () => edit(item) },
          ...(['PUBLISHED', 'DRAFT', 'ARCHIVED'] as const).filter(next => next !== item.status).map(next => ({ label: next === 'PUBLISHED' ? 'Xuất bản' : next === 'DRAFT' ? 'Chuyển về nháp' : 'Lưu trữ', permissionCodes: ['ARTICLES.MANAGE'], onClick: () => { setError(''); setPending({ item, status: next }) } })),
          { label: 'Xóa bài viết', tone: 'danger', permissionCodes: ['ARTICLES.MANAGE'], onClick: () => { setError(''); setPending({ item }) } },
        ]} /></td>
      </tr>)}
    </tbody></table><ServerPagination {...list} unitLabel="bài viết" onPageChange={list.setPage} /></div>
    <FormModal open={open} onClose={() => setOpen(false)} title={target ? 'Chi tiết bài viết' : 'Viết bài mới'} busy={busy || uploading} widthClassName="max-w-3xl">
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save() }}>
        <fieldset disabled={busy || uploading || !has('ARTICLES.MANAGE')} className="space-y-4">
          <label className="block">Tiêu đề<input required maxLength={255} className="block w-full border rounded-lg p-2 mt-1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
          <label className="block">Đường dẫn (slug)<input required maxLength={255} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="ky-thuat-canh-tac" className="block w-full border rounded-lg p-2 mt-1" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></label>
          <div><p className="mb-2">Ảnh đại diện <span className="text-red-700">*</span></p><ImageUploader url={form.thumbnailUrl} alt="Ảnh bài viết" upload={contentApi.uploadArticleImage}
            disabled={busy || !has('ARTICLES.MANAGE')} onUploadingChange={setUploading}
            onUploaded={image => setForm(current => ({ ...current, thumbnailUrl: image.url }))} onRemove={() => setForm(current => ({ ...current, thumbnailUrl: null }))}
            hint="Chọn hoặc kéo ảnh từ máy. JPG, PNG, WebP, tối đa 3 MB. Bài viết cần có ảnh đại diện trước khi lưu." /></div>
          <label className="block">Tóm tắt<textarea aria-label="Tóm tắt" maxLength={1000} rows={3} className="block w-full border rounded-lg p-2 mt-1" value={form.summary ?? ''} onChange={e => setForm({ ...form, summary: e.target.value })} /></label>
          <label className="block">Nội dung<textarea aria-label="Nội dung" required maxLength={100000} rows={12} className="block w-full border rounded-lg p-3 mt-1" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></label>
        </fieldset>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" disabled={busy || uploading} onClick={() => setOpen(false)}>Đóng</button>{has('ARTICLES.MANAGE') && <button type="submit" disabled={busy || uploading || !form.thumbnailUrl} className="rounded-lg bg-primary text-white px-4 py-2 disabled:opacity-50">{uploading ? 'Đang tải ảnh...' : busy ? 'Đang lưu...' : target ? 'Lưu bài viết' : 'Tạo bản nháp'}</button>}</div>
      </form>
    </FormModal>
    <ConfirmModal open={!!pending} onClose={() => setPending(null)} title={pending?.status ? 'Đổi trạng thái bài viết' : 'Xóa bài viết'} confirmLabel="Xác nhận" tone={pending?.status ? 'primary' : 'danger'} busy={busy} onConfirm={() => void apply()} message={`${pending?.item.title ?? ''}${pending?.status ? ` → ${articleLabels[pending.status]}` : ' sẽ bị xóa khỏi danh sách và trang kiến thức.'}`}>
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </ConfirmModal>
  </div>
}
