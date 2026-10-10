import { api } from './client'
import { buildQuery } from './stockApi'
import type { Paged, Uuid } from './types'

/**
 * AI diagnosis, reviewer side (docs/reference/api-flows/AI_DIAGNOSIS.md). Reading the queue needs the permission code of
 * the route; deciding a case (start review, review, rerun, recommendations) also needs the member's review right
 * (`canReviewAi` in /api/auth/me).
 */

export type DiagnosisStatus =
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'AI_COMPLETED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'INCONCLUSIVE'
  | 'FAILED'
  | 'CANCELLED'

export type ReviewDecision = 'CONFIRMED' | 'CORRECTED' | 'INCONCLUSIVE'

export type RecommendationKind = 'TREATMENT' | 'PRODUCT'

export type TreatmentKind = 'CULTURAL' | 'CHEMICAL' | 'PREVENTIVE' | 'OTHER'

export interface DiseaseSummary {
  id: Uuid
  code: string
  name: string
  isHealthy: boolean
  symptoms: string | null
  prevention: string | null
}

export interface DiagnosisListItem {
  id: Uuid
  caseNumber: string
  status: DiagnosisStatus
  submittedAt: string
  completedAt: string | null
  farmerProfileId: Uuid
  farmerName: string
  farmerPhone: string | null
  predictedClassLabel: string | null
  confidence: number | null
  passedPolicy: boolean | null
  finalDiseaseCode: string | null
}

export interface DiagnosisImage {
  id: Uuid
  /** A signed URL that expires at `expiresAt`: reload the case for a new one. */
  imageUrl: string
  expiresAt: string
  isPrimary: boolean
  fileName: string | null
  uploadedAt: string
}

export interface ClassScore {
  classLabel: string
  diseaseId: Uuid | null
  confidence: number
}

export interface AiInference {
  id: Uuid
  diagnosisImageId: Uuid
  status: 'SUCCESS' | 'FAILED'
  inferredAt: string
  durationMs: number | null
  model: { id: Uuid; name: string; version: string }
  policy: { id: Uuid; version: string; minimumConfidence: number; minimumMargin: number | null; topK: number }
  predictedClassLabel: string
  predictedDiseaseId: Uuid | null
  confidence: number
  margin: number | null
  passedPolicy: boolean
  topPredictions: ClassScore[]
  /** Why a FAILED inference failed (AI_SERVICE_UNAVAILABLE, MODEL_VERSION_MISMATCH, ...). */
  error: string | null
}

export interface AgentReview {
  id: Uuid
  decision: ReviewDecision
  finalDisease: DiseaseSummary | null
  aiDiseaseId: Uuid | null
  primaryAiInferenceId: Uuid | null
  comment: string | null
  isCurrent: boolean
  reviewedAt: string
  reviewerMemberId: Uuid
  reviewerName: string
  supersededAt: string | null
}

export interface Recommendation {
  id: Uuid
  agentReviewId: Uuid
  type: RecommendationKind
  diseaseTreatmentId: Uuid | null
  treatmentTitle: string | null
  storeProductId: Uuid | null
  productName: string | null
  productSku: string | null
  rankOrder: number
  reason: string | null
  isActive: boolean
  approvedAt: string
}

export interface DiagnosisCase {
  id: Uuid
  caseNumber: string
  status: DiagnosisStatus
  submittedAt: string
  completedAt: string | null
  farmer: { farmerProfileId: Uuid; userId: Uuid; fullName: string; phoneNumber: string | null }
  farmerNote: string | null
  finalDisease: DiseaseSummary | null
  images: DiagnosisImage[]
  inferences: AiInference[]
  currentReview: AgentReview | null
  reviewHistory: AgentReview[]
  recommendations: Recommendation[]
}

export interface Treatment {
  id: Uuid
  diseaseId: Uuid
  treatmentType: TreatmentKind
  title: string
  instructions: string
  activeIngredientId: Uuid | null
  activeIngredientName: string | null
  precautions: string | null
  priority: number
  isActive: boolean
}

export interface Disease {
  id: Uuid
  code: string
  name: string
  scientificName: string | null
  cropType: string
  description: string | null
  symptoms: string | null
  causes: string | null
  prevention: string | null
  isHealthyClass: boolean
  isActive: boolean
  treatments: Treatment[]
}

export const diagnosisApi = {
  /** The review queue, oldest first. `aiPassed`: only cases whose latest AI result passed (true) or did not pass (false) the policy. */
  list: (params: {
    status?: DiagnosisStatus
    aiPassed?: boolean
    from?: string
    to?: string
    search?: string
    page?: number
    pageSize?: number
  }) => api<Paged<DiagnosisListItem>>(`/api/diagnosis-cases${buildQuery(params)}`),

  get: (id: Uuid) => api<DiagnosisCase>(`/api/diagnosis-cases/${id}`),

  /** AI_COMPLETED -> UNDER_REVIEW. */
  startReview: (id: Uuid) => api<DiagnosisCase>(`/api/diagnosis-cases/${id}/start-review`, { method: 'POST' }),

  /** CONFIRMED needs the disease the AI predicted; CORRECTED any disease; INCONCLUSIVE none. A new review replaces the current one. */
  review: (id: Uuid, data: { decision: ReviewDecision; finalDiseaseId?: Uuid | null; primaryAiInferenceId?: Uuid | null; comment?: string | null }) =>
    api<DiagnosisCase>(`/api/diagnosis-cases/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),

  /** Only on a case that is submitted or failed; 503 when the AI service cannot be reached. */
  rerunAi: (id: Uuid) => api<DiagnosisCase>(`/api/diagnosis-cases/${id}/rerun-ai`, { method: 'POST' }),

  /** Only on a verified case. Exactly one target: a treatment or a store product. */
  recommend: (
    id: Uuid,
    data: { type: RecommendationKind; diseaseTreatmentId?: Uuid | null; storeProductId?: Uuid | null; rankOrder?: number; reason?: string | null },
  ) => api<Recommendation>(`/api/diagnosis-cases/${id}/recommendations`, { method: 'POST', body: JSON.stringify(data) }),

  /** Deactivates the recommendation (the row is kept). */
  unrecommend: (id: Uuid, recommendationId: Uuid) =>
    api<void>(`/api/diagnosis-cases/${id}/recommendations/${recommendationId}`, { method: 'DELETE' }),
}

export const diseasesApi = {
  /** The five rice classes with their treatments. */
  list: (isActive?: boolean) => api<Disease[]>(`/api/diseases${buildQuery({ isActive })}`),
}
