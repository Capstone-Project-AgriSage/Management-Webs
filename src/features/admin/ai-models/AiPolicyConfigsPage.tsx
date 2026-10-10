import { useEffect, useState } from 'react'
import { aiModelsApi, listModelOptions, type AiModelRow, type AiPolicyRow } from '@/api/aiModelsApi'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { usePermission } from '@/context/PermissionContext'
import { usePagination } from '@/hooks/usePagination'
import { describeError } from '@/api/client'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import EmptyTableRow from '@/components/ui/EmptyTableRow'

export default function AiPolicyConfigsPage() {
  usePageHeader({ title: 'Chính sách AI' })
  const { has } = usePermission()
  const { showToast } = useToast()
  const [models, setModels] = useState<AiModelRow[]>([])
  const [modelId, setModelId] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [policies, setPolicies] = useState<AiPolicyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ version: '', minimumConfidence: '0.8', topK: '3', effectiveFrom: '' })
  useEffect(() => {
    const controller = new AbortController()
    listModelOptions(controller.signal).then(rows => { if (!controller.signal.aborted) { setModels(rows); setModelId(rows[0]?.id ?? ''); setLoading(false) } }).catch(err => { if (!controller.signal.aborted) { setError(describeError(err)); setLoading(false) } })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setPolicies([])
    if (!modelId) return () => controller.abort()
    setLoading(true); setError('')
    aiModelsApi.policies(modelId, controller.signal).then(rows => { if (!controller.signal.aborted) setPolicies(rows) }).catch(err => { if (!controller.signal.aborted) setError(describeError(err)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [modelId, revision])
  const keyword = search.trim().toLowerCase()
  const matches = policies.filter(row => (!keyword || `${row.id} ${row.version}`.toLowerCase().includes(keyword)) && (!status || row.status === status))
  const pages = usePagination(matches, 10, [modelId, search, status].join('|'))
  const run = async (operation: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    try { await operation(); setCreating(false); setRevision(value => value + 1); showToast('Đã lưu chính sách AI', 'success') }
    catch (err) { showToast(describeError(err), 'error') }
    finally { setBusy(false) }
  }
  const create = () => {
    const confidence = Number(form.minimumConfidence), topK = Number(form.topK), effectiveFrom = new Date(form.effectiveFrom)
    if (!form.version.trim() || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 || !Number.isInteger(topK) || topK < 1 || topK > 10 || !Number.isFinite(effectiveFrom.getTime())) { showToast('Kiểm tra phiên bản, ngưỡng 0–1, Top K từ 1–10 và ngày hiệu lực.', 'warning'); return }
    if (modelId && has('AI_POLICIES.CREATE')) void run(() => aiModelsApi.createPolicy(modelId, { version: form.version.trim(), minimumConfidence: confidence, topK, effectiveFrom: effectiveFrom.toISOString(), requiresHumanReview: true }))
  }
  return <div className="max-w-[1600px] mx-auto space-y-5">
    <ListToolbar search={{ value: search, onChange: setSearch, placeholder: 'Tìm theo ID hoặc phiên bản chính sách...' }} onClear={() => { setSearch(''); setStatus(''); setModelId(models[0]?.id ?? ''); pages.setPage(1) }} actions={has('AI_POLICIES.CREATE') && <button disabled={!modelId || loading} onClick={() => { setForm({ version: '', minimumConfidence: '0.8', topK: '3', effectiveFrom: '' }); setCreating(true) }} className="bg-primary-dark text-white px-4 rounded-[10px] font-semibold">+ Tạo chính sách</button>}>
      <FilterSelect label="Mô hình AI" value={modelId} onChange={setModelId} options={[{ value: '', label: 'Chọn mô hình AI' }, ...models.map(model => ({ value: model.id, label: `${model.name} · ${model.version}` }))]} />
      <FilterSelect label="Lọc trạng thái" value={status} onChange={setStatus} options={[{ value: '', label: 'Mọi trạng thái' }, { value: 'DRAFT', label: 'Bản nháp' }, { value: 'ACTIVE', label: 'Đang hoạt động' }, { value: 'INACTIVE', label: 'Ngừng hoạt động' }]} />
    </ListToolbar>
    {error && <div role="alert" className="text-rose-700">{error}</div>}
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" aria-busy={loading}>
      <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm text-left"><thead className="bg-slate-50"><tr><th className="p-4">Phiên bản</th><th className="p-4">Ngưỡng tin cậy</th><th className="p-4">Top K</th><th className="p-4">Ngày hiệu lực</th><th className="p-4">Trạng thái</th><th className="p-4">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">
        {pages.paginated.map(policy => <tr key={policy.id}><td className="p-4 font-semibold">{policy.version}</td><td className="p-4">{policy.minimumConfidence}</td><td className="p-4">{policy.topK}</td><td className="p-4">{new Date(policy.effectiveFrom).toLocaleDateString('vi-VN')}</td><td className="p-4">{policy.status}</td><td className="p-4">{has(`AI_POLICIES.${policy.status === 'ACTIVE' ? 'DEACTIVATE' : 'ACTIVATE'}`) && <button disabled={busy} className="text-primary font-semibold" onClick={() => void run(() => aiModelsApi.setPolicyActive(policy.id, policy.status !== 'ACTIVE'))}>{policy.status === 'ACTIVE' ? 'Ngừng hoạt động' : 'Kích hoạt'}</button>}</td></tr>)}
        {!pages.paginated.length && <EmptyTableRow colSpan={6} message={loading ? 'Đang tải...' : 'Không có chính sách phù hợp.'} />}
      </tbody></table></div><Pagination {...pages} unitLabel="chính sách" />
    </div>
    <Modal open={creating} onClose={() => { if (!busy) setCreating(false) }} title="Tạo chính sách AI">
      <div className="grid grid-cols-2 gap-4 text-sm">
        {([{ key: 'version', label: 'Phiên bản', type: 'text' }, { key: 'minimumConfidence', label: 'Ngưỡng tin cậy (0–1)', type: 'number' }, { key: 'topK', label: 'Top K (1–10)', type: 'number' }, { key: 'effectiveFrom', label: 'Hiệu lực từ', type: 'datetime-local' }] as const).map(field => <label key={field.key}>{field.label}<input disabled={busy} className="w-full border rounded-lg p-2 mt-1" type={field.type} step={field.key === 'minimumConfidence' ? '0.01' : undefined} value={form[field.key]} onChange={event => setForm(previous => ({ ...previous, [field.key]: event.target.value }))} /></label>)}
      </div><button disabled={busy} onClick={create} className="bg-primary-dark text-white px-4 py-2 rounded-lg mt-4">{busy ? 'Đang lưu...' : 'Tạo chính sách'}</button>
    </Modal>
  </div>
}
