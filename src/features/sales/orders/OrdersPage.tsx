import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Download, Plus, Receipt, Clock, PackageCheck, CheckCircle, FilterX, Phone, StickyNote } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import type { RowAction } from '@/components/ui/RowActionsMenu'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import DetailModal from '@/components/ui/DetailModal'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatVnd } from '@/utils/money'
import { downloadCsv } from '@/utils/csv'
import KpiCard from '@/components/ui/KpiCard'
import { ordersApi } from '@/api/ordersApi'
import { paymentsApi } from '@/api/paymentsApi'
import type { OrderResponse, OrderStatus } from '@/api/types'
import type { FefoSuggestionResponse } from '@/api/ordersApi'
import type { OrderPaymentsSummary } from '@/api/paymentsApi'
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

  const { showToast } = useToast()
  const navigate = useNavigate()

  const [orders, setOrders] = useState<OrderResponse[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('')
  const [isLoading, setIsLoading] = useState(false)

  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null)
  
  // Payment state
  const [paymentSummary, setPaymentSummary] = useState<OrderPaymentsSummary | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isPaying, setIsPaying] = useState(false)

  // Confirm state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [fefoSuggestions, setFefoSuggestions] = useState<FefoSuggestionResponse | null>(null)
  const [isLoadingFefo, setIsLoadingFefo] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  // Pickup state
  const [isPickupModalOpen, setIsPickupModalOpen] = useState(false)
  const [pickupSuggestions, setPickupSuggestions] = useState<FefoSuggestionResponse | null>(null)
  const [isLoadingPickupSuggestions, setIsLoadingPickupSuggestions] = useState(false)
  const [isPickingUp, setIsPickingUp] = useState(false)

  // Cancel state
  const [cancelModal, setCancelModal] = useState<{ open: boolean; type: 'ORDER' | 'ITEM'; itemId?: string; title: string }>({ open: false, type: 'ORDER', title: '' })
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const res = await ordersApi.getOrders({
        page,
        pageSize: 10,
        search,
        status: statusFilter || undefined
      })
      setOrders(res.items)
      setTotalCount(res.totalCount)
      setTotalPages(res.totalPages)
    } catch (err: any) {
      showToast(err.detail || 'Lỗi tải danh sách đơn hàng', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(fetchOrders, 300)
    return () => clearTimeout(timer)
  }, [page, search, statusFilter])

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setPage(1)
  }

  const handleOpenDetail = async (order: OrderResponse) => {
    setSelectedOrder(order)
    setPaymentSummary(null)
    try {
      const summary = await paymentsApi.getOrderPayments(order.id)
      setPaymentSummary(summary)
    } catch (err) {
      showToast('Không thể tải thông tin thanh toán', 'error')
    }
  }

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

  const handleOpenConfirmModal = async () => {
    if (!selectedOrder) return
    setIsConfirmModalOpen(true)
    setIsLoadingFefo(true)
    try {
      const suggestions = await ordersApi.getFefoSuggestions(selectedOrder.id)
      setFefoSuggestions(suggestions)
    } catch (err: any) {
      showToast(err.detail || 'Không thể lấy thông tin lô hàng', 'error')
      setIsConfirmModalOpen(false)
    } finally {
      setIsLoadingFefo(false)
    }
  }

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return
    setIsConfirming(true)
    try {
      await ordersApi.confirm(selectedOrder.id)
      showToast('Xác nhận đơn và giữ hàng thành công!', 'success')
      setIsConfirmModalOpen(false)
      setSelectedOrder(null)
      fetchOrders() // refresh orders list
    } catch (err: any) {
      showToast(err.detail || 'Lỗi xác nhận đơn', 'error')
    } finally {
      setIsConfirming(false)
    }
  }

  const handleOpenPickupModal = async () => {
    if (!selectedOrder) return
    setIsPickupModalOpen(true)
    setIsLoadingPickupSuggestions(true)
    try {
      const suggestions = await ordersApi.getFefoSuggestions(selectedOrder.id)
      setPickupSuggestions(suggestions)
    } catch (err: any) {
      showToast(err.detail || 'Không thể tải lô hàng cần giao', 'error')
      setIsPickupModalOpen(false)
    } finally {
      setIsLoadingPickupSuggestions(false)
    }
  }

  const handlePickupOrder = async () => {
    if (!selectedOrder || !pickupSuggestions) return
    setIsPickingUp(true)
    try {
      const payload = {
        items: pickupSuggestions.items?.map(item => ({
          orderItemId: item.orderItemId,
          lots: item.lots?.map(lot => ({
            inventoryLotId: lot.inventoryLotId,
            baseQuantity: lot.suggestedBaseQuantity
          }))?.filter(l => l.baseQuantity > 0) || []
        }))?.filter(i => i.lots.length > 0),
        note: 'Giao hàng tại quầy'
      }
      await ordersApi.pickup(selectedOrder.id, payload)
      showToast('Giao hàng và trừ kho thành công!', 'success')
      setIsPickupModalOpen(false)
      setSelectedOrder(null)
      fetchOrders()
    } catch (err: any) {
      showToast(err.detail || 'Lỗi khi giao hàng', 'error')
    } finally {
      setIsPickingUp(false)
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
      // Tải lại payment summary để lấy thông tin hoàn tiền (nếu có)
      const newSummary = await paymentsApi.getOrderPayments(selectedOrder.id)
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
            onClick={() => navigate('/sales/counter-sales')}
          >
            <Plus size={16} />
            <span>Soạn đơn tại quầy</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          layout="stacked"
          icon={Receipt}
          iconClassName="bg-primary/10 text-primary"
          title="Kết quả tìm kiếm"
          value={totalCount}
          valueSuffix={<span className="text-xs font-medium text-on-surface-variant">đơn hàng</span>}
        />
      </div>

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
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface text-label-md font-bold bg-surface-container-low">
                <th className="py-4 pl-4 px-3 w-[220px]">Khách hàng</th>
                <th className="py-4 px-3 min-w-[200px]">Đơn hàng</th>
                <th className="py-4 px-3 text-center min-w-[130px]">Trạng thái</th>
                <th className="py-4 px-3 text-right min-w-[120px]">Tổng tiền</th>
                <th className="py-4 pr-4 pl-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm text-on-surface">
              {isLoading ? (
                <EmptyTableRow colSpan={5} message="Đang tải dữ liệu..." />
              ) : !orders || orders.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Không tìm thấy đơn hàng." />
              ) : null}
              {orders?.map((order) => {
                const isSelected = order.id === selectedOrder?.id
                const st = STATUS_VISUALS[order.status]
                return (
                  <tr
                    key={order.id}
                    onClick={() => handleOpenDetail(order)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected ? 'bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-surface-container-low'
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
          <>
            <div className="p-4 bg-surface-container-low border-b border-outline-variant flex items-center justify-between rounded-t-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-on-surface">#{selectedOrder.orderNumber}</span>
                  <StatusBadge label={STATUS_MAP[selectedOrder.status]} className={STATUS_VISUALS[selectedOrder.status]?.className} />
                </div>
                <div className="text-label-sm text-on-surface-variant mt-1">Tạo lúc: {new Date(selectedOrder.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
            <div className="p-4 space-y-2 border-b border-outline-variant">
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
            </div>
            <div className="p-4 space-y-2 border-b border-outline-variant">
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
                        <button
                          className="text-rose-600 hover:text-rose-800 text-[11px] font-bold underline"
                          onClick={() => setCancelModal({ open: true, type: 'ITEM', itemId: item.id, title: `Hủy phần chưa giao của ${item.productName}` })}
                        >
                          Hủy phần còn lại ({item.remainingBaseQuantity} Đ.V.C.S)
                        </button>
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
                          <div key={rf.refundId} className="flex justify-between items-center text-sm font-bold bg-rose-50 border border-rose-200 text-rose-700 p-2 rounded-lg">
                            <span>Cần hoàn tiền mặt:</span>
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
            
            {/* Actions for Detail Modal */}
            <div className="p-4 bg-surface-container-low border-t border-outline-variant flex flex-col gap-3 rounded-b-xl">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-on-surface-variant">Trạng thái thanh toán:</span>
                <span className={`font-bold ${getPaymentStatus().color}`}>{getPaymentStatus().label}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  className="w-full h-10 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg font-bold flex items-center justify-center transition-colors disabled:opacity-50"
                  disabled={!paymentSummary || paymentSummary.remainingToPay <= 0 || ['COMPLETED', 'CANCELLED', 'PARTIALLY_CANCELLED'].includes(selectedOrder.status)}
                  onClick={() => setIsPaymentModalOpen(true)}
                >
                  <Receipt size={16} className="mr-2" />
                  THU TIỀN TẠI QUẦY
                </button>
                <button
                  className="w-full h-10 bg-primary text-on-primary hover:bg-primary/90 rounded-lg font-bold flex items-center justify-center transition-colors disabled:opacity-50"
                  disabled={!paymentSummary || paymentSummary.paidAmount < paymentSummary.orderTotal || selectedOrder.status !== 'PENDING_CONFIRMATION'}
                  onClick={handleOpenConfirmModal}
                >
                  <CheckCircle size={16} className="mr-2" />
                  XÁC NHẬN ĐƠN (M5)
                </button>
              </div>
              <div className="text-xs text-center text-on-surface-variant mt-1">
                * Chỉ có thể xác nhận đơn khi đã thu đủ tiền
              </div>

              {['CONFIRMED', 'PREPARING', 'READY_FOR_FULFILLMENT', 'PARTIALLY_FULFILLED'].includes(selectedOrder.status) && (
                <button
                  className="w-full h-10 mt-1 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-bold flex items-center justify-center transition-colors shadow-sm"
                  onClick={handleOpenPickupModal}
                >
                  <PackageCheck size={16} className="mr-2" />
                  GIAO HÀNG TẠI QUẦY (M6)
                </button>
              )}

              {['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY_FOR_FULFILLMENT'].includes(selectedOrder.status) && (
                <button
                  className="w-full h-10 mt-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg font-bold flex items-center justify-center transition-colors shadow-sm"
                  onClick={() => setCancelModal({ open: true, type: 'ORDER', title: `Hủy toàn bộ đơn hàng #${selectedOrder.orderNumber}` })}
                >
                  HỦY ĐƠN HÀNG (M8)
                </button>
              )}
            </div>
          </>
        ) : null}
      </DetailModal>

      {/* Payment Modal */}
      {isPaymentModalOpen && paymentSummary && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h3 className="font-bold text-lg text-on-surface">Thu tiền đơn #{selectedOrder.orderNumber}</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <FilterX size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center bg-surface-container-lowest p-3 rounded-lg border border-outline-variant">
                <span className="text-sm font-medium text-on-surface-variant">Còn phải thu:</span>
                <span className="text-xl font-bold text-rose-600">{formatVnd(paymentSummary.remainingToPay)}</span>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-on-surface mb-2">Số tiền thu (VNĐ)</label>
                <input
                  type="number"
                  className="w-full h-12 px-4 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg font-mono font-bold"
                  placeholder="Nhập số tiền..."
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 bg-surface-container-high hover:bg-surface-container-highest text-sm font-bold rounded-lg border border-outline-variant transition-colors text-on-surface"
                  onClick={() => setPaymentAmount(paymentSummary.remainingToPay.toString())}
                >
                  Thu hết số còn lại
                </button>
                <button
                  className="flex-1 py-2 bg-surface-container-high hover:bg-surface-container-highest text-sm font-bold rounded-lg border border-outline-variant transition-colors text-on-surface"
                  onClick={() => setPaymentAmount((paymentSummary.orderTotal / 2).toString())}
                >
                  Đặt cọc 50%
                </button>
              </div>
            </div>
            
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest">
              <button
                className="w-full h-12 bg-primary text-on-primary hover:bg-primary/90 font-bold rounded-xl transition-colors disabled:opacity-50"
                onClick={handleProcessPayment}
                disabled={isPaying || !paymentAmount}
              >
                {isPaying ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN THU TIỀN (TIỀN MẶT)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal M5 */}
      {isConfirmModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface w-full max-w-3xl rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h3 className="font-bold text-lg text-on-surface">Xác nhận đơn và giữ hàng #{selectedOrder.orderNumber}</h3>
              <button onClick={() => setIsConfirmModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <FilterX size={20} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1">
              {isLoadingFefo ? (
                <div className="py-10 text-center text-on-surface-variant font-medium animate-pulse">
                  Đang tính toán các lô hàng gợi ý tự động (FEFO)...
                </div>
              ) : fefoSuggestions ? (
                <div className="space-y-4">
                  <div className="bg-primary/10 text-primary p-3 rounded-lg text-sm font-medium mb-4">
                    Hệ thống đã tự động gợi ý các lô hàng tối ưu theo nguyên tắc FEFO (hết hạn trước xuất trước). Vui lòng kiểm tra trước khi xác nhận.
                  </div>
                  
                  {fefoSuggestions.items?.map((item) => {
                    const originalItem = selectedOrder.items?.find(i => i.id === item.orderItemId)
                    const hasShortage = item.shortageBaseQuantity > 0
                    
                    return (
                      <div key={item.orderItemId} className={`border rounded-xl p-4 ${hasShortage ? 'border-rose-300 bg-rose-50' : 'border-outline-variant bg-surface-container-lowest'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-bold text-on-surface">{originalItem?.productName}</div>
                            <div className="text-xs text-on-surface-variant mt-1">
                              Cần xuất: {item.baseQuantity} {originalItem?.packagingName} (Đơn vị cơ sở)
                            </div>
                          </div>
                          {hasShortage && (
                            <div className="bg-rose-100 text-rose-700 font-bold text-xs px-2 py-1 rounded-md">
                              THIẾU {item.shortageBaseQuantity} Đ.VỊ
                            </div>
                          )}
                        </div>
                        
                        <div className="bg-surface rounded-lg overflow-hidden border border-outline-variant text-sm">
                          <table className="w-full text-left">
                            <thead className="bg-surface-container-low text-xs text-on-surface-variant">
                              <tr>
                                <th className="p-2 font-medium">Số lô</th>
                                <th className="p-2 font-medium text-center">Hạn dùng</th>
                                <th className="p-2 font-medium text-right">Tồn khả dụng</th>
                                <th className="p-2 font-medium text-right text-primary">Sẽ giữ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/50">
                              {item.lots.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="p-4 text-center text-on-surface-variant italic text-xs">
                                    Không có lô hàng nào phù hợp
                                  </td>
                                </tr>
                              ) : (
                                item.lots?.map((lot, idx) => (
                                  <tr key={idx}>
                                    <td className="p-2 font-mono font-medium">{lot.lotNumber || 'Không số'}</td>
                                    <td className="p-2 text-center">{lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Không hạn'}</td>
                                    <td className="p-2 text-right">{lot.availableBaseQuantity}</td>
                                    <td className="p-2 text-right font-bold text-primary">{lot.suggestedBaseQuantity}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-rose-600 font-medium">
                  Không có dữ liệu gợi ý FEFO
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-3">
              <button
                className="px-6 py-2 bg-surface-container-high hover:bg-surface-container-highest font-bold rounded-xl transition-colors"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                HỦY
              </button>
              <button
                className="px-6 py-2 bg-primary text-on-primary hover:bg-primary/90 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                onClick={handleConfirmOrder}
                disabled={
                  isConfirming || 
                  isLoadingFefo || 
                  !fefoSuggestions || 
                  fefoSuggestions.items?.some(i => i.shortageBaseQuantity > 0)
                }
              >
                {isConfirming ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN VÀ GIỮ HÀNG'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pickup Modal M6 */}
      {isPickupModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface w-full max-w-3xl rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 border-b border-outline-variant bg-indigo-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-indigo-900">Giao hàng tại quầy #{selectedOrder.orderNumber}</h3>
              <button onClick={() => setIsPickupModalOpen(false)} className="text-indigo-500 hover:text-indigo-800">
                <FilterX size={20} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1">
              {isLoadingPickupSuggestions ? (
                <div className="py-10 text-center text-on-surface-variant font-medium animate-pulse">
                  Đang tải thông tin các lô hàng cần giao...
                </div>
              ) : pickupSuggestions ? (
                <div className="space-y-4">
                  <div className="bg-indigo-50 text-indigo-800 p-3 rounded-lg text-sm mb-4">
                    Xác nhận xuất kho các lô hàng dưới đây để giao cho khách. Số lượng xuất đã được lấy theo số lượng giữ (FEFO).
                  </div>
                  
                  {pickupSuggestions.items?.map((item) => {
                    const originalItem = selectedOrder.items?.find(i => i.id === item.orderItemId)
                    
                    return (
                      <div key={item.orderItemId} className="border border-outline-variant rounded-xl p-4 bg-surface-container-lowest">
                        <div className="font-bold text-on-surface mb-2">{originalItem?.productName}</div>
                        <div className="text-xs text-on-surface-variant mb-3">
                          Cần giao: {item.baseQuantity} {originalItem?.packagingName} (Đơn vị cơ sở)
                        </div>
                        
                        <div className="bg-surface rounded-lg overflow-hidden border border-outline-variant text-sm">
                          <table className="w-full text-left">
                            <thead className="bg-surface-container-low text-xs text-on-surface-variant">
                              <tr>
                                <th className="p-2 font-medium">Số lô</th>
                                <th className="p-2 font-medium text-center">Hạn dùng</th>
                                <th className="p-2 font-medium text-right text-indigo-600">Thực tế xuất</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/50">
                              {item.lots.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="p-4 text-center text-on-surface-variant italic text-xs">
                                    Không có lô hàng
                                  </td>
                                </tr>
                              ) : (
                                item.lots?.map((lot, idx) => (
                                  <tr key={idx}>
                                    <td className="p-2 font-mono font-medium">{lot.lotNumber || 'Không số'}</td>
                                    <td className="p-2 text-center">{lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Không hạn'}</td>
                                    <td className="p-2 text-right font-bold text-indigo-600">{lot.suggestedBaseQuantity}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-rose-600 font-medium">
                  Không có dữ liệu
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-3">
              <button
                className="px-6 py-2 bg-surface-container-high hover:bg-surface-container-highest font-bold rounded-xl transition-colors text-on-surface"
                onClick={() => setIsPickupModalOpen(false)}
              >
                HỦY
              </button>
              <button
                className="px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                onClick={handlePickupOrder}
                disabled={isPickingUp || isLoadingPickupSuggestions || !pickupSuggestions}
              >
                {isPickingUp ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN GIAO & TRỪ KHO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal M8 */}
      {cancelModal.open && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-rose-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-rose-900">{cancelModal.title}</h3>
              <button onClick={() => setCancelModal({ open: false, type: 'ORDER', title: '' })} className="text-rose-500 hover:text-rose-800">
                <FilterX size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="text-sm text-on-surface-variant">
                Vui lòng nhập lý do hủy. Hành động này không thể hoàn tác. Nếu đã thu tiền, hệ thống sẽ tự động tạo khoản cần hoàn.
              </div>
              
              <div>
                <label className="block text-sm font-bold text-on-surface mb-2">Lý do hủy <span className="text-rose-600">*</span></label>
                <textarea
                  className="w-full h-24 p-3 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm resize-none"
                  placeholder="Nhập lý do hủy (tối đa 1000 ký tự)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  maxLength={1000}
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-3">
              <button
                className="px-6 py-2 bg-surface-container-high hover:bg-surface-container-highest font-bold rounded-xl transition-colors text-on-surface"
                onClick={() => setCancelModal({ open: false, type: 'ORDER', title: '' })}
              >
                ĐÓNG
              </button>
              <button
                className="px-6 py-2 bg-rose-600 text-white hover:bg-rose-700 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                onClick={handleCancelSubmit}
                disabled={isCancelling || !cancelReason.trim()}
              >
                {isCancelling ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN HỦY'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
