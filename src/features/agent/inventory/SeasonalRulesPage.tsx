import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { useCallback, useRef, useState } from 'react'
import { replenishmentApi, type SeasonalRule } from '@/api/replenishmentApi'
import { describeError } from '@/api/client'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import KpiCard from '@/components/ui/KpiCard'
import ConfirmModal from '@/components/ui/ConfirmModal'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { usePermission } from '@/context/PermissionContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useReportData } from '@/features/agent/reports/useReportData'
import { formatDate } from '@/utils/units'
import SeasonalRuleFormModal from './SeasonalRuleFormModal'

export default function SeasonalRulesPage() {
  usePageHeader({ title: 'Quy tắc nhập hàng theo mùa vụ', subtitle: 'Lịch chuẩn bị hàng và danh mục sản phẩm do đại lý cấu hình' })
  const { showToast } = useToast()
  const { has } = usePermission()
  const canManage = has('SEASONAL_RULES.MANAGE')
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search)
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<SeasonalRule | 'new' | null>(null)
  const [detail, setDetail] = useState<SeasonalRule | null>(null)
  const [deactivate, setDeactivate] = useState<SeasonalRule | null>(null)
  const [busy, setBusy] = useState(false)
  const detailRequest = useRef(0)
  const problem = from && to && to < from ? 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' : null
  const load = useCallback((signal: AbortSignal) => replenishmentApi.rules({ search: term || undefined,
    isActive: status === '' ? undefined : status === 'true', fromDate: from || undefined,
    toDate: to || undefined, page, pageSize: 10 }, signal), [term, status, from, to, page])
  const { data, loading, error, refresh } = useReportData(load, problem)
  const open = async (id: string, edit: boolean) => {
    const request = ++detailRequest.current
    setBusy(true)
    try { const rule = await replenishmentApi.rule(id); if (request === detailRequest.current) { if (edit) setEditing(rule); else setDetail(rule) } }
    catch (err) { if (request === detailRequest.current) showToast(describeError(err, 'Không tải được quy tắc.'), 'error') }
    finally { if (request === detailRequest.current) setBusy(false) }
  }
  const confirmDeactivate = async () => {
    if (!deactivate || busy) return
    setBusy(true)
    try { await replenishmentApi.deactivate(deactivate.id); setDeactivate(null); setPage(1); refresh(); showToast('Đã ngừng áp dụng quy tắc.', 'success') }
    catch (err) { showToast(describeError(err, 'Không ngừng áp dụng được quy tắc.'), 'error') }
    finally { setBusy(false) }
  }
  return <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
    <section className="agrisage-summary-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Tổng hợp quy tắc theo bộ lọc">
      <KpiCard title="Quy tắc" value={data?.summary.total ?? '—'} subtitle="Toàn bộ kết quả theo bộ lọc" />
      <KpiCard title="Đang bật" value={data?.summary.active ?? '—'} subtitle="Cho phép tính vào kế hoạch" />
      <KpiCard title="Sắp tới" value={data?.summary.upcoming ?? '—'} subtitle="Ngày bắt đầu ở tương lai" />
      <KpiCard title="Đã qua thời gian" value={data?.summary.ended ?? '—'} subtitle="Không còn tác động đến nhu cầu tới" />
    </section>
    <ListToolbar search={{ value: search, onChange: value => { setSearch(value); setPage(1) }, placeholder: 'Tìm tên quy tắc, cây trồng, khu vực...' }}
      onClear={() => { setSearch(''); setStatus(''); setFrom(''); setTo(''); setPage(1) }} actions={canManage ? <button disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm" onClick={() => setEditing('new')}>Thêm quy tắc</button> : undefined}>
      <FilterSelect label="Trạng thái" value={status} onChange={value => { setStatus(value); setPage(1) }} options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'true', label: 'Đang bật' }, { value: 'false', label: 'Ngừng áp dụng' }]} />
      <label className="text-sm">Từ ngày<input type="date" className="block border rounded-lg h-10 px-3" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} /></label>
      <label className="text-sm">Đến ngày<input type="date" className="block border rounded-lg h-10 px-3" value={to} onChange={e => { setTo(e.target.value); setPage(1) }} /></label>
    </ListToolbar>
    {(problem || error) && <p role="alert" className="text-rose-700">{problem || error} {!problem && <button className="underline" onClick={refresh}>Thử lại</button>}</p>}
    {busy && !deactivate && <p role="status" className="text-sm text-slate-500">Đang tải chi tiết...</p>}
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="bg-surface-container-low text-xs uppercase text-on-surface-variant"><tr>{['Quy tắc', 'Thời gian áp dụng', 'Chuẩn bị / Hệ số', 'Sản phẩm', 'Trạng thái', 'Thao tác'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-outline-variant/50">{loading ? <EmptyTableRow colSpan={6} message="Đang tải quy tắc..." /> : !data?.items.length ? <EmptyTableRow colSpan={6} message="Không có quy tắc phù hợp." /> : data.items.map(r => <tr key={r.id} className="hover:bg-surface-container-low">
        <td className="px-4 py-3"><strong>{r.name}</strong><p className="text-xs text-slate-500">{r.cropType}{r.region ? ` · ${r.region}` : ''}</p></td>
        <td className="px-4 py-3">{formatDate(r.startsOn)} – {formatDate(r.endsOn)}</td><td className="px-4 py-3">Trước {r.prepareDays} ngày · ×{r.demandFactor}</td><td className="px-4 py-3">{r.items.length}</td>
        <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs ${r.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{r.isActive ? 'Đang bật' : 'Ngừng áp dụng'}</span></td>
        <td className="px-4 py-3 text-right whitespace-nowrap"><RowActionsMenu disabled={busy} triggerLabel={`Thao tác quy tắc ${r.name}`} actions={[
          { label: 'Xem chi tiết', icon: 'visibility', onClick: () => { void open(r.id, false) } },
          { label: 'Sửa quy tắc', icon: 'edit', permissionCodes: ['SEASONAL_RULES.MANAGE'], onClick: () => { void open(r.id, true) } },
          ...(r.isActive ? [{ label: 'Ngừng áp dụng', icon: 'pause_circle', permissionCodes: ['SEASONAL_RULES.MANAGE'], onClick: () => setDeactivate(r) }] : []),
        ]} /></td>
      </tr>)}</tbody>
    </table></div><ServerPagination page={page} pageSize={10} totalCount={data?.totalCount ?? 0} totalPages={data?.totalPages ?? 0} unitLabel="quy tắc" onPageChange={setPage} /></div>
    {editing && <SeasonalRuleFormModal rule={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setPage(1); refresh(); showToast('Đã lưu quy tắc mùa vụ.', 'success') }} />}
    {detail && <DetailModal open onClose={() => setDetail(null)}><ModalLayout header={<h3 className="text-lg font-semibold">{detail.name}</h3>}>
      <p className="text-sm">{detail.cropType} · {detail.region ?? 'Khu vực phục vụ của đại lý'}</p><p>{formatDate(detail.startsOn)} – {formatDate(detail.endsOn)} · Chuẩn bị trước {detail.prepareDays} ngày · Hệ số {detail.demandFactor}</p>
      <ul className="divide-y">{detail.items.map(i => <li key={i.storeProductId} className="py-3 text-sm"><strong>{i.productName}</strong> · {i.sku}<p className="text-slate-500">Mục tiêu: {i.targetStockLevelBase === null ? 'Theo cấu hình sản phẩm / lịch sử bán' : `${i.targetStockLevelBase} đơn vị cơ sở`}</p></li>)}</ul>
    </ModalLayout></DetailModal>}
    <ConfirmModal open={!!deactivate} title="Ngừng áp dụng quy tắc" message={`Ngừng áp dụng “${deactivate?.name ?? ''}”? Kế hoạch nhập sẽ được tính lại, lịch sử quy tắc vẫn được giữ.`} confirmLabel="Ngừng áp dụng" tone="danger" busy={busy} onConfirm={() => void confirmDeactivate()} onClose={() => setDeactivate(null)} />
  </div>
}
