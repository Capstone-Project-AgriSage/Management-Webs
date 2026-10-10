import PermissionAction from '@/components/auth/PermissionAction'
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Undo2 } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { describeError } from '@/api/client'
import { returnsApi, type ReturnListItem, type ReturnStatus } from '@/api/returnsApi'
import type { Paged } from '@/api/types'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { formatVnd } from '@/utils/money'
import { formatDateTime } from '@/utils/units'
import { RETURN_STATUS_BADGE_CLASS, RETURN_STATUS_LABEL } from './returnLabels'
import { useReturnsBase } from './returnPaths'

const PAGE_SIZE = 10

export default function ReturnsListPage() {
  usePageHeader({ title: 'Trả hàng', subtitle: 'Khách trả lại hàng đã mua: duyệt, nhận hàng, kiểm tra, nhập lại kho và hoàn tiền' })
  const { showToast } = useToast()
  const navigate = useNavigate()
  const base = useReturnsBase()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<ReturnListItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const request = useRef(0)

  const load = useCallback(async () => {
    const id = ++request.current
    setLoading(true)
    try {
      const res = await returnsApi.list({
        status: (status || undefined) as ReturnStatus | undefined,
        search: debouncedSearch.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      if (id === request.current) setData(res)
    } catch (err) {
      if (id === request.current) showToast(describeError(err, 'Không tải được danh sách trả hàng'), 'error')
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [status, debouncedSearch, page, showToast])

  useEffect(() => {
    load()
  }, [load])

  const items = data?.items ?? []

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <BusinessReportCards kind="returns" searchResult={{ count: data?.totalCount ?? 0, unit: 'phiếu trả' }} />
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm flex flex-wrap items-center gap-3 flex-1">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Tìm theo mã trả hàng, mã đơn hoặc tên khách..."
            className="relative flex-1 min-w-[240px]"
          />
          <FilterSelect
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={[{ value: '', label: 'Tất cả trạng thái' }, ...(Object.keys(RETURN_STATUS_LABEL) as ReturnStatus[]).map((s) => ({ value: s, label: RETURN_STATUS_LABEL[s] }))]}
          />
        </div>
        <PermissionAction codes={['RETURNS.CREATE']}><button
          type="button"
          onClick={() => navigate(`${base}/new`)}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm"
        >
          <Plus size={16} /> Tạo yêu cầu trả hàng
        </button></PermissionAction>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 font-medium">Mã trả hàng</th>
                <th className="py-3 px-3 font-medium">Đơn hàng</th>
                <th className="py-3 px-3 font-medium">Khách hàng</th>
                <th className="py-3 px-3 font-medium text-center">Trạng thái</th>
                <th className="py-3 px-3 font-medium text-right">Giá trị trả</th>
                <th className="py-3 px-3 font-medium text-right">Cần hoàn tiền</th>
                <th className="py-3 px-4 font-medium">Yêu cầu lúc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm">
              {loading && items.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Đang tải..." className="text-slate-500 animate-pulse" />
              ) : items.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Chưa có yêu cầu trả hàng nào." />
              ) : (
                items.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => navigate(`${base}/${r.id}`)}>
                    <td className="py-3 px-4 font-mono text-xs font-semibold">{r.returnNumber}</td>
                    <td className="py-3 px-3 font-mono text-xs">{r.orderNumber}</td>
                    <td className="py-3 px-3">{r.customerName}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded tracking-wide whitespace-nowrap ${RETURN_STATUS_BADGE_CLASS[r.status]}`}>{RETURN_STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(r.totalReturnAmount)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{r.totalRefundAmount > 0 ? formatVnd(r.totalRefundAmount) : <span className="text-slate-400">-</span>}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{formatDateTime(r.requestedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={data?.totalPages ?? 1}
          startIndex={(page - 1) * PAGE_SIZE}
          endIndex={Math.min(page * PAGE_SIZE, data?.totalCount ?? 0)}
          totalCount={data?.totalCount ?? 0}
          unitLabel="yêu cầu trả hàng"
          goPrev={() => setPage((p) => Math.max(1, p - 1))}
          goNext={() => setPage((p) => Math.min(data?.totalPages ?? 1, p + 1))}
          setPage={setPage}
        />
      </div>

      <p className="text-xs text-slate-500 flex items-start gap-2">
        <Undo2 size={14} className="mt-0.5 shrink-0" />
        Chỉ trả được hàng đã giao. Nhân viên tạo yêu cầu, nhận hàng và kiểm tra; Chủ cửa hàng duyệt, chốt kiểm tra và xác nhận hoàn tiền.
      </p>
    </div>
  )
}
