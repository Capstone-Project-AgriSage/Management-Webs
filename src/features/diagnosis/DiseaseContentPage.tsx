import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { usePermission } from '@/context/PermissionContext'
import { describeError } from '@/api/client'
import {
  diseasesApi,
  type Disease,
  type DiseaseContentInput,
  type DiseaseCreateInput,
  type ProblemType,
  type Treatment,
  type TreatmentInput,
  type TreatmentKind,
} from '@/api/diagnosisApi'
import { adminCatalogApi, type AdminCatalogRow } from '@/api/adminCatalogApi'
import ConfirmModal from '@/components/ui/ConfirmModal'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import Select from '@/components/ui/Select'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import KpiCard from '@/components/ui/KpiCard'
import StatusBadge from '@/components/ui/StatusBadge'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'
import DiseaseProductsPanel from './DiseaseProductsPanel'
import { PROBLEM_TYPE_LABEL, TREATMENT_KIND_LABEL, diseaseLabel } from './diagnosisLabels'

const field =
  'w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'

const KINDS = Object.keys(TREATMENT_KIND_LABEL) as TreatmentKind[]
const PROBLEM_TYPES = Object.keys(PROBLEM_TYPE_LABEL) as ProblemType[]

interface ContentForm {
  name: string
  scientificName: string
  description: string
  symptoms: string
  causes: string
  prevention: string
  searchKeywords: string
}

interface CreateForm extends ContentForm {
  code: string
  problemType: ProblemType
}

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,48}$/

const emptyCreate: CreateForm = {
  code: '',
  problemType: 'DISEASE',
  name: '',
  scientificName: '',
  description: '',
  symptoms: '',
  causes: '',
  prevention: '',
  searchKeywords: '',
}

interface TreatmentForm {
  treatmentType: TreatmentKind
  title: string
  instructions: string
  /** '' = no ingredient. */
  activeIngredientId: string
  precautions: string
  priority: string
}

const orNull = (value: string): string | null => value.trim() || null

function contentFormOf(d: Disease): ContentForm {
  return {
    name: d.name,
    scientificName: d.scientificName ?? '',
    description: d.description ?? '',
    symptoms: d.symptoms ?? '',
    causes: d.causes ?? '',
    prevention: d.prevention ?? '',
    searchKeywords: d.searchKeywords ?? '',
  }
}

// The five AI classes cannot be switched off (the AI needs them).
const SEEDED_CODES = new Set(['LEAF_BLAST', 'BACTERIAL_LEAF_BLIGHT', 'BROWN_SPOT', 'SHEATH_BLIGHT', 'HEALTHY'])

const emptyTreatment: TreatmentForm = { treatmentType: 'CHEMICAL', title: '', instructions: '', activeIngredientId: '', precautions: '', priority: '0' }

function treatmentFormOf(t: Treatment): TreatmentForm {
  return {
    treatmentType: t.treatmentType,
    title: t.title,
    instructions: t.instructions,
    activeIngredientId: t.activeIngredientId ?? '',
    precautions: t.precautions ?? '',
    priority: String(t.priority),
  }
}

function priorityOf(value: string): number | null {
  const n = Number(value)
  return value.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 1000 ? n : null
}

const searchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm leading-6 whitespace-pre-line break-words ${value ? 'text-slate-800' : 'text-slate-500'}`}>{value || 'Chưa nhập'}</dd>
    </div>
  )
}

export default function DiseaseContentPage() {
  usePageHeader({
    title: 'Vấn đề trên lúa và cách xử lý',
    subtitle: 'Bệnh, sâu rầy, cỏ dại, dinh dưỡng: nội dung nông dân đọc và các sản phẩm đã duyệt được gợi ý cho từng vấn đề',
  })
  const { has } = usePermission()
  const { showToast } = useToast()
  const canEditDisease = has('DISEASES.UPDATE')
  const canCreateProblem = has('DISEASES.CREATE')
  const canCreate = has('DISEASE_TREATMENTS.CREATE')
  const canUpdate = has('DISEASE_TREATMENTS.UPDATE')
  const canActivate = has('DISEASE_TREATMENTS.ACTIVATE')
  const canDeactivate = has('DISEASE_TREATMENTS.DEACTIVATE')

  const [diseases, setDiseases] = useState<Disease[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [problemType, setProblemType] = useState('')
  const [status, setStatus] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = diseases?.find(d => d.id === selectedId)
  const filtered = useMemo(() => {
    const keyword = searchText(search.trim())
    return (diseases ?? []).filter(d => (!problemType || (d.problemType ?? 'DISEASE') === problemType)
      && (!status || d.isActive === (status === 'active'))
      && (!keyword || searchText([d.code, d.name, diseaseLabel(d.code, d.name), d.searchKeywords, d.symptoms].filter(Boolean).join(' ')).includes(keyword)))
  }, [diseases, search, problemType, status])
  const pagination = usePagination(filtered, undefined, JSON.stringify([search, problemType, status]))

  const [editing, setEditing] = useState<Disease | null>(null)
  const [contentForm, setContentForm] = useState<ContentForm | null>(null)
  // `treatment` is null while a new one is being added to `disease`.
  const [treating, setTreating] = useState<{ disease: Disease; treatment: Treatment | null } | null>(null)
  const [treatmentForm, setTreatmentForm] = useState<TreatmentForm>(emptyTreatment)
  const [stopping, setStopping] = useState<Treatment | null>(null)
  const [ingredients, setIngredients] = useState<AdminCatalogRow[]>([])
  const [creating, setCreating] = useState<CreateForm | null>(null)
  const [switching, setSwitching] = useState<Disease | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    adminCatalogApi
      .activeIngredients(controller.signal)
      .then((res) => setIngredients(res.items))
      .catch(() => undefined) // the picker then only offers "no ingredient"; the page still works
    return () => controller.abort()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDiseases(await diseasesApi.list())
      setLoadError(null)
    } catch (err) {
      setLoadError(describeError(err, 'Không tải được nội dung bệnh'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: () => Promise<unknown>, success: string, failure: string) => {
    setBusy(true)
    try {
      await action()
      await load()
      showToast(success, 'success')
      return true
    } catch (err) {
      showToast(describeError(err, failure), 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const openContent = (d: Disease) => {
    setEditing(d)
    setContentForm(contentFormOf(d))
  }

  const saveContent = async () => {
    if (!editing || !contentForm) return
    const body: DiseaseContentInput = {
      name: contentForm.name.trim(),
      scientificName: orNull(contentForm.scientificName),
      description: orNull(contentForm.description),
      symptoms: orNull(contentForm.symptoms),
      causes: orNull(contentForm.causes),
      prevention: orNull(contentForm.prevention),
      // '' clears the keywords; leaving the field out would keep them.
      searchKeywords: contentForm.searchKeywords.trim(),
    }
    if (await run(() => diseasesApi.update(editing.id, body), 'Đã lưu nội dung bệnh', 'Không lưu được nội dung bệnh')) {
      setEditing(null)
    }
  }

  const saveNewProblem = async () => {
    if (!creating) return
    const body: DiseaseCreateInput = {
      code: creating.code.trim(),
      problemType: creating.problemType,
      name: creating.name.trim(),
      scientificName: orNull(creating.scientificName),
      description: orNull(creating.description),
      symptoms: orNull(creating.symptoms),
      causes: orNull(creating.causes),
      prevention: orNull(creating.prevention),
      searchKeywords: orNull(creating.searchKeywords),
    }
    if (await run(() => diseasesApi.create(body), 'Đã thêm vấn đề', 'Không thêm được vấn đề')) {
      setCreating(null)
    }
  }

  const switchActive = async () => {
    if (!switching) return
    const next = !switching.isActive
    if (await run(() => diseasesApi.setActive(switching.id, next), next ? 'Đã dùng lại vấn đề' : 'Đã ngừng vấn đề', 'Không đổi được trạng thái vấn đề')) {
      setSwitching(null)
    }
  }

  const openTreatment = (disease: Disease, treatment: Treatment | null) => {
    setTreating({ disease, treatment })
    setTreatmentForm(treatment ? treatmentFormOf(treatment) : emptyTreatment)
  }

  const saveTreatment = async () => {
    const priority = priorityOf(treatmentForm.priority)
    if (!treating || priority === null) return
    const body: TreatmentInput = {
      treatmentType: treatmentForm.treatmentType,
      title: treatmentForm.title.trim(),
      instructions: treatmentForm.instructions.trim(),
      activeIngredientId: treatmentForm.activeIngredientId || null,
      precautions: orNull(treatmentForm.precautions),
      priority,
    }
    const { disease, treatment } = treating
    const saved = await run(
      () => (treatment ? diseasesApi.updateTreatment(treatment.id, body) : diseasesApi.createTreatment(disease.id, body)),
      treatment ? 'Đã lưu cách xử lý' : 'Đã thêm cách xử lý',
      'Không lưu được cách xử lý',
    )
    if (saved) setTreating(null)
  }

  const stop = async () => {
    if (!stopping) return
    if (await run(() => diseasesApi.deactivateTreatment(stopping.id), 'Đã ngừng cách xử lý', 'Không ngừng được cách xử lý')) {
      setStopping(null)
    }
  }

  const contentInvalid = !contentForm || !contentForm.name.trim()
  const createInvalid = !creating || !CODE_PATTERN.test(creating.code.trim()) || !creating.name.trim()
  const treatmentInvalid = !treatmentForm.title.trim() || !treatmentForm.instructions.trim() || priorityOf(treatmentForm.priority) === null

  return (
    <div className="max-w-[1600px] mx-auto space-y-5">
        <div className="agrisage-summary-grid grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5" aria-label="Tổng hợp vấn đề trên lúa">
          <KpiCard title="Tổng số vấn đề" value={diseases ? diseases.length : loadError ? 'Lỗi tải' : '—'} subtitle="Toàn bộ danh sách" />
          <KpiCard title="Đang hoạt động" value={diseases ? diseases.filter(d => d.isActive).length : '—'} subtitle="Được hiển thị cho nông dân" />
          <KpiCard title="Cần bổ sung nội dung" value={diseases ? diseases.filter(d => !d.symptoms?.trim() && !d.prevention?.trim()).length : '—'} subtitle="Chưa có triệu chứng và phòng ngừa" />
          <KpiCard title="Cách xử lý đang dùng" value={diseases ? diseases.reduce((sum, d) => sum + d.treatments.filter(t => t.isActive).length, 0) : '—'} subtitle="Trên toàn bộ vấn đề" />
        </div>
        <ListToolbar
          search={{ value: search, onChange: value => setSearch(value.slice(0, 200)), placeholder: 'Tìm mã, tên, triệu chứng, từ khóa...', label: 'Tìm vấn đề trên lúa' }}
          onClear={() => { setSearch(''); setProblemType(''); setStatus('') }}
          actions={canCreateProblem && <button type="button" disabled={busy} onClick={() => setCreating(emptyCreate)} className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16} aria-hidden="true" />Thêm vấn đề</button>}
        >
          <FilterSelect label="Loại vấn đề" value={problemType} onChange={setProblemType} options={[{ value: '', label: 'Tất cả loại' }, ...PROBLEM_TYPES.map(value => ({ value, label: PROBLEM_TYPE_LABEL[value] }))]} />
          <FilterSelect label="Trạng thái" value={status} onChange={setStatus} options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'active', label: 'Đang hoạt động' }, { value: 'inactive', label: 'Đã ngừng' }]} />
        </ListToolbar>

      {loadError && (
        <div role="alert" className="text-rose-700 text-sm">
          {loadError}{' '}
          <button type="button" className="underline" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Danh sách vấn đề</h2>
          <p className="text-xs text-slate-500" role="status">{loading ? 'Đang tải...' : diseases ? `${filtered.length ? pagination.startIndex + 1 : 0}–${pagination.endIndex} / ${filtered.length} vấn đề${search || problemType || status ? ' phù hợp' : ''}` : 'Chưa tải được dữ liệu'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm" aria-label="Danh sách vấn đề trên lúa">
            <thead><tr><th scope="col" className="px-4 py-3">Vấn đề</th><th scope="col" className="px-4 py-3">Loại</th><th scope="col" className="px-4 py-3">Nội dung</th><th scope="col" className="px-4 py-3 text-right">Cách xử lý</th><th scope="col" className="px-4 py-3">Trạng thái</th><th scope="col" className="px-4 py-3 text-right">Thao tác</th></tr></thead>
            <tbody>
              {pagination.paginated.map(d => <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-4"><button id={`problem-view-${d.id}`} type="button" className="text-left font-semibold text-primary-dark hover:underline focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Xem chi tiết ${diseaseLabel(d.code, d.name)}`} onClick={() => setSelectedId(d.id)}>{diseaseLabel(d.code, d.name)}</button><p className="mt-1 text-xs text-slate-500 break-all">{d.code}</p>{d.name !== diseaseLabel(d.code, d.name) && <p className="mt-1 text-xs text-slate-500">{d.name}</p>}</td>
                <td className="px-4 py-4 text-slate-700">{d.isHealthyClass ? 'Lá khỏe' : PROBLEM_TYPE_LABEL[d.problemType ?? 'DISEASE']}</td>
                <td className="px-4 py-4"><StatusBadge label={!d.symptoms?.trim() && !d.prevention?.trim() ? 'Cần bổ sung' : 'Đã có nội dung'} className={!d.symptoms?.trim() && !d.prevention?.trim() ? 'text-amber-700' : 'text-emerald-700'} /></td>
                <td className="px-4 py-4 text-right tabular-nums"><span className="font-semibold">{d.treatments.filter(t => t.isActive).length}</span><p className="mt-1 text-xs text-slate-500">đang dùng</p></td>
                <td className="px-4 py-4"><StatusBadge label={d.isActive ? 'Đang hoạt động' : 'Đã ngừng'} /></td>
                <td className="px-4 py-4 text-right"><RowActionsMenu disabled={busy} triggerLabel={`Thao tác ${diseaseLabel(d.code, d.name)}`} actions={[
                  { label: 'Xem chi tiết', icon: 'visibility', onClick: () => setSelectedId(d.id) },
                  ...(canEditDisease ? [{ label: 'Sửa nội dung', icon: 'edit', onClick: () => openContent(d) }] : []),
                  ...(canCreate ? [{ label: 'Thêm cách xử lý', icon: 'add', onClick: () => openTreatment(d, null) }] : []),
                  ...(canEditDisease && !d.isHealthyClass && !SEEDED_CODES.has(d.code) ? [{ label: d.isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại', icon: d.isActive ? 'pause_circle' : 'play_circle', tone: d.isActive ? 'danger' as const : 'default' as const, onClick: () => setSwitching(d) }] : []),
                ]} /></td>
              </tr>)}
              {filtered.length === 0 && <EmptyTableRow colSpan={6} message={loading ? 'Đang tải vấn đề trên lúa...' : loadError && !diseases ? 'Không tải được danh sách. Chọn Thử lại để tải lại dữ liệu.' : diseases?.length ? 'Không có vấn đề phù hợp. Hãy đổi từ khóa hoặc xóa bộ lọc.' : 'Chưa có vấn đề nào trong danh sách.'} />}
            </tbody>
          </table>
        </div>
        {diseases && <Pagination {...pagination} unitLabel="vấn đề" />}
      </div>

      {selected && [selected].map((d) => {
        const empty = !d.symptoms?.trim() && !d.prevention?.trim()
        const activeCount = d.treatments.filter((t) => t.isActive).length
        const treatments = [...d.treatments].sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, 'vi'))
        return (
          <DetailModal key={d.id} open title={`Chi tiết vấn đề: ${diseaseLabel(d.code, d.name)}`} widthClassName="max-w-4xl" busy={busy} onClose={() => setSelectedId(null)}>
            <ModalLayout bodyClassName="space-y-6" header={<div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2>{diseaseLabel(d.code, d.name)}</h2>
                <p className="mt-1 text-xs text-slate-500 break-words">
                  <span>{d.code}</span>
                  {d.name !== diseaseLabel(d.code, d.name) && <> · {d.name}</>}
                  <span className="ml-2 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">{PROBLEM_TYPE_LABEL[d.problemType ?? 'DISEASE']}</span>
                  {d.isHealthyClass && <span className="ml-2 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold">Lá khỏe</span>}
                </p>
                <div className="mt-3"><StatusBadge label={d.isActive ? 'Đang hoạt động' : 'Đã ngừng'} /></div>
              </div>
              <RowActionsMenu disabled={busy} triggerLabel={`Thao tác ${diseaseLabel(d.code, d.name)}`} actions={[
                ...(canEditDisease ? [{ label: 'Sửa nội dung', icon: 'edit', onClick: () => openContent(d) }] : []),
                ...(canEditDisease && !d.isHealthyClass && !SEEDED_CODES.has(d.code) ? [{ label: d.isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại', icon: d.isActive ? 'pause_circle' : 'play_circle', tone: d.isActive ? 'danger' as const : 'default' as const, onClick: () => setSwitching(d) }] : []),
              ]} />
            </div>} footer={<button type="button" disabled={busy} onClick={() => setSelectedId(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Đóng</button>}>

            <p className="max-w-prose text-sm leading-6 text-slate-600">
              Nông dân đọc nội dung ngay sau khi lưu, không có bước duyệt nội dung. Chỉ nhập thông tin đã được người hiểu cây lúa kiểm tra.
              Sản phẩm gợi ý phải có liên kết đã duyệt; hoạt chất chỉ để hiển thị. Cách xử lý hóa học chỉ hiện khi AI chắc chắn.
            </p>

            {empty && (
              <p className="rounded-lg bg-amber-50 text-amber-900 text-sm px-3 py-2">
                Vấn đề này chưa có triệu chứng hay cách phòng ngừa. Hãy bổ sung nội dung để nông dân có thông tin tra cứu.
              </p>
            )}

            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <Fact label="Tên khoa học" value={d.scientificName} />
              <Fact label="Mô tả" value={d.description} />
              <Fact label="Triệu chứng" value={d.symptoms} />
              <Fact label="Nguyên nhân" value={d.causes} />
              <Fact label="Phòng ngừa" value={d.prevention} />
              <Fact label="Từ khóa tìm kiếm của nông dân" value={d.searchKeywords ?? null} />
            </dl>

            <div className="border-t border-outline-variant/60 pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Cách xử lý <span className="font-normal text-slate-500">({activeCount} đang dùng)</span>
                </h3>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => openTreatment(d, null)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 min-h-10 px-3 rounded-[10px] border border-slate-200 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    aria-label={`Thêm cách xử lý cho ${diseaseLabel(d.code, d.name)}`}
                  >
                    <Plus size={14} /> Thêm cách xử lý
                  </button>
                )}
              </div>
              {d.isHealthyClass && (
                <p className="text-xs text-slate-500">Lá khỏe chỉ nhận hướng dẫn chăm sóc, không gợi ý sản phẩm.</p>
              )}
              {treatments.length === 0 ? (
                <p className="text-sm text-slate-600">Chưa có cách xử lý nào.</p>
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm" aria-label={`Cách xử lý cho ${diseaseLabel(d.code, d.name)}`}>
                  <thead><tr><th scope="col" className="px-3 py-3">Cách xử lý</th><th scope="col" className="px-3 py-3">Loại</th><th scope="col" className="px-3 py-3 text-right">Ưu tiên</th><th scope="col" className="px-3 py-3">Trạng thái</th><th scope="col" className="px-3 py-3 text-right">Thao tác</th></tr></thead>
                  <tbody>
                  {treatments.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-4 align-top max-w-lg">
                        <div className="font-medium text-slate-900">
                          {t.title}
                        </div>
                        <div className="mt-1 text-slate-700 whitespace-pre-line break-words">{t.instructions}</div>
                        {t.activeIngredientName && <div className="text-xs text-slate-500">Hoạt chất: {t.activeIngredientName}</div>}
                        {t.precautions && <div className="text-xs text-amber-800 whitespace-pre-line">Lưu ý: {t.precautions}</div>}
                      </td>
                      <td className="px-3 py-4 align-top text-slate-600">{TREATMENT_KIND_LABEL[t.treatmentType]}</td>
                      <td className="px-3 py-4 align-top text-right tabular-nums">{t.priority}</td>
                      <td className="px-3 py-4 align-top"><StatusBadge label={t.isActive ? 'Đang hoạt động' : 'Đã ngừng'} /></td>
                      <td className="px-3 py-4 align-top text-right"><RowActionsMenu disabled={busy} triggerLabel={`Thao tác cách xử lý ${t.title}`} actions={[
                        ...(canUpdate ? [{ label: 'Sửa cách xử lý', icon: 'edit', onClick: () => openTreatment(d, t) }] : []),
                        ...(!t.isActive && canActivate ? [{ label: 'Kích hoạt lại', icon: 'play_circle', onClick: () => { void run(() => diseasesApi.activateTreatment(t.id), 'Đã kích hoạt lại cách xử lý', 'Không kích hoạt được cách xử lý') } }] : []),
                        ...(t.isActive && canDeactivate ? [{ label: 'Ngừng cách xử lý', icon: 'pause_circle', tone: 'danger' as const, onClick: () => setStopping(t) }] : []),
                      ]} /></td>
                    </tr>
                  ))}
                  </tbody>
                </table></div>
              )}
            </div>

            {!d.isHealthyClass && has('DISEASE_PRODUCTS.READ') && <DiseaseProductsPanel disease={d} />}
            </ModalLayout>
          </DetailModal>
        )
      })}

      <ConfirmModal
        open={editing !== null && contentForm !== null}
        title={editing ? `Sửa nội dung: ${diseaseLabel(editing.code, editing.name)}` : 'Sửa nội dung vấn đề'}
        message="Lưu sẽ thay toàn bộ các ô dưới đây; ô để trống sẽ xóa nội dung cũ. Mã bệnh không đổi."
        confirmLabel="Lưu nội dung"
        busy={busy}
        confirmDisabled={contentInvalid}
        onConfirm={() => void saveContent()}
        onClose={() => setEditing(null)}
      >
        {contentForm && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Tên vấn đề
              <input className={`${field} mt-1 font-normal`} maxLength={200} value={contentForm.name} onChange={(e) => setContentForm({ ...contentForm, name: e.target.value })} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Tên khoa học
              <input className={`${field} mt-1 font-normal`} maxLength={255} value={contentForm.scientificName} onChange={(e) => setContentForm({ ...contentForm, scientificName: e.target.value })} />
            </label>
            {(
              [
                ['description', 'Mô tả'],
                ['symptoms', 'Triệu chứng'],
                ['causes', 'Nguyên nhân'],
                ['prevention', 'Phòng ngừa'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm font-semibold text-slate-700">
                {label}
                <textarea className={`${field} mt-1 font-normal min-h-[84px]`} maxLength={4000} value={contentForm[key]} onChange={(e) => setContentForm({ ...contentForm, [key]: e.target.value })} />
              </label>
            ))}
            <label className="block text-sm font-semibold text-slate-700">
              Từ khóa tìm kiếm của nông dân
              <textarea className={`${field} mt-1 font-normal min-h-[60px]`} maxLength={1000} value={contentForm.searchKeywords} onChange={(e) => setContentForm({ ...contentForm, searchKeywords: e.target.value })} />
              <span className="mt-1 block text-xs font-normal text-slate-500">Tên dân gian, triệu chứng nông dân hay gõ, cách nhau dấu phẩy. Gõ không dấu vẫn tìm được.</span>
            </label>
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={creating !== null}
        title="Thêm vấn đề"
        message="Mã không đổi được sau khi tạo. Vấn đề mới hiện cho nông dân tìm kiếm ngay, nhưng chưa có sản phẩm nào cho đến khi bạn thêm và duyệt liên kết."
        confirmLabel="Thêm vấn đề"
        busy={busy}
        confirmDisabled={createInvalid}
        onConfirm={() => void saveNewProblem()}
        onClose={() => setCreating(null)}
      >
        {creating && (
          <div className="space-y-3" data-testid="problem-form">
            <label className="block text-sm font-semibold text-slate-700">
              Mã (chữ hoa, số, gạch dưới)
              <input
                className={`${field} mt-1 font-normal font-mono`}
                maxLength={49}
                value={creating.code}
                onChange={(e) => setCreating({ ...creating, code: e.target.value.toUpperCase() })}
                aria-label="Mã vấn đề"
                aria-invalid={creating.code !== '' && !CODE_PATTERN.test(creating.code.trim())}
                placeholder="BROWN_PLANTHOPPER"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Tên
              <input className={`${field} mt-1 font-normal`} maxLength={200} value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} aria-label="Tên vấn đề" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Loại
              <Select className={`${field} mt-1 font-normal`} value={creating.problemType} onChange={(e) => setCreating({ ...creating, problemType: e.target.value as ProblemType })} aria-label="Loại vấn đề">
                {PROBLEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROBLEM_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Từ khóa tìm kiếm của nông dân
              <textarea className={`${field} mt-1 font-normal min-h-[60px]`} maxLength={1000} value={creating.searchKeywords} onChange={(e) => setCreating({ ...creating, searchKeywords: e.target.value })} />
            </label>
            {(
              [
                ['description', 'Mô tả'],
                ['symptoms', 'Triệu chứng'],
                ['causes', 'Nguyên nhân'],
                ['prevention', 'Phòng ngừa'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm font-semibold text-slate-700">
                {label}
                <textarea className={`${field} mt-1 font-normal min-h-[70px]`} maxLength={4000} value={creating[key]} onChange={(e) => setCreating({ ...creating, [key]: e.target.value })} />
              </label>
            ))}
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={switching !== null}
        title={switching?.isActive ? 'Ngừng vấn đề' : 'Dùng lại vấn đề'}
        message={
          switching
            ? switching.isActive
              ? `"${switching.name}" sẽ không còn hiện trong danh sách nông dân tìm kiếm. Các liên kết sản phẩm được giữ lại.`
              : `"${switching.name}" sẽ hiện lại cho nông dân tìm kiếm.`
            : undefined
        }
        confirmLabel={switching?.isActive ? 'Ngừng vấn đề' : 'Dùng lại'}
        tone={switching?.isActive ? 'danger' : 'primary'}
        busy={busy}
        onConfirm={() => void switchActive()}
        onClose={() => setSwitching(null)}
      />

      <ConfirmModal
        open={treating !== null}
        title={treating?.treatment ? 'Sửa cách xử lý' : 'Thêm cách xử lý'}
        message={treating ? `Bệnh: ${diseaseLabel(treating.disease.code, treating.disease.name)}` : undefined}
        confirmLabel={treating?.treatment ? 'Lưu cách xử lý' : 'Thêm cách xử lý'}
        busy={busy}
        confirmDisabled={treatmentInvalid}
        onConfirm={() => void saveTreatment()}
        onClose={() => setTreating(null)}
      >
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            Loại
            <Select className={`${field} mt-1 font-normal`} value={treatmentForm.treatmentType} onChange={(e) => setTreatmentForm({ ...treatmentForm, treatmentType: e.target.value as TreatmentKind })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {TREATMENT_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Tiêu đề
            <input className={`${field} mt-1 font-normal`} maxLength={255} value={treatmentForm.title} onChange={(e) => setTreatmentForm({ ...treatmentForm, title: e.target.value })} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Hướng dẫn thực hiện
            <textarea className={`${field} mt-1 font-normal min-h-[110px]`} maxLength={4000} value={treatmentForm.instructions} onChange={(e) => setTreatmentForm({ ...treatmentForm, instructions: e.target.value })} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Hoạt chất (thông tin tham khảo)
            <Select
              className={`${field} mt-1 font-normal`}
              value={treatmentForm.activeIngredientId}
              onChange={(e) => setTreatmentForm({ ...treatmentForm, activeIngredientId: e.target.value })}
              aria-label="Hoạt chất"
            >
              <option value="">Không gắn hoạt chất</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.code ? ` (${i.code})` : ''}
                </option>
              ))}
              {treatmentForm.activeIngredientId && !ingredients.some((i) => i.id === treatmentForm.activeIngredientId) && (
                <option value={treatmentForm.activeIngredientId}>
                  {treating?.treatment?.activeIngredientName ?? 'Hoạt chất hiện tại'} (đã ngừng)
                </option>
              )}
            </Select>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              {treatmentForm.treatmentType === 'CHEMICAL' && !treatmentForm.activeIngredientId
                ? 'Nên ghi hoạt chất để nông dân biết thuốc dùng hoạt chất nào.'
                : 'Hoạt chất chỉ để hiển thị. Sản phẩm được gợi ý lấy từ mục "Sản phẩm gợi ý" của vấn đề, không tự ghép theo hoạt chất.'}
            </span>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Lưu ý an toàn (không bắt buộc)
            <textarea className={`${field} mt-1 font-normal min-h-[70px]`} maxLength={2000} value={treatmentForm.precautions} onChange={(e) => setTreatmentForm({ ...treatmentForm, precautions: e.target.value })} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Mức ưu tiên (0 đến 1000, số lớn hiện trước)
            <input className={`${field} mt-1 font-normal`} inputMode="numeric" value={treatmentForm.priority} onChange={(e) => setTreatmentForm({ ...treatmentForm, priority: e.target.value })} aria-invalid={priorityOf(treatmentForm.priority) === null} />
          </label>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={stopping !== null}
        title="Ngừng cách xử lý"
        message={stopping ? `"${stopping.title}" sẽ không còn hiện cho nông dân. Bạn có thể kích hoạt lại sau.` : undefined}
        confirmLabel="Ngừng cách xử lý"
        tone="danger"
        busy={busy}
        onConfirm={() => void stop()}
        onClose={() => setStopping(null)}
      />
    </div>
  )
}
