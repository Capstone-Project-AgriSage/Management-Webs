import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/ui/Pagination'
import ListToolbar from '@/components/ui/ListToolbar'
import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { describeError } from '@/api/client';
import { catalogApi } from '@/api/catalogApi';
import { inventoryReportsApi, type InventoryMovementAmount, type InventoryMovementReport, type InventoryValuationReport } from '@/api/inventoryReportsApi';
import FilterSelect from '@/components/ui/FilterSelect'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { downloadCsv } from '@/utils/csv';
import { formatVnd } from '@/utils/money';
import { formatQty, monthStartInput, rangeDays, todayInput, unitLabel } from '@/utils/units';

type Tab = 'movement' | 'valuation'

const MAX_DAYS = 366

const dateInputClassName =
  'h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm'

/** Quantity over value, signed the way the report returns them (sales and write-offs are negative). */
function Amount({ amount }: { amount: InventoryMovementAmount }) {
  if (amount.quantity === 0 && amount.value === 0) return <span className="text-slate-300">-</span>
  return (
    <div className="text-right tabular-nums">
      <div className={amount.quantity < 0 ? 'text-amber-700' : amount.quantity > 0 ? 'text-emerald-700' : ''}>
        {amount.quantity > 0 ? '+' : ''}
        {formatQty(amount.quantity)}
      </div>
      <div className="text-[11px] text-slate-500 whitespace-nowrap">{formatVnd(amount.value)}</div>
    </div>
  )
}

export default function InventoryReportsPage() {
  usePageHeader({ title: 'Báo cáo kho', subtitle: 'Xuất - nhập - tồn theo kỳ và định giá tồn kho (chỉ Chủ cửa hàng và Admin)' })
  const { showToast } = useToast()

  const [tab, setTab] = useState<Tab>('movement')
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [from, setFrom] = useState(monthStartInput())
  const [to, setTo] = useState(todayInput())

  const [movement, setMovement] = useState<InventoryMovementReport | null>(null)
  const [valuation, setValuation] = useState<InventoryValuationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const request = useRef(0)

  const days = rangeDays(from, to)
  const rangeProblem =
    tab !== 'movement' ? null : !from || !to ? 'Chọn đủ ngày bắt đầu và ngày kết thúc.' : days <= 0 ? 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' : days > MAX_DAYS ? `Khoảng thời gian tối đa ${MAX_DAYS} ngày.` : null

  useEffect(() => {
    catalogApi
      .getCategories()
      .then((res) => {
        const list = Array.isArray(res) ? res : ((res as { items?: { id: string; name: string }[] }).items ?? [])
        setCategories(list)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (rangeProblem) return
    const id = ++request.current
    setLoading(true)
    const run =
      tab === 'movement'
        ? inventoryReportsApi.getMovement({ fromDate: from, toDate: to, categoryId: categoryId || undefined }).then((r) => {
            if (id === request.current) setMovement(r)
          })
        : inventoryReportsApi.getValuation({ categoryId: categoryId || undefined }).then((r) => {
            if (id === request.current) setValuation(r)
          })
    run
      .catch((err) => {
        if (id === request.current) showToast(describeError(err, 'Không tải được báo cáo'), 'error')
      })
      .finally(() => {
        if (id === request.current) setLoading(false)
      })
  }, [tab, from, to, categoryId, rangeProblem, showToast])

  const exportMovement = () => {
    if (!movement || movement.rows.length === 0) return showToast('Không có dòng nào để xuất', 'info')
    const cell = (a: InventoryMovementAmount) => `${a.quantity} | ${Math.round(a.value)}`
    downloadCsv(
      `xuat-nhap-ton-${movement.fromDate}-${movement.toDate}.csv`,
      movement.rows.map((r) => ({
        'Mã SP': r.sku,
        'Tên sản phẩm': r.productName,
        'Đơn vị': unitLabel(r.baseUnit),
        'Tồn đầu (SL)': r.openingQuantity,
        'Tồn đầu (GT)': Math.round(r.openingValue),
        'Nhập kho (SL | GT)': cell(r.stockIn),
        'Khách trả (SL | GT)': cell(r.returnIn),
        'Điều chỉnh tăng (SL | GT)': cell(r.adjustmentIn),
        'Bán (SL | GT)': cell(r.sale),
        'Điều chỉnh giảm (SL | GT)': cell(r.adjustmentOut),
        'Đảo phiếu (SL | GT)': cell(r.reversal),
        'Tồn cuối (SL)': r.closingQuantity,
        'Tồn cuối (GT)': Math.round(r.closingValue),
      })),
    )
  }

  const exportValuation = () => {
    if (!valuation || valuation.rows.length === 0) return showToast('Không có dòng nào để xuất', 'info')
    downloadCsv(
      `dinh-gia-kho-${todayInput()}.csv`,
      valuation.rows.map((r) => ({
        'Mã SP': r.sku,
        'Tên sản phẩm': r.productName,
        'Danh mục': r.category ?? '',
        'Tồn (đơn vị cơ sở)': r.onHandBaseQuantity,
        'Giá vốn bình quân': r.averageUnitCost === null ? '' : Math.round(r.averageUnitCost),
        'Giá trị tồn': Math.round(r.stockValue),
        'Giá trị hàng hết hạn': Math.round(r.expiredValue),
      })),
    )
  }

  const movementPages = usePagination(movement?.rows ?? [], 10, [from, to, categoryId].join('|'))
  const valuationPages = usePagination(valuation?.rows ?? [], 10, [categoryId].join('|'))

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm" role="tablist">
          {(
            [
              ['movement', 'Xuất - nhập - tồn'],
              ['valuation', 'Định giá kho'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === value ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={tab === 'movement' ? exportMovement : exportValuation}
          className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm"
        >
          <Download size={16} /> Xuất CSV
        </button>
      </div>

      <ListToolbar  onClear={() => { setCategoryId(''); setFrom(monthStartInput()); setTo(todayInput()) }}>
{tab === 'movement' ? (
          <>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="rp-from">
                Từ ngày
              </label>
              <input id="rp-from" type="date" className={dateInputClassName} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="rp-to">
                Đến ngày
              </label>
              <input id="rp-to" type="date" className={dateInputClassName} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        ) : null}
<div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Danh mục</label>
          <FilterSelect
            value={categoryId}
            onChange={setCategoryId}
            className="relative min-w-[220px]"
            options={[{ value: '', label: 'Tất cả danh mục' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
      </ListToolbar>

      {rangeProblem ? (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" role="alert">
          {rangeProblem}
        </p>
      ) : null}

      {tab === 'movement' ? (
        <section aria-label="Xuất nhập tồn" className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                <tr>
                  <th className="py-3 px-4 font-medium">Sản phẩm</th>
                  <th className="py-3 px-3 font-medium text-right">Tồn đầu</th>
                  <th className="py-3 px-3 font-medium text-right">Nhập kho</th>
                  <th className="py-3 px-3 font-medium text-right">Khách trả</th>
                  <th className="py-3 px-3 font-medium text-right">Điều chỉnh +</th>
                  <th className="py-3 px-3 font-medium text-right">Bán</th>
                  <th className="py-3 px-3 font-medium text-right">Điều chỉnh -</th>
                  <th className="py-3 px-3 font-medium text-right">Đảo phiếu</th>
                  <th className="py-3 px-4 font-medium text-right">Tồn cuối</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50 text-sm">
                {loading && !movement ? (
                  <EmptyTableRow colSpan={9} message="Đang tải báo cáo..." className="text-slate-500 animate-pulse" />
                ) : !movement || movement.rows.length === 0 ? (
                  <EmptyTableRow colSpan={9} message="Không có dữ liệu trong kỳ này." />
                ) : (
                  <>
                    {movementPages.paginated.map((r) => (
                      <tr key={r.storeProductId} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-medium">{r.productName}</div>
                          <div className="font-mono text-xs text-slate-500">
                            {r.sku} · {unitLabel(r.baseUnit)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          <div>{formatQty(r.openingQuantity)}</div>
                          <div className="text-[11px] text-slate-500 whitespace-nowrap">{formatVnd(r.openingValue)}</div>
                        </td>
                        <td className="py-2.5 px-3"><Amount amount={r.stockIn} /></td>
                        <td className="py-2.5 px-3"><Amount amount={r.returnIn} /></td>
                        <td className="py-2.5 px-3"><Amount amount={r.adjustmentIn} /></td>
                        <td className="py-2.5 px-3"><Amount amount={r.sale} /></td>
                        <td className="py-2.5 px-3"><Amount amount={r.adjustmentOut} /></td>
                        <td className="py-2.5 px-3"><Amount amount={r.reversal} /></td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-semibold">
                          <div>{formatQty(r.closingQuantity)}</div>
                          <div className="text-[11px] font-normal text-slate-500 whitespace-nowrap">{formatVnd(r.closingValue)}</div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="py-2.5 px-4">Tổng giá trị</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(movement.totals.openingValue)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(movement.totals.stockIn)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(movement.totals.returnIn)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(movement.totals.adjustmentIn)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(movement.totals.sale)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(movement.totals.adjustmentOut)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(movement.totals.reversal)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">{formatVnd(movement.totals.closingValue)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <Pagination {...movementPages} unitLabel="sản phẩm" />
        </section>
      ) : (
        <section aria-label="Định giá kho" className="flex flex-col gap-4">
          {valuation && valuation.byCategory.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-200">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng giá trị tồn</div>
                <div className="text-2xl font-bold tabular-nums text-emerald-700 mt-1">{formatVnd(valuation.totals.stockValue)}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Trong đó hết hạn: <span className={valuation.totals.expiredValue > 0 ? 'text-rose-600 font-medium' : ''}>{formatVnd(valuation.totals.expiredValue)}</span>
                </div>
              </div>
              {valuation.byCategory.map((c) => (
                <div key={c.categoryId} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{c.name}</div>
                  <div className="text-xl font-bold tabular-nums text-slate-900 mt-1">{formatVnd(c.stockValue)}</div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="py-3 px-4 font-medium">Sản phẩm</th>
                    <th className="py-3 px-3 font-medium">Danh mục</th>
                    <th className="py-3 px-3 font-medium text-right">Tồn</th>
                    <th className="py-3 px-3 font-medium text-right">Giá vốn BQ</th>
                    <th className="py-3 px-3 font-medium text-right">Giá trị tồn</th>
                    <th className="py-3 px-4 font-medium text-right">Trong đó hết hạn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50 text-sm">
                  {loading && !valuation ? (
                    <EmptyTableRow colSpan={6} message="Đang tải báo cáo..." className="text-slate-500 animate-pulse" />
                  ) : !valuation || valuation.rows.length === 0 ? (
                    <EmptyTableRow colSpan={6} message="Không có sản phẩm nào." />
                  ) : (
                    <>
                      {valuationPages.paginated.map((r) => (
                        <tr key={r.storeProductId} className="hover:bg-surface-container-low transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-medium">{r.productName}</div>
                            <div className="font-mono text-xs text-slate-500">{r.sku}</div>
                          </td>
                          <td className="py-2.5 px-3">{r.category ?? '-'}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{formatQty(r.onHandBaseQuantity)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{r.averageUnitCost === null ? '-' : formatVnd(r.averageUnitCost)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{formatVnd(r.stockValue)}</td>
                          <td className={`py-2.5 px-4 text-right tabular-nums whitespace-nowrap ${r.expiredValue > 0 ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>{formatVnd(r.expiredValue)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold">
                        <td className="py-2.5 px-4" colSpan={4}>
                          Tổng cộng
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(valuation.totals.stockValue)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">{formatVnd(valuation.totals.expiredValue)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          <Pagination {...valuationPages} unitLabel="lô hàng" />
          </div>
        </section>
      )}
    </div>
  )
}
