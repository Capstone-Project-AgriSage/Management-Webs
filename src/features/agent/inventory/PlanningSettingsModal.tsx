import { useEffect, useState } from 'react'
import { ApiError, describeError } from '@/api/client'
import { replenishmentApi, type StorePlanningProduct } from '@/api/replenishmentApi'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import { useToast } from '@/context/ToastContext'

const input = 'w-full h-10 rounded-lg border border-slate-200 px-3 text-sm focus:ring-1 focus:ring-emerald-500'
export default function PlanningSettingsModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast()
  const [product, setProduct] = useState<StorePlanningProduct | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [values, setValues] = useState({ minimum: '', target: '', lead: '7', safety: '0', coverage: '14', enabled: true })
  useEffect(() => {
    const controller = new AbortController()
    replenishmentApi.product(id, controller.signal).then(p => {
      if (controller.signal.aborted) return
      setProduct(p)
      setValues({ minimum: p.minStockLevelBase?.toString() ?? '', target: p.replenishment.targetStockLevelBase?.toString() ?? '',
        lead: String(p.replenishment.leadTimeDays), safety: String(p.replenishment.safetyStockBase),
        coverage: String(p.replenishment.targetCoverageDays), enabled: p.replenishment.enabled })
    }).catch(err => { if (!controller.signal.aborted) setError(describeError(err, 'Không tải được cấu hình.')) })
    return () => controller.abort()
  }, [id])
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!product || busy) return
    const integer = (value: string) => value.trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0
    if (![values.lead, values.safety, values.coverage].every(integer)
      || (values.minimum !== '' && !integer(values.minimum)) || (values.target !== '' && !integer(values.target))) {
      setError('Số lượng và số ngày phải là số nguyên không âm hợp lệ.'); return
    }
    setBusy(true); setError(null)
    try {
      await replenishmentApi.configure(id, { storeSku: product.storeSku,
        minStockLevelBase: values.minimum === '' ? null : Number(values.minimum),
        replenishment: { enabled: values.enabled, targetStockLevelBase: values.target === '' ? null : Number(values.target),
          leadTimeDays: Number(values.lead), safetyStockBase: Number(values.safety), targetCoverageDays: Number(values.coverage) } })
      showToast('Đã lưu cấu hình nhập hàng.', 'success'); onSaved()
    } catch (err) { setError(err instanceof ApiError ? describeError(err, 'Không lưu được cấu hình.') : 'Không lưu được cấu hình.') }
    finally { setBusy(false) }
  }
  return <DetailModal open onClose={onClose} busy={busy}><ModalLayout header={<h3 className="text-lg font-semibold">Cấu hình nhập hàng{product ? ` · ${product.name}` : ''}</h3>}>
    {!product ? <p role={error ? 'alert' : 'status'}>{error ?? 'Đang tải cấu hình...'}</p> : <form onSubmit={save} className="space-y-4">
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <p className="text-sm text-slate-500">Số lượng theo đơn vị cơ sở. Để trống mục tiêu để tính theo tốc độ bán; khi chưa đủ lịch sử sẽ dùng ngưỡng tối thiểu.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{([
        ['minimum', 'Tồn tối thiểu', 0, undefined], ['target', 'Mục tiêu cố định', 0, undefined],
        ['lead', 'Thời gian chờ nhập (ngày)', 0, 365], ['safety', 'Tồn an toàn', 0, undefined], ['coverage', 'Dự trữ thêm (ngày)', 1, 90],
      ] as const).map(([key, label, min, max]) => <label key={key} className="space-y-1 text-sm font-medium block">{label}
        <input className={input} type="number" min={min} max={max} step="1" value={values[key]} required={key !== 'minimum' && key !== 'target'}
          onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} /></label>)}</div>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={values.enabled} onChange={e => setValues(v => ({ ...v, enabled: e.target.checked }))} />Đưa vào kế hoạch nhập hàng</label>
      <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="px-4 py-2 border rounded-lg">Hủy</button>
        <button disabled={busy} className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">{busy ? 'Đang lưu...' : 'Lưu cấu hình'}</button></div>
    </form>}
  </ModalLayout></DetailModal>
}
