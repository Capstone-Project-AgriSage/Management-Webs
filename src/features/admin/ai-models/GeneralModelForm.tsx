import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { describeError } from '@/api/client'
import { diseasesApi, type Disease } from '@/api/diagnosisApi'
import { AI_PROVIDERS, aiProviderApi, providerInfo, type AiProvider, type AiProviderSettings } from '@/api/aiProviderApi'
import type { AiModelInput } from '@/api/aiModelsApi'
import { CROP_CODES, cropLabel, diseaseLabel } from '@/features/diagnosis/diagnosisLabels'
import { formatDay } from '@/utils/creditLabels'

// AI_DIAGNOSIS.md 2.2 D17: a general model (framework ANTHROPIC = Claude, GOOGLE = Gemini) registers the active DISEASE
// codes it may answer, plus HEALTHY. The admin picks the provider and the crops; every active disease of a picked crop
// becomes a label. The version must be the model id configured for that provider, or each case fails with
// MODEL_VERSION_MISMATCH (D10).

const MODEL_ID = /^[a-z0-9][a-z0-9.-]+$/
const field = 'w-full border rounded-lg p-2 mt-1 text-sm font-normal'

const isDisease = (d: Disease) => d.isActive && !d.isHealthyClass && (d.problemType ?? 'DISEASE') === 'DISEASE'

export default function GeneralModelForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: AiModelInput) => void }) {
  const [diseases, setDiseases] = useState<Disease[] | null>(null)
  const [providers, setProviders] = useState<AiProviderSettings[]>([])
  const [loadError, setLoadError] = useState('')
  const [provider, setProvider] = useState<AiProvider>('ANTHROPIC')
  const [name, setName] = useState('')
  const [version, setVersion] = useState('')
  const [crops, setCrops] = useState<Set<string>>(new Set())
  const [touched, setTouched] = useState(false)
  const info = providerInfo(provider)!
  const configured = providers.find(p => p.provider === provider) ?? null

  // Name and version follow the provider until the admin types their own.
  const pickProvider = (next: AiProvider, list = providers) => {
    setProvider(next)
    const nextInfo = providerInfo(next)!
    setName(`${nextInfo.model} chẩn đoán ${formatDay(new Date().toISOString())}`)
    setVersion(list.find(p => p.provider === next)?.modelId ?? '')
  }

  useEffect(() => {
    const controller = new AbortController()
    diseasesApi.list(true, controller.signal).then(rows => {
      if (controller.signal.aborted) return
      setDiseases(rows)
      // Every crop that has a disease is picked at first; the admin unticks the ones not to diagnose.
      setCrops(new Set(rows.filter(isDisease).map(d => d.cropType || 'RICE')))
    }).catch(err => { if (!controller.signal.aborted) setLoadError(describeError(err, 'Không tải được danh sách bệnh')) })
    aiProviderApi.list(controller.signal).then(list => {
      if (controller.signal.aborted) return
      setProviders(list)
      // Start on the provider that is switched on (Claude when both or neither are).
      const start = list.find(p => p.isEnabled)?.provider ?? 'ANTHROPIC'
      pickProvider(start, list)
    }).catch(() => { if (!controller.signal.aborted) pickProvider('ANTHROPIC', []) })
    // Runs once: pickProvider only sets state from the loaded list.
    return () => controller.abort()
  }, [])

  const byCrop = useMemo(() => {
    const groups = new Map<string, Disease[]>()
    for (const d of (diseases ?? []).filter(isDisease)) {
      const crop = d.cropType || 'RICE'
      groups.set(crop, [...(groups.get(crop) ?? []), d])
    }
    return groups
  }, [diseases])
  const cropCodes = [...new Set([...CROP_CODES, ...byCrop.keys()])]
  const healthy = diseases?.find(d => d.isHealthyClass && d.isActive)
  const labels = [...cropCodes.filter(crop => crops.has(crop)).flatMap(crop => (byCrop.get(crop) ?? []).map(d => d.code)), ...(healthy ? [healthy.code] : [])]
  const diseaseCount = labels.length - (healthy ? 1 : 0)

  const errors = {
    name: name.trim() ? '' : 'Nhập tên mô hình.',
    version: MODEL_ID.test(version.trim()) ? '' : `Nhập mã model ${info.model}, ví dụ ${provider === 'GOOGLE' ? 'gemini-3.6-flash' : 'claude-opus-5-5'}.`,
    crops: diseaseCount > 0 ? '' : 'Chọn ít nhất một cây trồng có bệnh.',
    healthy: diseases && !healthy ? 'Chưa có lớp "Lá khỏe" (HEALTHY) đang hoạt động.' : '',
  }
  const invalid = Object.values(errors).some(Boolean) || !diseases
  const mismatch = configured && version.trim() && version.trim() !== configured.modelId

  const toggle = (crop: string, on: boolean) => setCrops(previous => { const next = new Set(previous); if (on) next.add(crop); else next.delete(crop); return next })
  const submit = () => {
    setTouched(true)
    if (invalid || busy) return
    onSubmit({ name: name.trim(), version: version.trim(), framework: provider, modelStorageUrl: info.storageUrl, classLabels: labels })
  }

  if (loadError) return <p role="alert" className="text-sm text-rose-700">{loadError}</p>
  if (!diseases) return <p role="status" className="text-sm text-slate-500">Đang tải danh sách bệnh…</p>
  return (
    <div className="space-y-4 text-sm" data-testid="general-model-form">
      <fieldset>
        <legend className="font-semibold">Nhà cung cấp</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {AI_PROVIDERS.map(p => {
            const state = providers.find(s => s.provider === p.code)
            return <label key={p.code} className="flex items-center gap-2">
              <input type="radio" name="general-model-provider" checked={provider === p.code} disabled={busy} onChange={() => pickProvider(p.code)} />
              {p.label} <span className="text-xs text-slate-500">{state ? (state.isEnabled ? '· đang bật' : state.hasApiKey ? '· đang tắt' : '· chưa có key') : ''}</span>
            </label>
          })}
        </div>
        {configured && !configured.isEnabled && (
          <p className="mt-1 text-xs text-amber-700">{info.label} chưa bật: mô hình đăng ký được, nhưng ca chẩn đoán sẽ lỗi cho đến khi bật ở trang <Link className="underline" to={`/admin/ai/provider?provider=${provider}`}>Nhà cung cấp AI</Link>.</p>
        )}
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block font-semibold">Tên mô hình
          <input className={field} value={name} maxLength={200} disabled={busy} onChange={e => setName(e.target.value)} aria-invalid={touched && !!errors.name} />
          {touched && errors.name && <span className="text-xs font-normal text-rose-600">{errors.name}</span>}
        </label>
        <label className="block font-semibold">Phiên bản = mã model {info.model}
          <input className={`${field} font-mono`} value={version} maxLength={100} disabled={busy} onChange={e => setVersion(e.target.value)} aria-invalid={touched && !!errors.version} />
          {touched && errors.version
            ? <span className="text-xs font-normal text-rose-600">{errors.version}</span>
            : mismatch
              ? <span className="text-xs font-normal text-amber-700">Khác model đang cấu hình ({configured.modelId}): ca chẩn đoán sẽ lỗi cho đến khi hai mã trùng nhau.</span>
              : <span className="text-xs font-normal text-slate-500">Lấy từ trang <Link className="underline" to={`/admin/ai/provider?provider=${provider}`}>Nhà cung cấp AI</Link>.</span>}
        </label>
      </div>
      <fieldset>
        <legend className="font-semibold">Cây trồng được chẩn đoán</legend>
        <p className="text-xs text-slate-500">Mọi bệnh đang hoạt động của cây được chọn trở thành nhãn của mô hình. Lớp "Lá khỏe" luôn có.</p>
        <ul className="mt-2 space-y-2">
          {cropCodes.map(crop => {
            const rows = byCrop.get(crop) ?? []
            return <li key={crop} className="rounded-lg border border-slate-200 p-3">
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={crops.has(crop) && rows.length > 0} disabled={busy || rows.length === 0} onChange={e => toggle(crop, e.target.checked)} />
                {cropLabel(crop)} <span className="font-normal text-slate-500">· {rows.length ? `${rows.length} bệnh` : 'chưa có bệnh'}</span>
              </label>
              {rows.length > 0 && <p className="mt-1 pl-6 text-xs text-slate-600">{rows.map(d => diseaseLabel(d.code, d.name)).join(', ')}</p>}
            </li>
          })}
        </ul>
        {touched && (errors.crops || errors.healthy) && <p className="mt-2 text-xs text-rose-600">{errors.crops || errors.healthy}</p>}
      </fieldset>
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700" data-testid="general-labels">
        <strong>{labels.length} nhãn:</strong> <span className="font-mono break-all">{labels.join(', ') || '—'}</span>
      </p>
      <p className="text-xs text-slate-500">Một bệnh thêm sau khi đăng ký chỉ được chẩn đoán qua ảnh khi đăng ký một mô hình mới có mã của bệnh đó. Sau khi đăng ký: thêm chính sách ngưỡng tin cậy rồi kích hoạt (mô hình đang hoạt động sẽ tự ngừng).</p>
      <button type="button" onClick={submit} disabled={busy} className="bg-primary-dark text-white px-4 py-2 rounded-lg">{busy ? 'Đang lưu...' : `Đăng ký mô hình ${info.model}`}</button>
    </div>
  )
}
