import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Receipt, CreditCard, CheckCircle2, Phone, MapPin, Activity, FileText } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import KpiCard from '@/components/ui/KpiCard'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import DetailModal from '@/components/ui/DetailModal'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import StatusBadge from '@/components/ui/StatusBadge'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { useSelectableList } from '@/hooks/useSelectableList'
import { useFilteredList } from '@/hooks/useFilteredList'
import { usePagination } from '@/hooks/usePagination'
import { farmers as FARMERS } from '@/features/sales/data/mockFarmers'
import { parseVnd, formatVnd } from '@/utils/money'

const DEBT_OPTIONS = ['Tất cả công nợ', 'Có công nợ', 'Không có nợ', 'Nợ quá hạn']
const REGION_OPTIONS = ['Tất cả khu vực', ...new Set(FARMERS.map((f) => f.areaShort.split(',').pop()?.trim() ?? '').filter(Boolean))]

export default function FarmersPage() {
  usePageHeader({
    title: 'Farmer',
    subtitle: 'Tìm kiếm Farmer và xem lịch sử mua hàng khi bán tại quầy',
  })

  const { showToast } = useToast()
  const navigate = useNavigate()
  const { selectedId, setSelectedId, selected: selectedFarmer } = useSelectableList(FARMERS, (f) => f.id)

  const [regionFilter, setRegionFilter] = useState(REGION_OPTIONS[0])

  const {
    search,
    setSearch,
    statusFilter: debtFilter,
    setStatusFilter: setDebtFilter,
    filtered: filteredFarmers,
    clearFilters: handleClearFiltersBase,
  } = useFilteredList(
    FARMERS,
    DEBT_OPTIONS[0],
    (farmer, keyword, debtFilter) =>
      (!keyword ||
        farmer.name.toLowerCase().includes(keyword) ||
        farmer.phone.toLowerCase().includes(keyword) ||
        farmer.areaShort.toLowerCase().includes(keyword)) &&
      (debtFilter === DEBT_OPTIONS[0] ||
        (debtFilter === 'Có công nợ' && farmer.hasDebt) ||
        (debtFilter === 'Không có nợ' && !farmer.hasDebt) ||
        (debtFilter === 'Nợ quá hạn' && farmer.status === 'Quá hạn nợ')) &&
      (regionFilter === REGION_OPTIONS[0] || farmer.areaShort.includes(regionFilter)),
  )

  const handleClearFilters = () => {
    handleClearFiltersBase()
    setRegionFilter(REGION_OPTIONS[0])
  }

  const { page, totalPages, paginated: paginatedFarmers, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filteredFarmers, 10)

  const handleCreateOrder = (farmerName: string) => {
    showToast(`Đang mở tạo đơn tại quầy cho ${farmerName}`)
    navigate('/orders')
  }

  const totalFarmers = FARMERS.length
  const totalOrders = FARMERS.reduce((sum, f) => sum + (Number.parseInt(f.totalOrdersCount, 10) || 0), 0)
  const activeFarmerCount = FARMERS.filter((f) => f.status === 'Đang hoạt động').length
  const activePercent = totalFarmers ? Math.round((activeFarmerCount / totalFarmers) * 1000) / 10 : 0
  const inDebtFarmers = FARMERS.filter((f) => f.hasDebt)
  const totalDebtAmount = inDebtFarmers.reduce((sum, f) => sum + parseVnd(f.debtLabel), 0)

  return (
    <>
      {/* KPI TILES OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          layout="header"
          icon={Users}
          iconClassName="bg-emerald-50 text-emerald-600"
          title="Tổng Farmer"
          value={totalFarmers}
          valueSuffix={<span className="text-xs text-slate-500 font-medium">người</span>}
          subtitle="Trong danh sách phụ trách tại quầy"
        />
        <KpiCard
          layout="header"
          icon={Receipt}
          iconClassName="bg-blue-50 text-blue-600"
          title="Tổng đơn hàng"
          value={totalOrders}
          valueSuffix={
            <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">{activePercent}% đang hoạt động</span>
          }
          subtitle="Lũy kế từ trước đến nay"
        />
        <KpiCard
          layout="header"
          icon={CreditCard}
          iconClassName="bg-red-50 text-red-600"
          title="Đang có công nợ"
          value={inDebtFarmers.length}
          valueClassName="text-red-600"
          valueSuffix={<span className="text-xs text-slate-500 font-medium">người</span>}
          subtitle={
            <>
              Tổng nợ: <span className="font-semibold text-slate-700">{formatVnd(totalDebtAmount)}</span>
            </>
          }
        />
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mt-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm tên Farmer, số điện thoại..."
            className="relative min-w-[220px] flex-1 max-w-xs"
          />
          <FilterSelect value={regionFilter} onChange={setRegionFilter} options={REGION_OPTIONS} />
          <FilterSelect value={debtFilter} onChange={setDebtFilter} options={DEBT_OPTIONS} />
        </div>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 h-9 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          onClick={handleClearFilters}
          type="button"
        >
          <span>Xóa bộ lọc</span>
        </button>
      </div>

      {/* MAIN FARMER TABLE */}
      <div className="pt-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden min-w-0">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-4 px-4">Farmer</th>
                <th className="py-4 px-3">Số điện thoại</th>
                <th className="py-4 px-3">Khu vực</th>
                <th className="py-4 px-3">Đơn gần nhất</th>
                <th className="py-4 px-3 text-center">Tổng mua</th>
                <th className="py-4 px-3 text-center">Công nợ</th>
                <th className="py-4 px-3 text-center">Trạng thái</th>
                <th className="py-4 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm font-normal">
              {filteredFarmers.length === 0 ? (
                <EmptyTableRow colSpan={8} message="Không tìm thấy Farmer phù hợp với bộ lọc." className="text-slate-400" />
              ) : null}
              {paginatedFarmers.map((farmer) => {
                const isSelected = farmer.id === selectedId
                return (
                  <tr
                    key={farmer.id}
                    onClick={() => setSelectedId(farmer.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-emerald-50/50 border-l-2 border-l-emerald-500 hover:bg-emerald-50' : 'hover:bg-slate-50/50 border-l-2 border-transparent'
                    }`}
                  >
                    <td className="py-4.5 px-4">
                      <div className="font-medium text-slate-900 flex items-center gap-1.5">
                        <span>{farmer.name}</span>
                        {farmer.verified ? (
                          <span title="Đã xác thực">
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-slate-500">#{farmer.id}</div>
                    </td>
                    <td className="py-4.5 px-3 font-medium text-slate-700 text-xs">{farmer.phone}</td>
                    <td className="py-3.5 px-3 text-slate-600 truncate max-w-[130px] text-xs" title={farmer.areaTitle}>
                      {farmer.areaShort}
                    </td>
                    <td className="py-4.5 px-3">
                      <span className="font-medium text-slate-900 text-xs">{farmer.lastOrderId}</span>
                      <span className="block text-[11px] text-slate-500">{farmer.lastOrderAgo}</span>
                    </td>
                    <td className="py-4.5 px-3 text-center font-medium text-slate-900 text-xs tabular-nums">{farmer.totalPurchaseLabel}</td>
                    <td className="py-4.5 px-3 text-center">
                      {farmer.hasDebt ? (
                        <>
                          <span
                            className={`font-medium px-2 py-0.5 rounded text-[11px] ${
                              farmer.debtOverdue
                                ? 'text-rose-700 bg-rose-50 border border-rose-200'
                                : 'text-amber-800 bg-amber-50 border border-amber-200'
                            }`}
                          >
                            {farmer.debtLabel}
                          </span>
                          {farmer.debtNote ? (
                            <span className={`block text-[10px] mt-1 ${farmer.debtOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
                              {farmer.debtNote}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="font-medium text-slate-400 text-xs">{farmer.debtLabel}</span>
                      )}
                    </td>
                    <td className="py-4.5 px-3 text-center">
                      <StatusBadge label={farmer.statusBadge.label} className={farmer.statusBadge.className} minWidthClassName="min-w-[120px]" />
                    </td>
                    <td className="py-4.5 px-4 text-center">
                      <div className="flex items-center justify-center">
                        <RowActionsMenu
                          triggerLabel={`Thao tác ${farmer.name}`}
                          actions={[
                            { label: 'Xem chi tiết', icon: 'visibility', onClick: () => setSelectedId(farmer.id) },
                            { label: 'Tạo đơn tại quầy', icon: 'point_of_sale', tone: 'primary', onClick: () => handleCreateOrder(farmer.name) },
                          ]}
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
          unitLabel="Farmer"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>

      {/* DETAIL MODAL: THÔNG TIN FARMER */}
      <DetailModal open={selectedFarmer !== null} onClose={() => setSelectedId(null)} widthClassName="max-w-lg">
        {selectedFarmer ? (
          <div className="flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg text-slate-900 font-bold">{selectedFarmer.name}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                    #{selectedFarmer.id}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <Phone size={12} className="text-slate-400" />
                  <span className="font-medium text-slate-700">{selectedFarmer.phone}</span>
                </div>
              </div>
              <StatusBadge label={selectedFarmer.statusBadge.label} className={selectedFarmer.statusBadge.className} />
            </div>
            <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
              <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                  <MapPin size={16} className="text-slate-400" />
                  <span>Thông tin cư trú</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 min-w-[75px]">Địa chỉ:</span>
                    <span className="font-medium text-slate-800 text-right">{selectedFarmer.fullAddress}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Ngày tham gia:</span>
                    <span className="font-medium text-slate-800">{selectedFarmer.joinDate}</span>
                  </div>
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <Activity size={16} className="text-slate-400" />
                    <span>Tổng quan giao dịch</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Tổng: <strong className="text-slate-800">{selectedFarmer.totalOrdersCount}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-white p-2 border border-slate-200 rounded-lg shadow-sm">
                    <div className="text-[11px] text-slate-500">Tổng giá trị mua hàng</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedFarmer.totalPurchaseValue}</div>
                  </div>
                  <div className="bg-white p-2 border border-slate-200 rounded-lg shadow-sm">
                    <div className="text-[11px] text-slate-500">{selectedFarmer.lastOrderDateNote}</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedFarmer.lastOrderValue}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-slate-600">
                      Đã thanh toán: <strong className="text-emerald-600">{selectedFarmer.paidAmount}</strong> ({selectedFarmer.paidPercent})
                    </span>
                    <span className="text-slate-600">
                      Công nợ: <strong className="text-rose-600">{selectedFarmer.debtLabel}</strong>
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: selectedFarmer.paidPercent }}></div>
                    <div className="bg-amber-500 h-full" style={{ width: selectedFarmer.debtPercent }}></div>
                  </div>
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <FileText size={16} className="text-slate-400" />
                    <span>Đơn hàng gần đây</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedFarmer.recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div>
                        <div className="font-semibold text-slate-800">{order.id}</div>
                        <div className="text-[11px] text-slate-500">
                          {order.date} - {order.note}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">{order.amount}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${order.statusClassName}`}>{order.statusLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200">
              <button
                className="w-full px-3 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-center font-semibold text-xs transition-colors shadow-sm"
                onClick={() => handleCreateOrder(selectedFarmer.name)}
                type="button"
              >
                Tạo đơn tại quầy
              </button>
            </div>
          </div>
        ) : null}
      </DetailModal>
    </>
  )
}
