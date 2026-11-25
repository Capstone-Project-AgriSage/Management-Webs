import ListReportCards from '@/features/agent/reports/ListReportCards'
import { useBusinessDataRefresh } from '@/hooks/useBusinessDataRefresh'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { exchangesApi, exchangeStatus, type ExchangePage } from '@/api/exchangesApi'
import { usePermission } from '@/context/PermissionContext'
import { usePageHeader } from '@/context/PageHeaderContext'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import StatusBadge from '@/components/ui/StatusBadge'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import Pagination from '@/components/ui/Pagination'
import { formatVnd } from '@/utils/money'
import { vnDateTime } from '@/utils/date'
import { useExchangeBase } from './exchangePaths'
import { exchangePrimary, exchangeSecondary } from './exchangeStyles'

const PAGE_SIZE = 20

export default function ExchangesPage() {
  const navigate = useNavigate()
  const { has } = usePermission()
  const base = useExchangeBase()
  const canRead = has('EXCHANGES.READ')
  const sequence = useRef(0)
  const [data, setData] = useState<ExchangePage | null>(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  usePageHeader({ title: 'Đổi hàng', subtitle: 'Quản lý yêu cầu đổi, thu hồi hàng và quyết toán chênh lệch' })

  const load = useCallback(async () => {
    if (!canRead) return
    const current = ++sequence.current
    setLoading(true)
    setError('')
    try {
      const result = await exchangesApi.list({ page, search, status })
      if (current === sequence.current) {
        if (page > Math.max(1, result.totalPages)) { setPage(Math.max(1, result.totalPages)); return }
        setData(result)
      }
    } catch (error) {
      if (current === sequence.current) setError(error instanceof Error ? error.message : 'Không tải được danh sách đổi hàng')
    } finally {
      if (current === sequence.current) setLoading(false)
    }
  }, [canRead, page, search, status])

  useEffect(() => {
    sequence.current++
    const timer = setTimeout(() => { void load() }, 250)
    return () => clearTimeout(timer)
  }, [load])
  useBusinessDataRefresh(load, ['inventory'])

  return <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
    {canRead && <ListReportCards title="Tổng hợp đổi hàng" totalCount={data?.totalCount ?? null} unit="yêu cầu" loading={loading} error={!!error} metrics={[
      { label: 'Tiền đã thu', value: data?.summary?.receivedAmount ?? null, kind: 'money', note: 'Thu thêm từ đổi hàng đã hoàn tất theo bộ lọc' },
      { label: 'Tiền đã hoàn', value: data?.summary?.refundedAmount ?? null, kind: 'money', note: 'Hoàn tiền từ đổi hàng đã hoàn tất theo bộ lọc' },
      { label: 'Tiền thu ròng', value: data?.summary?.netReceivedAmount ?? null, kind: 'money', note: 'Tiền đã thu trừ tiền đã hoàn theo bộ lọc' },
    ]} />}
    <ListToolbar search={{ value: search, onChange: value => { setSearch(value); setPage(1) }, placeholder: 'Tìm mã đơn, mã phiếu trả hoặc tên khách hàng...' }}
      onClear={() => { setSearch(''); setStatus(''); setPage(1) }}
      actions={<>
        {canRead && <button type="button" className={exchangeSecondary} disabled={loading} onClick={load}><RefreshCw size={16} aria-hidden="true" /> Làm mới</button>}
        {has('EXCHANGES.CREATE') && <Link to={`${base}/new`} className={exchangePrimary}><Plus size={16} aria-hidden="true" /> Tạo yêu cầu đổi</Link>}
      </>}>
      <FilterSelect label="Trạng thái đổi hàng" value={status} onChange={value => { setStatus(value); setPage(1) }}
        options={[{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(exchangeStatus).map(([value, label]) => ({ value, label }))]} />
    </ListToolbar>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error} <button type="button" className="font-semibold underline" onClick={load}>Thử lại</button></p>}
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm" aria-busy={loading}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant">
            <tr>{['Mã phiếu', 'Đơn hàng gốc', 'Khách hàng', 'Trạng thái', 'Giá trị hàng mới', 'Chênh lệch', 'Ngày yêu cầu', 'Thao tác'].map((title, index) => <th key={title} scope="col" className={`px-4 py-3 font-medium whitespace-nowrap ${[4, 5, 7].includes(index) ? 'text-right' : index === 3 ? 'text-center' : ''}`}>{title}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/50">
            {!canRead ? <EmptyTableRow colSpan={8} message="Bạn chưa được cấp quyền xem danh sách đổi hàng." /> : loading ? <EmptyTableRow colSpan={8} message="Đang tải yêu cầu đổi hàng..." /> : !data?.items.length ? <EmptyTableRow colSpan={8} message={error ? 'Không tải được danh sách. Vui lòng thử lại.' : 'Chưa có yêu cầu đổi hàng phù hợp.'} /> : data.items.map(item => <tr key={item.id} className="transition-colors hover:bg-surface-container-low">
              <td className="px-4 py-3 font-mono text-xs font-semibold"><Link className="text-primary hover:underline" to={`${base}/${item.id}`}>{item.returnNumber}</Link></td>
              <td className="px-4 py-3 font-mono text-xs">{item.orderNumber}</td>
              <td className="px-4 py-3">{item.customerName}</td>
              <td className="px-4 py-3 text-center"><StatusBadge label={exchangeStatus[item.status]} /></td>
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatVnd(item.replacementAmount)}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap"><span className={item.difference === null ? 'text-on-surface-variant' : item.difference < 0 ? 'text-rose-700' : 'text-primary'}>{item.difference === null ? 'Chưa chốt' : item.difference === 0 ? 'Ngang giá' : `${item.difference > 0 ? 'Thu thêm' : 'Hoàn lại'} ${formatVnd(Math.abs(item.difference))}`}</span></td>
              <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant">{vnDateTime(item.createdAt)}</td>
              <td className="px-4 py-3 text-right"><RowActionsMenu triggerLabel={`Thao tác đổi hàng ${item.returnNumber}`} actions={[{ label: 'Xem chi tiết', icon: 'visibility', permissionCodes: ['EXCHANGES.READ'], onClick: () => navigate(`${base}/${item.id}`) }]} /></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {canRead && <Pagination page={page} totalPages={data?.totalPages ?? 1} startIndex={(page - 1) * PAGE_SIZE} endIndex={Math.min(page * PAGE_SIZE, data?.totalCount ?? 0)} totalCount={data?.totalCount ?? 0} unitLabel="yêu cầu đổi hàng" goPrev={() => setPage(value => Math.max(1, value - 1))} goNext={() => setPage(value => Math.min(data?.totalPages ?? 1, value + 1))} setPage={setPage} />}
    </div>
  </div>
}
