import { api, toQuery } from './client'
import type { Paged } from './types'
import { LIST_PAGE_SIZE } from '@/utils/pagination'

export interface AiModelRow {
  id: string
  name: string
  version: string
  framework: string
  architecture: string | null
  modelStorageUrl: string
  classLabels: string[]
  metrics: Record<string, unknown> | null
  status: string
  createdAt: string
}
export interface AiModelInput {
  name: string
  version: string
  framework: string
  modelStorageUrl: string
  classLabels: string[]
  architecture?: string | null
  inputWidth?: number | null
  inputHeight?: number | null
  metrics?: Record<string, unknown> | null
}
export interface AiPolicyRow {
  id: string
  aiModelId: string
  version: string
  minimumConfidence: number
  minimumMargin: number | null
  topK: number
  requiresHumanReview: boolean
  status: string
  effectiveFrom: string
  effectiveTo: string | null
}
export interface AiPolicyInput { version: string; minimumConfidence: number; topK: number; effectiveFrom: string; requiresHumanReview: true }
export const aiModelsApi = {
  list: (page: number, status: string, signal?: AbortSignal) => api<Paged<AiModelRow>>(`/api/ai-models${toQuery({ page, pageSize: LIST_PAGE_SIZE, status: status || undefined })}`, { signal }),
  create: (input: AiModelInput) => api<AiModelRow>('/api/ai-models', { method: 'POST', body: JSON.stringify(input) }),
  activate: (id: string) => api<AiModelRow>(`/api/ai-models/${id}/activate`, { method: 'POST' }),
  retire: (id: string) => api<AiModelRow>(`/api/ai-models/${id}/retire`, { method: 'POST' }),
  policies: (id: string, signal?: AbortSignal) => api<AiPolicyRow[]>(`/api/ai-models/${id}/policies`, { signal }),
  createPolicy: (id: string, input: AiPolicyInput) => api<AiPolicyRow>(`/api/ai-models/${id}/policies`, { method: 'POST', body: JSON.stringify(input) }),
  setPolicyActive: (id: string, active: boolean) => api<AiPolicyRow>(`/api/ai-policies/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }),
}

export async function listModelOptions(signal: AbortSignal) {
  const first = await aiModelsApi.list(1, '', signal)
  const models = [...first.items]
  for (let page = 2; page <= first.totalPages; page++) models.push(...(await aiModelsApi.list(page, '', signal)).items)
  return models
}

/** This endpoint has no Search parameter. Read its 10-item pages to search without a fixed truncation. */
export async function searchAiModels(page: number, status: string, search: string, signal: AbortSignal): Promise<Paged<AiModelRow>> {
  if (!search) return aiModelsApi.list(page, status, signal)
  const first = await aiModelsApi.list(1, status, signal)
  const all = [...first.items]
  for (let sourcePage = 2; sourcePage <= first.totalPages; sourcePage++) {
    all.push(...(await aiModelsApi.list(sourcePage, status, signal)).items)
  }
  const keyword = search.toLowerCase()
  const matches = all.filter(model => `${model.id} ${model.name} ${model.version}`.toLowerCase().includes(keyword))
  return { items: matches.slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE), page, pageSize: LIST_PAGE_SIZE, totalCount: matches.length, totalPages: Math.ceil(matches.length / LIST_PAGE_SIZE) }
}
