import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Info, KeyRound, Lock, PlugZap, ShieldAlert } from 'lucide-react'
import { ApiError } from '@/api/client'
import { AI_PROVIDERS, aiProviderApi, providerInfo, type AiProvider, type AiProviderSettings, type AiProviderTestResult } from '@/api/aiProviderApi'
import { usePageHeader } from '@/context/PageHeaderContext'
import { usePermission } from '@/context/PermissionContext'
import { useToast } from '@/context/ToastContext'
import { describeApiError } from '@/utils/apiError'
import { formatDayTime } from '@/utils/creditLabels'

// AI_DIAGNOSIS.md 2.2 §15: the providers the general photo-diagnosis models call, one tab per provider (Claude, Gemini). Each
// API key is write only: it goes to the server once, is stored encrypted, and this page only ever shows its last four
// characters. Which provider diagnoses is decided by the ACTIVE AI model (its framework), not here.

const MODEL_LABEL: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5 · chính xác nhất',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5 · cân bằng chi phí',
  'claude-haiku-5-5': 'Claude Haiku 5.5 · nhanh, rẻ nhất',
}
const MIN_TIMEOUT = 10
const MAX_TIMEOUT = 300
const MODEL_ID = /^[a-z0-9][a-z0-9.-]+$/

interface Form {
  modelId: string
  timeoutSeconds: string
  isEnabled: boolean
  apiKey: string
  clearApiKey: boolean
}

const formOf = (s: AiProviderSettings): Form => ({ modelId: s.modelId, timeoutSeconds: String(s.timeoutSeconds), isEnabled: s.isEnabled, apiKey: '', clearApiKey: false })

const input = 'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-500'

export default function AiProviderPage() {
  usePageHeader({ title: 'Nhà cung cấp AI', subtitle: 'Model AI chẩn đoán ảnh theo cây trồng và API key của từng nhà cung cấp' })
  const [params, setParams] = useSearchParams()
  const provider: AiProvider = params.get('provider')?.toUpperCase() === 'GOOGLE' ? 'GOOGLE' : 'ANTHROPIC'
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-5 p-space-md">
      <div role="tablist" aria-label="Nhà cung cấp AI" className="inline-flex self-start rounded-lg border border-slate-200 bg-white p-1 text-sm">
        {AI_PROVIDERS.map(p => (
          <button key={p.code} type="button" role="tab" aria-selected={provider === p.code} onClick={() => setParams({ provider: p.code }, { replace: true })}
            className={`rounded-md px-4 py-1.5 font-semibold ${provider === p.code ? 'bg-primary-dark text-white' : 'text-slate-700'}`}>{p.label}</button>
        ))}
      </div>
      <ProviderPanel key={provider} provider={provider} />
    </div>
  )
}

function ProviderPanel({ provider }: { provider: AiProvider }) {
  const { has } = usePermission()
  const canManage = has('AI_PROVIDER.MANAGE')
  const { showToast } = useToast()
  const info = providerInfo(provider)!
  const [settings, setSettings] = useState<AiProviderSettings | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<AiProviderTestResult | null>(null)

  const apply = (next: AiProviderSettings) => { setSettings(next); setForm(formOf(next)) }
  const load = useCallback(async () => {
    setLoading(true); setLoadError('')
    try { apply(await aiProviderApi.get(provider)) } catch (err) { setLoadError(describeApiError(err, 'Không tải được cấu hình nhà cung cấp AI')) } finally { setLoading(false) }
  }, [provider])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  if (loading && !settings) return <div role="status" className="text-sm text-slate-500">Đang tải cấu hình {info.label}…</div>
  if (!settings || !form) return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{loadError || 'Không tải được cấu hình nhà cung cấp AI'}
      <button type="button" className="ml-3 underline" onClick={() => void load()}>Thử lại</button></div>
  )

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(previous => (previous ? { ...previous, [key]: value } : previous))
  const newKey = form.apiKey.trim()
  // A key that will be stored after the save: the new one, or the stored one when it is kept.
  const keyAfterSave = newKey !== '' || (settings.hasApiKey && !form.clearApiKey)
  const timeout = Number(form.timeoutSeconds)
  const modelError = MODEL_ID.test(form.modelId.trim()) && form.modelId.trim().length <= 100 ? '' : 'Mã model gồm chữ thường, số, dấu chấm và gạch ngang, ví dụ gemini-3.6-flash.'
  const timeoutError = !Number.isInteger(timeout) || timeout < MIN_TIMEOUT || timeout > MAX_TIMEOUT ? `Số giây nguyên từ ${MIN_TIMEOUT} đến ${MAX_TIMEOUT}.` : ''
  const keyError = newKey && !settings.encryptionConfigured ? 'Máy chủ chưa có khoá mã hoá nên chưa lưu được key.' : ''
  const enabledError = form.isEnabled && !keyAfterSave ? 'Cần một API key để bật.' : ''
  const dirty = newKey !== '' || form.clearApiKey || form.modelId.trim() !== settings.modelId || form.timeoutSeconds !== String(settings.timeoutSeconds) || form.isEnabled !== settings.isEnabled
  const invalid = !!(modelError || timeoutError || keyError || enabledError)

  const save = async () => {
    if (!canManage || saving || invalid || !dirty) return
    setSaving(true); setTestResult(null)
    try {
      const saved = await aiProviderApi.update(provider, {
        modelId: form.modelId.trim(),
        isEnabled: form.isEnabled && keyAfterSave,
        timeoutSeconds: timeout,
        version: settings.version,
        ...(newKey ? { apiKey: newKey } : {}),
        ...(form.clearApiKey && !newKey ? { clearApiKey: true } : {}),
      })
      apply(saved)
      showToast(`Đã lưu cấu hình ${info.label}`, 'success')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        showToast('Cấu hình vừa được người khác sửa. Đã tải lại bản mới, hãy kiểm tra rồi lưu lại.', 'error')
        await load()
      } else showToast(describeApiError(err, 'Không lưu được cấu hình'), 'error')
    } finally { setSaving(false) }
  }

  const test = async () => {
    if (!canManage || testing) return
    setTesting(true); setTestResult(null)
    try { setTestResult(await aiProviderApi.test(provider)) } catch (err) { setTestResult({ ok: false, message: describeApiError(err, 'Không kiểm tra được kết nối') }) } finally { setTesting(false) }
  }

  const disabled = !canManage || saving
  return (
    <div className="flex flex-col gap-5" role="tabpanel" aria-label={info.label}>
      {!settings.encryptionConfigured && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p><strong className="font-semibold">Máy chủ chưa có khoá mã hoá.</strong> Chưa thể lưu API key. Người vận hành máy chủ cần đặt <code className="font-mono">SecretEncryption:Key</code> (32 byte, base64) trong User Secrets hoặc biến môi trường rồi khởi động lại API.</p>
        </div>
      )}
      {provider === 'GOOGLE' && (
        <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900" data-testid="google-free-tier-note">
          <Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>Key miễn phí của Google AI Studio: theo điều khoản Gemini API, Google dùng ảnh và câu trả lời để cải thiện sản phẩm, người duyệt có thể đọc, và không được gửi thông tin cá nhân. Khi chẩn đoán bằng ảnh thật của nông dân, dùng key của dự án đã bật thanh toán (gói trả phí).</p>
        </div>
      )}
      {!canManage && <p className="flex items-center gap-2 text-xs text-slate-500"><Lock size={14} aria-hidden="true" />Chỉ Admin có quyền sửa cấu hình này.</p>}

      <section aria-label="Trạng thái nhà cung cấp AI" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nhà cung cấp</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{info.label}</p>
          <p className="mt-1 text-xs text-slate-500 break-all">{settings.modelId}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">API key</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900" data-testid="key-state">
            <KeyRound size={16} aria-hidden="true" className={settings.hasApiKey ? 'text-emerald-700' : 'text-slate-400'} />
            {settings.hasApiKey ? `Đã lưu · kết thúc bằng ${settings.apiKeyHint ?? '••••'}` : 'Chưa có key'}
          </p>
          <p className="mt-1 text-xs text-slate-500">Key không bao giờ được hiện lại.</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái</p>
          <p className={`mt-1 text-sm font-semibold ${settings.isEnabled ? 'text-emerald-700' : 'text-slate-700'}`} data-testid="provider-state">{settings.isEnabled ? 'Đang bật' : 'Đang tắt'}</p>
          <p className="mt-1 text-xs text-slate-500">{settings.updatedAt ? `Cập nhật ${formatDayTime(settings.updatedAt)}` : 'Chưa lưu lần nào: đang dùng giá trị mặc định'}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Cấu hình {info.label}</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="provider-model" className="text-sm font-medium text-slate-700">Model</label>
            <input id="provider-model" list="provider-model-options" className={`${input} font-mono ${modelError ? 'border-rose-300' : ''}`} value={form.modelId} disabled={disabled}
              maxLength={100} spellCheck={false} autoComplete="off" onChange={e => set('modelId', e.target.value)} aria-invalid={!!modelError} aria-describedby="provider-model-hint" />
            <datalist id="provider-model-options">
              {settings.suggestedModels.map(model => <option key={model} value={model}>{MODEL_LABEL[model] ?? model}</option>)}
            </datalist>
            <p id="provider-model-hint" className={`text-xs ${modelError ? 'text-rose-600' : 'text-slate-500'}`}>
              {modelError || `Gợi ý: ${settings.suggestedModels.join(', ')}. Mô hình AI đã đăng ký cho ${info.model} phải có phiên bản đúng bằng mã này.`}
            </p>
          </div>
          <div className="space-y-1">
            <label htmlFor="provider-timeout" className="text-sm font-medium text-slate-700">Thời gian chờ tối đa</label>
            <div className="flex items-center gap-2">
              <input id="provider-timeout" type="number" inputMode="numeric" min={MIN_TIMEOUT} max={MAX_TIMEOUT} className={`${input} ${timeoutError ? 'border-rose-300' : ''}`} value={form.timeoutSeconds} disabled={disabled}
                onChange={e => set('timeoutSeconds', e.target.value)} aria-invalid={!!timeoutError} aria-describedby="provider-timeout-hint" />
              <span className="shrink-0 text-sm text-slate-500">giây</span>
            </div>
            <p id="provider-timeout-hint" className={`text-xs ${timeoutError ? 'text-rose-600' : 'text-slate-500'}`}>{timeoutError || 'Quá thời gian này, ca chẩn đoán báo lỗi và nông dân gửi lại được.'}</p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="provider-key" className="text-sm font-medium text-slate-700">{settings.hasApiKey ? 'Thay API key' : 'API key'}</label>
            <input id="provider-key" type="password" autoComplete="new-password" spellCheck={false} maxLength={500} className={`${input} font-mono ${keyError ? 'border-rose-300' : ''}`}
              value={form.apiKey} disabled={disabled || !settings.encryptionConfigured || form.clearApiKey}
              placeholder={settings.hasApiKey ? `Để trống để giữ key đang lưu (…${settings.apiKeyHint ?? ''})` : `Dán API key từ ${info.keySource}`}
              onChange={e => set('apiKey', e.target.value)} aria-invalid={!!keyError} aria-describedby="provider-key-hint" />
            <p id="provider-key-hint" className={`text-xs ${keyError ? 'text-rose-600' : 'text-slate-500'}`}>{keyError || 'Key được mã hoá trên máy chủ. Trang này, nhật ký và các API không bao giờ trả lại key.'}</p>
            {settings.hasApiKey && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.clearApiKey} disabled={disabled || newKey !== ''} onChange={e => setForm(previous => (previous ? { ...previous, clearApiKey: e.target.checked, isEnabled: e.target.checked ? false : previous.isEnabled } : previous))} />
                Xoá key đang lưu (nhà cung cấp sẽ tắt)
              </label>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.isEnabled} disabled={disabled || (!keyAfterSave && !form.isEnabled)} onChange={e => set('isEnabled', e.target.checked)} aria-describedby="provider-enabled-hint" />
              Bật chẩn đoán ảnh bằng {info.model}
            </label>
            <p id="provider-enabled-hint" className={`mt-1 text-xs ${enabledError ? 'text-rose-600' : 'text-slate-500'}`}>{enabledError || `Khi tắt, ca gửi tới mô hình ${info.model} sẽ báo lỗi và nông dân gửi lại sau.`}</p>
          </div>
        </div>
        {canManage && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => void save()} disabled={saving || invalid || !dirty} className="h-10 rounded-lg bg-primary-dark px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu…' : 'Lưu cấu hình'}</button>
            <button type="button" onClick={() => void test()} disabled={testing || saving || dirty || !settings.hasApiKey} title={dirty ? 'Lưu thay đổi trước khi kiểm tra' : undefined}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-50">
              <PlugZap size={16} aria-hidden="true" />{testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
            </button>
            <p className="text-xs text-slate-500">{dirty ? 'Lưu thay đổi trước khi kiểm tra.' : 'Kiểm tra dùng key và model đã lưu, không tạo nội dung nên không tốn phí.'}</p>
          </div>
        )}
        {testResult && (
          <p role="status" data-testid="test-result" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${testResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{testResult.message}</p>
        )}
      </section>

      <p className="text-xs leading-5 text-slate-500">
        Nhà cung cấp nào chẩn đoán do mô hình AI đang hoạt động quyết định. Để dùng {info.model}: lưu key và bật ở đây, rồi ở trang{' '}
        <Link to="/admin/ai/models" className="font-semibold text-primary-dark underline">Mô hình AI</Link> đăng ký mô hình {info.model} với các cây trồng cần
        chẩn đoán, thêm chính sách ngưỡng tin cậy và kích hoạt. Ảnh của nông dân được gửi tới {info.label} để phân tích.
      </p>
    </div>
  )
}
