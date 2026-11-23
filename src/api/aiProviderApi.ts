import { api } from './client'

/**
 * The AI providers the general diagnosis models call (AI_DIAGNOSIS.md 2.2 §15), admin only: one setting per provider,
 * ANTHROPIC (Claude) and GOOGLE (Gemini). The API key is write only: the response tells whether one is stored and shows its
 * last four characters, never the key itself.
 */
export type AiProvider = 'ANTHROPIC' | 'GOOGLE'

export const AI_PROVIDERS: { code: AiProvider; label: string; model: string; keySource: string; storageUrl: string }[] = [
  { code: 'ANTHROPIC', label: 'Anthropic (Claude)', model: 'Claude', keySource: 'Claude Console', storageUrl: 'https://api.anthropic.com' },
  { code: 'GOOGLE', label: 'Google (Gemini)', model: 'Gemini', keySource: 'Google AI Studio', storageUrl: 'https://generativelanguage.googleapis.com' },
]

export const providerInfo = (code: string | null | undefined) => AI_PROVIDERS.find(p => p.code === code?.toUpperCase())

export interface AiProviderSettings {
  provider: AiProvider
  modelId: string
  isEnabled: boolean
  timeoutSeconds: number
  hasApiKey: boolean
  apiKeyHint: string | null
  /** False when the server has no master key (SecretEncryption:Key): no key can be stored then. */
  encryptionConfigured: boolean
  suggestedModels: string[]
  updatedAt: string | null
  /** 0 before the first save. */
  version: number
}

export interface AiProviderSettingsInput {
  modelId: string
  isEnabled: boolean
  timeoutSeconds: number
  version: number
  /** Omitted keeps the stored key. */
  apiKey?: string
  clearApiKey?: boolean
}

export interface AiProviderTestResult {
  ok: boolean
  message: string
}

export const aiProviderApi = {
  list: (signal?: AbortSignal) => api<AiProviderSettings[]>('/api/admin/ai-providers', { signal }),
  get: (provider: AiProvider, signal?: AbortSignal) => api<AiProviderSettings>(`/api/admin/ai-providers/${provider}`, { signal }),
  update: (provider: AiProvider, input: AiProviderSettingsInput) =>
    api<AiProviderSettings>(`/api/admin/ai-providers/${provider}`, { method: 'PUT', body: JSON.stringify(input) }),
  /** Checks the STORED key and model with the provider's models API; generates no text, costs nothing. */
  test: (provider: AiProvider) => api<AiProviderTestResult>(`/api/admin/ai-providers/${provider}/test`, { method: 'POST' }),
}
