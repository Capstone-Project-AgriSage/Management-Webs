import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Download, Printer, Plus, Receipt, Clock, Truck, CheckCircle, RefreshCw, Columns, MapPin, Phone, BadgeCheck, MessageSquare, FilterX } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import DetailModal from '../../components/ui/DetailModal'
import FormModal, { type FormFieldSpec } from '../../components/ui/FormModal'
import Pagination from '../../components/ui/Pagination'
import SearchInput from '../../components/ui/SearchInput'
import FilterSelect from '../../components/ui/FilterSelect'
import StatusBadge from '../../components/ui/StatusBadge'
import { useSelectableList } from '../../hooks/useSelectableList'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { useFormValues } from '../../hooks/useFormValues'
import { orders as INITIAL_ORDERS } from '../../data/mockOrders'
import { parseVnd, formatVnd } from '../../utils/money'
import { downloadCsv } from '../../utils/csv'
import type { Order, OrderStatus } from '../../types'

const STATUS_OPTIONS = ['Tất cả trạng thái', 'Chờ xác nhận', 'Đã xác nhận', 'Đang xử lý', 'Đang giao', 'Hoàn thành', 'Đã hủy']
const PAYMENT_OPTIONS = ['Tất cả thanh toán', 'VietQR (Đã TT)', 'Chuyển khoản', 'Tiền mặt (COD)', 'Cọc 50%', 'Gối nợ vụ mùa']

const MinimalBadge = ({ label, type }: { label: string, type: 'status' | 'billing' }) => {
  if (type === 'status') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border border-slate-200 text-slate-500 bg-white">
        {label}
      </span>
    )
  }
  
  // Billing
  let icon = <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-1.5" />;
  if (label.includes('Đã TT') || label.includes('Chuyển khoản') || label.includes('Tiền mặt')) {
    icon = <CheckCircle size={10} className="text-emerald-500 mr-1.5" />;
  } else if (label.includes('Cọc')) {
    icon = <Clock size={10} className="text-amber-500 mr-1.5" />;
  } else if (label.includes('Gối nợ')) {
    icon = <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mr-1.5" />;
  }
  
  return (
    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-medium border border-slate-200 text-slate-600 bg-white min-w-[100px]">
      {icon}
      {label}
    </span>
  )
}

const STATUS_VISUALS: Record<OrderStatus, { className: string; panelClassName: string }> = {
  'Chờ xác nhận': { className: 'bg-amber-100 text-amber-800 border-amber-300', panelClassName: 'bg-amber-100 text-amber-800' },
  'Đã xác nhận': { className: 'bg-sky-100 text-sky-800 border-sky-300', panelClassName: 'bg-sky-100 text-sky-800' },
  'Đang xử lý': { className: 'bg-indigo-100 text-indigo-800 border-indigo-300', panelClassName: 'bg-indigo-100 text-indigo-800' },
  'Đang giao': { className: 'bg-blue-100 text-blue-800 border-blue-300', panelClassName: 'bg-blue-100 text-blue-800' },
  'Hoàn thành': { className: 'bg-emerald-100 text-emerald-800 border-emerald-300', panelClassName: 'bg-emerald-100 text-emerald-800' },
  'Đã hủy': { className: 'bg-slate-100 text-slate-800 border-slate-300', panelClassName: 'bg-slate-100 text-slate-800' },
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  'Chờ xác nhận': 'Đã xác nhận',
  'Đã xác nhận': 'Đang xử lý',
  'Đang xử lý': 'Đang giao',
  'Đang giao': 'Hoàn thành',
}

const emptyOrderForm = {
  customerName: '',
  phone: '',
  shortLocation: '',
  wardAddress: '',
  productTitle: '',
  quantity: '',
  unitPrice: '',
}

const CREATE_ORDER_FIELDS: FormFieldSpec[] = [
  { key: 'customerName', label: 'Tên khách hàng' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'shortLocation', label: 'Địa chỉ ngắn gọn (VD: Thới Lai)' },
  { key: 'wardAddress', label: 'Địa chỉ đầy đủ (Xã/Huyện/Tỉnh)' },
  { key: 'productTitle', label: 'Sản phẩm' },
  { key: 'quantity', label: 'Số lượng', type: 'number', min: '1', group: 'qtyPrice' },
  { key: 'unitPrice', label: 'Đơn giá (₫)', placeholder: 'VD: 685.000', group: 'qtyPrice' },
]

export default function OrdersPage() {
  usePageHeader({
    title: 'Quản lý đơn hàng',
  })

  const [orders, setOrders] = useState(INITIAL_ORDERS)
  const { showToast } = useToast()
  const itemsTotalLabel = 'Tổng thanh toán'

  const setOrderStatus = (id: string, label: OrderStatus) => {
    const visuals = STATUS_VISUALS[label]
    if (!visuals) return
    setOrders((prev) =>
      prev.map((order) =>
        order.id === id
          ? {
              ...order,
              status: label,
              statusBadge: { label, className: visuals.className, pulse: false },
              panelBadge: { label, className: visuals.panelClassName },
              rowAttentionClassName: undefined,
              idClassName: 'text-on-surface',
            }
          : order,
      ),
    )
    showToast(`Đã cập nhật đơn #${id} sang "${label}"`)
  }

  const advanceOrderStatus = (id: string) => {
    const order = orders.find((o) => o.id === id)
    const next = order && NEXT_STATUS[order.status]
    if (next) setOrderStatus(id, next)
  }

  const handleOrderAction = (id: string, label: string) => {
    if (label === 'Duyệt đơn') setOrderStatus(id, 'Đã xác nhận')
    else if (label === 'Xác nhận') setOrderStatus(id, 'Đang giao')
    else if (label === 'Cập nhật') advanceOrderStatus(id)
    else if (label === 'Xem') setSelectedId(id)
    else showToast(`Đã thực hiện "${label}" cho đơn #${id}`)
  }

  const [createOpen, setCreateOpen] = useState(false)
  const { values: createForm, update: updateCreateForm, reset: resetCreateForm } = useFormValues(emptyOrderForm)

  const handleCreateOrder = () => {
    const { customerName, phone, shortLocation, wardAddress, productTitle, quantity, unitPrice } = createForm
    const qty = Number.parseInt(quantity, 10)
    const price = parseVnd(unitPrice)
    if (!customerName.trim() || !phone.trim() || !shortLocation.trim() || !wardAddress.trim() || !productTitle.trim() || Number.isNaN(qty) || qty <= 0 || price <= 0) {
      showToast('Vui lòng nhập đầy đủ thông tin đơn hàng')
      return
    }
    const maxNum = orders.reduce((max, o) => {
      const n = Number.parseInt(o.id.split('-').pop() ?? '0', 10)
      return Number.isNaN(n) ? max : Math.max(max, n)
    }, 0)
    const total = qty * price
    const newOrder: Order = {
      id: `DH-2024-${maxNum + 1}`,
      customerName: customerName.trim(),
      phone: phone.trim(),
      shortLocation: shortLocation.trim(),
      fullAddress: shortLocation.trim(),
      wardAddress: wardAddress.trim(),
      timeRest: 'Vừa tạo',
      createdAgo: 'Vừa tạo',
      productLine: productTitle.trim(),
      productTitle: productTitle.trim(),
      productNote: `Số lượng: ${qty}`,
      items: [{ name: productTitle.trim(), qtyPrice: `${qty} x ${formatVnd(price)}`, total: formatVnd(total) }],
      total: formatVnd(total),
      paymentMethod: 'Gối nợ vụ mùa',
      paymentBadge: { label: 'Gối nợ vụ mùa', className: 'bg-slate-100 text-slate-800 border-slate-300' },
      status: 'Chờ xác nhận',
      statusBadge: { label: 'Chờ xác nhận', className: STATUS_VISUALS['Chờ xác nhận'].className, pulse: true },
      shippingIcon: 'local_shipping',
      shippingIconClassName: 'text-outline',
      shippingLabel: 'Chưa xếp chuyến',
      idClassName: 'text-on-surface',
      panelBadge: { label: 'Chờ xác nhận', className: STATUS_VISUALS['Chờ xác nhận'].panelClassName },
      paymentFooterNote: 'Chưa thanh toán',
      paymentFooterClassName: 'text-outline',
      actions: [
        { label: 'Xem', icon: 'visibility' },
        { label: 'Duyệt đơn', icon: 'check_circle', tone: 'primary' },
      ],
    }
    setOrders((prev) => [newOrder, ...prev])
    showToast(`Đã tạo đơn hàng ${newOrder.id}`)
    resetCreateForm()
    setCreateOpen(false)
  }

  const handleExportOrders = () => {
    downloadCsv(
      // oxlint-disable-next-line react/purity -- only invoked from a click handler, never during render
      `don-hang-${Date.now()}.csv`,
      filteredOrders.map((o) => ({
        'Mã đơn': o.id,
        'Khách hàng': o.customerName,
        'SĐT': o.phone,
        'Địa chỉ': o.wardAddress,
        'Sản phẩm': o.productTitle,
        'Tổng tiền': o.total,
        'Thanh toán': o.paymentBadge.label,
        'Trạng thái': o.statusBadge.label,
      })),
    )
    showToast(`Đã xuất Excel ${filteredOrders.length} đơn hàng`)
  }

  const handlePrintOrders = () => {
    showToast(`Đang in phiếu xuất hàng loạt cho ${filteredOrders.length} đơn hàng`)
    window.print()
  }

  const { selectedId, setSelectedId, selected: selectedOrder } = useSelectableList(orders, (o) => o.id)

  const [paymentFilter, setPaymentFilter] = useState(PAYMENT_OPTIONS[0])

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredOrders,
    clearFilters: handleClearFiltersBase,
  } = useFilteredList(
    orders,
    STATUS_OPTIONS[0],
    (order, keyword, status) =>
      (!keyword ||
        order.id.toLowerCase().includes(keyword) ||
        order.customerName.toLowerCase().includes(keyword) ||
        order.phone.toLowerCase().includes(keyword)) &&
      (status === STATUS_OPTIONS[0] || order.statusBadge.label === status) &&
      (paymentFilter === PAYMENT_OPTIONS[0] || order.paymentBadge.label === paymentFilter),
  )

  const handleClearFilters = () => {
    handleClearFiltersBase()
    setPaymentFilter(PAYMENT_OPTIONS[0])
  }

  const { page, totalPages, paginated: paginatedOrders, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filteredOrders, 10)

  const totalOrdersToday = orders.length
  const totalOrderValue = orders.reduce((sum, o) => sum + parseVnd(o.total), 0)
  const waitingCount = orders.filter((o) => o.statusBadge.label === 'Chờ xác nhận').length
  const processingCount = orders.filter((o) => o.statusBadge.label === 'Đang xử lý').length
  const deliveringCount = orders.filter((o) => o.statusBadge.label === 'Đang giao').length
  const completedCount = orders.filter((o) => o.statusBadge.label === 'Hoàn thành').length

  return (
    <>
      {/* PAGE TITLE & ACTIONS ZONE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1 text-[12px] text-slate-500" aria-label="Breadcrumb">
          <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Quản lý đơn hàng</span>
        </nav>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50/50 transition-colors shadow-sm"
            type="button"
            onClick={handleExportOrders}
          >
            <Download size={16} className="text-slate-500" />
            <span>Xuất Excel</span>
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50/50 transition-colors shadow-sm"
            type="button"
            onClick={handlePrintOrders}
          >
            <Printer size={16} className="text-slate-500" />
            <span>In phiếu xuất hàng loạt</span>
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} />
            <span>Tạo đơn hàng</span>
          </button>
        </div>
      </div>

      {/* SUMMARY KPI CARDS (4 Clean SaaS Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đơn hàng hôm nay</span>
            <Receipt size={20} className="text-emerald-600" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{totalOrdersToday}</span>
              <span className="text-xs font-medium text-slate-500">đơn</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
            <span>Tổng giá trị:</span>
            <span className="font-semibold text-slate-900">{formatVnd(totalOrderValue)}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chờ xác nhận</span>
            <Clock size={20} className="text-amber-500" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-600 tabular-nums">{waitingCount}</span>
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-semibold border border-amber-200">Cần duyệt</span>
            </div>
          </div>
          <div className="text-xs text-amber-600 border-t border-amber-100/50 pt-2 flex items-center gap-1">
            <Clock size={14} />
            <span>Ưu tiên xuất kho trạm</span>
          </div>
        </div>
        
        {/* KPI 3 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đang giao hàng</span>
            <Truck size={20} className="text-blue-500" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{processingCount + deliveringCount}</span>
              <span className="text-xs font-medium text-blue-600">đơn</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2">
            {deliveringCount} đang giao • {processingCount} đang soạn hàng
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hoàn thành</span>
            <CheckCircle size={20} className="text-emerald-500" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600 tabular-nums">{completedCount}</span>
              <span className="text-xs font-medium text-emerald-600">đơn</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2">
            Đã giao &amp; thanh toán thành công
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm kiếm mã đơn, tên nông dân, SĐT..."
            className="relative min-w-[280px] flex-1 max-w-md"
          />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[160px]" />
          <FilterSelect value={paymentFilter} onChange={setPaymentFilter} options={PAYMENT_OPTIONS} className="relative min-w-[160px]" />
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 px-2 py-1"
            type="button"
            onClick={handleClearFilters}
          >
            <FilterX size={14} />
            <span>Xóa bộ lọc</span>
          </button>
        </div>
      </div>

      {/* MAIN TABLE */}
      <div className="bg-white rounded-xl flex flex-col pt-2">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">Danh sách đơn xuất kho trạm #04</span>
              <span className="text-[10px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{filteredOrders.length} bản ghi</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
                title="Làm mới bảng"
                onClick={() => showToast('Đã làm mới danh sách đơn hàng')}
              >
                <RefreshCw size={14} />
              </button>
              <button
                className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
                title="Tùy biến cột"
                onClick={() => showToast('Chức năng tùy biến cột đang được phát triển')}
              >
                <Columns size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                  <th className="py-4 pl-4 pr-3 w-10">
                    <input type="checkbox" className="rounded border-slate-300" />
                  </th>
                  <th className="py-4 px-3">Khách hàng</th>
                  <th className="py-4 px-3 text-center">Trạng thái</th>
                  <th className="py-4 px-3 text-center">Thanh toán</th>
                  <th className="py-4 px-3 text-center">Tổng tiền</th>
                  <th className="py-4 px-3">Sản phẩm</th>
                  <th className="py-4 px-3">Thời gian</th>
                  <th className="py-4 pr-4 pl-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredOrders.length === 0 ? (
                  <EmptyTableRow colSpan={8} message="Không tìm thấy đơn hàng phù hợp với bộ lọc." />
                ) : null}
                {paginatedOrders.map((order) => {
                  const isSelected = order.id === selectedId
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className={`transition-colors cursor-pointer group border-b border-slate-50 ${
                        isSelected
                          ? 'bg-slate-50'
                          : `hover:bg-slate-50/50 ${order.rowAttentionClassName ?? ''}`
                      }`}
                    >
                      <td className="py-4 pl-4 pr-3">
                         <input type="checkbox" className="rounded border-slate-300" checked={isSelected} readOnly />
                      </td>
                      <td className="py-4 px-3">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-semibold text-xs border border-slate-200">
                             {order.customerName.charAt(0)}
                           </div>
                           <div>
                             <div className="font-semibold text-slate-800 text-[13px]">{order.customerName}</div>
                             <div className="text-[11px] text-slate-400 mt-0.5">{order.id}</div>
                           </div>
                         </div>
                      </td>
                      <td className="py-4 px-3 text-center whitespace-nowrap">
                         <MinimalBadge label={order.statusBadge.label} type="status" />
                      </td>
                      <td className="py-4 px-3 text-center whitespace-nowrap">
                         <MinimalBadge label={order.paymentBadge.label} type="billing" />
                      </td>
                      <td className="py-4 px-3 text-center font-medium text-slate-700 text-[13px] whitespace-nowrap">
                         {order.total}
                      </td>
                      <td className="py-4 px-3 max-w-[200px]">
                         <div className="truncate text-slate-700 text-[13px]">{order.productLine}</div>
                      </td>
                      <td className="py-4 px-3 text-slate-500 whitespace-nowrap text-[12px] leading-tight">
                         <div className="text-slate-700 font-medium">{order.timeBold ? order.timeBold : order.timeRest}</div>
                         <div className="text-slate-400 text-[11px] mt-0.5">{order.timeBold ? `lúc ${order.timeRest}` : ''}</div>
                      </td>
                      <td className="py-4 pr-4 pl-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <RowActionsMenu
                            triggerLabel={`Thao tác đơn #${order.id}`}
                            actions={order.actions.map((action) => ({
                              ...action,
                              onClick: () => handleOrderAction(order.id, action.label),
                            }))}
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
            startIndex={startIndex}
            endIndex={endIndex}
            totalCount={totalCount}
            unitLabel="đơn hàng"
            goPrev={goPrev}
            goNext={goNext}
            setPage={setPage}
          />
        </div>

      {/* DETAIL MODAL: CHI TIẾT ĐƠN HÀNG */}
      <DetailModal open={selectedOrder !== null} onClose={() => setSelectedId(null)}>
        {selectedOrder ? (
          <>
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between rounded-t-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-slate-900">#{selectedOrder.id}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${selectedOrder.panelBadge.className}`}>
                    {selectedOrder.panelBadge.label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{selectedOrder.createdAgo}</div>
              </div>
            </div>
            <div className="p-4 space-y-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Khách hàng đặt</span>
                <div className="text-sm text-slate-900 font-bold mt-1">{selectedOrder.customerName}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                  <Phone size={12} className="text-slate-400" />
                  <span className="font-mono font-medium text-slate-900">{selectedOrder.phone}</span>
                  <span className="text-slate-300">|</span> 
                  <span>{selectedOrder.fullAddress}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{selectedOrder.wardAddress}</div>
              </div>
              {selectedOrder.deliveryNote ? (
                <div className="bg-amber-50 border border-amber-200/60 rounded-md p-2.5 text-xs text-amber-900 mt-3">
                  <div className="flex items-start gap-1.5">
                    <MapPin size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Ghi chú giao hàng:</span> {selectedOrder.deliveryNote}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="p-4 space-y-2 border-b border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Danh sách vật tư xuất</span>
              <div className="space-y-3 pt-2 text-xs">
                {selectedOrder.items.map((item) => (
                  <div key={item.name} className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{item.qtyPrice}</p>
                    </div>
                    <span className="font-mono font-bold text-slate-900">{item.total}</span>
                  </div>
                ))}
                {selectedOrder.feeLine ? (
                  <div className="flex items-start justify-between text-slate-500 pt-2 border-t border-dashed border-slate-200">
                    <span>{selectedOrder.feeLine.label}</span>
                    <span className="font-mono font-medium text-slate-700">{selectedOrder.feeLine.value}</span>
                  </div>
                ) : null}
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{itemsTotalLabel}</span>
                  <div className={`text-[11px] font-medium flex items-center gap-1 mt-0.5 ${selectedOrder.paymentFooterClassName}`}>
                    <BadgeCheck size={14} className="text-emerald-500" />
                    <span className="text-slate-600">{selectedOrder.paymentFooterNote}</span>
                  </div>
                </div>
                <span className="font-mono text-lg font-bold text-emerald-600">{selectedOrder.total}</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-b-xl space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50/50 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-sm"
                  type="button"
                  onClick={() => {
                    showToast(`Đang in phiếu giao hàng cho đơn #${selectedOrder.id}`)
                    window.print()
                  }}
                >
                  <Printer size={14} className="text-slate-500" />
                  <span>In phiếu giao hàng</span>
                </button>
                <button
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  disabled={!NEXT_STATUS[selectedOrder.status]}
                  onClick={() => advanceOrderStatus(selectedOrder.id)}
                >
                  <RefreshCw size={14} />
                  <span>
                    {NEXT_STATUS[selectedOrder.status]
                      ? `Chuyển sang "${NEXT_STATUS[selectedOrder.status]}"`
                      : 'Đã hoàn thành'}
                  </span>
                </button>
              </div>
              <button
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50/50 text-slate-600 rounded-lg text-xs font-medium transition-colors shadow-sm"
                type="button"
                onClick={() => showToast(`Đã gửi SMS cập nhật cho ${selectedOrder.customerName}`)}
              >
                <MessageSquare size={14} className="text-slate-400" />
                <span>Gửi SMS cập nhật cho nông dân</span>
              </button>
            </div>
          </>
        ) : null}
      </DetailModal>

      {/* MODAL: TẠO ĐƠN HÀNG MỚI */}
      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo đơn hàng mới"
        fields={CREATE_ORDER_FIELDS}
        values={createForm}
        onChange={updateCreateForm}
        onSubmit={handleCreateOrder}
        submitLabel="Tạo đơn hàng"
      />
    </>
  )
}
