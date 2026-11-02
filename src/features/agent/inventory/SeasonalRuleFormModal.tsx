import { useState } from 'react'
import { replenishmentApi, type SeasonalRule } from '@/api/replenishmentApi'
import { describeError } from '@/api/client'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import ProductPicker, { type PickedProduct } from './ProductPicker'
import { todayInput } from '@/utils/units'

const input = 'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-1 focus:ring-emerald-500'
interface Line { product: PickedProduct; target: string }
export default function SeasonalRuleFormModal({ rule, onClose, onSaved }: { rule: SeasonalRule | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(rule?.name ?? '')
  const [crop, setCrop] = useState(rule?.cropType ?? 'RICE')
  const [region, setRegion] = useState(rule?.region ?? '')
  const [starts, setStarts] = useState(rule?.startsOn ?? todayInput())
  const [ends, setEnds] = useState(rule?.endsOn ?? todayInput())
  const [prepare, setPrepare] = useState(String(rule?.prepareDays ?? 14))
  const [factor, setFactor] = useState(String(rule?.demandFactor ?? 1))
  const [active, setActive] = useState(rule?.isActive ?? true)
  const [lines, setLines] = useState<Line[]>(rule?.items.map(i => ({ product: { storeProductId: i.storeProductId, sku: i.sku, productName: i.productName, baseUnit: '' }, target: i.targetStockLevelBase?.toString() ?? '' })) ?? [])
  const [picked, setPicked] = useState<PickedProduct | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!name.trim() || !crop.trim() || !starts || !ends || ends < starts) { setError('Nhập tên, cây trồng và khoảng ngày hợp lệ.'); return }
    if (!Number.isInteger(Number(prepare)) || Number(prepare) < 0 || Number(prepare) > 90
      || !Number.isFinite(Number(factor)) || Number(factor) < 0.1 || Number(factor) > 5) { setError('Chuẩn bị từ 0–90 ngày; hệ số nhu cầu từ 0,1–5.'); return }
    if (lines.length === 0 || lines.some(l => l.target !== '' && (!Number.isSafeInteger(Number(l.target)) || Number(l.target) < 0))) {
      setError('Thêm ít nhất một sản phẩm; mục tiêu phải là số nguyên không âm hoặc để trống.'); return
    }
    setBusy(true); setError(null)
    try {
      await replenishmentApi.saveRule(rule?.id ?? null, { name: name.trim(), cropType: crop.trim(), region: region.trim() || null,
        startsOn: starts, endsOn: ends, prepareDays: Number(prepare), demandFactor: Number(factor), isActive: active,
        version: rule?.version, items: lines.map(l => ({ storeProductId: l.product.storeProductId, targetStockLevelBase: l.target === '' ? null : Number(l.target) })) })
      onSaved()
    } catch (err) { setError(describeError(err, 'Không lưu được quy tắc. Nếu dữ liệu đã thay đổi, đóng và mở lại để tải bản mới.')) }
    finally { setBusy(false) }
  }
  return <DetailModal open onClose={onClose} busy={busy} widthClassName="max-w-3xl"><ModalLayout header={<h3 className="text-lg font-semibold">{rule ? 'Sửa' : 'Thêm'} quy tắc mùa vụ</h3>}>
    <form onSubmit={save} className="space-y-4">
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <p className="text-sm text-slate-500">Lịch chuẩn bị nhập hàng theo từng vụ/năm. Không thay đổi lịch thu nợ theo vụ.</p>
      <label className="block text-sm font-medium space-y-1">Tên quy tắc<input className={input} maxLength={150} required value={name} onChange={e => setName(e.target.value)} /></label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm font-medium space-y-1">Cây trồng<input className={input} maxLength={50} required value={crop} onChange={e => setCrop(e.target.value)} /></label>
        <label className="text-sm font-medium space-y-1">Khu vực phục vụ<input className={input} maxLength={150} value={region} onChange={e => setRegion(e.target.value)} /></label>
        <label className="text-sm font-medium space-y-1">Bắt đầu nhu cầu<input className={input} type="date" required value={starts} onChange={e => setStarts(e.target.value)} /></label>
        <label className="text-sm font-medium space-y-1">Kết thúc nhu cầu<input className={input} type="date" required min={starts} value={ends} onChange={e => setEnds(e.target.value)} /></label>
        <label className="text-sm font-medium space-y-1">Chuẩn bị trước (ngày)<input className={input} type="number" min={0} max={90} step={1} required value={prepare} onChange={e => setPrepare(e.target.value)} /></label>
        <label className="text-sm font-medium space-y-1">Hệ số nhu cầu<input className={input} type="number" min={0.1} max={5} step={0.001} required value={factor} onChange={e => setFactor(e.target.value)} /></label>
      </div>
      <p className="text-xs text-slate-500">Hệ số 1 giữ nguyên nhu cầu. Khi nhiều quy tắc trùng sản phẩm, lấy hệ số/mục tiêu cao nhất, không cộng dồn.</p>
      <div className="flex gap-2 items-start"><div className="flex-1"><ProductPicker value={picked} onChange={setPicked} /></div><button type="button" disabled={!picked || lines.length >= 100} className="h-10 px-3 rounded-lg border text-sm disabled:opacity-50" onClick={() => {
        if (!picked) return
        if (lines.some(l => l.product.storeProductId === picked.storeProductId)) { setError('Sản phẩm đã có trong quy tắc.'); return }
        setLines(current => [...current, { product: picked, target: '' }]); setPicked(null); setError(null)
      }}>Thêm sản phẩm</button></div>
      <div className="space-y-2">{lines.map((line, index) => <div key={line.product.storeProductId} className="grid grid-cols-[1fr_130px_40px] gap-2 items-center border rounded-lg p-3">
        <div className="text-sm"><strong>{line.product.productName}</strong><p className="text-xs text-slate-500">{line.product.sku}</p></div>
        <label className="text-xs text-slate-500">Mục tiêu cơ sở<input aria-label={`Mục tiêu ${line.product.productName}`} className={input} type="number" min={0} step={1} placeholder="Tự tính" value={line.target} onChange={e => setLines(current => current.map((l, i) => i === index ? { ...l, target: e.target.value } : l))} /></label>
        <button type="button" aria-label={`Bỏ ${line.product.productName}`} className="text-rose-700" onClick={() => setLines(current => current.filter((_, i) => i !== index))}>Bỏ</button>
      </div>)}</div>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Đang áp dụng</label>
      <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="px-4 py-2 border rounded-lg">Hủy</button><button disabled={busy} className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">{busy ? 'Đang lưu...' : 'Lưu quy tắc'}</button></div>
    </form>
  </ModalLayout></DetailModal>
}
