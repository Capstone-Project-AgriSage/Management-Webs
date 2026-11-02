import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { replenishmentApi, type PlanningView, type ReplenishmentItem } from '@/api/replenishmentApi'
import { catalogApi } from '@/api/catalogApi'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import KpiCard from '@/components/ui/KpiCard'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import { usePermission } from '@/context/PermissionContext'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { useReportData } from '@/features/agent/reports/useReportData'
import { formatDate, formatQtyUnit, unitLabel } from '@/utils/units'
import PlanningSettingsModal from './PlanningSettingsModal'

const views: { value: PlanningView; label: string }[] = [
  { value: 'suggestions', label: 'Đề xuất nhập' }, { value: 'stockout', label: 'Dự kiến hết hàng' },
  { value: 'forecast', label: 'Dự báo bán' }, { value: 'seasonal', label: 'Theo mùa vụ' },
]
const reasonLabels: Record<string, string> = { OUT_OF_STOCK: 'Hết hàng để bán', LOW_STOCK: 'Dưới ngưỡng tối thiểu',
  LEAD_TIME_RISK: 'Nguy cơ thiếu khi chờ nhập', SEASONAL: 'Chuẩn bị mùa vụ', NEEDS_CONFIGURATION: 'Cần cấu hình' }
const dataLabels: Record<string, string> = { SUFFICIENT: 'Đủ dữ liệu', INSUFFICIENT_HISTORY: 'Chưa đủ lịch sử', NO_DEMAND: 'Nhu cầu ròng bằng 0' }
const priorityLabels = { HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' }
const priorityClass = { HIGH: 'bg-rose-100 text-rose-700', MEDIUM: 'bg-amber-100 text-amber-800', LOW: 'bg-slate-100 text-slate-600' }

export default function ReplenishmentPage() {
  usePageHeader({ title: 'Kế hoạch nhập hàng', subtitle: 'Đề xuất từ tồn có thể bán, lịch sử bán và lịch mùa vụ đã cấu hình' })
  const { has } = usePermission()
  const [params, setParams] = useSearchParams()
  const view = views.some(v => v.value === params.get('tab')) ? params.get('tab') as PlanningView : 'suggestions'
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search)
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('')
  const [reason, setReason] = useState('')
  const [dataStatus, setDataStatus] = useState('')
  const [history, setHistory] = useState('90')
  const [horizon, setHorizon] = useState('30')
  const [sortBy, setSortBy] = useState('priority')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ReplenishmentItem | null>(null)
  const [settings, setSettings] = useState<string | null>(null)
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([])
  useEffect(() => {
    let active = true
    catalogApi.getCategories().then(rows => {
      const flatten = (items: typeof rows): { value: string; label: string }[] => items.flatMap(c => [{ value: c.id, label: c.name }, ...flatten(c.children ?? [])])
      if (active) setCategories(flatten(rows))
    }).catch(() => {})
    return () => { active = false }
  }, [])
  const load = useCallback(async (signal: AbortSignal) => {
    const result = await replenishmentApi.list(view, {
    search: term.trim() || undefined, categoryId: category || undefined, priority: priority || undefined,
    reason: reason || undefined, dataStatus: dataStatus || undefined, historyDays: Number(history),
    horizonDays: Number(horizon), page, pageSize: 10, sortBy,
    }, signal)
    const lastPage = Math.max(1, result.totalPages)
    // A configuration or realtime change may remove the last row of the current page.
    if (!signal.aborted && page > lastPage) setPage(lastPage)
    return result
  }, [view, term, category, priority, reason, dataStatus, history, horizon, page, sortBy])
  const { data, loading, error, refresh } = useReportData(load)
  useRealtimeRefresh(['inventory', 'orders'], refresh)
  const filter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); setSelected(null) }
  const qty = (value: number | null, unit: string) => value === null ? 'Chưa xác định' : formatQtyUnit(value, unit)
  const cards = data?.summary
  return <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
    <section className="agrisage-summary-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Tổng hợp kế hoạch theo bộ lọc">
      <KpiCard title="Sản phẩm theo bộ lọc" value={cards?.totalProducts ?? '—'} subtitle="Toàn bộ kết quả, không chỉ trang hiện tại" />
      <KpiCard title="Hết hàng để bán" value={cards?.outOfStock ?? '—'} subtitle="Không còn lượng hợp lệ chưa giữ cho đơn" />
      <KpiCard title="Ưu tiên cao" value={cards?.highPriority ?? '—'} subtitle="Cần xem xét đặt nhập sớm" />
      <KpiCard title="Chưa đủ lịch sử" value={cards?.insufficientHistory ?? '—'} subtitle="Có thể dùng mức tồn cấu hình" />
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" className="flex flex-wrap rounded-lg border border-slate-200 bg-white p-1">
        {views.map(v => <button key={v.value} role="tab" aria-selected={view === v.value} onClick={() => { setParams({ tab: v.value }); setPage(1); setSelected(null) }}
          className={`px-4 py-2 rounded-md text-sm font-medium ${view === v.value ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{v.label}</button>)}
      </div>
      <div className="flex gap-3 text-sm font-medium text-emerald-700">
        {has('SEASONAL_RULES.READ') && <Link to="/agent/inventory/seasonal-rules">Quy tắc mùa vụ</Link>}
        <button onClick={refresh}>Tải lại</button>
      </div>
    </div>
    <ListToolbar search={{ value: search, onChange: filter(setSearch), placeholder: 'Tìm theo SKU hoặc tên sản phẩm...' }}
      onClear={() => { setSearch(''); setCategory(''); setPriority(''); setReason(''); setDataStatus(''); setHistory('90'); setHorizon('30'); setSortBy('priority'); setPage(1) }}>
      <FilterSelect label="Nhóm hàng" value={category} onChange={filter(setCategory)} options={[{ value: '', label: 'Tất cả nhóm hàng' }, ...categories]} />
      <FilterSelect label="Ưu tiên" value={priority} onChange={filter(setPriority)} options={[{ value: '', label: 'Tất cả mức ưu tiên' }, ...Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))]} />
      <FilterSelect label="Lý do" value={reason} onChange={filter(setReason)} options={[{ value: '', label: 'Tất cả lý do' }, ...Object.entries(reasonLabels).map(([value, label]) => ({ value, label }))]} />
      <FilterSelect label="Dữ liệu" value={dataStatus} onChange={filter(setDataStatus)} options={[{ value: '', label: 'Tất cả tình trạng dữ liệu' }, ...Object.entries(dataLabels).map(([value, label]) => ({ value, label }))]} />
      <FilterSelect label="Lịch sử bán" value={history} onChange={filter(setHistory)} options={['30', '90', '180', '365'].map(value => ({ value, label: `${value} ngày đã hoàn tất` }))} />
      <FilterSelect label="Kỳ dự báo" value={horizon} onChange={filter(setHorizon)} options={['7', '14', '30', '60', '90'].map(value => ({ value, label: `${value} ngày tới` }))} />
      <FilterSelect label="Sắp xếp" value={sortBy} onChange={filter(setSortBy)} options={[{ value: 'priority', label: 'Ưu tiên cao trước' }, { value: 'name', label: 'Tên sản phẩm' }, { value: 'stockout', label: 'Ngày tồn còn lại tăng dần' }, { value: 'quantity', label: 'Lượng nhập tăng dần' }]} />
    </ListToolbar>
    {error && <div role="alert" className="p-4 rounded-lg bg-rose-50 text-rose-700">{error} <button onClick={refresh} className="underline">Thử lại</button></div>}
    <p className="text-xs text-slate-500">{data ? `Dữ liệu bán: ${formatDate(data.fromDate)} – ${formatDate(data.toDate)}. Tính lúc ${new Date(data.generatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.` : 'Đang chuẩn bị số liệu.'} Đề xuất cần người phụ trách xem xét, không tự thay đổi tồn kho.</p>
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase border-b border-outline-variant"><tr>
        {['Sản phẩm', 'Còn bán được', view === 'forecast' ? 'Nhu cầu dự báo' : 'Đề nghị nhập', 'Đủ bán / Chờ nhập', 'Dự kiến hết hàng', 'Lý do / Dữ liệu', 'Ưu tiên', 'Thao tác'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
      </tr></thead><tbody className="divide-y divide-outline-variant/50">
        {loading ? <EmptyTableRow colSpan={8} message="Đang tính kế hoạch nhập hàng..." /> : !data?.items.length ? <EmptyTableRow colSpan={8} message={error ? 'Chưa tải được dữ liệu.' : 'Không có sản phẩm phù hợp với bộ lọc.'} /> : data.items.map(row => <tr key={row.storeProductId} className="hover:bg-surface-container-low">
          <td className="px-4 py-3"><div className="font-medium">{row.productName}</div><span className="text-xs text-slate-500 font-mono">{row.sku}</span></td>
          <td className="px-4 py-3 whitespace-nowrap">{qty(row.sellableBaseQuantity, row.baseUnit)}</td>
          <td className="px-4 py-3"><div>{qty(view === 'forecast' ? row.expectedDemandBaseQuantity : row.suggestedBaseQuantity, row.baseUnit)}</div>{view !== 'forecast' && row.suggestedPurchaseQuantity !== null && <div className="text-xs text-slate-500">{row.suggestedPurchaseQuantity} {row.purchaseUnit}</div>}</td>
          <td className="px-4 py-3">{row.daysOfStock === null ? 'Chưa xác định' : `${row.daysOfStock} ngày`}<div className="text-xs text-slate-500">Chờ nhập {row.leadTimeDays} ngày</div></td>
          <td className="px-4 py-3 whitespace-nowrap">{row.estimatedStockoutDate ? formatDate(row.estimatedStockoutDate) : 'Chưa xác định'}</td>
          <td className="px-4 py-3"><div>{row.reasonCodes.map(r => reasonLabels[r] ?? r).join(' · ') || 'Theo dõi'}</div><span className="text-xs text-slate-500">{dataLabels[row.dataStatus] ?? row.dataStatus}</span></td>
          <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-semibold ${priorityClass[row.priority]}`}>{priorityLabels[row.priority]}</span></td>
          <td className="px-4 py-3 text-right whitespace-nowrap"><RowActionsMenu triggerLabel={`Thao tác kế hoạch ${row.productName}`} actions={[
            { label: 'Xem chi tiết', icon: 'visibility', onClick: () => setSelected(row) },
            { label: 'Cấu hình nhập hàng', icon: 'settings', permissionCodes: ['STORE_PRODUCTS.UPDATE'], onClick: () => setSettings(row.storeProductId) },
          ]} /></td>
        </tr>)}
      </tbody></table></div>
      <ServerPagination page={page} pageSize={10} totalCount={data?.totalCount ?? 0} totalPages={data?.totalPages ?? 0} unitLabel="sản phẩm" onPageChange={setPage} />
    </div>
    {selected && <DetailModal open onClose={() => setSelected(null)} widthClassName="max-w-4xl"><ModalLayout header={<h3 className="text-lg font-semibold">Cơ sở đề xuất · {selected.productName}</h3>}>
      <p>{selected.explanation}</p>
      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <p>Thực tế: <strong>{qty(selected.onHandBaseQuantity, selected.baseUnit)}</strong></p><p>Đã giữ: <strong>{qty(selected.reservedBaseQuantity, selected.baseUnit)}</strong></p><p>Có thể bán: <strong>{qty(selected.sellableBaseQuantity, selected.baseUnit)}</strong></p>
        <p>Bình quân/ngày: <strong>{qty(selected.averageDailySales, selected.baseUnit)}</strong></p><p>Lượng bán ròng: <strong>{qty(selected.soldBaseQuantity, selected.baseUnit)}</strong></p><p>Theo dõi: <strong>{selected.observedDays} ngày, {selected.saleDays} ngày bán</strong></p>
        <p>Mục tiêu: <strong>{qty(selected.targetBaseQuantity, selected.baseUnit)}</strong></p><p>Ngày nên đặt: <strong>{selected.suggestedOrderDate ? formatDate(selected.suggestedOrderDate) : 'Chưa xác định'}</strong></p>
      </div>
      {selected.seasons.map(s => <div key={s.id} className="p-3 rounded-lg bg-emerald-50 text-sm"><strong>{s.name}</strong> · {s.cropType}{s.region ? ` · ${s.region}` : ''}<p>{formatDate(s.startsOn)} – {formatDate(s.endsOn)} · hệ số {s.demandFactor}</p></div>)}
      <ul className="list-disc pl-5 text-sm text-amber-800 space-y-1">{selected.warnings.map(w => <li key={w}>{w}</li>)}</ul>
      {selected.forecast.length > 0 && <div><h4 className="font-medium mb-3">Nhu cầu dự báo mỗi ngày ({unitLabel(selected.baseUnit)})</h4><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={selected.forecast}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={v => String(v).slice(5)} /><YAxis /><Tooltip /><Line type="stepAfter" dataKey="expectedBaseQuantity" name="Nhu cầu" stroke="#059669" dot={false} /></LineChart></ResponsiveContainer></div></div>}
    </ModalLayout></DetailModal>}
    {settings && <PlanningSettingsModal id={settings} onClose={() => setSettings(null)} onSaved={() => { setSettings(null); setSelected(null); refresh() }} />}
  </div>
}
