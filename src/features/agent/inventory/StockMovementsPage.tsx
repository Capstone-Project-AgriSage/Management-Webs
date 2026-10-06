import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { describeError } from '@/api/client'
import { stockApi, type MovementType, type StockMovement, type StockMovementListItem } from '@/api/stockApi'
import type { Paged } from '@/api/types'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import DetailModal from '@/components/ui/DetailModal'
import { formatVnd } from '@/utils/money'
import { formatDate, formatDateTime, formatQty } from '@/utils/units'
import { ADJUSTMENT_REASONS, MOVEMENT_TYPE_BADGE_CLASS, MOVEMENT_TYPE_LABEL, MOVEMENT_TYPE_OPTIONS } from './stockLabels'

const PAGE_SIZE = 15

const dateInputClassName =
  'h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm'

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Nháp', POSTED: 'Đã ghi sổ', CANCELLED: 'Đã hủy' }

function badge(type: string) {
  return MOVEMENT_TYPE_BADGE_CLASS[type as MovementType] ?? 'bg-slate-100 text-slate-700'
}

export default function StockMovementsPage() {
  usePageHeader({ title: 'Biến động kho', subtitle: 'Sổ phiếu kho: nhập, bán, trả hàng, điều chỉnh, kiểm kê' })
  const { showToast } = useToast()

  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<StockMovementListItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<StockMovement | null>(null)
  const [detailLoading, setDetailLoading] = useState<string | null>(null)
  const request = useRef(0)

  const rangeInvalid = from !== '' && to !== '' && to < from

  const load = useCallback(async () => {
    if (rangeInvalid) return
    const id = ++request.current
    setLoading(true)
    try {
      const res = await stockApi.getMovements({
        type: (type || undefined) as MovementType | undefined,
        fromDate: from || undefined,
        toDate: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      if (id === request.current) setData(res)
    } catch (err) {
      if (id === request.current) showToast(describeError(err, 'Không tải được danh sách phiếu kho'), 'error')
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [type, from, to, page, rangeInvalid, showToast])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (item: StockMovementListItem) => {
    setDetailLoading(item.id)
    try {
      setDetail(await stockApi.getMovement(item.id))
    } catch (err) {
      showToast(describeError(err, 'Không mở được phiếu kho'), 'error')
    } finally {
      setDetailLoading(null)
    }
  }

  const items = data?.items ?? []
  const reasonLabel = (code: string | null) => ADJUSTMENT_REASONS.find((r) => r.value === code)?.label ?? code

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Loại phiếu</label>
          <FilterSelect
            value={type}
            onChange={(v) => {
              setType(v)
              setPage(1)
            }}
            className="relative min-w-[200px]"
            options={[{ value: '', label: 'Tất cả loại' }, ...MOVEMENT_TYPE_OPTIONS]}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="mv-from">
            Từ ngày
          </label>
          <input
            id="mv-from"
            type="date"
            className={dateInputClassName}
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="mv-to">
            Đến ngày
          </label>
          <input
            id="mv-to"
            type="date"
            className={dateInputClassName}
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
          />
        </div>
        {type || from || to ? (
          <button
            type="button"
            className="h-10 px-3 text-sm font-medium text-slate-600 hover:text-slate-900"
            onClick={() => {
              setType('')
              setFrom('')
              setTo('')
              setPage(1)
            }}
          >
            Xóa bộ lọc
          </button>
        ) : null}
        <div className="ml-auto">
          <Link
            to="/agent/inventory/stock-card"
            className="inline-flex items-center h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm"
          >
            Xem thẻ kho theo sản phẩm
          </Link>
        </div>
      </div>

      {rangeInvalid ? (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" role="alert">
          Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.
        </p>
      ) : null}

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 font-medium">Mã phiếu kho</th>
                <th className="py-3 px-3 font-medium">Loại</th>
                <th className="py-3 px-3 font-medium">Thời điểm</th>
                <th className="py-3 px-3 font-medium text-center">Số dòng</th>
                <th className="py-3 px-4 font-medium text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm">
              {loading && items.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Đang tải phiếu kho..." className="text-slate-500 animate-pulse" />
              ) : items.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Không có phiếu kho nào." />
              ) : (
                items.map((m) => (
                  <tr
                    key={m.id}
                    className={`hover:bg-surface-container-low transition-colors cursor-pointer ${detailLoading === m.id ? 'opacity-60' : ''}`}
                    onClick={() => openDetail(m)}
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold">{m.movementNumber}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide whitespace-nowrap ${badge(m.movementType)}`}>
                        {MOVEMENT_TYPE_LABEL[m.movementType] ?? m.movementType}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">{formatDateTime(m.occurredAt)}</td>
                    <td className="py-3 px-3 text-center tabular-nums">{m.itemCount}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs text-slate-600">{STATUS_LABEL[m.status] ?? m.status}</span>
                    </td>
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
          unitLabel="phiếu kho"
          goPrev={() => setPage((p) => Math.max(1, p - 1))}
          goNext={() => setPage((p) => Math.min(data?.totalPages ?? 1, p + 1))}
          setPage={setPage}
        />
      </div>

      <DetailModal open={detail !== null} onClose={() => setDetail(null)} widthClassName="max-w-4xl">
        {detail ? (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-bold text-slate-900 font-mono">{detail.movementNumber}</h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${badge(detail.movementType)}`}>
                {MOVEMENT_TYPE_LABEL[detail.movementType as MovementType] ?? detail.movementType}
              </span>
              <span className="text-xs text-slate-500">{STATUS_LABEL[detail.status] ?? detail.status}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Thời điểm</dt>
                <dd className="font-medium">{formatDateTime(detail.occurredAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Ghi sổ lúc</dt>
                <dd className="font-medium">{formatDateTime(detail.postedAt)}</dd>
              </div>
              {detail.reasonCode ? (
                <div>
                  <dt className="text-slate-500">Lý do</dt>
                  <dd className="font-medium">{reasonLabel(detail.reasonCode)}</dd>
                </div>
              ) : null}
              {detail.reason ? (
                <div className="col-span-2">
                  <dt className="text-slate-500">Ghi chú</dt>
                  <dd className="font-medium whitespace-pre-line">{detail.reason}</dd>
                </div>
              ) : null}
              <div className="col-span-2 flex flex-wrap gap-2">
                {detail.goodsReceiptId ? <span className="text-xs bg-slate-100 text-slate-700 rounded px-2 py-0.5">Từ phiếu nhập hàng</span> : null}
                {detail.orderId ? <span className="text-xs bg-slate-100 text-slate-700 rounded px-2 py-0.5">Từ đơn hàng</span> : null}
                {detail.deliveryId ? <span className="text-xs bg-slate-100 text-slate-700 rounded px-2 py-0.5">Từ chuyến giao hàng</span> : null}
                {detail.stocktakeId ? <span className="text-xs bg-slate-100 text-slate-700 rounded px-2 py-0.5">Từ phiếu kiểm kê</span> : null}
                {detail.reversalOfMovementId ? <span className="text-xs bg-slate-100 text-slate-700 rounded px-2 py-0.5">Đảo một phiếu kho khác</span> : null}
              </div>
            </dl>

            <div className="rounded-lg border border-outline-variant overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-[11px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="py-2 px-4 font-medium">Sản phẩm</th>
                    <th className="py-2 px-3 font-medium">Lô</th>
                    <th className="py-2 px-3 font-medium text-right">Số lượng</th>
                    <th className="py-2 px-3 font-medium text-right">Giá vốn</th>
                    <th className="py-2 px-3 font-medium text-right">Thành tiền</th>
                    <th className="py-2 px-4 font-medium text-right">Tồn sau</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50 text-sm">
                  {detail.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-4">
                        <div className="font-medium">{it.productName}</div>
                        <div className="font-mono text-xs text-slate-500">{it.sku}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs">
                        {it.lotNumber ?? '-'}
                        {it.expiryDate ? <div className="font-sans text-slate-500">HSD {formatDate(it.expiryDate)}</div> : null}
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${it.quantityDeltaBase < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {it.quantityDeltaBase > 0 ? '+' : ''}
                        {formatQty(it.quantityDeltaBase)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(it.unitCostSnapshot)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(it.totalCostSnapshot)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{it.quantityOnHandAfter === null ? '-' : formatQty(it.quantityOnHandAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Phiếu kho đã ghi sổ không sửa hay xóa được; sai sót được sửa bằng phiếu điều chỉnh hoặc phiếu đảo.</p>
          </div>
        ) : null}
      </DetailModal>
    </div>
  )
}
