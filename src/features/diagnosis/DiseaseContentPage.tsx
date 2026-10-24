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
  type Treatment,
  type TreatmentInput,
  type TreatmentKind,
} from '@/api/diagnosisApi'
import { adminCatalogApi, type AdminCatalogRow } from '@/api/adminCatalogApi'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Select from '@/components/ui/Select'
import { TREATMENT_KIND_LABEL, diseaseLabel } from './diagnosisLabels'

const field =
  'w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'

const KINDS = Object.keys(TREATMENT_KIND_LABEL) as TreatmentKind[]

interface ContentForm {
  name: string
  scientificName: string
  description: string
  symptoms: string
  causes: string
  prevention: string
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
  }
}

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
    title: 'Bệnh lúa và cách xử lý',
    subtitle: 'Nội dung nông dân đọc ngay khi AI nhận ra bệnh: mô tả bệnh, cách xử lý và hoạt chất để gợi ý sản phẩm',
  })
  const { has } = usePermission()
  const { showToast } = useToast()
  const canEditDisease = has('DISEASES.UPDATE')
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
    }
    if (await run(() => diseasesApi.update(editing.id, body), 'Đã lưu nội dung bệnh', 'Không lưu được nội dung bệnh')) {
      setEditing(null)
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
  const treatmentInvalid = !treatmentForm.title.trim() || !treatmentForm.instructions.trim() || priorityOf(treatmentForm.priority) === null

  return (
    <div className="max-w-[1100px] mx-auto space-y-5">
      <p className="text-sm text-slate-600">
        Mỗi bệnh có phần mô tả và nhiều cách xử lý. Nông dân đọc nội dung này ngay khi AI nhận ra bệnh, không còn bước duyệt,
        nên chỉ nhập nội dung đã được người hiểu bệnh lúa kiểm tra. Cách xử lý loại Hóa học chỉ hiện khi AI chắc chắn, và sản phẩm
        của cửa hàng chứa hoạt chất của cách xử lý được gợi ý kèm. Cách xử lý đã ngừng không còn hiện cho nông dân.
      </p>

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
                  {d.isHealthyClass && <span className="ml-2 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold">Lá khỏe</span>}
                  {!d.isActive && <span className="ml-2 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">Đã ngừng</span>}
                </p>
              </div>
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
          </div>
        )}
      </ConfirmModal>

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
                ? 'Nên gắn hoạt chất: nếu không, nông dân sẽ không được gợi ý sản phẩm nào cho cách xử lý này.'
                : 'Sản phẩm của cửa hàng chứa hoạt chất này được gợi ý khi AI chắc chắn về bệnh.'}
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
        message={stopping ? `"${stopping.title}" sẽ không còn hiện cho nông dân và không còn dùng để gợi ý sản phẩm. Bạn có thể kích hoạt lại sau.` : undefined}
        confirmLabel="Ngừng cách xử lý"
        tone="danger"
        busy={busy}
        onConfirm={() => void stop()}
        onClose={() => setStopping(null)}
      />
    </div>
  )
}
