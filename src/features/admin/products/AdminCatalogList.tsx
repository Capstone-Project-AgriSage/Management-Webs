import { useCallback, useState } from 'react'
import { adminCatalogApi, type AdminCatalogRow, type CatalogKind, type CatalogInput } from '@/api/adminCatalogApi'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { usePermission } from '@/context/PermissionContext'
import { describeError } from '@/api/client'
import { useServerList } from '@/hooks/useServerList'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useFormValues } from '@/hooks/useFormValues'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import FormModal from '@/components/ui/FormModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { LIST_PAGE_SIZE } from '@/utils/pagination'

export default function AdminCatalogList({ kind }: { kind: CatalogKind }) {
  const category = kind === 'categories'
  const title = category ? 'Danh mục sản phẩm' : 'Hoạt chất'
  const unit = category ? 'danh mục' : 'hoạt chất'
  const permission = category ? 'CATEGORIES' : 'INGREDIENTS'
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
  const form = useFormValues({ name: '', code: '', description: '', displayOrder: '0' })
  const open = (row?: AdminCatalogRow) => {
    form.reset({ name: row?.name ?? '', code: row?.code ?? '', description: row?.description ?? '', displayOrder: String(row?.displayOrder ?? 0) })
    setEditing(row ?? 'new')
  }
  const run = async (operation: () => Promise<unknown>, success: string) => {
    if (busy) return
    setBusy(true)
    try { await operation(); showToast(success, 'success'); setEditing(null); setDeleting(null); list.reload() }
    catch (err) { showToast(describeError(err, 'Không lưu được thay đổi'), 'error') }
    finally { setBusy(false) }
  }
  const save = () => {
    if (!editing) return
    if (!form.values.name.trim() || (category && editing === 'new' && !form.values.code.trim())) { showToast('Nhập tên và mã bắt buộc.', 'warning'); return }
    if (!has(`${permission}.${editing === 'new' ? 'CREATE' : 'UPDATE'}`)) return
    const data: CatalogInput = { name: form.values.name.trim(), description: form.values.description.trim() || null }
    if (category) {
      const displayOrder = Number(form.values.displayOrder)
      if (!Number.isInteger(displayOrder) || displayOrder < 0) { showToast('Thứ tự phải là số nguyên không âm', 'warning'); return }
      data.displayOrder = displayOrder
      data.parentId = editing === 'new' ? null : editing.parentId ?? null
      if (editing === 'new') data.code = form.values.code.trim()
    } else data.code = form.values.code.trim() || null
    void run(() => editing === 'new' ? adminCatalogApi.create(kind, data) : adminCatalogApi.update(kind, editing.id, data), 'Đã lưu thay đổi')
  }
  return <div className="max-w-[1600px] mx-auto space-y-5">
    <ListToolbar search={{ value: search, onChange: value => { setSearch(value.slice(0, 100)); list.setPage(1) }, placeholder: `Tìm theo mã hoặc tên ${unit}...` }} onClear={() => { setSearch(''); setStatus(''); list.setPage(1) }} actions={has(`${permission}.CREATE`) && <button className="bg-primary-dark text-white rounded-[10px] px-4 font-semibold" onClick={() => open()}>+ Thêm {unit}</button>}>
      <FilterSelect label="Lọc trạng thái" value={status} onChange={value => { setStatus(value); list.setPage(1) }} options={[{ value: '', label: 'Mọi trạng thái' }, { value: 'true', label: 'Hoạt động' }, { value: 'false', label: 'Ngừng hoạt động' }]} />
    </ListToolbar>
    {list.error && <div role="alert" className="text-rose-700">{list.error} <button onClick={list.reload}>Thử lại</button></div>}
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-busy={list.loading}>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[700px]">
        <thead className="bg-slate-50"><tr><th className="p-4">Mã</th><th className="p-4">Tên {unit}</th><th className="p-4">Mô tả</th><th className="p-4">Trạng thái</th><th className="p-4">Thao tác</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {list.items.map(row => <tr key={row.id} className="hover:bg-slate-50">
            <td className="p-4 font-mono text-xs">{row.code || '—'}</td><td className="p-4 font-semibold">{row.name}</td><td className="p-4 max-w-sm">{row.description || '—'}</td><td className="p-4">{row.isActive ? 'Hoạt động' : 'Ngừng hoạt động'}</td>
            <td className="p-4"><div className="flex gap-3 whitespace-nowrap">
              {has(`${permission}.UPDATE`) && <button disabled={busy} onClick={() => open(row)} className="text-primary font-semibold">Sửa</button>}
              {has(`${permission}.${row.isActive ? 'DEACTIVATE' : 'ACTIVATE'}`) && <button disabled={busy} onClick={() => void run(() => adminCatalogApi.setActive(kind, row.id, !row.isActive), 'Đã đổi trạng thái')}>{row.isActive ? 'Ngừng hoạt động' : 'Kích hoạt'}</button>}
              {has(`${permission}.DELETE`) && <button disabled={busy} onClick={() => setDeleting(row)} className="text-rose-700">Xóa</button>}
            </div></td>
          </tr>)}
          {!list.items.length && <EmptyTableRow colSpan={5} message={list.loading ? 'Đang tải...' : list.error ? 'Không tải được dữ liệu.' : `Không có ${unit} phù hợp.`} />}
        </tbody>
      </table></div>
      <ServerPagination page={list.page} pageSize={LIST_PAGE_SIZE} totalCount={list.totalCount} totalPages={list.totalPages} unitLabel={unit} onPageChange={list.setPage} />
    </div>
    <FormModal open={editing !== null} onClose={() => { if (!busy) setEditing(null) }} title={`${editing === 'new' ? 'Thêm' : 'Sửa'} ${unit}`} values={form.values} onChange={form.update} onSubmit={save} submitLabel={busy ? 'Đang lưu...' : 'Lưu'} fields={[
      { key: 'name', label: 'Tên', required: true },
      ...(!category || editing === 'new' ? [{ key: 'code', label: 'Mã', required: category }] : []),
      { key: 'description', label: 'Mô tả' },
      ...(category ? [{ key: 'displayOrder', label: 'Thứ tự', type: 'number' as const, min: '0' }] : []),
    ]} />
    <ConfirmModal open={deleting !== null} title={`Xóa ${unit}`} message={deleting?.name} confirmLabel="Xóa" tone="danger" busy={busy} onClose={() => setDeleting(null)} onConfirm={() => { if (deleting && has(`${permission}.DELETE`)) void run(() => adminCatalogApi.remove(kind, deleting.id), 'Đã xóa') }} />
  </div>
}
