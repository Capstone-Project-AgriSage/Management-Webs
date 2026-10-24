import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Image as ImageIcon, Phone } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { describeError } from '@/api/client'
import { diagnosisApi, type AgentReview, type DiagnosisCase, type FarmerResult } from '@/api/diagnosisApi'
import { formatDateTime } from '@/utils/units'
import {
  CERTAINTY_BADGE_CLASS,
  CERTAINTY_LABEL,
  DECISION_LABEL,
  DIAGNOSIS_STATUS_BADGE_CLASS,
  DIAGNOSIS_STATUS_LABEL,
  TREATMENT_KIND_LABEL,
  aiErrorText,
  diseaseLabel,
  useDiagnosisBase,
} from './diagnosisLabels'

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * One farmer's case, read only (AI_DIAGNOSIS.md 2.0): since 2026-10-21 nobody reviews the AI. Staff see the photo, the AI
 * evidence and exactly what the Farmer was shown, and can call the Farmer to follow up.
 */
export default function DiagnosisCasePage() {
  const { id = '' } = useParams()
  const base = useDiagnosisBase()

  const [item, setItem] = useState<DiagnosisCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  usePageHeader({
    title: item ? `Ca chẩn đoán ${item.caseNumber}` : 'Ca chẩn đoán',
    subtitle: 'Ảnh nông dân gửi, kết quả AI và những gì nông dân đã thấy',
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

  // The signed photo URL lasts an hour: reload the case when it is about to expire so the photo never goes blank.
  useEffect(() => {
    const expiry = item?.images[0]?.expiresAt
    if (!expiry) return
    const wait = new Date(expiry).getTime() - Date.now() - 60_000
    if (wait <= 0) return
    const timer = window.setTimeout(load, Math.min(wait, 2_147_000_000))
    return () => window.clearTimeout(timer)
  }, [item?.images, load])

  if (loading && !item) return <div className="p-space-md text-slate-500 animate-pulse">Đang tải...</div>
  if (!item) {
    return (
      <div className="p-space-md space-y-3">
        <p className="text-rose-700">{loadError ?? 'Không tìm thấy ca chẩn đoán.'}</p>
        <Link to={base} className="text-emerald-700 underline text-sm">
          Về danh sách
        </Link>
      </div>
    )
  }

  const photo = item.images[0]
  const legacy = item.currentReview !== null || item.reviewHistory.length > 0
  const storedRecommendations = item.recommendations.filter((r) => r.isActive)

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={base} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Danh sách
        </Link>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded tracking-wide ${DIAGNOSIS_STATUS_BADGE_CLASS[item.status]}`}>
          {DIAGNOSIS_STATUS_LABEL[item.status]}
        </span>
        <span className="text-sm text-slate-600">
          {item.farmer.fullName} · gửi lúc {formatDateTime(item.submittedAt)}
        </span>
        <div className="flex-1" />
        {item.farmer.phoneNumber && (
          <a
            href={`tel:${item.farmer.phoneNumber}`}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50"
            data-testid="call-farmer"
          >
            <Phone size={16} /> Gọi nông dân {item.farmer.phoneNumber}
          </a>
        )}
      </div>

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
          <FarmerView result={item.farmerResult} status={item.status} />

          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-on-surface">Kết quả của AI</h2>
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
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Chắc chắn</span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Chưa chắc</span>
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

          {legacy && (
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-3" data-testid="legacy-review">
              <h2 className="text-sm font-semibold text-on-surface">Kết quả duyệt trước đây</h2>
              <p className="text-xs text-slate-500">Ca này được duyệt trước khi bỏ bước duyệt (21/10/2026).</p>
              {item.currentReview && <ReviewBlock review={item.currentReview} current />}
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
              {storedRecommendations.length > 0 && (
                <ul className="divide-y divide-outline-variant/60">
                  {storedRecommendations.map((r) => (
                    <li key={r.id} className="py-2 flex items-start gap-3 text-sm">
                      <span className="mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap">
                        {r.type === 'TREATMENT' ? 'Cách xử lý' : 'Sản phẩm'}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{r.type === 'TREATMENT' ? r.treatmentTitle : r.productName}</div>
                        {r.productSku && <div className="text-xs text-slate-500 font-mono">{r.productSku}</div>}
                        {r.reason && <div className="text-xs text-slate-600">{r.reason}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function FarmerView({ result, status }: { result: FarmerResult | null; status: DiagnosisCase['status'] }) {
  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-3" data-testid="farmer-view">
      <h2 className="text-sm font-semibold text-on-surface">Nông dân đã thấy</h2>
      {!result ? (
        <p className="text-sm text-slate-600">
          {status === 'FAILED'
            ? 'AI chưa phân tích được ảnh. Nông dân được mời thử lại hoặc gửi ảnh khác.'
            : status === 'CANCELLED'
              ? 'Nông dân đã hủy ca này.'
              : status === 'INCONCLUSIVE'
                ? 'Nông dân được nhắc chụp lại ảnh (kết luận trước đây).'
                : 'Chưa có kết quả.'}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{diseaseLabel(result.disease.code, result.disease.name)}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${CERTAINTY_BADGE_CLASS[result.certainty]}`}>
              {CERTAINTY_LABEL[result.certainty]}
            </span>
          </div>
          {result.certainty === 'UNCERTAIN' && (
            <p className="text-sm text-amber-800">
              Nông dân được khuyên chụp lại ảnh hoặc hỏi cửa hàng; không có thuốc nào được gợi ý. Nên gọi tư vấn.
            </p>
          )}
          {result.reviewerComment && <p className="text-sm text-slate-700">Nhận xét: {result.reviewerComment}</p>}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cách xử lý ({result.treatments.length})</h3>
            {result.treatments.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có nội dung. Chủ cửa hàng nhập ở mục "Bệnh & cách xử lý".</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {result.treatments.map((t) => (
                  <li key={t.id}>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 mr-2">
                      {TREATMENT_KIND_LABEL[t.type]}
                    </span>
                    {t.title}
                    {t.activeIngredientName && <span className="text-xs text-slate-500"> · {t.activeIngredientName}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sản phẩm gợi ý ({result.products.length})</h3>
            {result.products.length === 0 ? (
              <p className="text-sm text-slate-600">
                {result.certainty === 'CONFIDENT' && !result.disease.isHealthy
                  ? 'Không có sản phẩm nào của cửa hàng chứa hoạt chất của cách xử lý bệnh này.'
                  : 'Không gợi ý sản phẩm.'}
              </p>
            ) : (
              <ul className="mt-1 divide-y divide-outline-variant/60 text-sm">
                {result.products.map((p) => (
                  <li key={p.storeProductId} className="py-1.5">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      <span className="font-mono">{p.sku}</span>
                      {p.reason ? ` · ${p.reason}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
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
