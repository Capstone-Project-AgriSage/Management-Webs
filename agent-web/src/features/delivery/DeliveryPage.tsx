import { useState } from 'react'
import { Link } from 'react-router-dom'
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
import type { TripTimelineStep, DeliveryStatus } from '../../types'
import { useSelectableList } from '../../hooks/useSelectableList'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { useFormValues } from '../../hooks/useFormValues'
import { trips as INITIAL_TRIPS } from '../../data/mockDeliveries'
import { parseVnd, formatVnd } from '../../utils/money'
import { downloadCsv } from '../../utils/csv'
import type { Trip } from '../../types'

import {
  ChevronRight,
  Download,
  Printer,
  Plus,
  Clock,
  Banknote,
  Calendar,
  FilterX,
  User,
  CheckCircle2,
  Phone,
  AlertTriangle,
  Flag,
  Check,
  X,
  Radio
} from 'lucide-react'

const STATUS_OPTIONS = [
  'Tất cả trạng thái (Chờ, Đang giao, Thành công...)',
  'Chờ phân công',
  'Đã phân công',
  'Đang lấy hàng',
  'Đang giao',
  'Giao thành công',
  'Giao thất bại',
]

const DRIVER_OPTIONS = ['Tất cả tài xế', 'Nguyễn Văn Út', 'Lê Hoàng Nam', 'Trần Quốc Bảo', 'Huỳnh Minh Sang']
const COD_OPTIONS = ['Tất cả COD', 'Chờ thu COD', 'Đã thu COD', 'Đã CK / 0 COD', 'Tiền mặt tại kho', 'Chưa thu được']

const NEW_TRIP_DRIVERS = DRIVER_OPTIONS.slice(1)
const emptyTripForm = {
  orderId: '',
  customerName: '',
  customerPhone: '',
  addressShort: '',
  driverName: NEW_TRIP_DRIVERS[0] ?? '',
  scheduledWindow: '',
  codAmount: '',
}

const CREATE_TRIP_FIELDS: FormFieldSpec[] = [
  { key: 'orderId', label: 'Mã đơn hàng gốc (VD: #DH-2024-1082)' },
  { key: 'customerName', label: 'Tên khách hàng' },
  { key: 'customerPhone', label: 'Số điện thoại khách hàng' },
  { key: 'addressShort', label: 'Địa chỉ giao hàng' },
  { key: 'scheduledWindow', label: 'Khung giờ hẹn giao (VD: 10:00 - 10:30)' },
  { key: 'codAmount', label: 'Số tiền thu hộ COD (₫)' },
  { key: 'driverName', label: 'Tài xế', type: 'select', options: NEW_TRIP_DRIVERS },
]

const STATUS_VISUALS: Record<DeliveryStatus, { className: string; dotClassName: string; dotPulseClassName?: string }> = {
  'Chờ phân công': { className: 'bg-slate-100 text-slate-700 border-slate-300', dotClassName: 'bg-slate-500' },
  'Đã phân công': { className: 'bg-indigo-100 text-indigo-800 border-indigo-200', dotClassName: 'bg-indigo-600' },
  'Đang lấy hàng': { className: 'bg-amber-100 text-amber-800 border-amber-300', dotClassName: 'bg-amber-600' },
  'Đang giao': { className: 'bg-blue-100 text-blue-800 border-blue-200', dotClassName: 'bg-blue-600', dotPulseClassName: 'animate-ping' },
  'Giao thành công': { className: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotClassName: 'bg-emerald-600' },
  'Giao thất bại': { className: 'bg-rose-100 text-rose-800 border-rose-300', dotClassName: 'bg-rose-600' },
}

export default function DeliveryPage() {
  usePageHeader({
    title: 'Quản lý giao hàng',
  })

  const [trips, setTrips] = useState(INITIAL_TRIPS)
  const { showToast } = useToast()

  const setTripStatus = (id: string, label: DeliveryStatus) => {
    const visuals = STATUS_VISUALS[label]
    if (!visuals) return
    setTrips((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
            ...t,
            status: label,
            statusBadge: { label, className: visuals.className, dotClassName: visuals.dotClassName, dotPulseClassName: visuals.dotPulseClassName },
            rowClassName: undefined,
          }
          : t,
      ),
    )
    showToast(`Đã cập nhật chuyến #${id} sang "${label}"`)
  }

  const confirmDelivery = (id: string) => {
    setTripStatus(id, 'Giao thành công')
    setTrips((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, codStatus: 'Đã thu COD', codBadge: { label: 'Đã thu COD', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' } }
          : t,
      ),
    )
  }

  const handleTripAction = (id: string, label: string) => {
    if (label === 'Phân công tài xế') setTripStatus(id, 'Đã phân công')
    else if (label === 'Xử lý lại chuyến giao') setTripStatus(id, 'Đang giao')
    else if (label === 'Xem chi tiết' || label === 'Xem ghi chú') setSelectedId(id)
    else if (label === 'In phiếu giao') window.print()
    else showToast(`Đã thực hiện "${label}" cho chuyến #${id}`)
  }

  const [createOpen, setCreateOpen] = useState(false)
  const { values: createForm, update: updateCreateForm, reset: resetCreateForm } = useFormValues(emptyTripForm)

  const handleCreateTrip = () => {
    const { orderId, customerName, customerPhone, addressShort, driverName, scheduledWindow, codAmount } = createForm
    const cod = parseVnd(codAmount)
    if (!orderId.trim() || !customerName.trim() || !customerPhone.trim() || !addressShort.trim() || !scheduledWindow.trim() || cod <= 0) {
      showToast('Vui lòng nhập đầy đủ thông tin chuyến giao')
      return
    }
    const maxNum = trips.reduce((max, t) => {
      const n = Number.parseInt(t.id.split('-').pop() ?? '0', 10)
      return Number.isNaN(n) ? max : Math.max(max, n)
    }, 0)
    const newTrip: Trip = {
      id: `GH-${maxNum + 1}`,
      orderId: orderId.trim(),
      customerName: customerName.trim(),
      addressShort: addressShort.trim(),
      addressTitle: addressShort.trim(),
      driverName,
      driverIcon: 'Truck',
      vehicleLabel: 'Chưa xác định',
      etaLabel: scheduledWindow.trim(),
      etaClassName: 'text-slate-700 font-medium',
      codAmountLabel: formatVnd(cod),
      codAmountClassName: 'font-bold text-slate-900 tabular-nums',
      codStatus: 'Chờ thu COD',
      codBadge: { label: 'Chờ thu COD', className: 'bg-amber-100 text-amber-800 border border-amber-300' },
      status: 'Chờ phân công',
      statusBadge: { label: 'Chờ phân công', className: STATUS_VISUALS['Chờ phân công'].className, dotClassName: STATUS_VISUALS['Chờ phân công'].dotClassName },
      actions: [
        { label: 'Xem chi tiết', icon: 'Eye' },
        { label: 'Phân công tài xế', icon: 'UserPlus', tone: 'primary' },
      ],
      customerPhone: customerPhone.trim(),
      customerAddressDetail: addressShort.trim(),
      driverInitial: driverName.charAt(0),
      driverPhone: 'Chưa cập nhật',
      driverRoleLabel: 'Chưa phân công',
      scheduledWindow: scheduledWindow.trim(),
      timeline: [{ label: 'Đã tạo chuyến giao', time: 'Vừa xong', note: 'Chờ phân công tài xế', state: 'current', icon: 'Flag' }],
      items: [],
      orderTotalLabel: formatVnd(cod),
      codToCollectLabel: formatVnd(cod),
      codNote: 'Thu tiền mặt hoặc quét VietQR cá nhân của tài xế.',
    }
    setTrips((prev) => [newTrip, ...prev])
    showToast(`Đã tạo chuyến giao ${newTrip.id}`)
    resetCreateForm()
    setCreateOpen(false)
  }

  const handleExportTrips = () => {
    downloadCsv(
      `chuyen-giao-${Date.now()}.csv`,
      filteredTrips.map((t) => ({
        'Mã GH': t.id,
        'Mã đơn': t.orderId,
        'Khách hàng': t.customerName,
        'Địa chỉ': t.addressTitle,
        'Tài xế': t.driverName,
        'Thu COD': t.codAmountLabel,
        'Trạng thái': t.statusBadge.label,
      })),
    )
    showToast(`Đã xuất danh sách ${filteredTrips.length} chuyến giao`)
  }

  const handlePrintTrips = () => {
    showToast(`Đang in phiếu giao cho ${filteredTrips.length} chuyến`)
    window.print()
  }

  const { selectedId, setSelectedId, selected: selectedTrip } = useSelectableList(trips, (t) => t.id)

  const [driverFilter, setDriverFilter] = useState(DRIVER_OPTIONS[0])
  const [codFilter, setCodFilter] = useState(COD_OPTIONS[0])

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredTrips,
    clearFilters: handleClearFiltersBase,
  } = useFilteredList(
    trips,
    STATUS_OPTIONS[0],
    (trip, keyword, status) =>
      (!keyword ||
        trip.id.toLowerCase().includes(keyword) ||
        trip.orderId.toLowerCase().includes(keyword) ||
        trip.customerName.toLowerCase().includes(keyword)) &&
      (status === STATUS_OPTIONS[0] || trip.statusBadge.label === status) &&
      (driverFilter === DRIVER_OPTIONS[0] || trip.driverName === driverFilter) &&
      (codFilter === COD_OPTIONS[0] || trip.codBadge.label === codFilter),
  )

  const handleClearFilters = () => {
    handleClearFiltersBase()
    setDriverFilter(DRIVER_OPTIONS[0])
    setCodFilter(COD_OPTIONS[0])
  }

  const { page, totalPages, paginated: paginatedTrips, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filteredTrips, 10)

  const waitingTrips = trips.filter((t) => t.statusBadge.label === 'Chờ phân công').length
  const deliveringTrips = trips.filter((t) => t.statusBadge.label === 'Đang giao').length
  const succeededTrips = trips.filter((t) => t.statusBadge.label === 'Giao thành công').length
  const failedTrips = trips.filter((t) => t.statusBadge.label === 'Giao thất bại').length
  const successRate = trips.length ? Math.round((succeededTrips / trips.length) * 1000) / 10 : 0
  const totalCodAmount = trips.reduce((sum, t) => sum + parseVnd(t.codAmountLabel), 0)
  const reconciledCodAmount = trips
    .filter((t) => t.codBadge.label === 'Đã thu COD')
    .reduce((sum, t) => sum + parseVnd(t.codAmountLabel), 0)

  const timelineCircleClassName = (state: TripTimelineStep['state']) => {
    switch (state) {
      case 'done':
        return 'bg-emerald-600 text-white ring-4 ring-white'
      case 'current':
        return 'bg-emerald-800 text-white ring-4 ring-emerald-100 animate-pulse'
      case 'failed':
        return 'bg-rose-600 text-white ring-4 ring-white'
      default:
        return 'bg-slate-200 text-slate-400 ring-4 ring-white'
    }
  }

  const timelineIcon = (step: TripTimelineStep) => {
    if (step.state === 'done') return <Check size={14} />
    if (step.state === 'failed') return <X size={14} />
    return <Flag size={14} />
  }

  return (
    <>
      {/* 1. BREADCRUMB & PAGE HEADER WITH ONLY ONE MAIN CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-emerald-700 font-medium">Quản lý giao hàng</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50/50 text-slate-700 rounded-lg text-sm font-semibold shadow-sm transition-colors"
            type="button"
            onClick={handleExportTrips}
          >
            <Download size={16} className="text-slate-500" />
            <span className="">Xuất danh sách</span>
          </button>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50/50 text-slate-700 rounded-lg text-sm font-semibold shadow-sm transition-colors"
            type="button"
            onClick={handlePrintTrips}
          >
            <Printer size={16} className="text-slate-500" />
            <span className="">In phiếu giao loạt</span>
          </button>
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={18} />
            <span className="">Tạo chuyến giao</span>
          </button>
        </div>
      </div>

      {/* 2. 5 THẺ KPI TÓM TẮT GIAO HÀNG (Compact KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs uppercase tracking-wider font-semibold">Chờ giao</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100"></span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl text-slate-900 font-bold tabular-nums">{waitingTrips}</span>
            <span className="text-sm text-slate-500">chuyến</span>
          </div>
          <p className="text-xs text-amber-600 mt-1 font-medium truncate flex items-center gap-1">
            <Clock size={14} />
            Cần xếp xe/ghe
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs uppercase tracking-wider font-semibold">Đang giao</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100 animate-pulse"></span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl text-slate-900 font-bold tabular-nums">{deliveringTrips}</span>
            <span className="text-sm text-slate-500">chuyến</span>
          </div>
          <p className="text-xs text-slate-600 mt-1 truncate">
            Đang vận chuyển ghe xuồng &amp; xe lôi
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs uppercase tracking-wider font-semibold">Giao thành công</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl text-emerald-700 font-bold tabular-nums">{succeededTrips}</span>
            <span className="text-sm text-slate-500">chuyến</span>
          </div>
          <p className="text-xs text-emerald-700 mt-1 font-medium truncate">
            Đạt {successRate}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs uppercase tracking-wider font-semibold">Giao thất bại</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100"></span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl text-rose-600 font-bold tabular-nums">{failedTrips}</span>
            <span className="text-sm text-slate-500">chuyến</span>
          </div>
          <p className="text-xs text-rose-600 mt-1 font-medium truncate">
            Cần xử lý lại
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs uppercase tracking-wider font-semibold">Thu COD hôm nay</span>
            <Banknote size={16} className="text-slate-400" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl leading-tight text-slate-900 font-bold tabular-nums">{formatVnd(totalCodAmount)}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 truncate">
            Đã đối soát <span className="font-semibold text-emerald-700">{formatVnd(reconciledCodAmount)}</span>
          </p>
        </div>
      </div>

      {/* 3. BỘ LỌC TÌM KIẾM (Filters bar) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm mã giao hàng / mã đơn / khách hàng..."
            className="relative w-72 min-w-[220px]"
          />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          <FilterSelect value={driverFilter} onChange={setDriverFilter} options={DRIVER_OPTIONS} />
          <FilterSelect value={codFilter} onChange={setCodFilter} options={COD_OPTIONS} />
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium">
            <Calendar size={16} className="text-slate-400" />
            <span className="">Hôm nay - Vụ Thu Đông</span>
          </div>
        </div>
        <button
          className="text-sm font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1.5 transition-colors px-2 py-1"
          type="button"
          onClick={handleClearFilters}
        >
          <FilterX size={18} />
          <span className="">Xóa bộ lọc</span>
        </button>
      </div>

      {/* BẢNG DỮ LIỆU GIAO HÀNG */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">Danh sách các chuyến giao thực địa</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 font-semibold tabular-nums">{filteredTrips.length} chuyến</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="">Cập nhật trực tiếp: 09:28</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-4 px-4">Mã GH / Đơn</th>
                <th className="py-4 px-4">Khách hàng &amp; Địa chỉ</th>
                <th className="py-4 px-4 text-right">Thu COD</th>
                <th className="py-4 px-4 text-center">Trạng thái</th>
                <th className="py-4 px-4 text-right "></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTrips.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Không tìm thấy chuyến giao phù hợp với bộ lọc." className="text-slate-400" />
              ) : null}
              {paginatedTrips.map((trip) => {
                const isSelected = trip.id === selectedId
                return (
                  <tr
                    key={trip.id}
                    onClick={() => setSelectedId(trip.id)}
                    className={`transition-colors cursor-pointer ${isSelected
                      ? 'bg-emerald-50 hover:bg-emerald-50 border-l-4 border-l-emerald-600'
                      : `hover:bg-slate-50/50/80 ${trip.rowClassName ?? ''}`
                      }`}
                  >
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900 text-[13px]">{trip.id}</div>
                      <div className="text-[11px] text-slate-500">{trip.orderId}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-900">{trip.customerName}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[190px]" title={trip.addressTitle}>
                        {trip.addressShort}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className={trip.codAmountClassName}>{trip.codAmountLabel}</div>
                      <span className={`inline-block px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-semibold ${trip.codBadge.className}`}>
                        {trip.codBadge.label}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <StatusBadge label={trip.statusBadge.label} className={trip.statusBadge.className} minWidthClassName="min-w-[144px]" />
                      {trip.failureNote ? (
                        <div className="text-[11px] text-rose-600 mt-1 font-medium">{trip.failureNote}</div>
                      ) : null}
                    </td>
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end">
                        <RowActionsMenu
                          triggerLabel={`Thao tác chuyến #${trip.id}`}
                          actions={trip.actions.map((action) => ({
                            ...action,
                            onClick: () => handleTripAction(trip.id, action.label),
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
          unitLabel="chuyến giao"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1.5">
              <Radio size={16} className="text-emerald-600" />
              Nhật ký vận hành trực tiếp trạm Cần Thơ #04
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Tự động đồng bộ mỗi 30 giây</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">09:25</span>
                <span className=""><strong>GH-8821</strong> bắt đầu di chuyển về Thới Lai (Tài xế Út - Xe lôi)</span>
              </span>
              <span className="text-[11px] text-slate-500 shrink-0">GPS: 10.0452° N, 105.7469° E</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-blue-700 font-bold bg-blue-100 px-1.5 py-0.5 rounded">09:12</span>
                <span className=""><strong>GH-8819</strong> hoàn tất giao 30 gói Virtako tại Cờ Đỏ (Tài xế Bảo - Thu đủ 2.160.000 đ)</span>
              </span>
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 shrink-0">
                <CheckCircle2 size={14} /> Đã đối soát
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded">08:45</span>
                <span className=""><strong>GH-8817</strong> cập nhật thất bại: Khách hẹn giao sau mưa lớn (Điều phối viên Minh)</span>
              </span>
              <span className="text-[11px] text-rose-600 font-bold shrink-0">Hẹn lại 15:00</span>
            </div>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL: CHI TIẾT CHUYẾN GIAO ĐANG CHỌN */}
      <DetailModal open={selectedTrip !== null} onClose={() => setSelectedId(null)}>
        {selectedTrip ? (
          <div className="flex flex-col divide-y divide-slate-50">
            <div className="p-5 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Chi tiết chuyến giao</span>
                <StatusBadge label={selectedTrip.statusBadge.label} className={selectedTrip.statusBadge.className} />
              </div>
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-bold text-slate-900 font-mono">#{selectedTrip.id}</h2>
                <span className="text-sm text-slate-500">Đơn gốc: <strong className="text-slate-900 font-mono">{selectedTrip.orderId}</strong></span>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <User size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">{selectedTrip.customerName}</span>
                    <a className="text-sm text-emerald-700 font-bold hover:underline" href={`tel:${selectedTrip.customerPhone.replace(/\./g, '')}`}>{selectedTrip.customerPhone}</a>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 leading-snug">
                    {selectedTrip.customerAddressDetail}
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                    {selectedTrip.driverInitial}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedTrip.driverName}</p>
                    <p className="text-xs text-slate-500">{selectedTrip.driverRoleLabel} • {selectedTrip.driverPhone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Hẹn giao</span>
                  <span className="text-sm font-bold text-emerald-700">{selectedTrip.scheduledWindow}</span>
                </div>
              </div>
            </div>
            <div className="p-5 bg-white">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-4">Tiến độ chuyến giao</h3>
              <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 pl-1">
                {selectedTrip.timeline.map((step, idx) => (
                  <div key={idx} className="relative flex items-start gap-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${timelineCircleClassName(step.state)}`}>
                      {timelineIcon(step)}
                    </div>
                    {step.state === 'current' || step.state === 'failed' ? (
                      <div
                        className={`min-w-0 flex-1 p-3 rounded-xl border ${step.state === 'current' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-bold ${step.state === 'current' ? 'text-emerald-800' : 'text-rose-800'}`}>
                            {step.label}
                          </span>
                          <span className={`font-mono text-xs font-bold ${step.state === 'current' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {step.time}
                          </span>
                        </div>
                        <p className={`text-xs mt-1 ${step.state === 'current' ? 'text-emerald-600' : 'text-rose-600'}`}>{step.note}</p>
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm ${step.state === 'done' ? 'font-bold text-slate-900' : 'font-medium text-slate-500'}`}>
                            {step.label}
                          </span>
                          <span className={`font-mono text-xs ${step.state === 'done' ? 'text-slate-500' : 'text-slate-400'}`}>{step.time}</span>
                        </div>
                        <p className={`text-xs mt-0.5 ${step.state === 'done' ? 'text-slate-600' : 'text-slate-400'}`}>{step.note}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 font-bold">Danh mục vật tư giao đợt này</h3>
              <div className="space-y-2 text-sm divide-y divide-slate-50">
                {selectedTrip.items.map((item) => (
                  <div key={item.name} className="pt-2 flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.qtyPrice}</p>
                    </div>
                    <span className="font-bold text-slate-900 tabular-nums">{item.total}</span>
                  </div>
                ))}
                {selectedTrip.shippingFeeNote ? (
                  <div className="pt-2 flex justify-between items-start text-xs text-slate-500 font-medium">
                    <span className="">{selectedTrip.shippingFeeNote.label}</span>
                    <span className={selectedTrip.shippingFeeNote.valueClassName}>{selectedTrip.shippingFeeNote.value}</span>
                  </div>
                ) : null}
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 mt-3">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm text-amber-900 font-semibold">Tổng tiền đơn hàng:</span>
                  <span className="font-bold text-amber-900 tabular-nums">{selectedTrip.orderTotalLabel}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-amber-200">
                  <span className="text-sm text-amber-700 font-bold flex items-center gap-1.5">
                    <Banknote size={18} />
                    Cần thu hộ COD:
                  </span>
                  <span className="text-xl font-bold text-amber-900 tabular-nums">{selectedTrip.codToCollectLabel}</span>
                </div>
                <p className="text-xs text-amber-700 mt-2 font-medium">
                  * {selectedTrip.codNote}
                </p>
              </div>
            </div>
            <div className="p-5 bg-slate-50 space-y-3">
              <button
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                disabled={selectedTrip.statusBadge.label === 'Giao thành công'}
                onClick={() => confirmDelivery(selectedTrip.id)}
              >
                <CheckCircle2 size={20} />
                <span className="">
                  {selectedTrip.statusBadge.label === 'Giao thành công' ? 'Đã giao thành công' : 'Xác nhận giao hàng & Thu COD'}
                </span>
              </button>
              <div className="grid grid-cols-2 gap-3">
                <a
                  className="py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-50/50 text-slate-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  href={`tel:${selectedTrip.driverPhone.replace(/\./g, '')}`}
                >
                  <Phone size={16} className="text-emerald-700" />
                  <span className="">Gọi tài xế</span>
                </a>
                <button
                  className="py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-50/50 text-slate-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  type="button"
                  onClick={() => {
                    showToast(`Đang in phiếu giao cho chuyến #${selectedTrip.id}`)
                    window.print()
                  }}
                >
                  <Printer size={16} className="text-slate-500" />
                  <span className="">In phiếu giao</span>
                </button>
              </div>
              <button
                className="w-full py-2.5 px-3 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                type="button"
                onClick={() => {
                  setTripStatus(selectedTrip.id, 'Giao thất bại')
                  showToast(`Đã ghi nhận báo giao thất bại / đổi lịch cho chuyến #${selectedTrip.id}`)
                }}
              >
                <AlertTriangle size={18} />
                <span className="">Báo giao thất bại / Đổi lịch</span>
              </button>
            </div>
          </div>
        ) : null}
      </DetailModal>

      {/* MODAL: TẠO CHUYẾN GIAO MỚI */}
      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo chuyến giao mới"
        fields={CREATE_TRIP_FIELDS}
        values={createForm}
        onChange={updateCreateForm}
        onSubmit={handleCreateTrip}
        submitLabel="Tạo chuyến giao"
      />
    </>
  )
}
