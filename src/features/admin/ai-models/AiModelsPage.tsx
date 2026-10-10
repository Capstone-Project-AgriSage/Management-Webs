import { useCallback, useState } from 'react'
import { aiModelsApi, searchAiModels, type AiModelInput, type AiModelRow } from '@/api/aiModelsApi'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { usePermission } from '@/context/PermissionContext'
import { useServerList } from '@/hooks/useServerList'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { describeError } from '@/api/client'
import { LIST_PAGE_SIZE } from '@/utils/pagination'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import EmptyTableRow from '@/components/ui/EmptyTableRow'

const labels: Record<string, string> = { DRAFT: 'Bản nháp', ACTIVE: 'Đang hoạt động', RETIRED: 'Đã ngừng' }
const initialManifest = JSON.stringify({ name: '', version: '', framework: 'PyTorch', modelStorageUrl: '', classLabels: ['LEAF_BLAST', 'BACTERIAL_LEAF_BLIGHT', 'BROWN_SPOT', 'SHEATH_BLIGHT', 'HEALTHY'] }, null, 2)

export default function AiModelsPage() {
  usePageHeader({ title: 'Mô hình AI' })
  const { has } = usePermission()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const keyword = useDebouncedValue(search.trim())
  const load = useCallback((page: number, signal: AbortSignal) => searchAiModels(page, status, keyword, signal), [status, keyword])
  const list = useServerList(load)
  const [creating, setCreating] = useState(false)
  const [manifest, setManifest] = useState(initialManifest)
  const [detail, setDetail] = useState<AiModelRow | null>(null)
  const [retiring, setRetiring] = useState<AiModelRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const run = async (operation: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true); setFormError('')
    try { await operation(); setCreating(false); setRetiring(null); list.reload(); showToast('Đã lưu thay đổi', 'success') }
    catch (err) { const error = describeError(err, 'Không lưu được mô hình'); setFormError(error); showToast(error, 'error') }
    finally { setBusy(false) }
  }
  const create = () => {
    if (!has('AI_MODELS.CREATE')) return
    try {
      const value = JSON.parse(manifest) as AiModelInput
      if (!value || typeof value !== 'object' || Array.isArray(value) || !value.name?.trim() || !value.version?.trim() || !value.framework?.trim() || !value.modelStorageUrl?.trim() || !Array.isArray(value.classLabels)) {
        setFormError('Nhập tên, phiên bản, framework, URL mô hình và danh sách classLabels.'); return
      }
      void run(() => aiModelsApi.create(value))
    } catch { setFormError('Manifest phải là JSON hợp lệ.') }
  }
  return <div className="max-w-[1600px] mx-auto space-y-5">
    <ListToolbar search={{ value: search, onChange: value => { setSearch(value); list.setPage(1) }, placeholder: 'Tìm theo tên, ID hoặc phiên bản mô hình...' }} onClear={() => { setSearch(''); setStatus(''); list.setPage(1) }} actions={has('AI_MODELS.CREATE') && <button className="bg-primary-dark text-white px-4 rounded-[10px] font-semibold" onClick={() => { setManifest(initialManifest); setFormError(''); setCreating(true) }}>+ Đăng ký mô hình</button>}>
      <FilterSelect label="Lọc trạng thái" value={status} onChange={value => { setStatus(value); list.setPage(1) }} options={[{ value: '', label: 'Mọi trạng thái' }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} />
    </ListToolbar>
    {list.error && <div role="alert" className="text-rose-700">{list.error} <button onClick={list.reload}>Thử lại</button></div>}
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-busy={list.loading}>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[700px]">
        <thead className="bg-slate-50"><tr><th className="p-4">Mô hình</th><th className="p-4">Phiên bản</th><th className="p-4">Framework</th><th className="p-4">Trạng thái</th><th className="p-4">Thao tác</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {list.items.map(model => <tr key={model.id} className="hover:bg-slate-50"><td className="p-4 font-semibold">{model.name}</td><td className="p-4">{model.version}</td><td className="p-4">{model.framework}</td><td className="p-4">{labels[model.status] ?? model.status}</td><td className="p-4"><div className="flex gap-3 whitespace-nowrap">
            <button onClick={() => setDetail(model)} className="text-primary font-semibold">Chi tiết</button>
            {model.status === 'DRAFT' && has('AI_MODELS.ACTIVATE') && <button disabled={busy} onClick={() => void run(() => aiModelsApi.activate(model.id))}>Kích hoạt</button>}
            {model.status === 'ACTIVE' && has('AI_MODELS.RETIRE') && <button disabled={busy} onClick={() => setRetiring(model)}>Ngừng mô hình</button>}
          </div></td></tr>)}
          {!list.items.length && <EmptyTableRow colSpan={5} message={list.loading ? 'Đang tải...' : list.error ? 'Không tải được dữ liệu.' : 'Không có mô hình phù hợp.'} />}
        </tbody>
      </table></div>
      <ServerPagination page={list.page} pageSize={LIST_PAGE_SIZE} totalCount={list.totalCount} totalPages={list.totalPages} unitLabel="mô hình" onPageChange={list.setPage} />
    </div>
    <Modal open={creating} onClose={() => { if (!busy) setCreating(false) }} title="Đăng ký mô hình AI">
      <label className="block text-sm font-semibold">Manifest mô hình (JSON)<textarea className="mt-2 w-full h-80 border rounded-lg p-3 font-mono text-xs" value={manifest} onChange={event => setManifest(event.target.value)} disabled={busy} /></label>
      {formError && <p role="alert" className="text-rose-700 mt-2">{formError}</p>}
      <button onClick={create} disabled={busy} className="mt-4 bg-primary-dark text-white px-4 py-2 rounded-lg">{busy ? 'Đang lưu...' : 'Đăng ký'}</button>
    </Modal>
    <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail?.name ?? 'Chi tiết mô hình'}>
      {detail && <div className="space-y-3 text-sm"><p>{detail.version} · {detail.framework} · {detail.architecture || '—'}</p><p>{labels[detail.status] ?? detail.status}</p><pre className="bg-slate-50 p-3 rounded-lg overflow-auto text-xs">{JSON.stringify(detail.metrics ?? {}, null, 2)}</pre></div>}
    </Modal>
    <ConfirmModal open={retiring !== null} title="Ngừng mô hình AI" message={retiring?.name} confirmLabel="Ngừng mô hình" busy={busy} onClose={() => setRetiring(null)} onConfirm={() => { if (retiring && has('AI_MODELS.RETIRE')) void run(() => aiModelsApi.retire(retiring.id)) }} />
  </div>
}
