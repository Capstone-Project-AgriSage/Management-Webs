import { mockAiModels, mockAiPolicies } from '../data/mockAiData'
import type { AiModel, AiPolicy, AiModelStatus, AiModelType, AiPolicyPriority, AiPolicyType, AiModelActionId, AiPolicyActionId } from '../types'

let models = [...mockAiModels]
let policies = [...mockAiPolicies]

// --- Models ---
export function listModels(): AiModel[] {
  return models
}

export function registerModel(data: Partial<AiModel>): AiModel {
  const newId = `MOD-${data.type === 'Computer Vision' ? 'CV' : data.type === 'NLP/Chatbot' ? 'NLP' : 'PRD'}-${String(models.length + 1).padStart(3, '0')}`
  const newModel: AiModel = {
    id: newId,
    name: data.name || '',
    version: data.version || 'v1.0.0',
    type: data.type || 'Computer Vision',
    accuracy: data.accuracy || 0,
    status: 'Đang huấn luyện',
    lastUpdated: new Date().toISOString().split('T')[0],
    description: data.description || '',
  }
  models = [newModel, ...models]
  return newModel
}

export function updateModelStatus(id: string, status: AiModelStatus): void {
  models = models.map(m => m.id === id ? { ...m, status, lastUpdated: new Date().toISOString().split('T')[0] } : m)
}

export function modelActionsFor(status: AiModelStatus): { id: AiModelActionId; label: string; icon: string; danger?: boolean }[] {
  const actions: { id: AiModelActionId; label: string; icon: string; danger?: boolean }[] = [
    { id: 'view-metrics', label: 'Xem biểu đồ hiệu suất', icon: 'monitoring' }
  ]
  if (status === 'Đã dừng' || status === 'Đang huấn luyện') {
    actions.push({ id: 'deploy', label: 'Khởi chạy (Deploy)', icon: 'play_arrow' })
  } else {
    actions.push({ id: 'pause', label: 'Tạm dừng', icon: 'pause', danger: true })
  }
  return actions
}

// --- Policies ---
export function listPolicies(): AiPolicy[] {
  return policies
}

export function createPolicy(data: Partial<AiPolicy>): AiPolicy {
  const newId = `POL-${String(policies.length + 1).padStart(3, '0')}`
  const newPolicy: AiPolicy = {
    id: newId,
    name: data.name || '',
    type: data.type || 'System Prompt',
    priority: data.priority || 'Trung bình',
    content: data.content || '',
    isActive: data.isActive !== undefined ? data.isActive : true,
    lastUpdated: new Date().toISOString().split('T')[0],
  }
  policies = [newPolicy, ...policies]
  return newPolicy
}

export function updatePolicy(id: string, data: Partial<AiPolicy>): void {
  policies = policies.map(p => p.id === id ? { ...p, ...data, lastUpdated: new Date().toISOString().split('T')[0] } : p)
}

export function togglePolicyActive(id: string): void {
  policies = policies.map(p => p.id === id ? { ...p, isActive: !p.isActive, lastUpdated: new Date().toISOString().split('T')[0] } : p)
}

export function deletePolicy(id: string): void {
  policies = policies.filter(p => p.id !== id)
}

export function policyActionsFor(isActive: boolean): { id: AiPolicyActionId; label: string; icon: string; danger?: boolean }[] {
  return [
    { id: 'edit', label: 'Chỉnh sửa', icon: 'edit' },
    { id: 'toggle-active', label: isActive ? 'Tắt quy tắc' : 'Bật quy tắc', icon: isActive ? 'toggle_off' : 'toggle_on' },
    { id: 'delete', label: 'Xóa quy tắc', icon: 'delete', danger: true },
  ]
}
