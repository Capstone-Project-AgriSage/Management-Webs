import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Download, Plus, Receipt, Clock, PackageCheck, CheckCircle, FilterX, Phone, StickyNote, Pencil, ArrowRight } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import type { RowAction } from '@/components/ui/RowActionsMenu'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import DetailModal from '@/components/ui/DetailModal'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatVnd } from '@/utils/money'
import { downloadCsv } from '@/utils/csv'
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import { ordersApi } from '@/api/ordersApi'
import { paymentsApi } from '@/api/paymentsApi'
import type { OrderResponse, OrderStatus } from '@/api/types'
import type { OrderPaymentsSummary } from '@/api/paymentsApi'
import { deliveriesApi, type DeliveryListItem, type DeliveryResponse } from '@/api/deliveriesApi'
import { ApiError } from '@/api/client'
import { DELIVERY_STATUS_LABEL, formatDate, labelOf } from '@/utils/deliveryLabels'
import { useRoleBase } from '@/utils/creditLabels'
import OrderEditModal from './OrderEditModal'
import ConfirmOrderModal from './ConfirmOrderModal'
import PickupModal from './PickupModal'
/**
 * Made by staff at the counter. Orders from the farmer web or mobile app are paid through payOS or put on credit, so
 * staff do not collect cash for them. A screen rule only: the API still accepts a cash payment for any order.
 */
const isCounterOrder = (order: Pick<OrderResponse, 'source'>) => order.source === 'COUNTER'

const STATUS_MAP: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị',
  READY_FOR_FULFILLMENT: 'Sẵn sàng giao',
  PARTIALLY_FULFILLED: 'Giao một phần',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  PARTIALLY_CANCELLED: 'Hủy một phần',
}

const STATUS_OPTIONS: { label: string; value: OrderStatus | '' }[] = [
  { label: 'Tất cả trạng thái', value: '' },
  { label: 'Chờ xác nhận', value: 'PENDING_CONFIRMATION' },
  { label: 'Đã xác nhận', value: 'CONFIRMED' },
  { label: 'Đang chuẩn bị', value: 'PREPARING' },
  { label: 'Sẵn sàng giao', value: 'READY_FOR_FULFILLMENT' },
  { label: 'Giao một phần', value: 'PARTIALLY_FULFILLED' },
  { label: 'Hoàn thành', value: 'COMPLETED' },
  { label: 'Đã hủy', value: 'CANCELLED' },
  { label: 'Hủy một phần', value: 'PARTIALLY_CANCELLED' },
]

/** Payment state of a list row, derived from GET /api/orders/{id}/payments (the list itself has no payment fields). */
function paymentBadge(order: OrderResponse, p: OrderPaymentsSummary | undefined): { label: string; className: string } {
  if (!p) return { label: '…', className: 'bg-slate-50 text-slate-400 border-slate-200' }
  if (p.refunds?.some((r) => r.status === 'PENDING')) return { label: 'Cần hoàn tiền', className: 'bg-rose-50 text-rose-700 border-rose-200' }
  if (order.settlementType === 'CREDIT' && p.paidAmount === 0) return { label: 'Mua chịu', className: 'bg-violet-50 text-violet-700 border-violet-200' }
  if (p.paidAmount === 0) return { label: 'Chưa thanh toán', className: 'bg-rose-50 text-rose-700 border-rose-200' }
  if (p.paidAmount < p.orderTotal) return { label: 'Thanh toán 1 phần', className: 'bg-amber-50 text-amber-800 border-amber-200' }
  return { label: 'Đã thanh toán', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

const SOURCE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Tất cả nguồn', value: '' },
  { label: 'Tại quầy', value: 'COUNTER' },
  { label: 'Đơn Online (Web)', value: 'FARMER_WEB' },
  { label: 'Đơn Online (App)', value: 'FARMER_MOBILE' },
]

const STATUS_VISUALS: Record<OrderStatus, { className: string; dotClassName: string }> = {
  PENDING_CONFIRMATION: { className: 'bg-amber-100 text-amber-800 border-amber-300', dotClassName: 'bg-amber-600' },
  CONFIRMED: { className: 'bg-sky-100 text-sky-800 border-sky-300', dotClassName: 'bg-sky-600' },
  PREPARING: { className: 'bg-indigo-100 text-indigo-800 border-indigo-300', dotClassName: 'bg-indigo-600' },
  READY_FOR_FULFILLMENT: { className: 'bg-blue-100 text-blue-800 border-blue-300', dotClassName: 'bg-blue-600' },
  PARTIALLY_FULFILLED: { className: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300', dotClassName: 'bg-fuchsia-600' },
  COMPLETED: { className: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotClassName: 'bg-emerald-600' },
  CANCELLED: { className: 'bg-slate-100 text-slate-800 border-slate-300', dotClassName: 'bg-slate-500' },
  PARTIALLY_CANCELLED: { className: 'bg-slate-100 text-slate-800 border-slate-300', dotClassName: 'bg-slate-500' },
}

export default function OrdersPage() {
  usePageHeader({ title: 'Đơn hàng', subtitle: 'Quản lý các đơn hàng hệ thống' })
  // Shared by the store owner (/agent) and sales staff (/sales); links stay in the current role's area.
  const base = useRoleBase()

  const { showToast } = useToast()
  const navigate = useNavigate()

  const [orders, setOrders] = useState<OrderResponse[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [rowPayments, setRowPayments] = useState<Record<string, OrderPaymentsSummary>>({})
  const [isLoading, setIsLoading] = useState(true)
  const debouncedSearch = useDebouncedValue(search)
  const listRequest = useRef<AbortController | null>(null)

  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null)

  // Payment state
  const [paymentSummary, setPaymentSummary] = useState<OrderPaymentsSummary | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isPaying, setIsPaying] = useState(false)

  // Confirm (M5) and counter hand-over (M6) dialogs, and the optional preparing/ready steps
  const [confirmFor, setConfirmFor] = useState<OrderResponse | null>(null)
  const [pickupFor, setPickupFor] = useState<OrderResponse | null>(null)
  const [stepping, setStepping] = useState(false)

  // Cancel state
  const [cancelModal, setCancelModal] = useState<{ open: boolean; type: 'ORDER' | 'ITEM'; itemId?: string; title: string }>({ open: false, type: 'ORDER', title: '' })
  const [cancelReason, setCancelReason] = useState('')
  const [editingOrder, setEditingOrder] = useState<OrderResponse | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  // Delivery state
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false)
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<string, number>>({})
  const [isCreatingDelivery, setIsCreatingDelivery] = useState(false)
  const [orderDeliveries, setOrderDeliveries] = useState<DeliveryListItem[]>([])
  const [openDeliveryDetails, setOpenDeliveryDetails] = useState<DeliveryResponse[]>([])
  const [deliveryScheduledAt, setDeliveryScheduledAt] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')

  const fetchOrders = useCallback(async () => {
    listRequest.current?.abort()
    const controller = new AbortController()
    listRequest.current = controller
    setIsLoading(true)
    try {
      const res = await ordersApi.getOrders({
        page,
        pageSize: 10,
        search: debouncedSearch,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }, controller.signal)
      if (controller.signal.aborted) return
      setOrders(res.items)
      setRowPayments({})
      // One payments call per visible row (≤ page size), as FE_GUIDE_FLOW_1 §M9 suggests until the list carries it.
      void Promise.allSettled(res.items.map((o) => paymentsApi.getOrderPayments(o.id, controller.signal))).then((all) => {
        if (!controller.signal.aborted) setRowPayments(Object.fromEntries(all.flatMap((r, i) => (r.status === 'fulfilled' ? [[res.items[i].id, r.value]] : []))))
      })
      setTotalCount(res.totalCount)
      setTotalPages(res.totalPages)
    } catch (err: any) {
      if (!controller.signal.aborted) showToast(err.detail || 'Lỗi tải danh sách đơn hàng', 'error')
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [page, debouncedSearch, statusFilter, sourceFilter, fromDate, toDate, showToast])

  useEffect(() => {
    if (search !== debouncedSearch) { listRequest.current?.abort(); return }
    // Only typing is debounced; navigation and other filters load immediately.
    let active = true
    void Promise.resolve().then(() => { if (active) void fetchOrders() })
    return () => { active = false; listRequest.current?.abort() }
  }, [fetchOrders, search, debouncedSearch])

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setSourceFilter('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const handleOpenDetail = async (order: OrderResponse) => {
    // Show the dialog at once with the list summary, then load the full order (the list has no order lines).
    setSelectedOrder(order)
    setPaymentSummary(null)
    setOrderDeliveries([])
    if (order.fulfillmentType === 'DELIVERY') {
      deliveriesApi.getOrderDeliveries(order.id).then(setOrderDeliveries).catch(() => setOrderDeliveries([]))
    }
    try {
      const [full, summary] = await Promise.all([
        ordersApi.getById(order.id),
        paymentsApi.getOrderPayments(order.id),
      ])
      setSelectedOrder(full)
      setPaymentSummary(summary)
    } catch {
      showToast('Không thể tải chi tiết đơn hàng', 'error')
    }
  }

  // "?open=<orderId>" (e.g. from the counter screen right after creating an order) opens that order's detail.
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('open')
  useEffect(() => {
    if (!openId) return
    setSearchParams({}, { replace: true })
    ordersApi
      .getById(openId)
      .then(handleOpenDetail)
      .catch(() => showToast('Không tìm thấy đơn hàng', 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId])

  const handleExportOrders = () => {
    downloadCsv(
      `don-hang-${Date.now()}.csv`,
      orders?.map((o) => ({
        'Mã đơn': o.orderNumber,
        'Khách hàng': o.customerName,
        'SĐT': o.customerPhone || '',
        'Tổng tiền': formatVnd(o.totalAmount),
        'Trạng thái': STATUS_MAP[o.status],
        'Nguồn': o.source,
      }))
    )
    showToast(`Đã xuất Excel ${orders?.length || 0} đơn hàng`, 'success')
  }

  const buildActions = (order: OrderResponse): RowAction[] => {
    const actions: RowAction[] = [{ label: 'Xem chi tiết', icon: 'visibility', onClick: () => handleOpenDetail(order) }]
    return actions
  }

  const handleProcessPayment = async () => {
    if (!selectedOrder || !paymentSummary) return
    const amount = Number(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      showToast('Vui lòng nhập số tiền hợp lệ', 'error')
      return
    }
    if (amount > paymentSummary.remainingToPay) {
      showToast('Số tiền thu không được vượt quá số còn lại', 'error')
      return
    }

    setIsPaying(true)
    try {
      await paymentsApi.createCashPayment({
        paymentContext: 'ORDER_PAYMENT',
        orderId: selectedOrder.id,
        amount
      })
      showToast('Thu tiền thành công!', 'success')
      setIsPaymentModalOpen(false)
      setPaymentAmount('')
      // Tải lại payment summary
      const newSummary = await paymentsApi.getOrderPayments(selectedOrder.id)
      setPaymentSummary(newSummary)
    } catch (err: any) {
      showToast(err.detail || 'Lỗi thu tiền', 'error')
    } finally {
      setIsPaying(false)
    }
  }

  /** After an action on the open order: show the server's copy, reload its payments, refresh the list. */
  const refreshSelected = (order: OrderResponse) => {
    setSelectedOrder(order)
    paymentsApi.getOrderPayments(order.id).then(setPaymentSummary).catch(() => { })
    fetchOrders()
  }

  const runStep = async (action: () => Promise<OrderResponse>, success: string) => {
    setStepping(true)
    try {
      refreshSelected(await action())
      showToast(success, 'success')
    } catch (err: any) {
      showToast(err.detail || 'Không thực hiện được', 'error')
    } finally {
      setStepping(false)
    }
  }

  /** Packs of an order line still undelivered on other open deliveries — FE_GUIDE_FLOW_2 §Q2. */
  const plannedElsewhere = (orderItemId: string, conversion: number, deliveries = openDeliveryDetails) =>
    deliveries
      .filter((d) => d.status !== 'CANCELLED' && d.status !== 'DELIVERED')
      .flatMap((d) => d.items ?? [])
      .filter((i) => i.orderItemId === orderItemId)
      .reduce((sum, i) => sum + Math.ceil((i.remainingBaseQuantity ?? i.plannedBaseQuantity ?? 0) / conversion), 0)

  const availableToPlan = (item: OrderResponse['items'][number], deliveries = openDeliveryDetails) => {
    const conversion = item.conversionToBase || 1
    return Math.max(0, Math.floor(item.remainingBaseQuantity / conversion) - plannedElsewhere(item.id, conversion, deliveries))
  }

  const handleOpenDeliveryModal = async () => {
    if (!selectedOrder) return
    // Reload so a delivery created a moment ago (another tab, another staff) is counted.
    const list = await deliveriesApi.getOrderDeliveries(selectedOrder.id).catch(() => orderDeliveries)
    setOrderDeliveries(list)
    // The list has no lines: load the open deliveries to know what they still hold.
    const deliveries = await Promise.all(
      list.filter((d) => d.status !== 'CANCELLED' && d.status !== 'DELIVERED').map((d) => deliveriesApi.getDeliveryDetail(d.id)),
    ).catch(() => openDeliveryDetails)
    setOpenDeliveryDetails(deliveries)
    const initialQuantities: Record<string, number> = {}
    selectedOrder.items.forEach(item => {
      const free = availableToPlan(item, deliveries)
      if (free > 0) {
        initialQuantities[item.id] = free
      }
    })
    setDeliveryQuantities(initialQuantities)
    setDeliveryScheduledAt('')
    setDeliveryNote('')
    setIsDeliveryModalOpen(true)
  }

  const handleCreateDelivery = async () => {
    if (!selectedOrder) return
    const items = Object.entries(deliveryQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([orderItemId, plannedQuantity]) => ({
        orderItemId,
        plannedQuantity,
      }))

    if (items.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 sản phẩm để giao', 'error')
      return
    }

    setIsCreatingDelivery(true)
    try {
      const created = await deliveriesApi.create({
        orderId: selectedOrder.id,
        items,
        deliveryAddress: null,
        scheduledAt: deliveryScheduledAt ? new Date(deliveryScheduledAt).toISOString() : null,
        note: deliveryNote.trim() || null,
      })
      showToast(`Đã lập phiếu giao ${created.deliveryNumber}. Bấm "Phân công tài xế" để chọn tài xế.`, 'success')
      setIsDeliveryModalOpen(false)
      // Stay on the order so the new delivery shows up with its "Phân công tài xế" shortcut.
      deliveriesApi.getOrderDeliveries(selectedOrder.id).then(setOrderDeliveries).catch(() => { })
      fetchOrders()
    } catch (err) {
      // 422 errors are keyed by line ("items[i]"); name the product in the message.
      if (err instanceof ApiError && err.errors) {
        const [key, messages] = Object.entries(err.errors)[0] ?? []
        const index = key ? Number(/items\[(\d+)\]/.exec(key)?.[1]) : NaN
        const line = Number.isNaN(index) ? null : selectedOrder.items.find((i) => i.id === items[index]?.orderItemId)
        showToast(`${line ? line.productName + ': ' : ''}${messages?.[0] ?? err.message}`, 'error')
      } else {
        showToast(err instanceof Error ? err.message : 'Lỗi khi lập phiếu giao hàng', 'error')
      }
      deliveriesApi.getOrderDeliveries(selectedOrder.id).then(setOrderDeliveries).catch(() => { })
    } finally {
      setIsCreatingDelivery(false)
    }
  }

  const handleCancelSubmit = async () => {
    if (!selectedOrder) return
    if (!cancelReason.trim()) {
      showToast('Vui lòng nhập lý do hủy', 'error')
      return
    }
    setIsCancelling(true)
    try {
      if (cancelModal.type === 'ORDER') {
        await ordersApi.cancel(selectedOrder.id, { reason: cancelReason })
        showToast('Hủy đơn thành công', 'success')
      } else if (cancelModal.type === 'ITEM' && cancelModal.itemId) {
        await ordersApi.cancelRemainingItem(selectedOrder.id, cancelModal.itemId, { reason: cancelReason })
        showToast('Hủy phần còn lại của sản phẩm thành công', 'success')
      }
      setCancelModal({ open: false, type: 'ORDER', title: '' })
      setCancelReason('')
      // Tải lại đơn (trạng thái, số lượng còn lại) và payment summary để lấy thông tin hoàn tiền (nếu có)
      const [fullOrder, newSummary] = await Promise.all([
        ordersApi.getById(selectedOrder.id),
        paymentsApi.getOrderPayments(selectedOrder.id),
      ])
      setSelectedOrder(fullOrder)
      setPaymentSummary(newSummary)
      // Tạm đóng modal chi tiết hoặc load lại (đây load lại summary + list)
      fetchOrders()
    } catch (err: any) {
      showToast(err.detail || 'Lỗi khi hủy', 'error')
    } finally {
      setIsCancelling(false)
    }
  }

  // Tính trạng thái thanh toán tự động theo summary
  const getPaymentStatus = () => {
    if (!paymentSummary) return { label: 'Đang tải...', color: 'text-slate-500' }
    if (paymentSummary.paidAmount === 0) return { label: 'Chưa thanh toán', color: 'text-rose-600' }
    if (paymentSummary.paidAmount >= paymentSummary.orderTotal) return { label: 'Đã thanh toán đủ', color: 'text-emerald-600' }
    return { label: 'Thanh toán 1 phần', color: 'text-amber-600' }
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1 text-body-sm text-on-surface-variant" aria-label="Breadcrumb">
          <Link className="hover:text-primary transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-on-surface font-medium">Đơn hàng</span>
        </nav>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant text-on-surface text-sm font-medium rounded-lg hover:bg-surface-container-low transition-colors shadow-sm"
            type="button"
            onClick={handleExportOrders}
          >
            <Download size={16} className="text-on-surface-variant" />
            <span>Xuất Excel trang này</span>
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-on-primary text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            type="button"
            onClick={() => navigate(`${base}/counter-sales`)}
          >
            <Plus size={16} />
            <span>Soạn đơn tại quầy</span>
          </button>
        </div>
      </div>

      <BusinessReportCards kind="orders" fromDate={fromDate} toDate={toDate} onFromDateChange={value => { setFromDate(value); setPage(1) }} onToDateChange={value => { setToDate(value); setPage(1) }} searchResult={{ count: totalCount, unit: 'đơn hàng' }} />

      <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm flex flex-wrap items-center justify-between gap-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput
            value={search}
            onChange={(val) => { setSearch(val); setPage(1) }}
            placeholder="Tìm theo mã đơn, SĐT..."
            className="relative flex-1 min-w-[240px]"
          />
          <div className="relative min-w-[180px]">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as OrderStatus | ''); setPage(1) }}
              className="w-full h-10 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <ChevronRight size={16} className="text-on-surface-variant rotate-90" />
            </div>
          </div>

          <div className="relative min-w-[160px]">
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }}
              className="w-full h-10 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
            >
              {SOURCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <ChevronRight size={16} className="text-on-surface-variant rotate-90" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <input
              type="date"
              aria-label="Từ ngày"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
              className="h-10 px-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm"
            />
            <span>→</span>
            <input
              type="date"
              aria-label="Đến ngày"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => { setToDate(e.target.value); setPage(1) }}
              className="h-10 px-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm"
            />
          </div>

          <button
            className="h-9 px-3 text-on-surface-variant hover:text-on-surface text-xs font-medium flex items-center gap-1 transition-colors"
            onClick={handleClearFilters}
            type="button"
          >
            <FilterX size={14} />
            <span>Xóa bộ lọc</span>
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="overflow-x-auto">
          <table aria-busy={isLoading} className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface text-label-md font-bold bg-surface-container-low">
                <th className="py-4 pl-4 px-3 w-[220px]">Khách hàng</th>
                <th className="py-4 px-3 min-w-[200px]">Đơn hàng</th>
                <th className="py-4 px-3 text-center min-w-[130px]">Trạng thái</th>
                <th className="py-4 px-3 text-right min-w-[120px]">Tổng tiền</th>
                <th className="py-4 px-3 text-center min-w-[130px]">Thanh toán</th>
                <th className="py-4 pr-4 pl-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm text-on-surface">
              {isLoading && orders.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Đang tải dữ liệu..." />
              ) : !isLoading && orders.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không tìm thấy đơn hàng." />
              ) : null}
              {orders?.map((order) => {
                const isSelected = order.id === selectedOrder?.id
                const st = STATUS_VISUALS[order.status]
                return (
                  <tr
                    key={order.id}
                    onClick={() => handleOpenDetail(order)}
                    className={`transition-colors cursor-pointer group ${isSelected ? 'bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-surface-container-low'
                      }`}
                  >
                    <td className="py-4.5 pl-4 px-3">
                      <div className="font-bold text-sm text-on-surface">{order.customerName}</div>
                      {order.customerPhone && (
                        <div className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                          <Phone size={12} className="text-on-surface-variant" />
                          <span className="font-mono">{order.customerPhone}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4.5 px-3">
                      <div className="font-mono font-bold text-sm text-primary">{order.orderNumber}</div>
                      <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(order.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-4.5 px-3 text-center">
                      <StatusBadge label={STATUS_MAP[order.status]} className={st?.className} />
                    </td>
                    <td className="py-4.5 px-3 text-right font-mono font-bold text-on-surface">
                      {formatVnd(order.totalAmount)}
                    </td>
                    <td className="py-4.5 px-3 text-center">
                      {(() => {
                        const b = paymentBadge(order, rowPayments[order.id])
                        return <StatusBadge label={b.label} className={b.className} />
                      })()}
                    </td>
                    <td className="py-4.5 pr-4 pl-3 text-center">
                      <div className="flex items-center justify-center">
                        <RowActionsMenu
                          triggerLabel={`Thao tác đơn ${order.orderNumber}`}
                          actions={buildActions(order)}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          startIndex={(page - 1) * 10}
          endIndex={Math.min(page * 10, totalCount)}
          totalCount={totalCount}
          unitLabel="đơn"
          goPrev={() => setPage(p => Math.max(1, p - 1))}
          goNext={() => setPage(p => Math.min(totalPages, p + 1))}
          setPage={setPage}
        />
      </div>

      <DetailModal open={selectedOrder !== null} onClose={() => setSelectedOrder(null)}>
        {selectedOrder ? (
          <ModalLayout header={<div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-on-surface">#{selectedOrder.orderNumber}</span>
                <StatusBadge label={STATUS_MAP[selectedOrder.status]} className={STATUS_VISUALS[selectedOrder.status]?.className} />
              </div>
              <div className="text-label-sm text-on-surface-variant mt-1">Tạo lúc: {new Date(selectedOrder.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-on-surface-variant">Trạng thái thanh toán:</span>
              <span className={`font-bold ${getPaymentStatus().color}`}>{getPaymentStatus().label}</span>
            </div>

            {selectedOrder.status === 'PENDING_CONFIRMATION' && selectedOrder.items && (
              <PermissionAction codes={['ORDERS.UPDATE']}><button
                type="button"
                className="w-full h-10 mt-2 border border-outline-variant text-on-surface hover:bg-surface-container rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                onClick={() => setEditingOrder(selectedOrder)}
              >
                <Pencil size={15} /> SỬA ĐƠN (DÒNG HÀNG, GIÁ, GHI CHÚ)
              </button></PermissionAction>
            )}

            {/* Online orders (farmer web / mobile) are paid through payOS or put on credit: cash is only for counter orders. */}
            <div className={isCounterOrder(selectedOrder) ? 'grid grid-cols-2 gap-3 mt-2' : 'mt-2'}>
              {isCounterOrder(selectedOrder) && (
                <PermissionAction codes={['PAYMENTS.RECEIVE_CASH']}><button
                  className="w-full h-10 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg font-bold flex items-center justify-center transition-colors disabled:opacity-50"
                  disabled={!paymentSummary || paymentSummary.remainingToPay <= 0 || ['COMPLETED', 'CANCELLED', 'PARTIALLY_CANCELLED'].includes(selectedOrder.status)}
                  onClick={() => setIsPaymentModalOpen(true)}
                >
                  <Receipt size={16} className="mr-2" />
                  THU TIỀN TẠI QUẦY
                </button></PermissionAction>
              )}
              <PermissionAction codes={['ORDERS.CONFIRM']}><button
                className="w-full h-10 bg-primary text-on-primary hover:bg-primary/90 rounded-lg font-bold flex items-center justify-center transition-colors disabled:opacity-50"
                // A FULL_PAYMENT order is confirmed only once it is fully paid (server: "Payment does not cover the order total"); CREDIT orders are not.
                disabled={selectedOrder.status !== 'PENDING_CONFIRMATION' || (selectedOrder.settlementType === 'FULL_PAYMENT' && (!paymentSummary || paymentSummary.remainingToPay > 0))}
                title={selectedOrder.settlementType === 'FULL_PAYMENT' && (paymentSummary?.remainingToPay ?? 0) > 0 ? 'Đơn trả ngay: cần thu đủ tiền trước khi xác nhận' : undefined}
                onClick={() => setConfirmFor(selectedOrder)}
              >
                <CheckCircle size={16} className="mr-2" />
                XÁC NHẬN ĐƠN (M5)
              </button></PermissionAction>
            </div>
            <div className="text-xs text-center text-on-surface-variant mt-1">
              {selectedOrder.settlementType === 'CREDIT' ? '* Đơn mua chịu: xác nhận không cần thu tiền trước' : '* Chỉ có thể xác nhận đơn khi đã thu đủ tiền'}
            </div>

            {/* Optional tracking steps (FE_GUIDE_FLOW_1 §M5/§M9): skipping them does not block the hand-over. */}
            {['CONFIRMED', 'PREPARING'].includes(selectedOrder.status) && (
              <div className="grid grid-cols-2 gap-3">
                <PermissionAction codes={["ORDERS.START_PREPARING"]}><button
                  type="button"
                  className="h-9 rounded-lg border border-outline-variant text-sm font-semibold hover:bg-surface-container disabled:opacity-40"
                  disabled={stepping || selectedOrder.status !== 'CONFIRMED'}
                  onClick={() => runStep(() => ordersApi.startPreparing(selectedOrder.id), 'Đã chuyển sang Đang chuẩn bị')}
                >
                  Bắt đầu chuẩn bị
                </button></PermissionAction>
                <PermissionAction codes={["ORDERS.MARK_READY"]}><button
                  type="button"
                  className="h-9 rounded-lg border border-outline-variant text-sm font-semibold hover:bg-surface-container disabled:opacity-40"
                  disabled={stepping}
                  onClick={() => runStep(() => ordersApi.markReady(selectedOrder.id), 'Đơn đã sẵn sàng giao')}
                >
                  Sẵn sàng giao
                </button></PermissionAction>
              </div>
            )}

            {selectedOrder.status === 'PENDING_CONFIRMATION' && selectedOrder.settlementType === 'FULL_PAYMENT' && paymentSummary && paymentSummary.remainingToPay > 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {isCounterOrder(selectedOrder)
                  ? 'Đơn trả ngay chưa thanh toán đủ: chờ khách trả qua payOS hoặc thu tiền tại quầy rồi mới xác nhận được.'
                  : 'Đơn online trả ngay chưa thanh toán đủ: chờ khách thanh toán qua payOS rồi mới xác nhận được.'}
              </p>
            )}

            {['CONFIRMED', 'PREPARING', 'READY_FOR_FULFILLMENT', 'PARTIALLY_FULFILLED'].includes(selectedOrder.status) && selectedOrder.fulfillmentType === 'PICKUP' && (
              <PermissionAction codes={['ORDERS.PICKUP']}><button
                className="w-full h-10 mt-1 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-bold flex items-center justify-center transition-colors shadow-sm"
                onClick={() => setPickupFor(selectedOrder)}
              >
                <PackageCheck size={16} className="mr-2" />
                GIAO HÀNG TẠI QUẦY (M6)
              </button></PermissionAction>
            )}

            {selectedOrder.fulfillmentType === 'DELIVERY' && orderDeliveries.length > 0 && (
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Phiếu giao của đơn</div>
                <ul className="space-y-1">
                  {orderDeliveries.map((d) => {
                    // A draft or retry without a driver needs one; anything else is just opened to follow it.
                    const needsDriver = !d.assignedTo && (d.status === 'DRAFT' || d.status === 'RETRY_PENDING')
                    return (
                      <li key={d.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono">{d.deliveryNumber}</div>
                          <div className="text-xs text-on-surface-variant">
                            {labelOf(DELIVERY_STATUS_LABEL, d.status)}
                            {d.assignedTo ? ` · ${d.assignedTo.fullName}` : ''}
                            {d.scheduledAt ? ` · ${formatDate(d.scheduledAt)}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`${base}/deliveries?open=${d.id}`)}
                          className={`shrink-0 h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${needsDriver ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-outline-variant text-on-surface hover:bg-surface-container'
                            }`}
                        >
                          {needsDriver ? 'Phân công tài xế' : 'Mở phiếu giao'} <ArrowRight size={14} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {['CONFIRMED', 'PREPARING', 'READY_FOR_FULFILLMENT', 'PARTIALLY_FULFILLED'].includes(selectedOrder.status) && selectedOrder.fulfillmentType === 'DELIVERY' && (
              <PermissionAction codes={['DELIVERIES.CREATE']}><button
                className="w-full h-10 mt-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold flex items-center justify-center transition-colors shadow-sm"
                onClick={handleOpenDeliveryModal}
              >
                <PackageCheck size={16} className="mr-2" />
                LẬP PHIẾU GIAO HÀNG (M7)
              </button></PermissionAction>
            )}

            {['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY_FOR_FULFILLMENT'].includes(selectedOrder.status) && (
              <PermissionAction codes={["ORDERS.CANCEL"]}><button
                className="w-full h-10 mt-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg font-bold flex items-center justify-center transition-colors shadow-sm"
                onClick={() => setCancelModal({ open: true, type: 'ORDER', title: `Hủy toàn bộ đơn hàng #${selectedOrder.orderNumber}` })}
              >
                HỦY ĐƠN HÀNG (M8)
              </button></PermissionAction>
            )}

            {['COMPLETED', 'PARTIALLY_FULFILLED', 'PARTIALLY_CANCELLED'].includes(selectedOrder.status) && (
              <PermissionAction codes={['RETURNS.CREATE']}><button
                className="w-full h-10 mt-1 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-lg font-bold flex items-center justify-center transition-colors shadow-sm"
                onClick={() => navigate(`${base}/returns/new?orderId=${selectedOrder.id}`)}
              >
                TẠO YÊU CẦU TRẢ HÀNG
              </button></PermissionAction>
            )}
          </div>} bodyClassName="space-y-4"><div className="p-4 space-y-2 border-b border-outline-variant">
              <div>
                <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider block">Khách hàng</span>
                <div className="text-sm text-on-surface font-bold mt-1">{selectedOrder.customerName}</div>
                {selectedOrder.customerPhone && (
                  <div className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                    <Phone size={12} />
                    <span className="font-mono font-medium">{selectedOrder.customerPhone}</span>
                  </div>
                )}
              </div>
              {selectedOrder.note ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md p-2.5 text-xs text-amber-900 dark:text-amber-300 mt-3">
                  <div className="flex items-start gap-1.5">
                    <StickyNote size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Ghi chú:</span> {selectedOrder.note}
                    </div>
                  </div>
                </div>
              ) : null}
            </div><div className="p-4 space-y-2 border-b border-outline-variant">
              <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider block">Danh sách sản phẩm</span>
              <div className="space-y-3 pt-2 text-xs">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-on-surface">{item.productName}</p>
                        <p className="text-label-sm text-on-surface-variant font-mono mt-0.5">
                          {item.quantity} {item.packagingName} x {formatVnd(item.unitPrice)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-on-surface">{formatVnd(item.lineTotalAmount)}</span>
                    </div>
                    {item.remainingBaseQuantity > 0 && ['CONFIRMED', 'PREPARING', 'READY_FOR_FULFILLMENT', 'PARTIALLY_FULFILLED'].includes(selectedOrder.status) && (
                      <div className="flex justify-end">
                        <PermissionAction codes={["ORDERS.CANCEL_REMAINING"]}><button
                          className="text-rose-600 hover:text-rose-800 text-[11px] font-bold underline"
                          onClick={() => setCancelModal({ open: true, type: 'ITEM', itemId: item.id, title: `Hủy phần chưa giao của ${item.productName}` })}
                        >
                          Hủy phần còn lại ({item.remainingBaseQuantity} đơn vị cơ sở)
                        </button></PermissionAction>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-3 mt-3 border-t border-outline-variant flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-on-surface-variant">Tổng tiền đơn hàng:</span>
                  <span className="text-on-surface">{formatVnd(selectedOrder.totalAmount)}</span>
                </div>
                {paymentSummary ? (
                  <>
                    <div className="flex justify-between items-center text-sm font-medium">
                      <span className="text-on-surface-variant">Đã thu:</span>
                      <span className="text-emerald-600">{formatVnd(paymentSummary.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-on-surface-variant">Còn phải thu:</span>
                      <span className="text-rose-600">{formatVnd(paymentSummary.remainingToPay)}</span>
                    </div>

                    {/* Hiển thị hoàn tiền M8 */}
                    {paymentSummary.refunds && paymentSummary.refunds.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {paymentSummary.refunds?.map(rf => (
                          <div
                            key={rf.id}
                            className={`flex justify-between items-center text-sm font-bold p-2 rounded-lg border ${rf.status === 'PENDING' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                          >
                            <span>{rf.status === 'PENDING' ? 'Cần hoàn tiền mặt' : rf.status === 'COMPLETED' ? 'Đã hoàn tiền' : 'Khoản hoàn đã huỷ'} · {rf.refundNumber}</span>
                            <span>{formatVnd(rf.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-on-surface-variant animate-pulse">Đang tải thông tin thanh toán...</div>
                )}
              </div>
            </div>
          </ModalLayout>
        ) : null}
      </DetailModal>

      {/* Payment Modal */}
      {isPaymentModalOpen && paymentSummary && selectedOrder && (
        <DetailModal open onClose={() => setIsPaymentModalOpen(false)}>
          <ModalLayout header={<div className="space-y-1"><h3 className="font-bold text-lg text-on-surface">Thu tiền đơn #{selectedOrder.orderNumber}</h3></div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
            <PermissionAction codes={["PAYMENTS.RECEIVE_CASH"]}><button
              className="w-full h-12 bg-primary text-on-primary hover:bg-primary/90 font-bold rounded-xl transition-colors disabled:opacity-50"
              onClick={handleProcessPayment}
              disabled={isPaying || !paymentAmount}
            >
              {isPaying ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN THU TIỀN (TIỀN MẶT)'}
            </button></PermissionAction>
          </div>}>
            <div className="flex justify-between items-center bg-surface-container-lowest p-3 rounded-lg border border-outline-variant">
              <span className="text-sm font-medium text-on-surface-variant">Còn phải thu:</span>
              <span className="text-xl font-bold text-rose-600">{formatVnd(paymentSummary.remainingToPay)}</span>
            </div><div>
              <label className="block text-sm font-bold text-on-surface mb-2">Số tiền thu (VNĐ)</label>
              <input
                type="number"
                className="w-full h-12 px-4 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg font-mono font-bold"
                placeholder="Nhập số tiền..."
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div><div className="flex gap-2">
              <button
                className="flex-1 py-2 bg-surface-container-high hover:bg-surface-container-highest text-sm font-bold rounded-lg border border-outline-variant transition-colors text-on-surface"
                onClick={() => setPaymentAmount(paymentSummary.remainingToPay.toString())}
              >
                Thu hết số còn lại
              </button>
            </div>
          </ModalLayout>
        </DetailModal>
      )}

      <ConfirmOrderModal
        order={confirmFor}
        onClose={() => setConfirmFor(null)}
        onConfirmed={(order) => {
          setConfirmFor(null)
          showToast(order.settlementType === 'CREDIT' ? 'Đã xác nhận: giữ hàng và hạn mức của khách' : 'Đã xác nhận đơn và giữ hàng', 'success')
          refreshSelected(order)
        }}
      />

      <PickupModal
        order={pickupFor}
        onClose={() => setPickupFor(null)}
        onDone={(order) => {
          setPickupFor(null)
          showToast(order.status === 'COMPLETED' ? 'Đã giao đủ, đơn hoàn thành' : 'Đã giao một phần, phần còn lại giao sau hoặc huỷ', 'success')
          refreshSelected(order)
        }}
      />

      {/* Delivery Modal M7 */}
      {isDeliveryModalOpen && selectedOrder && (
        <DetailModal open onClose={() => setIsDeliveryModalOpen(false)}>
          <ModalLayout header={<div className="space-y-1"><h3 className="font-bold text-lg text-blue-900">Lập phiếu giao hàng #{selectedOrder.orderNumber}</h3></div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
            <button
              className="px-6 py-2 bg-surface-container-high hover:bg-surface-container-highest font-bold rounded-xl transition-colors text-on-surface"
              onClick={() => setIsDeliveryModalOpen(false)}
            >
              HỦY
            </button>
            <PermissionAction codes={["DELIVERIES.CREATE"]}><button
              className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              onClick={handleCreateDelivery}
              disabled={isCreatingDelivery || Object.values(deliveryQuantities).every(q => q === 0)}
            >
              {isCreatingDelivery ? 'ĐANG XỬ LÝ...' : 'LẬP PHIẾU GIAO'}
            </button></PermissionAction>
          </div>}>
            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4">
              Điền số lượng (theo quy cách) cho chuyến này. Lô hàng được chọn sẵn theo hạn dùng; có thể đổi lô trong chi tiết phiếu giao.
            </div><div className="bg-surface rounded-lg overflow-hidden border border-outline-variant text-sm">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-xs text-on-surface-variant">
                  <tr>
                    <th className="p-3 font-medium">Sản phẩm</th>
                    <th className="p-3 font-medium text-right">Cần giao</th>
                    <th className="p-3 font-medium text-right text-blue-600 w-32">SL lập phiếu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {selectedOrder.items?.filter(i => availableToPlan(i) > 0).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-on-surface-variant italic text-xs">
                        Mọi sản phẩm còn lại đã nằm trên các phiếu giao khác
                      </td>
                    </tr>
                  ) : (
                    selectedOrder.items?.filter(i => availableToPlan(i) > 0).map((item) => {
                      const maxPlanned = availableToPlan(item)
                      return (
                        <tr key={item.id}>
                          <td className="p-3">
                            <div className="font-bold">{item.productName}</div>
                            <div className="text-xs text-on-surface-variant mt-0.5">
                              {item.packagingName}
                            </div>
                          </td>
                          <td className="p-3 text-right font-medium">{maxPlanned}</td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              min="0"
                              max={maxPlanned}
                              value={deliveryQuantities[item.id] ?? 0}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0
                                setDeliveryQuantities(prev => ({ ...prev, [item.id]: Math.min(Math.max(val, 0), maxPlanned) }))
                              }}
                              className="w-full h-9 px-2 text-right rounded-lg border border-outline-variant focus:outline-none focus:border-blue-500 font-bold text-blue-600"
                            />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-medium text-on-surface-variant block mb-1">Hẹn giao lúc</span>
                <input
                  type="datetime-local"
                  value={deliveryScheduledAt}
                  onChange={(e) => setDeliveryScheduledAt(e.target.value)}
                  className="w-full h-9 px-2 rounded-lg border border-outline-variant focus:outline-none focus:border-blue-500"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-on-surface-variant block mb-1">Ghi chú cho tài xế</span>
                <input
                  type="text"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="VD: Gọi trước 15 phút"
                  className="w-full h-9 px-2 rounded-lg border border-outline-variant focus:outline-none focus:border-blue-500"
                />
              </label>
            </div>
          </ModalLayout>
        </DetailModal>
      )}

      {/* Cancel Modal M8 */}
      {cancelModal.open && selectedOrder && (
        <DetailModal open onClose={() => setCancelModal({ open: false, type: 'ORDER', title: '' })}>
          <ModalLayout header={<div className="space-y-1"><h3 className="font-bold text-lg text-rose-900">{cancelModal.title}</h3></div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
            <button
              className="px-6 py-2 bg-surface-container-high hover:bg-surface-container-highest font-bold rounded-xl transition-colors text-on-surface"
              onClick={() => setCancelModal({ open: false, type: 'ORDER', title: '' })}
            >
              ĐÓNG
            </button>
            <PermissionAction codes={[cancelModal.type === 'ORDER' ? 'ORDERS.CANCEL' : 'ORDERS.CANCEL_REMAINING']}><button
              className="px-6 py-2 bg-rose-600 text-white hover:bg-rose-700 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              onClick={handleCancelSubmit}
              disabled={isCancelling || !cancelReason.trim()}
            >
              {isCancelling ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN HỦY'}
            </button></PermissionAction>
          </div>}>
            <div className="text-sm text-on-surface-variant">
              Vui lòng nhập lý do hủy. Hành động này không thể hoàn tác. Nếu đã thu tiền, hệ thống sẽ tự động tạo khoản cần hoàn.
            </div><div>
              <label className="block text-sm font-bold text-on-surface mb-2">Lý do hủy <span className="text-rose-600">*</span></label>
              <textarea
                className="w-full h-24 p-3 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm resize-none"
                placeholder="Nhập lý do hủy (tối đa 1000 ký tự)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                maxLength={1000}
              />
            </div>
          </ModalLayout>
        </DetailModal>
      )}

      <OrderEditModal
        order={editingOrder}
        onClose={() => {
          setEditingOrder(null)
          fetchOrders()
        }}
        onChanged={(order) => {
          // Lines and total changed: refresh the detail and its payment summary (remaining to pay).
          setEditingOrder(order)
          setSelectedOrder(order)
          paymentsApi.getOrderPayments(order.id).then(setPaymentSummary).catch(() => { })
        }}
      />
    </div>
  )
}
