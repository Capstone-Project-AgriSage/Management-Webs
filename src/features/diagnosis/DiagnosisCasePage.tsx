import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Image as ImageIcon, Plus, RotateCw, Trash2 } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { describeError } from '@/api/client'
import {
  diagnosisApi,
  diseasesApi,
  type AiInference,
  type AgentReview,
  type Disease,
  type DiagnosisCase,
  type RecommendationKind,
  type ReviewDecision,
} from '@/api/diagnosisApi'
import { productLookupApi, type StoreProductRef } from '@/api/productLookupApi'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { formatDateTime } from '@/utils/units'
import {
  DECISION_LABEL,
  DIAGNOSIS_STATUS_BADGE_CLASS,
  DIAGNOSIS_STATUS_LABEL,
  TREATMENT_KIND_LABEL,
  aiErrorText,
  diseaseLabel,
  useDiagnosisBase,
} from './diagnosisLabels'

type Dialog = null | 'start' | 'review' | 'recommend' | 'rerun'

const field =
  'w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'

const REVIEWABLE = ['AI_COMPLETED', 'UNDER_REVIEW', 'FAILED', 'VERIFIED', 'INCONCLUSIVE']

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export default function DiagnosisCasePage() {
  const { id = '' } = useParams()
  const base = useDiagnosisBase()
  const { showToast } = useToast()
  const { user } = useAuth()
  const canReview = Boolean(user?.canReviewAi)

  const [item, setItem] = useState<DiagnosisCase | null>(null)
  const [diseases, setDiseases] = useState<Disease[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)

  // review form
  const [decision, setDecision] = useState<ReviewDecision>('CONFIRMED')
  const [correctedId, setCorrectedId] = useState('')
  const [comment, setComment] = useState('')

  // recommendation form
  const [kind, setKind] = useState<RecommendationKind>('TREATMENT')
  const [treatmentId, setTreatmentId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const debouncedProductSearch = useDebouncedValue(productSearch)
  const [products, setProducts] = useState<StoreProductRef[]>([])
  const [productId, setProductId] = useState('')
  const [reason, setReason] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)

  usePageHeader({
    title: item ? `Ca chẩn đoán ${item.caseNumber}` : 'Ca chẩn đoán',
    subtitle: 'Xem bằng chứng của AI, xác minh bệnh và gợi ý cách xử lý cho nông dân',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItem(await diagnosisApi.get(id))
      setLoadError(null)
    } catch (err) {
      setLoadError(describeError(err, 'Không tải được ca chẩn đoán'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    diseasesApi
      .list(true)
      .then(setDiseases)
      .catch(() => undefined) // names and treatments only; the case itself still shows
  }, [])

  // The signed photo URL lasts an hour: reload the case when it is about to expire so the photo never goes blank.
  useEffect(() => {
    const expiry = item?.images[0]?.expiresAt
    if (!expiry) return
    const wait = new Date(expiry).getTime() - Date.now() - 60_000
    if (wait <= 0) return
    const timer = window.setTimeout(load, Math.min(wait, 2_147_000_000))
    return () => window.clearTimeout(timer)
  }, [item?.images, load])

  useEffect(() => {
    if (dialog !== 'recommend' || kind !== 'PRODUCT') return
    let cancelled = false
    productLookupApi
      .searchStoreProducts({ search: debouncedProductSearch.trim() || undefined, pageSize: 8 })
      .then((res) => {
        if (!cancelled) setProducts(res.items)
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })
    return () => {
      cancelled = true
    }
  }, [dialog, kind, debouncedProductSearch])

  const successful = useMemo(() => item?.inferences.filter((i) => i.status === 'SUCCESS') ?? [], [item])
  const latestSuccess: AiInference | undefined = successful[successful.length - 1]
  const predictedDisease = diseases.find((d) => d.id === latestSuccess?.predictedDiseaseId)
  const finalDisease = diseases.find((d) => d.id === item?.finalDisease?.id)
  const treatments = (finalDisease?.treatments ?? []).filter((t) => t.isActive)
  const photo = item?.images[0]
  const canDecide = canReview && item !== null && REVIEWABLE.includes(item.status)
  const verified = item?.status === 'VERIFIED'
  const activeRecommendations = (item?.recommendations ?? []).filter((r) => r.isActive)

  const run = async (action: () => Promise<DiagnosisCase>, success: string, failure: string) => {
    setBusy(true)
    try {
      setItem(await action())
      showToast(success, 'success')
      setDialog(null)
    } catch (err) {
      showToast(describeError(err, failure), 'error')
    } finally {
      setBusy(false)
    }
  }

  const openReview = () => {
    // Default to what the AI saw when it is usable; a failed case has to be decided by hand.
    setDecision(latestSuccess ? 'CONFIRMED' : 'CORRECTED')
    setCorrectedId('')
    setComment('')
    setDialog('review')
  }

  const submitReview = () => {
    if (!item) return
    const finalDiseaseId =
      decision === 'INCONCLUSIVE' ? null : decision === 'CONFIRMED' ? latestSuccess?.predictedDiseaseId ?? null : correctedId || null
    return run(
      () =>
        diagnosisApi.review(item.id, {
          decision,
          finalDiseaseId,
          primaryAiInferenceId: latestSuccess?.id ?? null,
          comment: comment.trim() || null,
        }),
      'Đã lưu kết quả duyệt. Nông dân sẽ nhận thông báo.',
      'Không lưu được kết quả duyệt',
    )
  }

  const openRecommend = () => {
    setKind(treatments.length > 0 ? 'TREATMENT' : 'PRODUCT')
    setTreatmentId('')
    setProductId('')
    setProductSearch('')
    setReason('')
    setDialog('recommend')
  }

  const submitRecommendation = async () => {
    if (!item) return
    setBusy(true)
    try {
      await diagnosisApi.recommend(item.id, {
        type: kind,
        diseaseTreatmentId: kind === 'TREATMENT' ? treatmentId : null,
        storeProductId: kind === 'PRODUCT' ? productId : null,
        rankOrder: activeRecommendations.length + 1,
        reason: reason.trim() || null,
      })
      showToast('Đã thêm gợi ý', 'success')
      setDialog(null)
      await load()
    } catch (err) {
      showToast(describeError(err, 'Không thêm được gợi ý'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const removeRecommendation = async (recommendationId: string) => {
    if (!item) return
    setRemoving(recommendationId)
    try {
      await diagnosisApi.unrecommend(item.id, recommendationId)
      showToast('Đã gỡ gợi ý', 'success')
      await load()
    } catch (err) {
      showToast(describeError(err, 'Không gỡ được gợi ý'), 'error')
    } finally {
      setRemoving(null)
    }
  }

  if (loading && !item) return <div className="p-space-md text-slate-500 animate-pulse">Đang tải...</div>
  if (!item) {
    return (
      <div className="p-space-md space-y-3">
        <p className="text-rose-700">{loadError ?? 'Không tìm thấy ca chẩn đoán.'}</p>
        <Link to={base} className="text-emerald-700 underline text-sm">
          Về hàng đợi
        </Link>
      </div>
    )
  }

  const reviewConfirmDisabled =
    (decision === 'CONFIRMED' && !latestSuccess?.predictedDiseaseId) || (decision === 'CORRECTED' && !correctedId)

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={base} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Hàng đợi
        </Link>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded tracking-wide ${DIAGNOSIS_STATUS_BADGE_CLASS[item.status]}`}>
          {DIAGNOSIS_STATUS_LABEL[item.status]}
        </span>
        <span className="text-sm text-slate-600">
          {item.farmer.fullName}
          {item.farmer.phoneNumber ? ` · ${item.farmer.phoneNumber}` : ''} · gửi lúc {formatDateTime(item.submittedAt)}
        </span>
        <div className="flex-1" />
        {canDecide && item.status === 'AI_COMPLETED' && (
          <button
            type="button"
            onClick={() => setDialog('start')}
            className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50"
          >
            Bắt đầu duyệt
          </button>
        )}
        {canReview && (item.status === 'FAILED' || item.status === 'SUBMITTED') && (
          <button
            type="button"
            onClick={() => setDialog('rerun')}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50"
          >
            <RotateCw size={16} /> Chạy lại AI
          </button>
        )}
        {canDecide && (
          <button
            type="button"
            onClick={openReview}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm"
          >
            <Check size={16} /> {item.currentReview ? 'Duyệt lại' : 'Duyệt ca này'}
          </button>
        )}
      </div>

      {!canReview && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Bạn chưa được cấp quyền duyệt AI nên chỉ xem được ca này.
        </div>
      )}

      <div className="grid gap-space-lg lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-3 self-start">
          <h2 className="text-sm font-semibold text-on-surface">Ảnh nông dân gửi</h2>
          {photo ? (
            <a href={photo.imageUrl} target="_blank" rel="noreferrer">
              <img src={photo.imageUrl} alt={`Ảnh lá lúa của ca ${item.caseNumber}`} className="w-full rounded-lg border border-outline-variant object-contain max-h-[460px] bg-slate-50" />
            </a>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-48 rounded-lg border border-dashed border-slate-300 text-slate-500 text-sm">
              <ImageIcon size={24} />
              Không tải được ảnh lúc này. Tải lại trang để thử lại.
            </div>
          )}
          {item.farmerNote && (
            <p className="text-sm text-slate-700">
              <span className="font-medium">Ghi chú của nông dân:</span> {item.farmerNote}
            </p>
          )}
        </section>

        <div className="flex flex-col gap-space-lg">
          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-on-surface">Kết quả của AI (bằng chứng, chưa phải chẩn đoán)</h2>
              <span className="text-xs text-slate-500">{item.inferences.length} lần chạy</span>
            </div>
            {item.inferences.length === 0 && (
              <p className="text-sm text-slate-600">Chưa có kết quả AI. Có thể chưa cấu hình model đang dùng hoặc dịch vụ AI chưa chạy.</p>
            )}
            {[...item.inferences].reverse().map((inference, index) => (
              <div key={inference.id} className="rounded-lg border border-outline-variant p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-mono">
                    {inference.model.name} {inference.model.version}
                  </span>
                  <span>· {formatDateTime(inference.inferredAt)}</span>
                  {inference.durationMs !== null && <span>· {inference.durationMs} ms</span>}
                  {index === 0 && <span className="px-1.5 rounded bg-slate-100">mới nhất</span>}
                </div>
                {inference.status === 'FAILED' ? (
                  <p className="flex items-center gap-2 text-sm text-rose-700">
                    <AlertTriangle size={16} /> AI không cho kết quả: {aiErrorText(inference.error)}
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="text-lg font-semibold">{diseaseLabel(inference.predictedClassLabel)}</span>
                      <span className="tabular-nums text-sm">độ tin cậy {percent(inference.confidence)}</span>
                      {inference.margin !== null && <span className="tabular-nums text-sm text-slate-600">cách lớp thứ hai {percent(inference.margin)}</span>}
                      {inference.passedPolicy ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Đạt ngưỡng</span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Không đạt ngưỡng</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Ngưỡng {inference.policy.version}: tin cậy tối thiểu {percent(inference.policy.minimumConfidence)}
                      {inference.policy.minimumMargin !== null ? `, cách lớp thứ hai tối thiểu ${percent(inference.policy.minimumMargin)}` : ''}
                    </p>
                    <ul className="space-y-1.5">
                      {inference.topPredictions.map((score) => (
                        <li key={score.classLabel} className="grid grid-cols-[130px_1fr_56px] items-center gap-2 text-sm">
                          <span className="truncate">{diseaseLabel(score.classLabel)}</span>
                          <span className="h-2 rounded bg-slate-100 overflow-hidden">
                            <span className="block h-full bg-emerald-500" style={{ width: `${Math.max(1, score.confidence * 100)}%` }} />
                          </span>
                          <span className="tabular-nums text-right text-xs">{percent(score.confidence)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </section>

          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-on-surface">Kết quả duyệt</h2>
            {item.currentReview ? (
              <ReviewBlock review={item.currentReview} current />
            ) : (
              <p className="text-sm text-slate-600">Chưa có ai duyệt ca này. Nông dân chưa thấy kết quả nào.</p>
            )}
            {item.reviewHistory.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-600">Lịch sử duyệt ({item.reviewHistory.length})</summary>
                <div className="mt-2 space-y-2">
                  {item.reviewHistory.map((r) => (
                    <ReviewBlock key={r.id} review={r} />
                  ))}
                </div>
              </details>
            )}
          </section>

          {verified && (
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-on-surface">Gợi ý cho nông dân</h2>
                {canDecide && (
                  <button
                    type="button"
                    onClick={openRecommend}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50"
                  >
                    <Plus size={14} /> Thêm gợi ý
                  </button>
                )}
              </div>
              {item.finalDisease?.isHealthy && (
                <p className="text-xs text-slate-500">Lá khỏe chỉ nhận hướng dẫn chăm sóc, không gợi ý sản phẩm.</p>
              )}
              {activeRecommendations.length === 0 ? (
                <p className="text-sm text-slate-600">Chưa có gợi ý nào.</p>
              ) : (
                <ul className="divide-y divide-outline-variant/60">
                  {activeRecommendations.map((r) => (
                    <li key={r.id} className="py-2 flex items-start gap-3 text-sm">
                      <span className="mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap">
                        {r.type === 'TREATMENT' ? 'Cách xử lý' : 'Sản phẩm'}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{r.type === 'TREATMENT' ? r.treatmentTitle : r.productName}</div>
                        {r.productSku && <div className="text-xs text-slate-500 font-mono">{r.productSku}</div>}
                        {r.reason && <div className="text-xs text-slate-600">{r.reason}</div>}
                      </div>
                      {canDecide && (
                        <button
                          type="button"
                          disabled={removing === r.id}
                          onClick={() => removeRecommendation(r.id)}
                          className="p-1.5 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          aria-label="Gỡ gợi ý"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>

      <ConfirmModal
        open={dialog === 'start'}
        title="Bắt đầu duyệt ca này?"
        message="Ca chuyển sang trạng thái đang duyệt để đồng nghiệp biết bạn đang xem."
        confirmLabel="Bắt đầu duyệt"
        busy={busy}
        onConfirm={() =>
          run(() => diagnosisApi.startReview(item.id), 'Ca đã chuyển sang đang duyệt', 'Không bắt đầu duyệt được')
        }
        onClose={() => setDialog(null)}
      />

      <ConfirmModal
        open={dialog === 'rerun'}
        title="Chạy lại AI trên ảnh này?"
        message="Kết quả cũ vẫn được giữ làm lịch sử."
        confirmLabel="Chạy lại"
        busy={busy}
        onConfirm={() => run(() => diagnosisApi.rerunAi(item.id), 'Đã chạy lại AI', 'Không chạy lại được AI')}
        onClose={() => setDialog(null)}
      />

      <ConfirmModal
        open={dialog === 'review'}
        title="Duyệt ca chẩn đoán"
        message="Quyết định của bạn là kết quả nông dân nhìn thấy. AI chỉ là bằng chứng."
        confirmLabel="Lưu kết quả duyệt"
        busy={busy}
        confirmDisabled={reviewConfirmDisabled}
        onConfirm={submitReview}
        onClose={() => setDialog(null)}
      >
        <div className="space-y-3">
          {(['CONFIRMED', 'CORRECTED', 'INCONCLUSIVE'] as ReviewDecision[]).map((d) => {
            const disabled = d === 'CONFIRMED' && !latestSuccess
            return (
              <label key={d} className={`flex items-start gap-2 text-sm ${disabled ? 'opacity-50' : ''}`}>
                <input type="radio" name="decision" className="mt-1" checked={decision === d} disabled={disabled} onChange={() => setDecision(d)} />
                <span>
                  <span className="font-medium">{DECISION_LABEL[d]}</span>
                  {d === 'CONFIRMED' && latestSuccess && (
                    <span className="block text-xs text-slate-600">
                      Giữ kết quả {diseaseLabel(latestSuccess.predictedClassLabel, predictedDisease?.name)}
                    </span>
                  )}
                  {d === 'CONFIRMED' && !latestSuccess && <span className="block text-xs text-slate-600">Cần có kết quả AI hợp lệ</span>}
                  {d === 'INCONCLUSIVE' && <span className="block text-xs text-slate-600">Nông dân sẽ được nhắc chụp lại ảnh, không có gợi ý thuốc</span>}
                </span>
              </label>
            )
          })}
          {decision === 'CORRECTED' && (
            <select value={correctedId} onChange={(e) => setCorrectedId(e.target.value)} className={field} aria-label="Bệnh đúng">
              <option value="">Chọn bệnh đúng...</option>
              {diseases.map((d) => (
                <option key={d.id} value={d.id}>
                  {diseaseLabel(d.code, d.name)}
                </option>
              ))}
            </select>
          )}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Nhận xét cho nông dân (không bắt buộc)"
            className={field}
          />
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={dialog === 'recommend'}
        title="Thêm gợi ý"
        confirmLabel="Thêm gợi ý"
        busy={busy}
        confirmDisabled={kind === 'TREATMENT' ? !treatmentId : !productId || Boolean(item.finalDisease?.isHealthy)}
        onConfirm={submitRecommendation}
        onClose={() => setDialog(null)}
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['TREATMENT', 'PRODUCT'] as RecommendationKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 h-9 rounded-lg border text-sm font-medium ${kind === k ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white'}`}
              >
                {k === 'TREATMENT' ? 'Cách xử lý' : 'Sản phẩm trong cửa hàng'}
              </button>
            ))}
          </div>
          {kind === 'TREATMENT' ? (
            treatments.length === 0 ? (
              <p className="text-sm text-slate-600">Bệnh này chưa có cách xử lý nào. Chủ cửa hàng nhập ở mục nội dung bệnh.</p>
            ) : (
              <select value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className={field} aria-label="Cách xử lý">
                <option value="">Chọn cách xử lý...</option>
                {treatments.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{TREATMENT_KIND_LABEL[t.treatmentType]}] {t.title}
                  </option>
                ))}
              </select>
            )
          ) : item.finalDisease?.isHealthy ? (
            <p className="text-sm text-amber-800">Lá khỏe không được gợi ý sản phẩm.</p>
          ) : (
            <>
              <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Tìm sản phẩm..." className={field} />
              <ul className="max-h-48 overflow-y-auto divide-y divide-outline-variant/60 rounded-md border border-slate-200">
                {products.length === 0 && <li className="p-2 text-sm text-slate-500">Không có sản phẩm phù hợp.</li>}
                {products.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-slate-50">
                      <input type="radio" name="product" checked={productId === p.id} onChange={() => setProductId(p.id)} />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-xs text-slate-500 font-mono">{p.storeSku ?? p.sku}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} placeholder="Lý do hoặc cách dùng (không bắt buộc)" className={field} />
        </div>
      </ConfirmModal>
    </div>
  )
}

function ReviewBlock({ review, current = false }: { review: AgentReview; current?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-sm space-y-1 ${current ? 'border-emerald-300 bg-emerald-50/40' : 'border-outline-variant'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{DECISION_LABEL[review.decision]}</span>
        {review.finalDisease && <span>→ {diseaseLabel(review.finalDisease.code, review.finalDisease.name)}</span>}
      </div>
      <div className="text-xs text-slate-600">
        {review.reviewerName} · {formatDateTime(review.reviewedAt)}
        {review.supersededAt ? ` · được thay thế lúc ${formatDateTime(review.supersededAt)}` : ''}
      </div>
      {review.comment && <p className="text-slate-700">{review.comment}</p>}
    </div>
  )
}
