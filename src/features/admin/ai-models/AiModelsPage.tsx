import RowActionsMenu from '@/components/ui/RowActionsMenu'
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
import ListReportCards from '@/features/agent/reports/ListReportCards'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import GeneralModelForm from './GeneralModelForm'
import { providerInfo } from '@/api/aiProviderApi'
import { cropLabel } from '@/features/diagnosis/diagnosisLabels'

const labels: Record<string, string> = { DRAFT: 'Bản nháp', ACTIVE: 'Đang hoạt động', RETIRED: 'Đã ngừng' }
const frameworkLabel = (framework: string | null | undefined) => providerInfo(framework)?.label ?? framework ?? '—'
const initialManifest = JSON.stringify({ name: '', version: '', framework: 'pytorch', modelStorageUrl: '', classLabels: ['HEALTHY'] }, null, 2)
// A general model (Claude/Gemini) answers every crop; a crop model (manifest) only its own crop (AI_DIAGNOSIS.md D19).
const isGeneral = (model: AiModelRow) => !!providerInfo(model.framework)
const cropText = (model: AiModelRow) => isGeneral(model) ? 'Mọi cây' : model.cropType ? cropLabel(model.cropType) : '—'

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
  // A general model (Claude or Gemini) chosen by crop (AI_DIAGNOSIS.md 2.2), or a fixed-class model described by its JSON manifest.
  const [mode, setMode] = useState<'general' | 'manifest'>('general')
  const [manifest, setManifest] = useState(initialManifest)
  const [detail, setDetail] = useState<AiModelRow | null>(null)
  const [retiring, setRetiring] = useState<AiModelRow | null>(null)
  const [activating, setActivating] = useState<AiModelRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const run = async (operation: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true); setFormError('')
    try { await operation(); setCreating(false); setRetiring(null); setActivating(null); list.reload(); showToast('Đã lưu thay đổi', 'success') }
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
    <ListReportCards title="Tổng hợp mô hình AI" totalCount={list.totalCount} unit="mô hình" loading={list.loading} error={!!list.error} metrics={[
      { label: 'Đang hoạt động', value: list.items.filter(model => model.status === 'ACTIVE').length },
      { label: 'Bản nháp', value: list.items.filter(model => model.status === 'DRAFT').length },
      { label: 'Đã ngừng', value: list.items.filter(model => model.status === 'RETIRED').length },
    ]} />
    <ListToolbar search={{ value: search, onChange: value => { setSearch(value); list.setPage(1) }, placeholder: 'Tìm theo tên, ID hoặc phiên bản mô hình...' }} onClear={() => { setSearch(''); setStatus(''); list.setPage(1) }} actions={has('AI_MODELS.CREATE') && <button className="bg-primary-dark text-white px-4 rounded-[10px] font-semibold" onClick={() => { setManifest(initialManifest); setMode('general'); setFormError(''); setCreating(true) }}>+ Đăng ký mô hình</button>}>
      <FilterSelect label="Lọc trạng thái" value={status} onChange={value => { setStatus(value); list.setPage(1) }} options={[{ value: '', label: 'Mọi trạng thái' }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} />
    </ListToolbar>
    {list.error && <div role="alert" className="text-rose-700">{list.error} <button onClick={list.reload}>Thử lại</button></div>}
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-busy={list.loading}>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[700px]">
        <thead className="bg-slate-50"><tr><th className="p-4">Mô hình</th><th className="p-4">Phiên bản</th><th className="p-4">Framework</th><th className="p-4">Cây trồng</th><th className="p-4">Trạng thái</th><th className="p-4">Thao tác</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {list.items.map(model => <tr key={model.id} className="hover:bg-slate-50"><td className="p-4 font-semibold">{model.name}</td><td className="p-4">{model.version}</td><td className="p-4">{frameworkLabel(model.framework)}</td><td className="p-4">{cropText(model)}</td><td className="p-4">{labels[model.status] ?? model.status}</td><td className="p-4 text-right"><RowActionsMenu disabled={busy} triggerLabel={`Thao tác mô hình ${model.name}`} actions={[
            { label: 'Xem chi tiết', icon: 'visibility', onClick: () => setDetail(model) },
            ...(model.status === 'DRAFT' ? [{ label: 'Kích hoạt', icon: 'play_circle', permissionCodes: ['AI_MODELS.ACTIVATE'], onClick: () => setActivating(model) }] : []),
            ...(model.status === 'ACTIVE' ? [{ label: 'Ngừng mô hình', icon: 'pause_circle', permissionCodes: ['AI_MODELS.RETIRE'], onClick: () => setRetiring(model) }] : []),
          ]} /></td></tr>)}
          {!list.items.length && <EmptyTableRow colSpan={6} message={list.loading ? 'Đang tải...' : list.error ? 'Không tải được dữ liệu.' : 'Không có mô hình phù hợp.'} />}
        </tbody>
      </table></div>
      <ServerPagination page={list.page} pageSize={LIST_PAGE_SIZE} totalCount={list.totalCount} totalPages={list.totalPages} unitLabel="mô hình" onPageChange={list.setPage} />
    </div>
    <Modal open={creating} onClose={() => { if (!busy) setCreating(false) }} title="Đăng ký mô hình AI">
      <div role="group" aria-label="Loại mô hình" className="mb-4 inline-flex rounded-lg border border-slate-200 p-1 text-sm">
        {([['general', 'Claude / Gemini theo cây trồng'], ['manifest', 'Mô hình riêng một cây (manifest JSON)']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} disabled={busy}
          onClick={() => { setMode(value); setFormError('') }} className={`rounded-md px-3 py-1.5 font-semibold ${mode === value ? 'bg-primary-dark text-white' : 'text-slate-700'}`}>{label}</button>)}
      </div>
      {mode === 'general'
        ? <GeneralModelForm busy={busy} onSubmit={value => { if (has('AI_MODELS.CREATE')) void run(() => aiModelsApi.create(value)) }} />
        : <>
          <p className="text-xs text-slate-500 mb-2">Mô hình riêng chỉ trả lời một cây: classLabels gồm HEALTHY và mã bệnh của đúng cây đó (ví dụ thanh long: HEALTHY, DRAGONFRUIT_STEM_CANKER). Khi đang hoạt động, ảnh của cây này đi tới mô hình riêng; các cây khác vẫn dùng Claude/Gemini.</p>
          <label className="block text-sm font-semibold">Manifest mô hình (JSON)<textarea className="mt-2 w-full h-80 border rounded-lg p-3 font-mono text-xs" value={manifest} onChange={event => setManifest(event.target.value)} disabled={busy} /></label>
          <button onClick={create} disabled={busy} className="mt-4 bg-primary-dark text-white px-4 py-2 rounded-lg">{busy ? 'Đang lưu...' : 'Đăng ký'}</button>
        </>}
      {formError && <p role="alert" className="text-rose-700 mt-2">{formError}</p>}
    </Modal>
    <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail?.name ?? 'Chi tiết mô hình'}>
      {detail && <div className="space-y-3 text-sm"><p>{detail.version} · {frameworkLabel(detail.framework)} · {detail.architecture || '—'}</p><p>{labels[detail.status] ?? detail.status} · Cây trồng: {cropText(detail)}</p><p><span className="font-semibold">{(detail.classLabels ?? []).length} nhãn:</span> <span className="font-mono text-xs break-all">{(detail.classLabels ?? []).join(', ') || '—'}</span></p><pre className="bg-slate-50 p-3 rounded-lg overflow-auto text-xs">{JSON.stringify(detail.metrics ?? {}, null, 2)}</pre></div>}
    </Modal>
    <ConfirmModal open={activating !== null} title="Kích hoạt mô hình AI" confirmLabel="Kích hoạt" busy={busy} onClose={() => setActivating(null)}
      message={activating && (isGeneral(activating)
        ? `${activating.name} sẽ trả lời mọi cây. Mô hình chung (Claude/Gemini) đang hoạt động sẽ ngừng; mô hình riêng của một cây vẫn giữ.`
        : `${activating.name} sẽ trả lời ảnh ${cropText(activating).toLowerCase()}. Mô hình riêng đang hoạt động (nếu có) sẽ ngừng; mô hình chung Claude/Gemini vẫn giữ cho các cây khác.`)}
      onConfirm={() => { if (activating && has('AI_MODELS.ACTIVATE')) { const id = activating.id; void run(() => aiModelsApi.activate(id)) } }} />
    <ConfirmModal open={retiring !== null} title="Ngừng mô hình AI" message={retiring?.name} confirmLabel="Ngừng mô hình" busy={busy} onClose={() => setRetiring(null)} onConfirm={() => { if (retiring && has('AI_MODELS.RETIRE')) void run(() => aiModelsApi.retire(retiring.id)) }} />
  </div>
}
