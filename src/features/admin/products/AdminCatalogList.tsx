import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { useCallback, useRef, useState } from 'react'
import { adminCatalogApi, type AdminCatalogRow, type CatalogKind, type CatalogInput } from '@/api/adminCatalogApi'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { usePermission } from '@/context/PermissionContext'
import { describeError } from '@/api/client'
import { useServerList } from '@/hooks/useServerList'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useFormValues } from '@/hooks/useFormValues'
import ListToolbar from '@/components/ui/ListToolbar'
import ListReportCards from '@/features/agent/reports/ListReportCards'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import FormModal from '@/components/ui/FormModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import StatusBadge from '@/components/ui/StatusBadge'
import ProductThumb from '@/components/ui/ProductThumb'
import ImageUploader from '@/features/products/ImageUploader'
import { productsApi, storageKeyFromUrl, type UploadedImage } from '@/api/productsApi'
import { LIST_PAGE_SIZE } from '@/utils/pagination'

export default function AdminCatalogList({ kind }: { kind: CatalogKind }) {
  const category = kind === 'categories'
  const brand = kind === 'brands'
  const title = category ? 'Danh mục sản phẩm' : brand ? 'Thương hiệu' : 'Hoạt chất'
  const unit = category ? 'danh mục' : brand ? 'thương hiệu' : 'hoạt chất'
  const permission = category ? 'CATEGORIES' : brand ? 'BRANDS' : 'INGREDIENTS'
  usePageHeader({ title })
  const { has } = usePermission()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const keyword = useDebouncedValue(search.trim())
  const load = useCallback((page: number, signal: AbortSignal) => adminCatalogApi.list(kind, page, keyword, status ? status === 'true' : undefined, signal), [kind, keyword, status])
  const list = useServerList(load)
  const [editing, setEditing] = useState<AdminCatalogRow | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AdminCatalogRow | null>(null)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const uploadedLogoKeys = useRef<string[]>([])
  const deferredLogoDeletes = useRef<string[]>([])
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const form = useFormValues({ name: '', code: '', description: '', displayOrder: '', logoUrl: '' })
  const open = (row?: AdminCatalogRow) => {
    uploadedLogoKeys.current = []
    deferredLogoDeletes.current = []
    form.reset({ name: row?.name ?? '', code: row?.code ?? '', description: row?.description ?? '', displayOrder: row ? String((row.displayOrder ?? 0) + 1) : '', logoUrl: row?.logoUrl ?? '' })
    setEditing(row ?? 'new')
  }
  const cleanupUploadedLogos = () => {
    const keys = uploadedLogoKeys.current.splice(0)
    for (const key of keys) void productsApi.deleteImage(key).catch(() => undefined)
  }
  const run = async (operation: () => Promise<unknown>, success: string) => {
    if (saving.current) return
    saving.current = true
    setBusy(true)
    try {
      await operation()
      const currentLogoKey = brand ? storageKeyFromUrl(form.values.logoUrl) : null
      const cleanupKeys = uploadedLogoKeys.current.filter(key => key !== currentLogoKey)
      for (const key of new Set([...cleanupKeys, ...deferredLogoDeletes.current])) void productsApi.deleteImage(key).catch(() => undefined)
      uploadedLogoKeys.current = currentLogoKey ? [currentLogoKey] : []
      deferredLogoDeletes.current = []
      showToast(success, 'success'); setEditing(null); setDeleting(null); list.reload()
    }
    catch (err) { showToast(describeError(err, 'Không lưu được thay đổi'), 'error') }
    finally { saving.current = false; setBusy(false) }
  }
  const save = () => {
    if (!editing || busy) return
    if (!form.values.name.trim()) { showToast(`Nhập tên ${unit}.`, 'warning'); return }
    if (category && editing === 'new' && !form.values.code.trim()) { showToast('Nhập mã danh mục.', 'warning'); return }
    if (form.values.name.trim().length > (category || brand ? 150 : 200) || form.values.code.trim().length > 50 || form.values.description.trim().length > 500) { showToast('Tên, mã hoặc mô tả vượt quá độ dài cho phép.', 'warning'); return }
    if (!has(`${permission}.${editing === 'new' ? 'CREATE' : 'UPDATE'}`)) return
    const data: CatalogInput = { name: form.values.name.trim(), description: form.values.description.trim() || null }
    if (category) {
      const positionText = form.values.displayOrder.trim()
      if (positionText) {
        const position = Number(positionText)
        if (!Number.isInteger(position) || position < 1) { showToast('Vị trí phải là số nguyên dương.', 'warning'); return }
        data.displayOrder = position - 1
      } else {
        data.displayOrder = null
      }
      data.parentId = editing === 'new' ? null : editing.parentId ?? null
      if (editing === 'new') data.code = form.values.code.trim()
    } else data.code = form.values.code.trim() || null
    if (brand) {
      data.logoUrl = form.values.logoUrl.trim() || null
    }
    void run(() => editing === 'new' ? adminCatalogApi.create(kind, data) : adminCatalogApi.update(kind, editing.id, data), 'Đã lưu thay đổi')
  }
  const reorder = (row: AdminCatalogRow, index: number) => {
    if (!category || busy || !has('CATEGORIES.UPDATE') || draggedId === null || draggedId === row.id) return
    const source = list.items.find(item => item.id === draggedId)
    if (!source || (source.parentId ?? null) !== (row.parentId ?? null)) return
    const targetPosition = row.displayOrder ?? index
    setDraggedId(null)
    void run(() => adminCatalogApi.reorder(draggedId, targetPosition), 'Đã cập nhật thứ tự danh mục')
  }
  const handleUploadedLogo = (image: UploadedImage) => {
    const previousKey = storageKeyFromUrl(form.values.logoUrl)
    if (previousKey && !deferredLogoDeletes.current.includes(previousKey)) deferredLogoDeletes.current.push(previousKey)
    uploadedLogoKeys.current.push(image.storageKey)
    form.update('logoUrl', image.url)
  }
  const handleRemoveLogo = () => {
    const key = storageKeyFromUrl(form.values.logoUrl)
    if (key && !deferredLogoDeletes.current.includes(key)) deferredLogoDeletes.current.push(key)
    form.update('logoUrl', '')
  }
  return <div className="max-w-[1600px] mx-auto space-y-5">
    <ListReportCards title={`Tổng hợp ${unit}`} totalCount={list.totalCount} unit={unit} loading={list.loading} error={!!list.error} metrics={[
      { label: 'Đang hoạt động', value: list.items.filter(row => row.isActive).length },
      { label: 'Ngừng hoạt động', value: list.items.filter(row => !row.isActive).length },
      { label: 'Có mô tả', value: list.items.filter(row => row.description?.trim()).length },
    ]} />
    <ListToolbar search={{ value: search, onChange: value => { setSearch(value.slice(0, 100)); list.setPage(1) }, placeholder: `Tìm theo mã hoặc tên ${unit}...` }} onClear={() => { setSearch(''); setStatus(''); list.setPage(1) }} actions={has(`${permission}.CREATE`) && <button className="bg-primary-dark text-white rounded-[10px] px-4 font-semibold" onClick={() => open()}>+ Thêm {unit}</button>}>
      <FilterSelect label="Lọc trạng thái" value={status} onChange={value => { setStatus(value); list.setPage(1) }} options={[{ value: '', label: 'Mọi trạng thái' }, { value: 'true', label: 'Hoạt động' }, { value: 'false', label: 'Ngừng hoạt động' }]} />
    </ListToolbar>
    {list.error && <div role="alert" className="text-rose-700">{list.error} <button onClick={list.reload}>Thử lại</button></div>}
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-busy={list.loading}>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[700px]">
        <thead className="bg-slate-50"><tr>{category && <th className="p-4" scope="col">Vị trí</th>}{brand && <th className="p-4 w-20" scope="col">Logo</th>}<th className="p-4" scope="col">Mã</th><th className="p-4" scope="col">Tên {unit}</th><th className="p-4" scope="col">Mô tả</th><th className="p-4" scope="col">Trạng thái</th><th className="p-4 text-right" scope="col">Thao tác</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {list.items.map((row, index) => <tr key={row.id} draggable={category && has('CATEGORIES.UPDATE') && !busy && !keyword && !status} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', row.id); setDraggedId(row.id) }} onDragEnd={() => setDraggedId(null)} onDragOver={event => { if (category && draggedId && draggedId !== row.id) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } }} onDrop={event => { event.preventDefault(); reorder(row, index) }} className={`hover:bg-slate-50 ${draggedId === row.id ? 'opacity-50' : ''}`}>
            {brand && <td className="p-4"><ProductThumb src={row.logoUrl} alt={`Logo ${row.name}`} className="w-12 h-12 rounded-lg border border-slate-200 [&_img]:object-contain [&_img]:bg-white [&_img]:p-1" /></td>}
            {category && <td className="p-4 text-slate-500" title="Kéo để đổi vị trí"><span className="cursor-grab select-none" aria-label={`Kéo ${row.name}`}>⠿ {row.displayOrder === undefined ? '—' : row.displayOrder + 1}</span></td>}<td className="p-4 font-mono text-xs">{row.code || '—'}</td><td className="p-4 font-semibold">{row.name}</td><td className="p-4 max-w-sm break-words">{row.description || '—'}</td><td className="p-4"><StatusBadge label={row.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'} /></td>
            <td className="p-4 text-right"><RowActionsMenu disabled={busy} triggerLabel={`Thao tác ${row.name}`} actions={[
              { label: 'Sửa thông tin', icon: 'edit', permissionCodes: [`${permission}.UPDATE`], onClick: () => open(row) },
              { label: row.isActive ? 'Ngừng hoạt động' : 'Kích hoạt', icon: row.isActive ? 'pause_circle' : 'play_circle', permissionCodes: [`${permission}.${row.isActive ? 'DEACTIVATE' : 'ACTIVATE'}`], onClick: () => { if (has(`${permission}.${row.isActive ? 'DEACTIVATE' : 'ACTIVATE'}`)) void run(() => adminCatalogApi.setActive(kind, row.id, !row.isActive), 'Đã đổi trạng thái') } },
              { label: 'Xóa', icon: 'delete', tone: 'danger', permissionCodes: [`${permission}.DELETE`], onClick: () => setDeleting(row) },
            ]} /></td>
          </tr>)}
          {!list.items.length && <EmptyTableRow colSpan={category || brand ? 6 : 5} message={list.loading ? 'Đang tải...' : list.error ? 'Không tải được dữ liệu.' : `Không có ${unit} phù hợp.`} />}
        </tbody>
      </table></div>
      <ServerPagination page={list.page} pageSize={LIST_PAGE_SIZE} totalCount={list.totalCount} totalPages={list.totalPages} unitLabel={unit} onPageChange={list.setPage} />
    </div>
    <FormModal open={editing !== null} busy={busy} onClose={() => { if (!busy) { cleanupUploadedLogos(); deferredLogoDeletes.current = []; setEditing(null) } }} title={`${editing === 'new' ? 'Thêm' : 'Sửa'} ${unit}`} values={form.values} onChange={form.update} onSubmit={save} submitLabel={busy ? 'Đang lưu...' : 'Lưu'} fields={[
      { key: 'name', label: 'Tên', required: true },
      ...(!category || editing === 'new' ? [{ key: 'code', label: 'Mã', required: category }] : []),
      { key: 'description', label: 'Mô tả' },
      ...(brand ? [{ key: 'logo', type: 'note' as const, content: <ImageUploader alt="Logo thương hiệu" url={form.values.logoUrl || null} onUploaded={handleUploadedLogo} onRemove={handleRemoveLogo} disabled={busy} /> }] : []),
      ...(category ? [{ key: 'displayOrder', label: 'Vị trí', type: 'number' as const, min: '1', placeholder: 'Để trống để xếp cuối' }] : []),
    ]} />
    <ConfirmModal open={deleting !== null} title={`Xóa ${unit}`} message={`Bạn có chắc muốn xóa “${deleting?.name ?? ''}”? ${category ? 'Danh mục có danh mục con hoặc sản phẩm sẽ không thể xóa.' : brand ? 'Thương hiệu đang có sản phẩm sẽ không thể xóa.' : ''}`} confirmLabel="Xóa" tone="danger" busy={busy} onClose={() => { if (!busy) setDeleting(null) }} onConfirm={() => { if (deleting && has(`${permission}.DELETE`)) void run(() => adminCatalogApi.remove(kind, deleting.id), 'Đã xóa') }} />
  </div>
}
