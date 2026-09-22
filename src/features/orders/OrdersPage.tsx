import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Download, Plus, Receipt, Clock, PackageCheck, CheckCircle, FilterX, Phone, StickyNote } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import type { RowAction } from '../../components/ui/RowActionsMenu'
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
import { PAYMENT_METHOD_VISUALS } from '../../constants/paymentMethod'
import KpiCard from '../../components/ui/KpiCard'
import type { Order, OrderStatus, OrderPaymentMethod } from '../../types'

const STATUS_OPTIONS: ('Tất cả trạng thái' | OrderStatus)[] = [
  'Tất cả trạng thái',
  'Chờ xác nhận',
  'Đã xác nhận',
  'Đang chuẩn bị',
  'Hoàn thành',
  'Đã hủy',
]
const PAYMENT_METHOD_OPTIONS: OrderPaymentMethod[] = ['Tiền mặt tại quầy', 'VietQR', 'Cọc 50%', 'Gối nợ vụ mùa']
const PAYMENT_OPTIONS: ('Tất cả thanh toán' | OrderPaymentMethod)[] = ['Tất cả thanh toán', ...PAYMENT_METHOD_OPTIONS]
const COMPLETE_NOW_OPTIONS = ['Không', 'Có']

const STATUS_VISUALS: Record<OrderStatus, { className: string; dotClassName: string }> = {
  'Chờ xác nhận': { className: 'bg-amber-100 text-amber-800 border-amber-300', dotClassName: 'bg-amber-600' },
  'Đã xác nhận': { className: 'bg-sky-100 text-sky-800 border-sky-300', dotClassName: 'bg-sky-600' },
  'Đang chuẩn bị': { className: 'bg-indigo-100 text-indigo-800 border-indigo-300', dotClassName: 'bg-indigo-600' },
  'Hoàn thành': { className: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotClassName: 'bg-emerald-600' },
  'Đã hủy': { className: 'bg-slate-100 text-slate-800 border-slate-300', dotClassName: 'bg-slate-500' },
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  'Chờ xác nhận': 'Đã xác nhận',
  'Đã xác nhận': 'Đang chuẩn bị',
  'Đang chuẩn bị': 'Hoàn thành',
}

const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  'Chờ xác nhận': 'Xác nhận',
  'Đã xác nhận': 'Cập nhật chuẩn bị',
  'Đang chuẩn bị': 'Hoàn tất đơn',
}

const NEXT_ACTION_ICON: Partial<Record<OrderStatus, string>> = {
  'Chờ xác nhận': 'check_circle',
  'Đã xác nhận': 'inventory_2',
  'Đang chuẩn bị': 'task_alt',
}

const CANCELABLE_STATUSES: OrderStatus[] = ['Chờ xác nhận', 'Đã xác nhận', 'Đang chuẩn bị']

// The state machine's only legal moves: each cancelable status can advance one step forward
// (NEXT_STATUS) or be cancelled; 'Hoàn thành' and 'Đã hủy' are terminal and have no entry here,
// so any lookup against them yields undefined and blocks the transition.
const VALID_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  'Chờ xác nhận': ['Đã xác nhận', 'Đã hủy'],
  'Đã xác nhận': ['Đang chuẩn bị', 'Đã hủy'],
  'Đang chuẩn bị': ['Hoàn thành', 'Đã hủy'],
}

function buildActions(status: OrderStatus): RowAction[] {
  const actions: RowAction[] = [{ label: 'Xem', icon: 'visibility' }]
  const nextLabel = NEXT_ACTION_LABEL[status]
  if (nextLabel) actions.push({ label: nextLabel, icon: NEXT_ACTION_ICON[status] ?? 'check_circle', tone: 'primary' })
  if (CANCELABLE_STATUSES.includes(status)) actions.push({ label: 'Hủy đơn', icon: 'cancel', tone: 'danger' })
  return actions
}

const emptyOrderForm = {
  customerName: '',
  phone: '',
  productName: '',
  quantity: '',
  unitPrice: '',
  paymentMethod: PAYMENT_METHOD_OPTIONS[0],
  completeNow: COMPLETE_NOW_OPTIONS[0],
  note: '',
}

const CREATE_ORDER_FIELDS: FormFieldSpec[] = [
  { key: 'customerName', label: 'Tên khách hàng' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'productName', label: 'Sản phẩm' },
  { key: 'quantity', label: 'Số lượng', type: 'number', min: '1', group: 'qtyPrice' },
  { key: 'unitPrice', label: 'Đơn giá (₫)', placeholder: 'VD: 685.000', group: 'qtyPrice' },
  { key: 'paymentMethod', label: 'Phương thức thanh toán', type: 'select', options: PAYMENT_METHOD_OPTIONS },
  { key: 'completeNow', label: 'Hoàn tất ngay (bán trực tiếp tại quầy)', type: 'select', options: COMPLETE_NOW_OPTIONS },
  { key: 'note', label: 'Ghi chú' },
]

export default function OrdersPage() {
  usePageHeader({ title: 'Đơn hàng', subtitle: 'Tạo, xác nhận và theo dõi đơn bán tại cửa hàng' })

  const [orders, setOrders] = useState(INITIAL_ORDERS)
  const { showToast } = useToast()
  const { user } = useAuth()

  const setOrderStatus = (id: string, status: OrderStatus) => {
    const order = orders.find((o) => o.id === id)
    // Guard the transition here (not just at call sites) so a future caller — a bulk action, a
    // keyboard shortcut, whatever — can't push an order out of a terminal status or skip a step.
    if (!order || !VALID_TRANSITIONS[order.status]?.includes(status)) return
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, status, statusBadge: { label: status, ...STATUS_VISUALS[status] }, actions: buildActions(status) }
          : o,
      ),
    )
    showToast(`Đã cập nhật đơn ${id} sang "${status}"`)
  }

  const handleOrderAction = (id: string, label: string) => {
    if (label === 'Xem') {
      setSelectedId(id)
      return
    }
    if (label === 'Hủy đơn') {
      setOrderStatus(id, 'Đã hủy')
      return
    }
    const order = orders.find((o) => o.id === id)
    const next = order && NEXT_STATUS[order.status]
    if (next) setOrderStatus(id, next)
  }

  const [createOpen, setCreateOpen] = useState(false)
  const { values: createForm, update: updateCreateForm, reset: resetCreateForm } = useFormValues(emptyOrderForm)

  const handleCreateOrder = () => {
    const { customerName, phone, productName, quantity, unitPrice, paymentMethod, completeNow, note } = createForm
    const qty = Number.parseInt(quantity, 10)
    const price = parseVnd(unitPrice)
    if (!customerName.trim() || !phone.trim() || !productName.trim() || Number.isNaN(qty) || qty <= 0 || price <= 0) {
      showToast('Vui lòng nhập đầy đủ thông tin đơn hàng')
      return
    }
    const maxNum = orders.reduce((max, o) => {
      const n = Number.parseInt(o.id.split('-').pop() ?? '0', 10)
      return Number.isNaN(n) ? max : Math.max(max, n)
    }, 0)
    const total = qty * price
    const status: OrderStatus = completeNow === 'Có' ? 'Hoàn thành' : 'Chờ xác nhận'
    const method = paymentMethod as OrderPaymentMethod
    const newOrder: Order = {
      id: `DH-${maxNum + 1}`,
      customerName: customerName.trim(),
      phone: phone.trim(),
      createdAgo: 'Vừa tạo',
      createdAt: new Date().toISOString(),
      items: [{ productId: `SP-${maxNum + 1}`, name: productName.trim(), qtyPrice: `${qty} x ${formatVnd(price)}`, total: formatVnd(total) }],
      total: formatVnd(total),
      paymentMethod: method,
      paymentBadge: { label: method, className: PAYMENT_METHOD_VISUALS[method].badgeClassName },
      status,
      statusBadge: { label: status, ...STATUS_VISUALS[status] },
      note: note.trim() || undefined,
      createdBy: user.name,
      actions: buildActions(status),
    }
    setOrders((prev) => [newOrder, ...prev])
    showToast(`Đã tạo đơn hàng ${newOrder.id}`)
    resetCreateForm()
    setCreateOpen(false)
  }

  const handleExportOrders = () => {
    downloadCsv(
      `don-hang-${Date.now()}.csv`,
      filteredOrders.map((o) => ({
        'Mã đơn': o.id,
        'Khách hàng': o.customerName,
        SĐT: o.phone,
        'Sản phẩm': o.items[0]?.name ?? '',
        'Tổng tiền': o.total,
        'Thanh toán': o.paymentBadge.label,
        'Trạng thái': o.statusBadge.label,
      })),
    )
    showToast(`Đã xuất Excel ${filteredOrders.length} đơn hàng`)
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
      (status === STATUS_OPTIONS[0] || order.status === status) &&
      (paymentFilter === PAYMENT_OPTIONS[0] || order.paymentMethod === paymentFilter),
  )

  const handleClearFilters = () => {
    handleClearFiltersBase()
    setPaymentFilter(PAYMENT_OPTIONS[0])
  }

  const { page, totalPages, paginated: paginatedOrders, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filteredOrders, 8)

  const totalOrdersToday = orders.length
  const totalOrderValue = orders.reduce((sum, o) => sum + parseVnd(o.total), 0)
  const waitingCount = orders.filter((o) => o.status === 'Chờ xác nhận').length
  const preparingCount = orders.filter((o) => o.status === 'Đã xác nhận' || o.status === 'Đang chuẩn bị').length
  const completedCount = orders.filter((o) => o.status === 'Hoàn thành').length

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1 text-[12px] text-slate-500" aria-label="Breadcrumb">
          <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Đơn hàng</span>
        </nav>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            type="button"
            onClick={handleExportOrders}
          >
            <Download size={16} className="text-slate-500" />
            <span>Xuất Excel</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          layout="stacked"
          icon={Receipt}
          iconClassName="bg-emerald-50 text-emerald-600"
          title="Đơn hàng"
          value={totalOrdersToday}
          valueSuffix={<span className="text-xs font-medium text-slate-500">đơn</span>}
        >
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 mt-2 flex justify-between">
            <span>Tổng giá trị:</span>
            <span className="font-semibold text-slate-900">{formatVnd(totalOrderValue)}</span>
          </div>
        </KpiCard>

        <KpiCard
          layout="stacked"
          icon={Clock}
          iconClassName="bg-amber-50 text-amber-500"
          title="Chờ xác nhận"
          value={waitingCount}
          valueClassName="text-amber-600"
          valueSuffix={
            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-semibold border border-amber-200">
              Cần duyệt
            </span>
          }
          className="border-amber-200"
        >
          <div className="text-xs text-amber-600 border-t border-amber-100/50 pt-2 mt-2 flex items-center gap-1">
            <Clock size={14} />
            <span>Ưu tiên xử lý trước</span>
          </div>
        </KpiCard>

        <KpiCard
          layout="stacked"
          icon={PackageCheck}
          iconClassName="bg-indigo-50 text-indigo-500"
          title="Đang chuẩn bị"
          value={preparingCount}
          valueSuffix={<span className="text-xs font-medium text-indigo-600">đơn</span>}
        >
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 mt-2">Đã xác nhận &amp; đang soạn hàng</div>
        </KpiCard>

        <KpiCard
          layout="stacked"
          icon={CheckCircle}
          iconClassName="bg-emerald-50 text-emerald-500"
          title="Hoàn thành"
          value={completedCount}
          valueClassName="text-emerald-600"
          valueSuffix={<span className="text-xs font-medium text-emerald-600">đơn</span>}
        >
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 mt-2">Đã bán &amp; thanh toán tại quầy</div>
        </KpiCard>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm kiếm mã đơn, tên khách hàng, SĐT..."
            className="relative min-w-[280px] flex-1 max-w-md"
          />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[160px]" />
          <FilterSelect
            value={paymentFilter}
            onChange={(value) => setPaymentFilter(value as (typeof PAYMENT_OPTIONS)[number])}
            options={PAYMENT_OPTIONS}
            className="relative min-w-[160px]"
          />
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

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Danh sách đơn hàng</span>
            <span className="text-[10px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{filteredOrders.length} bản ghi</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 pl-4 px-3">Mã đơn</th>
                <th className="py-3 px-3">Khách hàng</th>
                <th className="py-3 px-3">Thời gian</th>
                <th className="py-3 px-3">Sản phẩm</th>
                <th className="py-3 px-3 text-center">Tổng tiền</th>
                <th className="py-3 px-3 text-center">Thanh toán</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 pr-4 pl-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? <EmptyTableRow colSpan={8} message="Không tìm thấy đơn hàng phù hợp với bộ lọc." /> : null}
              {paginatedOrders.map((order) => {
                const isSelected = order.id === selectedId
                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected ? 'bg-emerald-50/50 hover:bg-emerald-50 border-l-2 border-l-emerald-500' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className={`py-3 pl-4 px-3 font-mono font-medium text-xs ${isSelected ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {order.id}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 text-sm">{order.customerName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{order.phone}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-xs">{order.createdAgo}</td>
                    <td className="py-3 px-3 max-w-[220px]">
                      <div className="truncate text-slate-900 font-medium text-sm" title={order.items[0]?.name}>
                        {order.items[0]?.name}
                      </div>
                      <span className="text-xs text-slate-500">{order.items[0]?.qtyPrice}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-900 whitespace-nowrap">{order.total}</td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <StatusBadge label={order.paymentBadge.label} className={order.paymentBadge.className} minWidthClassName="min-w-[130px]" />
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <StatusBadge label={order.statusBadge.label} className={order.statusBadge.className} minWidthClassName="min-w-[110px]" />
                    </td>
                    <td className="py-3 pr-4 pl-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <RowActionsMenu
                          triggerLabel={`Thao tác đơn ${order.id}`}
                          actions={order.actions.map((action) => ({ ...action, onClick: () => handleOrderAction(order.id, action.label) }))}
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

      <DetailModal open={selectedOrder !== null} onClose={() => setSelectedId(null)}>
        {selectedOrder ? (
          <>
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between rounded-t-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-slate-900">#{selectedOrder.id}</span>
                  <StatusBadge label={selectedOrder.statusBadge.label} className={selectedOrder.statusBadge.className} />
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{selectedOrder.createdAgo}</div>
              </div>
            </div>
            <div className="p-4 space-y-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Khách hàng</span>
                <div className="text-sm text-slate-900 font-bold mt-1">{selectedOrder.customerName}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                  <Phone size={12} className="text-slate-400" />
                  <span className="font-mono font-medium text-slate-900">{selectedOrder.phone}</span>
                </div>
              </div>
              {selectedOrder.note ? (
                <div className="bg-amber-50 border border-amber-200/60 rounded-md p-2.5 text-xs text-amber-900 mt-3">
                  <div className="flex items-start gap-1.5">
                    <StickyNote size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Ghi chú:</span> {selectedOrder.note}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="p-4 space-y-2 border-b border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Danh sách sản phẩm</span>
              <div className="space-y-3 pt-2 text-xs">
                {selectedOrder.items.map((item) => (
                  <div key={item.productId} className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{item.qtyPrice}</p>
                    </div>
                    <span className="font-mono font-bold text-slate-900">{item.total}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng thanh toán</span>
                  <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                    {selectedOrder.paymentBadge.label} • Tạo bởi {selectedOrder.createdBy}
                  </div>
                </div>
                <span className="font-mono text-lg font-bold text-emerald-600">{selectedOrder.total}</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-b-xl space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-rose-600 rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  disabled={!CANCELABLE_STATUSES.includes(selectedOrder.status)}
                  onClick={() => setOrderStatus(selectedOrder.id, 'Đã hủy')}
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                  <span>Hủy đơn</span>
                </button>
                <button
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  disabled={!NEXT_STATUS[selectedOrder.status]}
                  onClick={() => {
                    const next = NEXT_STATUS[selectedOrder.status]
                    if (next) setOrderStatus(selectedOrder.id, next)
                  }}
                >
                  <CheckCircle size={14} />
                  <span>{NEXT_ACTION_LABEL[selectedOrder.status] ?? 'Đã xử lý xong'}</span>
                </button>
              </div>
            </div>
          </>
        ) : null}
      </DetailModal>

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
