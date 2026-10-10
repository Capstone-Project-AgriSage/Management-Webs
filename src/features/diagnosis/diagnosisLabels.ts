import { useLocation } from 'react-router-dom'
import type { DiagnosisStatus, ReviewDecision, TreatmentKind } from '@/api/diagnosisApi'

export const DIAGNOSIS_STATUS_LABEL: Record<DiagnosisStatus, string> = {
  SUBMITTED: 'Đã gửi, chờ chạy AI',
  PROCESSING: 'AI đang phân tích',
  AI_COMPLETED: 'Chờ duyệt',
  UNDER_REVIEW: 'Đang duyệt',
  VERIFIED: 'Đã xác minh',
  INCONCLUSIVE: 'Chưa kết luận',
  FAILED: 'AI lỗi, cần chẩn đoán tay',
  CANCELLED: 'Đã hủy',
}

export const DIAGNOSIS_STATUS_BADGE_CLASS: Record<DiagnosisStatus, string> = {
  SUBMITTED: 'bg-slate-200 text-slate-700',
  PROCESSING: 'bg-sky-100 text-sky-800',
  AI_COMPLETED: 'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-indigo-100 text-indigo-800',
  VERIFIED: 'bg-emerald-100 text-emerald-800',
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
