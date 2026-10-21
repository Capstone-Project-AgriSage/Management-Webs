import { api } from './client'
import { buildQuery } from './stockApi'
import type { Paged, Uuid } from './types'

/**
 * AI diagnosis, store side (docs/reference/api-flows/AI_DIAGNOSIS.md 2.0): read only. Since 2026-10-21 there is no Human
 * Review: the Farmer reads the AI result at once (`farmerResult` shows exactly what they saw). Reviews and stored
 * recommendations exist only on cases decided before that date.
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

/** CONFIDENT: the AI passed the policy. UNCERTAIN: it did not (no chemical treatment, no product). VERIFIED: a review before 2.0. */
export type DiagnosisCertainty = 'CONFIDENT' | 'UNCERTAIN' | 'VERIFIED'

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

/** What the Farmer read for the case, exactly as the farmer API returns it. */
export interface FarmerResult {
  certainty: DiagnosisCertainty
  hint: string | null
  disease: DiseaseSummary
  reviewerComment: string | null
  treatments: {
    id: Uuid
    type: TreatmentKind
    title: string
    instructions: string
    precautions: string | null
    rankOrder: number
    reason: string | null
    activeIngredientName: string | null
  }[]
  products: {
    storeProductId: Uuid
    productId: Uuid
    name: string
    sku: string
    imageUrl: string | null
    reason: string | null
    rankOrder: number
  }[]
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
  /** Only on cases reviewed before 2.0. */
  currentReview: AgentReview | null
  reviewHistory: AgentReview[]
  recommendations: Recommendation[]
  farmerResult: FarmerResult | null
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
  /** The farmers' cases, newest first. `aiPassed`: only cases whose latest AI result passed (true) or did not pass (false) the policy. */
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
}

/** What the PUT replaces: every text field is overwritten, an empty one clears it. The seeded code and the healthy flag never change. */
export interface DiseaseContentInput {
  name: string
  scientificName?: string | null
  description?: string | null
  symptoms?: string | null
  causes?: string | null
  prevention?: string | null
}

/**
 * The same body creates and replaces a treatment; a higher `priority` is listed first. A treatment's active ingredient
 * decides which products the Farmer is offered for a confident AI result (products containing it).
 */
export interface TreatmentInput {
  treatmentType: TreatmentKind
  title: string
  instructions: string
  activeIngredientId?: Uuid | null
  precautions?: string | null
  priority: number
}

export const diseasesApi = {
  /** The five rice classes with their treatments (inactive treatments included). */
  list: (isActive?: boolean) => api<Disease[]>(`/api/diseases${buildQuery({ isActive })}`),

  /** Admin and store owner. Returns the disease with its treatments. */
  update: (id: Uuid, data: DiseaseContentInput) =>
    api<Disease>(`/api/diseases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  createTreatment: (diseaseId: Uuid, data: TreatmentInput) =>
    api<Treatment>(`/api/diseases/${diseaseId}/treatments`, { method: 'POST', body: JSON.stringify(data) }),

  updateTreatment: (id: Uuid, data: TreatmentInput) =>
    api<Treatment>(`/api/disease-treatments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  activateTreatment: (id: Uuid) => api<Treatment>(`/api/disease-treatments/${id}/activate`, { method: 'POST' }),

  /** Semantic delete: the treatment is deactivated and no longer shown or used for suggestions. */
  deactivateTreatment: (id: Uuid) => api<void>(`/api/disease-treatments/${id}`, { method: 'DELETE' }),
}
