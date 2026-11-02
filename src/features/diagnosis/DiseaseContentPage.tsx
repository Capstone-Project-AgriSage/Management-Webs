import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
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
import Select from '@/components/ui/Select'
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

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm whitespace-pre-line ${value ? 'text-slate-800' : 'text-slate-400'}`}>{value || 'Chưa nhập'}</dd>
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
    try {
      setDiseases(await diseasesApi.list())
      setLoadError(null)
    } catch (err) {
      setLoadError(describeError(err, 'Không tải được nội dung bệnh'))
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
    <div className="max-w-[1100px] mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-600 flex-1 min-w-[260px]">
          Mỗi vấn đề (bệnh, sâu rầy, cỏ dại, dinh dưỡng) có phần mô tả, cách xử lý và danh sách sản phẩm gợi ý. Nông dân đọc nội dung này
          ngay, không có bước duyệt nội dung, nên chỉ nhập điều đã được người hiểu cây lúa kiểm tra. Sản phẩm chỉ hiện cho nông dân khi
          liên kết với vấn đề đã được duyệt; hoạt chất của cách xử lý chỉ để hiển thị. Cách xử lý loại Hóa học chỉ hiện khi AI chắc chắn.
        </p>
        {canCreateProblem && (
          <button
            type="button"
            onClick={() => setCreating(emptyCreate)}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-green-800"
          >
            <Plus size={14} /> Thêm vấn đề
          </button>
        )}
      </div>

      {loadError && (
        <div role="alert" className="text-rose-700 text-sm">
          {loadError}{' '}
          <button type="button" className="underline" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}
      {!diseases && !loadError && <p role="status" className="text-sm text-slate-500">Đang tải...</p>}

      {diseases?.map((d) => {
        const empty = !d.symptoms && !d.prevention
        const activeCount = d.treatments.filter((t) => t.isActive).length
        const treatments = [...d.treatments].sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, 'vi'))
        return (
          <section key={d.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-5 space-y-4" aria-label={diseaseLabel(d.code, d.name)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{diseaseLabel(d.code, d.name)}</h2>
                <p className="text-xs text-slate-500">
                  <span className="font-mono">{d.code}</span>
                  {d.name !== diseaseLabel(d.code, d.name) && <> · {d.name}</>}
                  <span className="ml-2 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">{PROBLEM_TYPE_LABEL[d.problemType ?? 'DISEASE']}</span>
                  {d.isHealthyClass && <span className="ml-2 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold">Lá khỏe</span>}
                  {!d.isActive && <span className="ml-2 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">Đã ngừng</span>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEditDisease && (
                  <button
                    type="button"
                    onClick={() => openContent(d)}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50"
                    aria-label={`Sửa nội dung ${diseaseLabel(d.code, d.name)}`}
                  >
                    <Pencil size={14} /> Sửa nội dung
                  </button>
                )}
                {canEditDisease && !d.isHealthyClass && !SEEDED_CODES.has(d.code) && (
                  <button
                    type="button"
                    onClick={() => setSwitching(d)}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50"
                    aria-label={`${d.isActive ? 'Ngừng' : 'Dùng lại'} ${diseaseLabel(d.code, d.name)}`}
                  >
                    {d.isActive ? 'Ngừng' : 'Dùng lại'}
                  </button>
                )}
              </div>
            </div>

            {empty && (
              <p className="rounded-lg bg-amber-50 text-amber-900 text-sm px-3 py-2">
                Bệnh này chưa có triệu chứng hay cách phòng ngừa, nông dân chỉ thấy tên bệnh.
              </p>
            )}

            <dl className="grid gap-3 sm:grid-cols-2">
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
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50"
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
                <ul className="divide-y divide-outline-variant/60">
                  {treatments.map((t) => (
                    <li key={t.id} className={`py-3 flex flex-wrap items-start gap-3 text-sm ${t.isActive ? '' : 'opacity-60'}`}>
                      <span className="mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap">
                        {TREATMENT_KIND_LABEL[t.treatmentType]}
                      </span>
                      <div className="flex-1 min-w-[220px]">
                        <div className="font-medium text-slate-900">
                          {t.title}
                          {!t.isActive && <span className="ml-2 text-xs font-semibold text-slate-600">(đã ngừng)</span>}
                        </div>
                        <div className="text-slate-700 whitespace-pre-line">{t.instructions}</div>
                        {t.activeIngredientName && <div className="text-xs text-slate-500">Hoạt chất: {t.activeIngredientName}</div>}
                        {t.precautions && <div className="text-xs text-amber-800 whitespace-pre-line">Lưu ý: {t.precautions}</div>}
                        <div className="text-xs text-slate-400">Ưu tiên {t.priority}</div>
                      </div>
                      <div className="flex gap-3 whitespace-nowrap">
                        {canUpdate && (
                          <button type="button" className="text-primary font-semibold" onClick={() => openTreatment(d, t)} aria-label={`Sửa cách xử lý ${t.title}`}>
                            Sửa
                          </button>
                        )}
                        {t.isActive && canDeactivate && (
                          <button type="button" className="text-rose-700 font-semibold" onClick={() => setStopping(t)} aria-label={`Ngừng cách xử lý ${t.title}`}>
                            Ngừng
                          </button>
                        )}
                        {!t.isActive && canActivate && (
                          <button
                            type="button"
                            className="text-primary font-semibold"
                            disabled={busy}
                            onClick={() => void run(() => diseasesApi.activateTreatment(t.id), 'Đã kích hoạt lại cách xử lý', 'Không kích hoạt được cách xử lý')}
                            aria-label={`Kích hoạt cách xử lý ${t.title}`}
                          >
                            Kích hoạt
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!d.isHealthyClass && has('DISEASE_PRODUCTS.READ') && <DiseaseProductsPanel disease={d} />}
          </section>
        )
      })}

      <ConfirmModal
        open={editing !== null && contentForm !== null}
        title={editing ? `Sửa nội dung: ${diseaseLabel(editing.code, editing.name)}` : 'Sửa nội dung bệnh'}
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
              Tên bệnh
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
            Hoạt chất (để gợi ý sản phẩm)
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
