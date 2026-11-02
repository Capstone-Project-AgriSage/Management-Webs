import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react'
import { usePermission } from '@/context/PermissionContext'
import { useToast } from '@/context/ToastContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { describeError } from '@/api/client'
import type { Disease } from '@/api/diagnosisApi'
import {
  diseaseProductsApi,
  type DiseaseProduct,
  type DiseaseProductInput,
  type GrowthStage,
  type RecommendationGroup,
} from '@/api/advisoryApi'
import { productsApi, type ProductListItem } from '@/api/productsApi'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Select from '@/components/ui/Select'
import { formatDateTime } from '@/utils/units'
import { GROUP_LABEL, GROWTH_STAGES, GROWTH_STAGE_LABEL, LINK_STATUS_BADGE_CLASS, LINK_STATUS_LABEL } from './diagnosisLabels'

const field =
  'w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'

interface LinkForm {
  group: RecommendationGroup
  registrationSource: string
  reason: string
  doseText: string
  doseSource: string
  /** Per hectare, in the base unit of the product; '' = no quantity is worked out. */
  dosePerHa: string
  applications: string
  /** '' = not recorded. */
  preHarvestDays: string
  stages: GrowthStage[]
  priority: string
}

const emptyForm: LinkForm = {
  group: 'PROTECTION',
  registrationSource: '',
  reason: '',
  doseText: '',
  doseSource: '',
  dosePerHa: '',
  applications: '1',
  preHarvestDays: '',
  stages: [],
  priority: '0',
}

const orNull = (value: string): string | null => value.trim() || null

function formOf(link: DiseaseProduct): LinkForm {
  return {
    group: link.recommendationGroup,
    registrationSource: link.registrationSource ?? '',
    reason: link.reason ?? '',
    doseText: link.doseText,
    doseSource: link.doseSource ?? '',
    dosePerHa: link.dosePerHaBase === null ? '' : String(link.dosePerHaBase),
    applications: String(link.applications),
    preHarvestDays: link.preHarvestDays === null ? '' : String(link.preHarvestDays),
    stages: link.growthStages,
    priority: String(link.priority),
  }
}

/** '' is valid (no quantity); otherwise a number above 0 with at most 3 decimals. */
function doseOf(value: string): number | null | undefined {
  if (value.trim() === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n > 0 && Math.round(n * 1000) / 1000 === n && n < 1e9 ? n : undefined
}

function intOf(value: string, min: number, max: number): number | null {
  const n = Number(value)
  return value.trim() !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null
}

function formInvalid(form: LinkForm, productChosen: boolean): string | null {
  if (!productChosen) return 'Chọn sản phẩm'
  if (!form.doseText.trim()) return 'Nhập cách dùng và liều'
  if (form.group === 'PROTECTION' && !form.registrationSource.trim()) return 'Thuốc bảo vệ thực vật cần nguồn đăng ký (văn bản, trang)'
  if (form.group === 'NUTRITION' && !form.reason.trim()) return 'Phân bón cần lý do gợi ý'
  if (doseOf(form.dosePerHa) === undefined) return 'Liều trên 1 ha phải lớn hơn 0, tối đa 3 chữ số thập phân'
  if (intOf(form.applications, 1, 10) === null) return 'Số lần dùng từ 1 đến 10'
  if (form.preHarvestDays.trim() !== '' && intOf(form.preHarvestDays, 0, 365) === null) return 'Thời gian cách ly là số ngày từ 0 đến 365'
  if (intOf(form.priority, 0, 1000) === null) return 'Mức ưu tiên từ 0 đến 1000'
  return null
}

function bodyOf(form: LinkForm): DiseaseProductInput {
  return {
    recommendationGroup: form.group,
    doseText: form.doseText.trim(),
    registrationSource: form.group === 'PROTECTION' ? orNull(form.registrationSource) : null,
    reason: form.group === 'NUTRITION' ? orNull(form.reason) : null,
    doseSource: orNull(form.doseSource),
    dosePerHaBase: doseOf(form.dosePerHa) ?? null,
    applications: intOf(form.applications, 1, 10) ?? 1,
    preHarvestDays: form.preHarvestDays.trim() === '' ? null : intOf(form.preHarvestDays, 0, 365),
    growthStages: form.stages.length > 0 ? form.stages : null,
    priority: intOf(form.priority, 0, 1000) ?? 0,
  }
}

interface ChosenProduct {
  id: string
  sku: string
  name: string
  baseUnit: string
}

/**
 * The products offered for one problem (ADVISORY.md section 6): each link carries its source, its dose and a status. Only an
 * APPROVED link reaches a Farmer; the approver (own permission) checks the source and the dose against the label.
 */
export default function DiseaseProductsPanel({ disease }: { disease: Disease }) {
  const { has } = usePermission()
  const { showToast } = useToast()
  const canCreate = has('DISEASE_PRODUCTS.CREATE')
  const canUpdate = has('DISEASE_PRODUCTS.UPDATE')
  const canApprove = has('DISEASE_PRODUCTS.APPROVE')
  const canDeactivate = has('DISEASE_PRODUCTS.DEACTIVATE')

  const [open, setOpen] = useState(false)
  const [links, setLinks] = useState<DiseaseProduct[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // `link` is null while a new product is being added.
  const [editing, setEditing] = useState<{ link: DiseaseProduct | null } | null>(null)
  const [form, setForm] = useState<LinkForm>(emptyForm)
  const [chosen, setChosen] = useState<ChosenProduct | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [results, setResults] = useState<ProductListItem[]>([])
  const [searching, setSearching] = useState(false)
  const searchRequest = useRef(0)

  const [approving, setApproving] = useState<DiseaseProduct | null>(null)
  const [checked, setChecked] = useState(false)
  const [stopping, setStopping] = useState<DiseaseProduct | null>(null)

  const load = useCallback(async () => {
    try {
      setLinks(await diseaseProductsApi.list(disease.id))
      setLoadError(null)
    } catch (err) {
      setLoadError(describeError(err, 'Không tải được sản phẩm gợi ý'))
    }
  }, [disease.id])

  useEffect(() => {
    if (open && links === null) void load()
  }, [open, links, load])

  useEffect(() => {
    if (!editing || editing.link) return
    const id = ++searchRequest.current
    setSearching(true)
    productsApi
      .list({ search: debouncedSearch.trim() || undefined, status: 'ACTIVE', page: 1, pageSize: 8 })
      .then((res) => {
        if (id === searchRequest.current) setResults(res.items)
      })
      .catch(() => {
        if (id === searchRequest.current) setResults([])
      })
      .finally(() => {
        if (id === searchRequest.current) setSearching(false)
      })
  }, [editing, debouncedSearch])

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

  const openAdd = () => {
    setEditing({ link: null })
    setForm({ ...emptyForm, group: disease.problemType === 'NUTRITION' || disease.problemType === 'GROWTH' ? 'NUTRITION' : 'PROTECTION' })
    setChosen(null)
    setSearch('')
    setResults([])
  }

  const openEdit = (link: DiseaseProduct) => {
    setEditing({ link })
    setForm(formOf(link))
    setChosen({ id: link.productId, sku: link.sku, name: link.productName, baseUnit: link.baseUnit })
  }

  const choose = async (product: ProductListItem) => {
    setChosen({ id: product.id, sku: product.sku, name: product.name, baseUnit: '' })
    try {
      const full = await productsApi.get(product.id)
      const base = full.packagings.find((p) => p.isBaseUnit)
      setChosen({ id: product.id, sku: product.sku, name: product.name, baseUnit: base?.packagingName || base?.unitName || '' })
    } catch {
      // the quantity field then just has no unit next to it
    }
  }

  const save = async () => {
    if (!editing || !chosen) return
    const body = bodyOf(form)
    const { link } = editing
    const saved = await run(
      () => (link ? diseaseProductsApi.update(link.id, body) : diseaseProductsApi.create(disease.id, { ...body, productId: chosen.id })),
      link ? (link.status === 'APPROVED' ? 'Đã lưu, liên kết quay về Nháp và cần duyệt lại' : 'Đã lưu liên kết') : 'Đã thêm sản phẩm gợi ý (Nháp)',
      'Không lưu được liên kết',
    )
    if (saved) setEditing(null)
  }

  const approve = async () => {
    if (!approving) return
    if (await run(() => diseaseProductsApi.approve(approving.id), 'Đã duyệt, nông dân sẽ thấy sản phẩm này', 'Không duyệt được liên kết')) {
      setApproving(null)
    }
  }

  const stop = async () => {
    if (!stopping) return
    if (await run(() => diseaseProductsApi.deactivate(stopping.id), 'Đã ngừng gợi ý sản phẩm này', 'Không ngừng được liên kết')) {
      setStopping(null)
    }
  }

  const problem = formInvalid(form, chosen !== null)
  const linkedIds = new Set((links ?? []).filter((l) => l.status !== 'INACTIVE').map((l) => l.productId))
  const approvedCount = (links ?? []).filter((l) => l.status === 'APPROVED').length
  const draftCount = (links ?? []).filter((l) => l.status === 'DRAFT').length
  const unit = chosen?.baseUnit ? ` (${chosen.baseUnit.toLowerCase()})` : ''

  return (
    <div className="border-t border-outline-variant/60 pt-4 space-y-3" data-testid={`products-${disease.code}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900"
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Sản phẩm gợi ý
          {links && (
            <span className="font-normal text-slate-500">
              ({approvedCount} đã duyệt{draftCount > 0 ? `, ${draftCount} chờ duyệt` : ''})
            </span>
          )}
        </button>
        {open && canCreate && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50"
            aria-label={`Thêm sản phẩm gợi ý cho ${disease.name}`}
          >
            <Plus size={14} /> Thêm sản phẩm
          </button>
        )}
      </div>

      {open && (
        <>
          <p className="text-xs text-slate-500">
            Nông dân chỉ thấy sản phẩm đã duyệt. Thuốc phải có nguồn đăng ký; liều và thời gian cách ly phải khớp nhãn thuốc. Sửa một liên kết
            đã duyệt sẽ đưa nó về Nháp.
          </p>
          {loadError && (
            <div role="alert" className="text-rose-700 text-sm">
              {loadError}{' '}
              <button type="button" className="underline" onClick={() => void load()}>
                Thử lại
              </button>
            </div>
          )}
          {!links && !loadError && <p role="status" className="text-sm text-slate-500">Đang tải...</p>}
          {links && links.length === 0 && (
            <p className="rounded-lg bg-amber-50 text-amber-900 text-sm px-3 py-2">
              Chưa có sản phẩm nào cho vấn đề này, nên nông dân chưa thấy gợi ý nào.
            </p>
          )}
          {links && links.length > 0 && (
            <ul className="divide-y divide-outline-variant/60">
              {links.map((l) => (
                <li key={l.id} className={`py-3 flex flex-wrap items-start gap-3 text-sm ${l.status === 'INACTIVE' ? 'opacity-60' : ''}`}>
                  <div className="flex-1 min-w-[260px] space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{l.productName}</span>
                      <span className="font-mono text-xs text-slate-500">{l.sku}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{GROUP_LABEL[l.recommendationGroup]}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${LINK_STATUS_BADGE_CLASS[l.status]}`}>{LINK_STATUS_LABEL[l.status]}</span>
                    </div>
                    {l.recommendationGroup === 'PROTECTION' ? (
                      <div className="text-xs text-slate-600">Đăng ký: {l.registrationSource ?? '—'}</div>
                    ) : (
                      <div className="text-xs text-slate-600">Lý do: {l.reason ?? '—'}</div>
                    )}
                    <div className="text-slate-800 whitespace-pre-line">{l.doseText}</div>
                    <div className="text-xs text-slate-600">
                      {l.dosePerHaBase === null
                        ? 'Chưa có liều theo ha: nông dân thấy 1 đơn vị, không có số lượng theo diện tích'
                        : `Tính số lượng: ${l.dosePerHaBase} ${l.baseUnit.toLowerCase()}/ha × ${l.applications} lần`}
                      {' · '}
                      {l.preHarvestDays === null ? 'Chưa ghi thời gian cách ly' : `Cách ly ${l.preHarvestDays} ngày`}
                      {' · '}
                      {l.growthStages.length === 0 ? 'Mọi giai đoạn' : l.growthStages.map((s) => GROWTH_STAGE_LABEL[s]).join(', ')}
                      {' · '}Ưu tiên {l.priority}
                    </div>
                    {l.doseSource && <div className="text-xs text-slate-500">Nguồn liều: {l.doseSource}</div>}
                    {l.status === 'APPROVED' && l.approvedAt && <div className="text-xs text-emerald-700">Duyệt lúc {formatDateTime(l.approvedAt)}</div>}
                  </div>
                  <div className="flex gap-3 whitespace-nowrap">
                    {canUpdate && l.status !== 'INACTIVE' && (
                      <button type="button" className="text-primary font-semibold" onClick={() => openEdit(l)} aria-label={`Sửa liên kết ${l.productName}`}>
                        <Pencil size={13} className="inline mr-1" />
                        Sửa
                      </button>
                    )}
                    {canApprove && l.status === 'DRAFT' && (
                      <button
                        type="button"
                        className="text-emerald-700 font-semibold"
                        onClick={() => {
                          setChecked(false)
                          setApproving(l)
                        }}
                        aria-label={`Duyệt liên kết ${l.productName}`}
                      >
                        <CheckCircle2 size={13} className="inline mr-1" />
                        Duyệt
                      </button>
                    )}
                    {canDeactivate && l.status !== 'INACTIVE' && (
                      <button type="button" className="text-rose-700 font-semibold" onClick={() => setStopping(l)} aria-label={`Ngừng liên kết ${l.productName}`}>
                        Ngừng
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmModal
        open={editing !== null}
        title={editing?.link ? 'Sửa sản phẩm gợi ý' : 'Thêm sản phẩm gợi ý'}
        message={
          <>
            Vấn đề: {disease.name}.{' '}
            {editing?.link?.status === 'APPROVED'
              ? 'Liên kết này đang được duyệt: lưu sẽ đưa nó về Nháp và nông dân không thấy cho đến khi duyệt lại.'
              : 'Liên kết mới ở trạng thái Nháp cho đến khi có người duyệt.'}
          </>
        }
        confirmLabel={editing?.link ? 'Lưu liên kết' : 'Thêm sản phẩm'}
        busy={busy}
        confirmDisabled={problem !== null}
        onConfirm={() => void save()}
        onClose={() => setEditing(null)}
      >
        <div className="space-y-3" data-testid="link-form">
          {editing && !editing.link && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                Tìm sản phẩm (tên hoặc mã)
                <input className={`${field} mt-1 font-normal`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ví dụ: Tilt Super" />
              </label>
              <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100" aria-label="Kết quả tìm sản phẩm">
                {searching && results.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Đang tìm...</li>}
                {!searching && results.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Không có sản phẩm phù hợp.</li>}
                {results.map((p) => {
                  const taken = linkedIds.has(p.id)
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={taken}
                        aria-pressed={chosen?.id === p.id}
                        onClick={() => void choose(p)}
                        className={`w-full text-left px-3 py-2 text-sm disabled:opacity-50 ${chosen?.id === p.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                      >
                        <span className="font-medium">{p.name}</span> <span className="font-mono text-xs text-slate-500">{p.sku}</span>
                        {taken && <span className="ml-2 text-xs text-slate-500">(đã gắn)</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {chosen && (
            <p className="text-sm text-slate-700">
              Sản phẩm: <span className="font-semibold">{chosen.name}</span> <span className="font-mono text-xs text-slate-500">{chosen.sku}</span>
            </p>
          )}

          <label className="block text-sm font-semibold text-slate-700">
            Nhóm
            <Select className={`${field} mt-1 font-normal`} value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value as RecommendationGroup })} aria-label="Nhóm">
              <option value="PROTECTION">{GROUP_LABEL.PROTECTION}</option>
              <option value="NUTRITION">{GROUP_LABEL.NUTRITION}</option>
            </Select>
          </label>
          {form.group === 'PROTECTION' ? (
            <label className="block text-sm font-semibold text-slate-700">
              Nguồn đăng ký (văn bản, trang)
              <input
                className={`${field} mt-1 font-normal`}
                maxLength={200}
                value={form.registrationSource}
                onChange={(e) => setForm({ ...form, registrationSource: e.target.value })}
                placeholder="TT 75/2025/TT-BNNMT, Phụ lục I, tr. 187"
              />
            </label>
          ) : (
            <label className="block text-sm font-semibold text-slate-700">
              Lý do gợi ý
              <input className={`${field} mt-1 font-normal`} maxLength={300} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
          )}
          <label className="block text-sm font-semibold text-slate-700">
            Cách dùng và liều (nông dân đọc nội dung này)
            <textarea className={`${field} mt-1 font-normal min-h-[84px]`} maxLength={500} value={form.doseText} onChange={(e) => setForm({ ...form, doseText: e.target.value })} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Nguồn của liều (trang nhà sản xuất, nhãn)
            <input className={`${field} mt-1 font-normal`} maxLength={200} value={form.doseSource} onChange={(e) => setForm({ ...form, doseSource: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              {`Liều cho 1 ha${unit}`}
              <input
                className={`${field} mt-1 font-normal`}
                inputMode="decimal"
                value={form.dosePerHa}
                onChange={(e) => setForm({ ...form, dosePerHa: e.target.value })}
                aria-label="Liều cho 1 ha"
                aria-invalid={doseOf(form.dosePerHa) === undefined}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Tính theo đơn vị gốc của sản phẩm{chosen?.baseUnit ? ` (${chosen.baseUnit.toLowerCase()})` : ''}. Để trống nếu chưa chắc: nông dân sẽ không thấy số lượng theo diện tích.
              </span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Số lần dùng (1 đến 10)
              <input className={`${field} mt-1 font-normal`} inputMode="numeric" value={form.applications} onChange={(e) => setForm({ ...form, applications: e.target.value })} aria-label="Số lần dùng" aria-invalid={intOf(form.applications, 1, 10) === null} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Thời gian cách ly (ngày)
              <input className={`${field} mt-1 font-normal`} inputMode="numeric" value={form.preHarvestDays} onChange={(e) => setForm({ ...form, preHarvestDays: e.target.value })} aria-label="Thời gian cách ly" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Mức ưu tiên (0 đến 1000, số lớn hiện trước)
              <input className={`${field} mt-1 font-normal`} inputMode="numeric" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} aria-label="Mức ưu tiên" aria-invalid={intOf(form.priority, 0, 1000) === null} />
            </label>
          </div>
          <fieldset className="text-sm">
            <legend className="font-semibold text-slate-700">Giai đoạn lúa (không chọn = mọi giai đoạn)</legend>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {GROWTH_STAGES.map((s) => (
                <label key={s} className="inline-flex items-center gap-1.5 font-normal text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.stages.includes(s)}
                    onChange={(e) => setForm({ ...form, stages: e.target.checked ? [...form.stages, s] : form.stages.filter((x) => x !== s) })}
                  />
                  {GROWTH_STAGE_LABEL[s]}
                </label>
              ))}
            </div>
          </fieldset>
          {problem && chosen && <p className="text-xs text-rose-700" role="status">{problem}</p>}
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={approving !== null}
        title="Duyệt sản phẩm gợi ý"
        message={approving ? `Sau khi duyệt, nông dân chọn "${disease.name}" sẽ thấy "${approving.productName}" kèm nội dung dưới đây.` : undefined}
        confirmLabel="Duyệt"
        busy={busy}
        confirmDisabled={!checked}
        onConfirm={() => void approve()}
        onClose={() => setApproving(null)}
      >
        {approving && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2 space-y-1">
              <div>
                <span className="font-semibold">{approving.productName}</span> <span className="font-mono text-xs text-slate-500">{approving.sku}</span>
              </div>
              {approving.recommendationGroup === 'PROTECTION' ? <div>Đăng ký: {approving.registrationSource ?? '—'}</div> : <div>Lý do: {approving.reason ?? '—'}</div>}
              <div className="whitespace-pre-line">{approving.doseText}</div>
              <div className="text-xs text-slate-600">
                {approving.dosePerHaBase === null ? 'Chưa có liều theo ha' : `${approving.dosePerHaBase} ${approving.baseUnit.toLowerCase()}/ha × ${approving.applications} lần`}
                {' · '}
                {approving.preHarvestDays === null ? 'Chưa ghi cách ly' : `Cách ly ${approving.preHarvestDays} ngày`}
              </div>
              {approving.doseSource && <div className="text-xs text-slate-500">Nguồn liều: {approving.doseSource}</div>}
            </div>
            <label className="flex items-start gap-2 text-slate-800">
              <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <span>Tôi đã đối chiếu nguồn đăng ký, liều và thời gian cách ly với nhãn thuốc hoặc văn bản gốc.</span>
            </label>
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={stopping !== null}
        title="Ngừng gợi ý sản phẩm"
        message={stopping ? `"${stopping.productName}" sẽ không còn hiện cho nông dân chọn "${disease.name}". Liên kết được giữ lại để tra cứu.` : undefined}
        confirmLabel="Ngừng gợi ý"
        tone="danger"
        busy={busy}
        onConfirm={() => void stop()}
        onClose={() => setStopping(null)}
      />
    </div>
  )
}
