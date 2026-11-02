import { api } from './client'
import { buildQuery } from './stockApi'
import type { Paged, Uuid } from './types'

/**
 * Input consultation, store side (docs/reference/api-flows/ADVISORY.md sections 6 and 7): the reviewed links between a
 * problem and a product, and the log of what was advised. A link reaches a Farmer only once it is APPROVED; editing an
 * approved link sends it back to DRAFT.
 */

export type RecommendationGroup = 'PROTECTION' | 'NUTRITION'

export type LinkStatus = 'DRAFT' | 'APPROVED' | 'INACTIVE'

export type GrowthStage = 'SEEDLING' | 'TILLERING' | 'BOOTING' | 'HEADING' | 'RIPENING'

export interface DiseaseProduct {
  id: Uuid
  diseaseId: Uuid
  productId: Uuid
  sku: string
  productName: string
  recommendationGroup: RecommendationGroup
  /** Document and page that registers the product for the problem; required for PROTECTION. */
  registrationSource: string | null
  /** Why the product helps; required for NUTRITION. */
  reason: string | null
  doseText: string
  doseSource: string | null
  /** In the product's base unit (bottle, pack, kg); null = the quantity is not worked out. */
  dosePerHaBase: number | null
  baseUnit: string
  applications: number
  preHarvestDays: number | null
  /** Empty = every stage. */
  growthStages: GrowthStage[]
  priority: number
  status: LinkStatus
  approvedBy: Uuid | null
  approvedAt: string | null
}

/** The same body updates a link; creating adds `productId`. Every field is overwritten. */
export interface DiseaseProductInput {
  recommendationGroup: RecommendationGroup
  doseText: string
  registrationSource?: string | null
  reason?: string | null
  doseSource?: string | null
  dosePerHaBase?: number | null
  applications: number
  preHarvestDays?: number | null
  growthStages?: GrowthStage[] | null
  priority: number
}

export interface CreateDiseaseProductInput extends DiseaseProductInput {
  productId: Uuid
}

export const diseaseProductsApi = {
  list: (diseaseId: Uuid) => api<DiseaseProduct[]>(`/api/diseases/${diseaseId}/products`),

  create: (diseaseId: Uuid, data: CreateDiseaseProductInput) =>
    api<DiseaseProduct>(`/api/diseases/${diseaseId}/products`, { method: 'POST', body: JSON.stringify(data) }),

  /** An approved link that is edited goes back to DRAFT. */
  update: (id: Uuid, data: DiseaseProductInput) =>
    api<DiseaseProduct>(`/api/disease-products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  /** Own permission, separate from editing: the approver checks the source and the dose. */
  approve: (id: Uuid) => api<DiseaseProduct>(`/api/disease-products/${id}/approve`, { method: 'POST' }),

  /** Semantic delete: the link becomes INACTIVE and no Farmer sees it. */
  deactivate: (id: Uuid) => api<void>(`/api/disease-products/${id}`, { method: 'DELETE' }),
}

export interface AdvisorySession {
  id: Uuid
  createdAt: string
  farmer: { id: Uuid; name: string; phone: string | null }
  problem: { id: Uuid; name: string }
  /** TEXT (the Farmer picked the problem) or DIAGNOSIS_CASE (came from an AI result). */
  source: string
  areaSqm: number | null
  growthStage: string | null
  items: { storeProductId: Uuid; name: string; group: RecommendationGroup; rankOrder: number }[]
  /** An order of the same Farmer within 7 days contains an advised product. */
  boughtWithin7Days: boolean
}

export const advisorySessionsApi = {
  list: (params: { from?: string; to?: string; diseaseId?: Uuid; page?: number; pageSize?: number }) =>
    api<Paged<AdvisorySession>>(`/api/advisory/sessions${buildQuery(params)}`),
}
