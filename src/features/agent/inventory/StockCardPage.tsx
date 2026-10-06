import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Download, Layers, Scale } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { describeError } from '@/api/client'
import { stockApi, type StockCard, type StockLot } from '@/api/stockApi'
import KpiCard from '@/components/ui/KpiCard'
import FilterSelect from '@/components/ui/FilterSelect'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { downloadCsv } from '@/utils/csv'
import { formatVnd } from '@/utils/money'
import { formatDateTime, formatQty, formatQtyUnit, monthStartInput, rangeDays, todayInput, unitLabel } from '@/utils/units'
import ProductPicker, { type PickedProduct } from './ProductPicker'
import { MOVEMENT_TYPE_BADGE_CLASS, MOVEMENT_TYPE_LABEL, REFERENCE_TYPE_LABEL } from './stockLabels'

const MAX_DAYS = 366

const dateInputClassName =
  'h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm'

export default function StockCardPage() {
  usePageHeader({ title: 'Thẻ kho', subtitle: 'Mọi lần nhập, bán, trả, điều chỉnh của một sản phẩm: tồn đầu + phát sinh = tồn cuối' })
  const { showToast } = useToast()
  const [params, setParams] = useSearchParams()

  const [productId, setProductId] = useState<string | null>(params.get('storeProductId'))
  const [product, setProduct] = useState<PickedProduct | null>(null)
  const [lotId, setLotId] = useState('')
  const [lots, setLots] = useState<StockLot[]>([])
  const [from, setFrom] = useState(monthStartInput())
  const [to, setTo] = useState(todayInput())
  const [card, setCard] = useState<StockCard | null>(null)
  const [loading, setLoading] = useState(false)
  const request = useRef(0)

  const days = rangeDays(from, to)
  const rangeProblem = !from || !to ? 'Chọn đủ ngày bắt đầu và ngày kết thúc.' : days <= 0 ? 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' : days > MAX_DAYS ? `Khoảng thời gian tối đa ${MAX_DAYS} ngày.` : null

  const pick = (p: PickedProduct | null) => {
    setProduct(p)
    setProductId(p?.storeProductId ?? null)
    setLotId('')
    setLots([])
    setCard(null)
    const next = new URLSearchParams(params)
    if (p) next.set('storeProductId', p.storeProductId)
    else next.delete('storeProductId')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    stockApi
      .getLots({ storeProductId: productId, pageSize: 100 })
      .then((res) => {
        if (!cancelled) setLots(res.items)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [productId])

  useEffect(() => {
    if (!productId || rangeProblem) return
    const id = ++request.current
    setLoading(true)
    stockApi
      .getStockCard({ storeProductId: productId, inventoryLotId: lotId || undefined, fromDate: from, toDate: to })
      .then((res) => {
        if (id !== request.current) return
        setCard(res)
        setProduct((prev) => prev ?? { storeProductId: res.storeProductId, sku: res.sku, productName: res.productName, baseUnit: res.baseUnit })
      })
      .catch((err) => {
        if (id !== request.current) return
        setCard(null)
        showToast(describeError(err, 'Không tải được thẻ kho'), 'error')
      })
      .finally(() => {
        if (id === request.current) setLoading(false)
      })
  }, [productId, lotId, from, to, rangeProblem, showToast])

  const totals = useMemo(() => {
    const lines = card?.lines ?? []
    return {
      inQty: lines.reduce((sum, l) => sum + l.inBaseQuantity, 0),
      outQty: lines.reduce((sum, l) => sum + l.outBaseQuantity, 0),
    }
  }, [card])

  const unit = card?.baseUnit ?? product?.baseUnit

  const exportCsv = () => {
    if (!card || card.lines.length === 0) {
      showToast('Không có dòng nào để xuất', 'info')
      return
    }
    downloadCsv(
      `the-kho-${card.sku}-${from}-${to}.csv`,
      card.lines.map((l) => ({
        'Thời điểm': formatDateTime(l.postedAt),
        'Phiếu kho': l.movementNumber,
        Loại: MOVEMENT_TYPE_LABEL[l.movementType] ?? l.movementType,
        'Chứng từ gốc': l.reference ? `${REFERENCE_TYPE_LABEL[l.reference.type] ?? l.reference.type} ${l.reference.number ?? ''}`.trim() : 'Điều chỉnh tay',
        Lô: l.lotNumber ?? '',
        Nhập: l.inBaseQuantity,
        Xuất: l.outBaseQuantity,
        Tồn: l.balanceBaseQuantity,
        'Giá vốn': l.unitCost,
      })),
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Sản phẩm</label>
          <ProductPicker value={product} onChange={pick} pendingLabel={productId && !product ? 'Đang tải sản phẩm...' : null} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="sc-from">
            Từ ngày
          </label>
          <input id="sc-from" type="date" className={dateInputClassName} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="sc-to">
            Đến ngày
          </label>
          <input id="sc-to" type="date" className={dateInputClassName} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Lô</label>
          <FilterSelect
            value={lotId}
            onChange={setLotId}
            className="relative min-w-[180px]"
            options={[
              { value: '', label: 'Tất cả các lô' },
              ...lots.map((l) => ({ value: l.id, label: l.lotNumber ?? 'Không có số lô' })),
            ]}
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!card || card.lines.length === 0}
          className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm disabled:opacity-50"
        >
          <Download size={16} /> Xuất CSV
        </button>
      </div>

      {rangeProblem ? (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" role="alert">
          {rangeProblem}
        </p>
      ) : null}

      {!productId ? (
        <div className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm py-16 flex flex-col items-center text-center gap-2">
          <Layers size={36} className="text-outline" />
          <p className="font-semibold text-on-surface">Chọn một sản phẩm để xem thẻ kho</p>
          <p className="text-sm text-on-surface-variant max-w-md">
            Thẻ kho liệt kê từng phiếu kho đã ghi sổ của sản phẩm trong khoảng ngày bạn chọn. Cũng có thể mở từ danh sách lô ở trang{' '}
            <Link to="/agent/inventory" className="text-emerald-700 font-medium hover:underline">
              Tồn kho
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard icon={Scale} iconClassName="bg-slate-100 text-slate-600" title="Tồn đầu kỳ" layout="side" value={card ? formatQty(card.openingBaseQuantity) : '...'} valueSuffix={<span className="text-sm text-slate-500">{unitLabel(unit)}</span>} />
            <KpiCard icon={ArrowDownToLine} iconClassName="bg-emerald-50 text-emerald-600" title="Tổng nhập" layout="side" value={card ? formatQty(totals.inQty) : '...'} valueClassName="text-emerald-700" valueSuffix={<span className="text-sm text-slate-500">{unitLabel(unit)}</span>} />
            <KpiCard icon={ArrowUpFromLine} iconClassName="bg-amber-50 text-amber-600" title="Tổng xuất" layout="side" value={card ? formatQty(totals.outQty) : '...'} valueClassName="text-amber-700" valueSuffix={<span className="text-sm text-slate-500">{unitLabel(unit)}</span>} />
            <KpiCard icon={Scale} iconClassName="bg-sky-50 text-sky-600" title="Tồn cuối kỳ" layout="side" value={card ? formatQty(card.closingBaseQuantity) : '...'} valueSuffix={<span className="text-sm text-slate-500">{unitLabel(unit)}</span>} subtitle={card ? `${card.lines.length} dòng phát sinh` : undefined} />
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="py-3 px-4 font-medium">Thời điểm</th>
                    <th className="py-3 px-3 font-medium">Phiếu kho</th>
                    <th className="py-3 px-3 font-medium">Loại</th>
                    <th className="py-3 px-3 font-medium">Chứng từ gốc</th>
                    <th className="py-3 px-3 font-medium">Lô</th>
                    <th className="py-3 px-3 font-medium text-right">Nhập</th>
                    <th className="py-3 px-3 font-medium text-right">Xuất</th>
                    <th className="py-3 px-3 font-medium text-right">Tồn</th>
                    <th className="py-3 px-4 font-medium text-right">Giá vốn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50 text-sm">
                  {card ? (
                    <tr className="bg-slate-50 text-slate-600">
                      <td className="py-2.5 px-4" colSpan={7}>
                        Tồn đầu kỳ (trước {from.split('-').reverse().join('/')})
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{formatQtyUnit(card.openingBaseQuantity, card.baseUnit)}</td>
                      <td />
                    </tr>
                  ) : null}
                  {loading && !card ? (
                    <EmptyTableRow colSpan={9} message="Đang tải thẻ kho..." className="text-slate-500 animate-pulse" />
                  ) : card && card.lines.length === 0 ? (
                    <EmptyTableRow colSpan={9} message="Không có phát sinh trong khoảng ngày này." />
                  ) : (
                    card?.lines.map((l, i) => (
                      <tr key={`${l.movementId}-${i}`} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(l.postedAt)}</td>
                        <td className="py-2.5 px-3 font-mono text-xs">{l.movementNumber}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide whitespace-nowrap ${MOVEMENT_TYPE_BADGE_CLASS[l.movementType] ?? 'bg-slate-100 text-slate-700'}`}>
                            {MOVEMENT_TYPE_LABEL[l.movementType] ?? l.movementType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {l.reference ? (
                            <span>
                              {REFERENCE_TYPE_LABEL[l.reference.type] ?? l.reference.type}
                              {l.reference.number ? <span className="font-mono text-xs text-slate-500"> {l.reference.number}</span> : null}
                            </span>
                          ) : (
                            <span className="text-slate-500">Điều chỉnh tay</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs">{l.lotNumber ?? '-'}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{l.inBaseQuantity ? `+${formatQty(l.inBaseQuantity)}` : ''}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-amber-700">{l.outBaseQuantity ? `-${formatQty(l.outBaseQuantity)}` : ''}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{formatQty(l.balanceBaseQuantity)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">{formatVnd(l.unitCost)}</td>
                      </tr>
                    ))
                  )}
                  {card ? (
                    <tr className="bg-slate-50 font-semibold">
                      <td className="py-2.5 px-4" colSpan={5}>
                        Cộng phát sinh / tồn cuối kỳ
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">+{formatQty(totals.inQty)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-amber-700">-{formatQty(totals.outQty)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatQtyUnit(card.closingBaseQuantity, card.baseUnit)}</td>
                      <td />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Chỉ gồm phiếu kho đã ghi sổ. Số lượng tính theo đơn vị cơ sở ({unitLabel(unit)}). Chọn một lô để xem riêng lô đó.
          </p>
        </>
      )}
    </div>
  )
}
