import { useLocation } from 'react-router-dom'
import type { DiagnosisCertainty, DiagnosisStatus, ProblemType, ReviewDecision, TreatmentKind } from '@/api/diagnosisApi'
import type { GrowthStage, LinkStatus, RecommendationGroup } from '@/api/advisoryApi'

/** UNDER_REVIEW, VERIFIED and INCONCLUSIVE only exist on cases from before Human Review was removed (2026-10-21). */
export const DIAGNOSIS_STATUS_LABEL: Record<DiagnosisStatus, string> = {
  SUBMITTED: 'Đã gửi, chờ chạy AI',
  PROCESSING: 'AI đang phân tích',
  AI_COMPLETED: 'Đã có kết quả AI',
  UNDER_REVIEW: 'Đang duyệt (cũ)',
  VERIFIED: 'Đã xác minh (cũ)',
  INCONCLUSIVE: 'Chưa kết luận (cũ)',
  FAILED: 'AI không phân tích được',
  CANCELLED: 'Đã hủy',
}

export const CERTAINTY_LABEL: Record<DiagnosisCertainty, string> = {
  CONFIDENT: 'AI chắc chắn',
  UNCERTAIN: 'AI chưa chắc chắn',
  VERIFIED: 'Đã được duyệt (trước đây)',
}

export const CERTAINTY_BADGE_CLASS: Record<DiagnosisCertainty, string> = {
  CONFIDENT: 'bg-emerald-100 text-emerald-800',
  UNCERTAIN: 'bg-amber-100 text-amber-800',
  VERIFIED: 'bg-slate-200 text-slate-700',
}

export const DIAGNOSIS_STATUS_BADGE_CLASS: Record<DiagnosisStatus, string> = {
  SUBMITTED: 'bg-slate-200 text-slate-700',
  PROCESSING: 'bg-sky-100 text-sky-800',
  AI_COMPLETED: 'bg-emerald-100 text-emerald-800',
  UNDER_REVIEW: 'bg-indigo-100 text-indigo-800',
  VERIFIED: 'bg-slate-200 text-slate-700',
  INCONCLUSIVE: 'bg-violet-100 text-violet-800',
  FAILED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate-200 text-slate-600',
}

export const DECISION_LABEL: Record<ReviewDecision, string> = {
  CONFIRMED: 'Xác nhận kết quả của AI',
  CORRECTED: 'Sửa lại bệnh',
  INCONCLUSIVE: 'Chưa thể kết luận',
}

export const TREATMENT_KIND_LABEL: Record<TreatmentKind, string> = {
  CULTURAL: 'Canh tác',
  CHEMICAL: 'Hóa học',
  PREVENTIVE: 'Phòng ngừa',
  OTHER: 'Khác',
}

export const PROBLEM_TYPE_LABEL: Record<ProblemType, string> = {
  DISEASE: 'Bệnh',
  PEST: 'Sâu rầy',
  WEED: 'Cỏ dại',
  NUTRITION: 'Dinh dưỡng',
  GROWTH: 'Sinh trưởng, đất',
}

export const GROUP_LABEL: Record<RecommendationGroup, string> = {
  PROTECTION: 'Thuốc bảo vệ thực vật',
  NUTRITION: 'Phân bón',
}

export const LINK_STATUS_LABEL: Record<LinkStatus, string> = {
  DRAFT: 'Nháp, chưa duyệt',
  APPROVED: 'Đã duyệt',
  INACTIVE: 'Đã ngừng',
}

export const LINK_STATUS_BADGE_CLASS: Record<LinkStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-slate-200 text-slate-600',
}

export const GROWTH_STAGE_LABEL: Record<GrowthStage, string> = {
  SEEDLING: 'Mạ, sau sạ',
  TILLERING: 'Đẻ nhánh',
  BOOTING: 'Làm đòng',
  HEADING: 'Trổ bông',
  RIPENING: 'Chín',
}

export const GROWTH_STAGES = Object.keys(GROWTH_STAGE_LABEL) as GrowthStage[]

/** Names shown to staff for the five seeded classes (the database holds the English names until content is edited). */
const DISEASE_VI: Record<string, string> = {
  LEAF_BLAST: 'Đạo ôn',
  BACTERIAL_LEAF_BLIGHT: 'Bạc lá (cháy bìa lá)',
  BROWN_SPOT: 'Đốm nâu',
  SHEATH_BLIGHT: 'Khô vằn',
  HEALTHY: 'Lá khỏe',
}

export function diseaseLabel(code: string | null | undefined, fallbackName?: string | null): string {
  if (!code) return fallbackName ?? '—'
  return DISEASE_VI[code] ?? fallbackName ?? code
}

/** Why a failed AI run failed, in words for staff. */
export function aiErrorText(error: string | null): string {
  switch (error) {
    case 'AI_SERVICE_UNAVAILABLE':
      return 'Không gọi được dịch vụ AI'
    case 'MODEL_VERSION_MISMATCH':
      return 'Dịch vụ AI trả về phiên bản model khác với model đang dùng'
    case 'STUB_REFUSED':
      return 'Kết quả mô phỏng bị từ chối ngoài môi trường phát triển'
    case 'UNKNOWN_CLASS_LABEL':
      return 'AI trả về một lớp bệnh không có trong hệ thống'
    default:
      return error ?? 'Lỗi không rõ'
  }
}

/** The diagnosis screens are shared: the store owner opens them under /agent, sales staff under /sales. */
export function useDiagnosisBase(): string {
  const { pathname } = useLocation()
  return pathname.startsWith('/sales') ? '/sales/ai-review' : '/agent/ai-recommendations'
}
