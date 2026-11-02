import RowActionsMenu from '@/components/ui/RowActionsMenu'
import DetailModal from '@/components/ui/DetailModal'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import ModalLayout from '@/components/ui/ModalLayout'
import ListToolbar from '@/components/ui/ListToolbar'
import PermissionAction from '@/components/auth/PermissionAction'
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronsRight, History } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { usePermission } from '@/context/PermissionContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { describeError } from '@/api/client';
import { stockApi, type AdjustmentReason, type AlertType, type InventoryAlertItem, type StockLot, type StockSummaryItem } from '@/api/stockApi';
import { inventoryReportsApi } from '@/api/inventoryReportsApi';
import type { Paged } from '@/api/types';
import KpiCard from '@/components/ui/KpiCard'

import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import ServerPagination from '@/components/ui/ServerPagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { formatVnd } from '@/utils/money';
import { formatDate, formatQty, formatQtyUnit, unitLabel } from '@/utils/units';
import StockAdjustmentModal, { type AdjustmentTarget } from './StockAdjustmentModal';
import PlanningSettingsModal from './PlanningSettingsModal';
import { catalogApi } from '@/api/catalogApi';
import { ALERT_BADGE_CLASS, ALERT_LABEL, LOT_STATUS_BADGE_CLASS, LOT_STATUS_LABEL, daysUntil, expiryLabel } from './stockLabels';

const PAGE_SIZE = 10
const EXPIRING_DAYS_DEFAULT = 30

interface Kpis {
  stockValue: number | null
  expiredValue: number | null
  expiring: number | null
  expired: number | null
  lowStock: number | null
  outOfStock: number | null
}

interface LotsState {
  loading: boolean
  items: StockLot[]
  error: string | null
  page: number
  totalCount: number
  totalPages: number
}

type Tab = 'summary' | 'alerts'

export default function StockOverviewPage() {
  const lotsRequest = useRef<Record<string, number>>({})
  usePageHeader({ title: 'Tồn kho', subtitle: 'Tồn theo sản phẩm và lô, hạn dùng, cảnh báo và điều chỉnh kho' })
  const { showToast } = useToast()
  const { has } = usePermission()
  const canReadReports = has('REPORTS.READ')

  const [tab, setTab] = useState<Tab>('summary')
  const [kpis, setKpis] = useState<Kpis>({ stockValue: null, expiredValue: null, expiring: null, expired: null, lowStock: null, outOfStock: null })
  const [planningSettings, setPlanningSettings] = useState<string | null>(null)
  const [alertSearch, setAlertSearch] = useState('')
  const debouncedAlertSearch = useDebouncedValue(alertSearch)
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([])
  useEffect(() => {
    let active = true
    catalogApi.getCategories().then(rows => {
      const flatten = (items: typeof rows): { value: string; label: string }[] => items.flatMap(c => [{ value: c.id, label: c.name }, ...flatten(c.children ?? [])])
      if (active) setCategories(flatten(rows))
    }).catch(() => {})
    return () => { active = false }
  }, [])

  // ---- stock overview (one row per product) ----
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [stockFilter, setStockFilter] = useState('')
  const [page, setPage] = useState(1)
  const [summary, setSummary] = useState<Paged<StockSummaryItem> | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<StockSummaryItem | null>(null)
  const [lotsByProduct, setLotsByProduct] = useState<Record<string, LotsState>>({})

  // ---- alerts ----
  const [alertType, setAlertType] = useState<'' | AlertType>('')
  const [withinDays, setWithinDays] = useState(String(EXPIRING_DAYS_DEFAULT))
  const [alertPage, setAlertPage] = useState(1)
  const [alerts, setAlerts] = useState<Paged<InventoryAlertItem> | null>(null)
  const [alertsLoading, setAlertsLoading] = useState(false)

  // ---- dialogs ----
  const [adjustment, setAdjustment] = useState<{ target: AdjustmentTarget; reason?: AdjustmentReason } | null>(null)
  const [expireOpen, setExpireOpen] = useState(false)
  const [expireBusy, setExpireBusy] = useState(false)
  const [lotToToggle, setLotToToggle] = useState<{ lot: StockLot; next: 'ACTIVE' | 'BLOCKED' } | null>(null)
  const [toggleBusy, setToggleBusy] = useState(false)

  const summaryRequest = useRef(0)
  const alertsRequest = useRef(0)

  const loadKpis = useCallback(async () => {
    const [valuation, expiring, expired, low, out] = await Promise.allSettled([
      canReadReports ? inventoryReportsApi.getValuation() : Promise.reject(new Error('Report permission required')),
      stockApi.getAlerts({ type: 'EXPIRING', withinDays: EXPIRING_DAYS_DEFAULT, pageSize: 1 }),
      stockApi.getAlerts({ type: 'EXPIRED', pageSize: 1 }),
      stockApi.getAlerts({ type: 'LOW_STOCK', pageSize: 1 }),
      stockApi.getAlerts({ type: 'OUT_OF_STOCK', pageSize: 1 }),
    ])
    setKpis({
      stockValue: valuation.status === 'fulfilled' ? valuation.value.totals.stockValue : null,
      expiredValue: valuation.status === 'fulfilled' ? valuation.value.totals.expiredValue : null,
      expiring: expiring.status === 'fulfilled' ? expiring.value.totalCount : null,
      expired: expired.status === 'fulfilled' ? expired.value.totalCount : null,
      lowStock: low.status === 'fulfilled' ? low.value.totalCount : null,
      outOfStock: out.status === 'fulfilled' ? out.value.totalCount : null,
    })
  }, [canReadReports])

  const loadSummary = useCallback(async () => {
    const id = ++summaryRequest.current
    setSummaryLoading(true)
    try {
      const res = await stockApi.getSummary({
        search: debouncedSearch.trim() || undefined,
        categoryId: category || undefined,
        hasSellableStock: stockFilter === 'sellable' ? true : stockFilter === 'unsellable' ? false : undefined,
        hasStock: stockFilter === 'physical' ? true : stockFilter === 'empty' ? false : undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      if (id === summaryRequest.current) setSummary(res)
    } catch (err) {
      if (id === summaryRequest.current) showToast(describeError(err, 'Không tải được tồn kho'), 'error')
    } finally {
      if (id === summaryRequest.current) setSummaryLoading(false)
    }
  }, [debouncedSearch, stockFilter, page, category, showToast])

  const loadAlerts = useCallback(async () => {
    const id = ++alertsRequest.current
    setAlertsLoading(true)
    try {
      const res = await stockApi.getAlerts({
        search: debouncedAlertSearch.trim() || undefined,
        categoryId: category || undefined,
        type: alertType || undefined,
        withinDays: Number(withinDays),
        page: alertPage,
        pageSize: PAGE_SIZE,
      })
      if (id === alertsRequest.current) setAlerts(res)
    } catch (err) {
      if (id === alertsRequest.current) showToast(describeError(err, 'Không tải được cảnh báo'), 'error')
    } finally {
      if (id === alertsRequest.current) setAlertsLoading(false)
    }
  }, [alertType, withinDays, alertPage, debouncedAlertSearch, category, showToast])

  const loadLots = useCallback(
    async (storeProductId: string, page = 1) => {
      const request = (lotsRequest.current[storeProductId] ?? 0) + 1
      lotsRequest.current[storeProductId] = request
      setLotsByProduct((prev) => ({ ...prev, [storeProductId]: { loading: true, items: prev[storeProductId]?.items ?? [], error: null, page, totalCount: prev[storeProductId]?.totalCount ?? 0, totalPages: prev[storeProductId]?.totalPages ?? 1 } }))
      try {
        let res = await stockApi.getLots({ storeProductId, page, pageSize: PAGE_SIZE })
        if (page > Math.max(1, res.totalPages)) res = await stockApi.getLots({ storeProductId, page: Math.max(1, res.totalPages), pageSize: PAGE_SIZE })
        if (lotsRequest.current[storeProductId] !== request) return
        setLotsByProduct((prev) => ({ ...prev, [storeProductId]: { loading: false, items: res.items, error: null, page: res.page, totalCount: res.totalCount, totalPages: Math.max(1, res.totalPages) } }))
      } catch (err) {
        if (lotsRequest.current[storeProductId] !== request) return
        setLotsByProduct((prev) => ({
          ...prev,
          [storeProductId]: { loading: false, items: [], error: describeError(err, 'Không tải được các lô'), page, totalCount: 0, totalPages: 1 },
        }))
      }
    },
    [],
  )

  useEffect(() => {
    loadKpis()
  }, [loadKpis])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (tab === 'alerts') loadAlerts()
  }, [tab, loadAlerts])

  const refreshAll = useCallback(() => {
    loadKpis()
    loadSummary()
    if (tab === 'alerts') loadAlerts()
    if (selectedProduct) loadLots(selectedProduct.storeProductId, lotsByProduct[selectedProduct.storeProductId]?.page ?? 1)
  }, [loadKpis, loadSummary, loadAlerts, loadLots, tab, selectedProduct, lotsByProduct])

  useRealtimeRefresh(['inventory'], refreshAll)

  const openProduct = (item: StockSummaryItem) => {
    setSelectedProduct(item)
    void loadLots(item.storeProductId)
  }

  const openAdjustmentForLot = (item: StockSummaryItem, lot: StockLot) => {
    setAdjustment({
      target: {
        lotId: lot.id,
        sku: item.sku,
        productName: item.productName,
        lotNumber: lot.lotNumber,
        baseUnit: item.baseUnit,
        onHand: lot.quantityOnHand,
        reserved: lot.quantityReserved,
        averageUnitCost: lot.averageUnitCost,
      },
      reason: lot.isExpired || lot.status === 'EXPIRED' ? 'EXPIRED' : undefined,
    })
  }

  /** From an alert row: the alert lacks the base unit and the average cost, so read them before opening the dialog. */
  const openAdjustmentForAlert = async (alert: InventoryAlertItem) => {
    if (!alert.inventoryLotId) return
    try {
      const [lots, products] = await Promise.all([
        stockApi.getLots({ storeProductId: alert.storeProductId, pageSize: 100 }),
        stockApi.getSummary({ search: alert.sku, pageSize: 20 }),
      ])
      const lot = lots.items.find((l) => l.id === alert.inventoryLotId)
      const product = products.items.find((p) => p.storeProductId === alert.storeProductId)
      if (!lot || !product) {
        showToast('Không tìm thấy lô này nữa, hãy tải lại danh sách', 'warning')
        return
      }
      openAdjustmentForLot(product, lot)
    } catch (err) {
      showToast(describeError(err, 'Không mở được hộp thoại điều chỉnh'), 'error')
    }
  }

  const confirmExpireDue = async () => {
    setExpireBusy(true)
    try {
      const res = await stockApi.expireDue()
      showToast(
        res.expiredLotCount === 0 ? 'Không có lô nào cần đánh dấu hết hạn' : `Đã đánh dấu ${res.expiredLotCount} lô hết hạn`,
        res.expiredLotCount === 0 ? 'info' : 'success',
      )
      setExpireOpen(false)
      refreshAll()
    } catch (err) {
      showToast(describeError(err, 'Không đánh dấu được lô hết hạn'), 'error')
    } finally {
      setExpireBusy(false)
    }
  }

  const confirmToggleLot = async () => {
    if (!lotToToggle) return
    setToggleBusy(true)
    try {
      await stockApi.changeLotStatus(lotToToggle.lot.id, lotToToggle.next)
      showToast(lotToToggle.next === 'BLOCKED' ? 'Đã khóa lô, lô này không được bán' : 'Đã mở khóa lô', 'success')
      setLotToToggle(null)
      refreshAll()
    } catch (err) {
      showToast(describeError(err, 'Không đổi được trạng thái lô'), 'error')
    } finally {
      setToggleBusy(false)
    }
  }

  const goToAlerts = (type: '' | AlertType) => {
    setAlertType(type)
    setAlertPage(1)
    setTab('alerts')
  }

  const summaryItems = summary?.items ?? []
  const alertItems = alerts?.items ?? []

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      {/* KPIs */}
      <section aria-label="Tổng hợp tồn kho" className="agrisage-summary-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <button type="button" className="text-left" onClick={() => goToAlerts('OUT_OF_STOCK')}><KpiCard title="Hết hàng để bán" value={kpis.outOfStock ?? '—'} subtitle="Không còn hàng hợp lệ chưa giữ cho đơn" /></button>
        <KpiCard
          title="Giá trị tồn kho"
          value={kpis.stockValue === null ? '—' : formatVnd(kpis.stockValue)}
          subtitle={canReadReports ? 'Theo giá vốn bình quân' : 'Cần quyền xem báo cáo'}
        />
        <button type="button" className="text-left" onClick={() => goToAlerts('EXPIRING')}>
          <KpiCard
            title={`Sắp hết hạn (${EXPIRING_DAYS_DEFAULT} ngày)`}
            value={kpis.expiring ?? '—'}
            valueSuffix={<span className="text-sm text-slate-500">lô</span>}
            subtitle="Bấm để xem danh sách"
            className="border-slate-200 hover:border-amber-300 transition-colors"
          />
        </button>
        <button type="button" className="text-left" onClick={() => goToAlerts('EXPIRED')}>
          <KpiCard
            title="Hết hạn còn tồn"
            value={kpis.expired ?? '—'}
            valueClassName={kpis.expired ? 'text-rose-600' : 'text-slate-900'}
            valueSuffix={<span className="text-sm text-slate-500">lô</span>}
            subtitle={kpis.expired === null ? 'Chưa có số liệu cảnh báo' : kpis.expired === 0 ? 'Không có hàng hết hạn' : kpis.expiredValue !== null ? `Giá trị ${formatVnd(kpis.expiredValue)}, cần xuất hủy` : 'Cần kiểm tra lô và xuất hủy'}
            className="border-slate-200 hover:border-rose-300 transition-colors"
          />
        </button>
        <button type="button" className="text-left" onClick={() => goToAlerts('LOW_STOCK')}>
          <KpiCard
            title="Sắp hết hàng"
            value={kpis.lowStock ?? '—'}
            valueSuffix={<span className="text-sm text-slate-500">sản phẩm</span>}
            subtitle="Dưới mức tồn tối thiểu"
            className="border-slate-200 hover:border-orange-300 transition-colors"
          />
        </button>
      </section>

      {/* Tabs + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm" role="tablist">
          {(
            [
              ['summary', 'Tồn theo sản phẩm'],
              ['alerts', 'Cảnh báo'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === value ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
              {value === 'alerts' && (kpis.expiring || kpis.expired || kpis.lowStock || kpis.outOfStock) ? (
                <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold">
                  {(kpis.expiring ?? 0) + (kpis.expired ?? 0) + (kpis.lowStock ?? 0) + (kpis.outOfStock ?? 0)}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {has('REPLENISHMENT.READ') && <Link to="/agent/inventory/replenishment" className="px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 bg-white text-sm font-medium">Kế hoạch nhập hàng</Link>}
          <Link
            to="/agent/inventory/movements"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm"
          >
            <History size={16} /> Biến động kho
          </Link>
          <PermissionAction codes={["INVENTORY.EXPIRE_DUE_LOTS"]}><button
            type="button"
            onClick={() => setExpireOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-sm font-medium shadow-sm"
          >
            <CalendarClock size={16} /> Đánh dấu lô hết hạn
          </button></PermissionAction>
        </div>
      </div>

      {tab === 'summary' ? (
        <section aria-label="Tồn theo sản phẩm">
          <ListToolbar search={{ value: search, onChange: (v) => {
                setSearch(v)
                setPage(1)
              }, placeholder: "Tìm theo mã hoặc tên sản phẩm..." }} onClear={() => { setSearch(''); setStockFilter(''); setCategory(''); setPage(1); setAlertPage(1) }}>
<FilterSelect label="Nhóm hàng" value={category} onChange={v => { setCategory(v); setPage(1); setAlertPage(1) }} options={[{ value: '', label: 'Tất cả nhóm hàng' }, ...categories]} />
<FilterSelect
              label="Tình trạng tồn kho"
              value={stockFilter}
              onChange={(v) => {
                setStockFilter(v)
                setPage(1)
              }}
              options={[
                { value: '', label: 'Tất cả tồn kho' },
                { value: 'sellable', label: 'Còn hàng để bán' },
                { value: 'unsellable', label: 'Hết hàng để bán' },
                { value: 'physical', label: 'Còn tồn thực tế' },
                { value: 'empty', label: 'Không còn tồn thực tế' },
              ]}
            />
      </ListToolbar>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                  <tr>

                    <th className="py-3 px-3 font-medium">Sản phẩm</th>
                    <th className="py-3 px-3 font-medium text-right">Tồn thực tế</th>
                    <th className="py-3 px-3 font-medium text-right">Đã giữ</th>
                    <th className="py-3 px-3 font-medium text-right">Bán được</th>
                    <th className="py-3 px-3 font-medium text-right">Giá trị</th>
                    <th className="py-3 px-3 font-medium text-center">Hạn gần nhất</th>
                    <th className="py-3 px-3 font-medium text-center">Số lô</th>
                    <th className="py-3 px-4 font-medium text-center">Trạng thái</th>
                  <th scope="col" className="py-3 px-4 w-16 text-right font-medium">Thao tác</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50 text-sm">
                  {summaryLoading && summaryItems.length === 0 ? (
                    <EmptyTableRow colSpan={9} message="Đang tải tồn kho..." className="text-slate-500 animate-pulse" />
                  ) : summaryItems.length === 0 ? (
                    <EmptyTableRow colSpan={9} message="Không có sản phẩm nào phù hợp." />
                  ) : (
                    summaryItems.map((item) => {
                      const nearest = daysUntil(item.nearestExpiryDate)
                      return (

                          <tr
                            key={item.storeProductId}
                            className="hover:bg-surface-container-low transition-colors cursor-pointer"
                            onClick={() => openProduct(item)}
                          >

                            <td className="py-3 px-3">
                              <div className="font-medium text-on-surface">{item.productName}</div>
                              <div className="font-mono text-xs text-on-surface-variant">{item.sku}</div>
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-semibold whitespace-nowrap">{formatQtyUnit(item.onHandBaseQuantity, item.baseUnit)}</td>
                            <td className="py-3 px-3 text-right tabular-nums text-amber-700">{formatQty(item.reservedBaseQuantity)}</td>
                            <td className="py-3 px-3 text-right tabular-nums text-emerald-700 font-semibold">
                              {formatQty(item.sellableAvailableBaseQuantity)}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(item.stockValue)}</td>
                            <td className="py-3 px-3 text-center">
                              {item.nearestExpiryDate ? (
                                <div>
                                  <div>{formatDate(item.nearestExpiryDate)}</div>
                                  {nearest !== null && nearest <= EXPIRING_DAYS_DEFAULT ? (
                                    <div className="text-[11px] font-medium text-amber-700">{expiryLabel(nearest)}</div>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-slate-400">Không có hạn</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center tabular-nums">{item.lotCount}</td>
                            <td className="py-3 px-4 text-center">
                              {item.sellableAvailableBaseQuantity <= 0 ? (
                                <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide whitespace-nowrap">Hết hàng</span>
                              ) : item.isLowStock ? (
                                <span className="bg-orange-100 text-orange-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide whitespace-nowrap">
                                  Sắp hết (tối thiểu {formatQty(item.minStockLevelBase ?? 0)})
                                </span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide whitespace-nowrap">Còn hàng</span>
                              )}
                            </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap"><RowActionsMenu triggerLabel={`Thao tác tồn kho ${item.productName}`} actions={[{ label: 'Xem chi tiết', icon: 'visibility', onClick: () => openProduct(item) }, { label: 'Cấu hình nhập hàng', icon: 'settings', permissionCodes: ['STORE_PRODUCTS.UPDATE'], onClick: () => { setSelectedProduct(null); setPlanningSettings(item.storeProductId) } }]} /></td>
                </tr>

                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={summary?.totalPages ?? 1}
              startIndex={(page - 1) * PAGE_SIZE}
              endIndex={Math.min(page * PAGE_SIZE, summary?.totalCount ?? 0)}
              totalCount={summary?.totalCount ?? 0}
              unitLabel="sản phẩm"
              goPrev={() => setPage((p) => Math.max(1, p - 1))}
              goNext={() => setPage((p) => Math.min(summary?.totalPages ?? 1, p + 1))}
              setPage={setPage}
            />
          </div>
        </section>
      ) : (
        <section aria-label="Cảnh báo kho">
          <ListToolbar search={{ value: alertSearch, onChange: v => { setAlertSearch(v); setAlertPage(1) }, placeholder: 'Tìm theo mã hoặc tên sản phẩm...' }} onClear={() => { setAlertSearch(''); setAlertType(''); setCategory(''); setPage(1); setWithinDays(String(EXPIRING_DAYS_DEFAULT)); setAlertPage(1) }}>
<FilterSelect label="Nhóm hàng" value={category} onChange={v => { setCategory(v); setPage(1); setAlertPage(1) }} options={[{ value: '', label: 'Tất cả nhóm hàng' }, ...categories]} />
<FilterSelect
              label="Loại cảnh báo kho"
              value={alertType}
              onChange={(v) => {
                setAlertType(v as '' | AlertType)
                setAlertPage(1)
              }}
              options={[
                { value: '', label: 'Tất cả cảnh báo' },
                { value: 'EXPIRING', label: ALERT_LABEL.EXPIRING },
                { value: 'EXPIRED', label: ALERT_LABEL.EXPIRED },
                { value: 'LOW_STOCK', label: ALERT_LABEL.LOW_STOCK },
                { value: 'OUT_OF_STOCK', label: ALERT_LABEL.OUT_OF_STOCK },
              ]}
            />
{alertType !== 'EXPIRED' && alertType !== 'LOW_STOCK' && alertType !== 'OUT_OF_STOCK' ? (
              <FilterSelect
                label="Thời gian sắp hết hạn"
                value={withinDays}
                onChange={(v) => {
                  setWithinDays(v)
                  setAlertPage(1)
                }}
                options={[
                  { value: '7', label: 'Hết hạn trong 7 ngày' },
                  { value: '15', label: 'Hết hạn trong 15 ngày' },
                  { value: '30', label: 'Hết hạn trong 30 ngày' },
                  { value: '60', label: 'Hết hạn trong 60 ngày' },
                  { value: '90', label: 'Hết hạn trong 90 ngày' },
                ]}
              />
            ) : null}
      </ListToolbar>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="py-3 px-4 font-medium">Cảnh báo</th>
                    <th className="py-3 px-3 font-medium">Sản phẩm</th>
                    <th className="py-3 px-3 font-medium">Số lô</th>
                    <th className="py-3 px-3 font-medium text-center">Hạn dùng</th>
                    <th className="py-3 px-3 font-medium text-right">Tồn</th>
                    <th className="py-3 px-3 font-medium text-right">Đã giữ</th>
                    <th className="py-3 px-3 font-medium text-right">Tối thiểu</th>
                    <th className="py-3 px-4 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50 text-sm">
                  {alertsLoading && alertItems.length === 0 ? (
                    <EmptyTableRow colSpan={8} message="Đang tải cảnh báo..." className="text-slate-500 animate-pulse" />
                  ) : alertItems.length === 0 ? (
                    <EmptyTableRow colSpan={8} message="Không có cảnh báo nào." />
                  ) : (
                    alertItems.map((a, i) => (
                      <tr key={`${a.type}-${a.inventoryLotId ?? a.storeProductId}-${i}`} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${ALERT_BADGE_CLASS[a.type]}`}>
                            {ALERT_LABEL[a.type]}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-on-surface">{a.productName}</div>
                          <div className="font-mono text-xs text-on-surface-variant">{a.sku}</div>
                        </td>
                        <td className="py-3 px-3 font-mono">{a.lotNumber ?? '-'}</td>
                        <td className="py-3 px-3 text-center">
                          {a.expiryDate ? (
                            <div>
                              <div>{formatDate(a.expiryDate)}</div>
                              <div className={`text-[11px] font-medium ${(a.daysToExpiry ?? 0) < 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                                {expiryLabel(a.daysToExpiry)}
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-semibold">{formatQty(a.onHandBaseQuantity)}</td>
                        <td className="py-3 px-3 text-right tabular-nums text-amber-700">{formatQty(a.reservedBaseQuantity)}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{a.minStockLevelBase === null ? '-' : formatQty(a.minStockLevelBase)}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {a.inventoryLotId ? <RowActionsMenu triggerLabel={`Thao tác cảnh báo ${a.productName}`} actions={[
                            { label: a.type === 'EXPIRED' ? 'Xuất hủy' : 'Điều chỉnh kho', icon: 'inventory_2', permissionCodes: ['STOCK_ADJUSTMENTS.CREATE'], onClick: () => { void openAdjustmentForAlert(a) } },
                          ]} /> : <span className="text-xs text-slate-500">Cần nhập thêm</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={alertPage}
              totalPages={alerts?.totalPages ?? 1}
              startIndex={(alertPage - 1) * PAGE_SIZE}
              endIndex={Math.min(alertPage * PAGE_SIZE, alerts?.totalCount ?? 0)}
              totalCount={alerts?.totalCount ?? 0}
              unitLabel="cảnh báo"
              goPrev={() => setAlertPage((p) => Math.max(1, p - 1))}
              goNext={() => setAlertPage((p) => Math.min(alerts?.totalPages ?? 1, p + 1))}
              setPage={setAlertPage}
            />
          </div>
        </section>
      )}

      {selectedProduct && (() => {
        const item = summaryItems.find(row => row.storeProductId === selectedProduct.storeProductId) ?? selectedProduct
        const lots = lotsByProduct[item.storeProductId]
        return <DetailModal open title={`Tồn kho — ${item.productName}`} onClose={() => setSelectedProduct(null)} widthClassName="max-w-4xl">
          <ModalLayout header={<div><h2>{item.productName}</h2><p className="mt-1 text-sm text-slate-500">{item.sku} · Tồn thực tế {formatQtyUnit(item.onHandBaseQuantity, item.baseUnit)}</p></div>}>
            {has('STORE_PRODUCTS.UPDATE') && <button className="text-sm font-medium text-emerald-700" onClick={() => { setSelectedProduct(null); setPlanningSettings(item.storeProductId) }}>Cấu hình nhập hàng</button>}
            <div className="rounded-lg border border-outline-variant overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-container-low px-4 py-2 border-b border-outline-variant">
                <span className="text-sm font-semibold text-on-surface">
                  Các lô của {item.productName} (đơn vị: {unitLabel(item.baseUnit)})
                </span>
                <Link
                  to={`/agent/inventory/stock-card?storeProductId=${item.storeProductId}`}
                  onClick={() => setSelectedProduct(null)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Xem thẻ kho <ChevronsRight size={16} />
                </Link>
              </div>
              <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left">
                <thead className="text-[11px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                  <tr>
                    <th className="py-2 px-4 font-medium">Số lô</th>
                    <th className="py-2 px-3 font-medium text-center">Trạng thái</th>
                    <th className="py-2 px-3 font-medium text-center">Hạn dùng</th>
                    <th className="py-2 px-3 font-medium text-right">Tồn</th>
                    <th className="py-2 px-3 font-medium text-right">Đã giữ</th>
                    <th className="py-2 px-3 font-medium text-right">Khả dụng</th>
                    <th className="py-2 px-3 font-medium text-right">Giá vốn BQ</th>
                    <th className="py-2 px-3 font-medium text-right">Giá trị</th>
                    <th className="py-2 px-4 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50 text-sm">
                  {lots?.loading && lots.items.length === 0 ? (
                    <EmptyTableRow colSpan={9} message="Đang tải các lô..." className="text-slate-500 animate-pulse" />
                  ) : lots?.error ? (
                    <EmptyTableRow colSpan={9} message={lots.error} className="text-rose-600" />
                  ) : !lots || lots.items.length === 0 ? (
                    <EmptyTableRow colSpan={9} message="Sản phẩm này chưa có lô nào." />
                  ) : (
                    lots.items.map((lot) => {
                      const days = daysUntil(lot.expiryDate)
                      const canBlock = lot.status === 'ACTIVE'
                      const canUnblock = lot.status === 'BLOCKED' || lot.status === 'QUARANTINED'
                      return (
                        <tr key={lot.id}>
                          <td className="py-2.5 px-4 font-mono">{lot.lotNumber ?? 'Không có'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${LOT_STATUS_BADGE_CLASS[lot.status]}`}>
                              {LOT_STATUS_LABEL[lot.status]}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {lot.expiryDate ? (
                              <div>
                                <div>{formatDate(lot.expiryDate)}</div>
                                {days !== null && days <= EXPIRING_DAYS_DEFAULT ? (
                                  <div className={`text-[11px] font-medium ${days < 0 ? 'text-rose-600' : 'text-amber-700'}`}>{expiryLabel(days)}</div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-slate-400">Không có hạn</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{formatQty(lot.quantityOnHand)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-amber-700">{formatQty(lot.quantityReserved)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{formatQty(lot.quantityAvailable)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {lot.averageUnitCost === null ? '-' : formatVnd(lot.averageUnitCost)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(lot.totalCostValue)}</td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap"><RowActionsMenu triggerLabel={`Thao tác lô ${lot.lotNumber ?? item.productName}`} actions={[
                            { label: 'Điều chỉnh kho', icon: 'inventory_2', permissionCodes: ['STOCK_ADJUSTMENTS.CREATE'], onClick: () => openAdjustmentForLot(item, lot) },
                            ...(canBlock ? [{ label: 'Khóa lô', icon: 'lock', permissionCodes: ['INVENTORY.CHANGE_LOT_STATUS'], onClick: () => setLotToToggle({ lot, next: 'BLOCKED' }) }] : []),
                            ...(canUnblock ? [{ label: 'Mở khóa lô', icon: 'lock_open', permissionCodes: ['INVENTORY.CHANGE_LOT_STATUS'], onClick: () => setLotToToggle({ lot, next: 'ACTIVE' }) }] : []),
                          ]} /></td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table></div>
            </div>
            {lots && !lots.loading && !lots.error && <ServerPagination page={lots.page} pageSize={PAGE_SIZE} totalCount={lots.totalCount} totalPages={lots.totalPages} unitLabel="lô hàng" onPageChange={page => { void loadLots(item.storeProductId, page) }} />}
          </ModalLayout>
        </DetailModal>
      })()}

      <StockAdjustmentModal
        target={adjustment?.target ?? null}
        defaultReason={adjustment?.reason}
        onClose={() => setAdjustment(null)}
        onDone={() => {
          setAdjustment(null)
          refreshAll()
        }}
      />

      <PermissionAction codes={["INVENTORY.EXPIRE_DUE_LOTS"]}><ConfirmModal
        open={expireOpen}
        title="Đánh dấu các lô đã quá hạn"
        message="Mọi lô đang bán đã quá hạn dùng sẽ chuyển sang trạng thái Hết hạn trong một lần. Hệ thống vốn đã không bán lô quá hạn, thao tác này chỉ cập nhật trạng thái cho màn hình và báo cáo. Số tồn không thay đổi, hàng vẫn cần xuất hủy bằng phiếu điều chỉnh."
        confirmLabel="Đánh dấu"
        busy={expireBusy}
        onConfirm={confirmExpireDue}
        onClose={() => setExpireOpen(false)}
      /></PermissionAction>

      <PermissionAction codes={["INVENTORY.CHANGE_LOT_STATUS"]}><ConfirmModal
        open={lotToToggle !== null}
        title={lotToToggle?.next === 'BLOCKED' ? 'Khóa lô hàng' : 'Mở khóa lô hàng'}
        message={
          lotToToggle?.next === 'BLOCKED'
            ? `Lô ${lotToToggle.lot.lotNumber ?? ''} sẽ không được giữ hàng hay bán cho đến khi mở khóa.`
            : `Lô ${lotToToggle?.lot.lotNumber ?? ''} sẽ được bán trở lại (nếu chưa hết hạn).`
        }
        confirmLabel={lotToToggle?.next === 'BLOCKED' ? 'Khóa lô' : 'Mở khóa'}
        tone={lotToToggle?.next === 'BLOCKED' ? 'danger' : 'primary'}
        busy={toggleBusy}
        onConfirm={confirmToggleLot}
        onClose={() => setLotToToggle(null)}
      /></PermissionAction>
      {planningSettings && <PlanningSettingsModal id={planningSettings} onClose={() => setPlanningSettings(null)} onSaved={() => { setPlanningSettings(null); refreshAll() }} />}
    </div>
  )
}
