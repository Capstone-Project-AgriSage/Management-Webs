import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { replenishmentApi, type ExpiryRiskItem, type VelocityItem } from '@/api/replenishmentApi'
import { catalogApi } from '@/api/catalogApi'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import KpiCard from '@/components/ui/KpiCard'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { useReportData } from '@/features/agent/reports/useReportData'
import { formatDate, formatQtyUnit } from '@/utils/units'
import { formatVnd } from '@/utils/money'

const velocityLabels: Record<string, string> = { FAST: 'Tồn đủ bán ít ngày', STABLE: 'Đang bán', SLOW: 'Chậm / tồn dài ngày', NO_SALES: 'Không có bán ròng' }
const riskLabels: Record<string, string> = { EXPIRED: 'Đã hết hạn', HELD_STOCK: 'Lô đang giữ / khóa', INSUFFICIENT_HISTORY: 'Chưa đủ lịch sử', ESTIMATED: 'Ước tính theo FEFO' }
export default function InventoryPlanningReportsPage() {
  usePageHeader({ title: 'Phân tích tồn kho', subtitle: 'Tốc độ bán và lượng có nguy cơ không bán hết trước hạn' })
  const [tab, setTab] = useState<'velocity' | 'expiry'>('velocity')
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search)
  const [category, setCategory] = useState('')
  const [history, setHistory] = useState('90')
  const [within, setWithin] = useState('30')
  const [velocity, setVelocity] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<VelocityItem | ExpiryRiskItem | null>(null)
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([])
  useEffect(() => { let active = true; catalogApi.getCategories().then(rows => {
    const flatten = (items: typeof rows): { value: string; label: string }[] => items.flatMap(c => [{ value: c.id, label: c.name }, ...flatten(c.children ?? [])])
    if (active) setCategories(flatten(rows))
  }).catch(() => {}); return () => { active = false } }, [])
  const load = useCallback(async (signal: AbortSignal) => {
    const query = { search: term || undefined, categoryId: category || undefined, historyDays: Number(history), page, pageSize: 10 }
    return tab === 'velocity' ? { type: 'velocity' as const, result: await replenishmentApi.velocity({ ...query, velocity: velocity || undefined }, signal) }
      : { type: 'expiry' as const, result: await replenishmentApi.expiryRisk({ ...query, withinDays: Number(within) }, signal) }
  }, [tab, term, category, history, within, velocity, page])
  const { data, loading, error, refresh } = useReportData(load)
  useRealtimeRefresh(['inventory'], refresh)
  const filter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1) }
  const metrics = data?.type === 'velocity' ? [
    ['Sản phẩm', data.result.summary.products], ['Tồn đủ bán ít ngày', data.result.summary.fast], ['Bán chậm / tồn dài', data.result.summary.slow], ['Không bán ròng', data.result.summary.noSales],
  ] : data?.type === 'expiry' ? [['Lô theo bộ lọc', data.result.summary.lots], ['Lô có rủi ro xác định', data.result.summary.knownRiskLots], ['Chưa xác định rủi ro', data.result.summary.unknownRiskLots], ['Giá trị rủi ro đã tính', formatVnd(data.result.summary.knownRiskValue)]] : [['Kết quả', '—'], ['Theo dõi', '—'], ['Cần xem xét', '—'], ['Chưa xác định', '—']]
  return <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
    <section className="agrisage-summary-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Tổng hợp phân tích kho">{metrics.map(([title, value]) => <KpiCard key={title} title={String(title)} value={value} subtitle="Toàn bộ kết quả theo bộ lọc" />)}</section>
    <div className="flex flex-wrap justify-between gap-3"><div role="tablist" className="inline-flex border rounded-lg bg-white p-1">{([['velocity', 'Tốc độ bán'], ['expiry', 'Rủi ro hạn dùng']] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={`px-4 py-2 rounded-md text-sm ${tab === value ? 'bg-emerald-600 text-white' : 'text-slate-600'}`} onClick={() => { setTab(value); setPage(1); setSelected(null) }}>{label}</button>)}</div><Link className="text-sm text-emerald-700" to="/agent/inventory/reports">Báo cáo nhập–xuất–tồn / Excel</Link></div>
    <ListToolbar search={{ value: search, onChange: filter(setSearch), placeholder: 'Tìm SKU hoặc tên sản phẩm...' }} onClear={() => { setSearch(''); setCategory(''); setHistory('90'); setWithin('30'); setVelocity(''); setPage(1) }}>
      <FilterSelect label="Nhóm hàng" value={category} onChange={filter(setCategory)} options={[{ value: '', label: 'Tất cả nhóm hàng' }, ...categories]} />
      <FilterSelect label="Lịch sử bán" value={history} onChange={filter(setHistory)} options={['30', '90', '180', '365'].map(value => ({ value, label: `${value} ngày` }))} />
      {tab === 'velocity' ? <FilterSelect label="Tốc độ bán" value={velocity} onChange={filter(setVelocity)} options={[{ value: '', label: 'Tất cả' }, ...Object.entries(velocityLabels).map(([value, label]) => ({ value, label }))]} />
        : <FilterSelect label="Khoảng hạn dùng" value={within} onChange={filter(setWithin)} options={['7', '30', '60', '90', '180', '365'].map(value => ({ value, label: `Hết hạn / đến ${value} ngày tới` }))} />}
    </ListToolbar>
    <p className="text-xs text-slate-500">{tab === 'velocity' ? 'Phân nhóm vận hành: tồn đủ bán tối đa 7 ngày; chậm khi trên 90 ngày tồn hoặc 30 ngày không bán. Đây không phải hệ số vòng quay tài chính.' : 'Ước tính theo lịch sử bán và FEFO, chưa xét hệ số mùa vụ. Hàng chưa hết hạn chỉ dự báo phần chưa giữ cho đơn; thiếu lịch sử hiển thị chưa xác định.'}</p>
    {error && <p role="alert" className="text-rose-700">{error} <button className="underline" onClick={refresh}>Thử lại</button></p>}
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="bg-surface-container-low text-xs uppercase text-on-surface-variant"><tr>{(tab === 'velocity' ? ['Sản phẩm', 'Lượng bán ròng', 'Có thể bán', 'Bình quân / ngày', 'Ngày đủ bán', 'Phân nhóm', 'Thao tác'] : ['Sản phẩm / Lô', 'Hạn dùng', 'Thực tế / Đã giữ', 'Lượng rủi ro', 'Giá trị rủi ro', 'Cơ sở', 'Thao tác']).map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-outline-variant/50">{loading ? <EmptyTableRow colSpan={7} message="Đang phân tích tồn kho..." /> : !data?.result.items.length ? <EmptyTableRow colSpan={7} message={error ? 'Chưa tải được dữ liệu.' : 'Không có kết quả phù hợp.'} /> : data.type === 'velocity' ? data.result.items.map(r => <tr key={r.storeProductId} className="hover:bg-surface-container-low">
        <td className="px-4 py-3"><strong>{r.productName}</strong><p className="text-xs text-slate-500">{r.sku}</p></td><td className="px-4 py-3">{formatQtyUnit(r.soldBaseQuantity, r.baseUnit)}</td><td className="px-4 py-3">{formatQtyUnit(r.sellableBaseQuantity, r.baseUnit)}</td><td className="px-4 py-3">{r.averageDailySales === null ? 'Chưa xác định' : formatQtyUnit(r.averageDailySales, r.baseUnit)}</td><td className="px-4 py-3">{r.daysOfStock ?? 'Chưa xác định'}</td><td className="px-4 py-3">{velocityLabels[r.velocity]}</td><td className="px-4 py-3 text-right"><RowActionsMenu triggerLabel={`Thao tác phân tích ${r.productName}`} actions={[{ label: 'Xem chi tiết', icon: 'visibility', onClick: () => setSelected(r) }]} /></td>
      </tr>) : data.result.items.map(r => <tr key={r.inventoryLotId} className="hover:bg-surface-container-low">
        <td className="px-4 py-3"><strong>{r.productName}</strong><p className="text-xs text-slate-500">{r.sku} · {r.lotNumber ?? 'Không số lô'}</p></td><td className="px-4 py-3">{formatDate(r.expiryDate)}</td><td className="px-4 py-3">{r.onHandBaseQuantity} / {r.reservedBaseQuantity}</td><td className="px-4 py-3">{r.atRiskBaseQuantity === null ? 'Chưa xác định' : formatQtyUnit(r.atRiskBaseQuantity, r.baseUnit)}</td><td className="px-4 py-3">{r.atRiskValue === null ? 'Chưa xác định' : formatVnd(r.atRiskValue)}</td><td className="px-4 py-3">{riskLabels[r.dataStatus] ?? r.dataStatus}</td><td className="px-4 py-3 text-right"><RowActionsMenu triggerLabel={`Thao tác lô ${r.lotNumber ?? r.productName}`} actions={[{ label: 'Xem chi tiết', icon: 'visibility', onClick: () => setSelected(r) }]} /></td>
      </tr>)}</tbody>
    </table></div><ServerPagination page={page} pageSize={10} totalCount={data?.result.totalCount ?? 0} totalPages={data?.result.totalPages ?? 0} unitLabel={tab === 'velocity' ? 'sản phẩm' : 'lô'} onPageChange={setPage} /></div>
    {selected && <DetailModal open onClose={() => setSelected(null)}><ModalLayout header={<h3 className="text-lg font-semibold">{selected.productName}</h3>}>
      <p className="text-sm">{selected.sku}</p>{'inventoryLotId' in selected ? <><p>Lô {selected.lotNumber ?? 'không số'} · {formatDate(selected.expiryDate)} · {selected.lotStatus}</p><p>{riskLabels[selected.dataStatus]}</p><p>Rủi ro: {selected.atRiskBaseQuantity === null ? 'Chưa đủ cơ sở tính' : formatQtyUnit(selected.atRiskBaseQuantity, selected.baseUnit)}</p><p className="text-sm text-slate-500">Lô đã hết hạn tính toàn bộ lượng còn tồn. Lô chưa hết hạn chỉ dự báo lượng chưa giữ cho đơn. Việc xuất hủy cần thao tác điều chỉnh kho hiện có.</p></> : <><p>Lần xuất bán gần nhất trong kỳ: {selected.lastSaleDate ? formatDate(selected.lastSaleDate) : 'Không có'}</p><p>{selected.dataStatus === 'INSUFFICIENT_HISTORY' ? 'Chưa đủ dữ liệu dự báo.' : 'Bình quân từ lượng xuất bán ròng trong kỳ theo dõi.'}</p></>}
      <Link className="text-sm text-emerald-700" to={`/agent/inventory/stock-card?storeProductId=${selected.storeProductId}`}>Xem thẻ kho sản phẩm</Link>
    </ModalLayout></DetailModal>}
  </div>
}
