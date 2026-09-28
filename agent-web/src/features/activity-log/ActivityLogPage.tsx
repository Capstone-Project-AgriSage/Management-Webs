import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import DetailModal from '../../components/ui/DetailModal'
import Pagination from '../../components/ui/Pagination'
import SearchInput from '../../components/ui/SearchInput'
import FilterSelect from '../../components/ui/FilterSelect'
import StatusBadge from '../../components/ui/StatusBadge'
import { useSelectableList } from '../../hooks/useSelectableList'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { logEntries as LOG_ENTRIES } from '../../data/mockActivityLog'
import { downloadCsv } from '../../utils/csv'

import {
  Download,
  History,
  ShoppingCart,
  Banknote,
  BrainCircuit,
  RotateCcw,
  Flag,
  Info,
  Link as LinkIcon,
  SlidersHorizontal,
  ArrowRight,
  Brain,
  Contact,
  Pencil,
  ChevronRight
} from 'lucide-react'

const MODULE_OPTIONS = ['Tất cả phân hệ', 'Đơn hàng', 'Giao hàng', 'Thanh toán', 'Công nợ', 'Gợi ý AI', 'Kho hàng', 'Sản phẩm', 'Nông dân']
const ACTION_OPTIONS = ['Tất cả loại thao tác', 'Tạo mới', 'Cập nhật', 'Xác nhận', 'Phê duyệt', 'Từ chối', 'Đối soát', 'Gửi nhắc', 'Điều chỉnh', 'Xuất kho', 'Nhập kho']
const ACTOR_OPTIONS = ['Người thực hiện: Tất cả', 'Nguyễn Văn Minh', 'ĐP. Lê Hoàng', 'KT. Trần Thảo', 'Hệ thống VietQR']

export default function ActivityLogPage() {
  usePageHeader({
    title: 'Nhật ký thao tác',
  })

  const { showToast } = useToast()
  const navigate = useNavigate()
  const { selectedId, setSelectedId, selected } = useSelectableList(LOG_ENTRIES, (entry) => entry.id)

  const [actionFilter, setActionFilter] = useState(ACTION_OPTIONS[0])
  const [actorFilter, setActorFilter] = useState(ACTOR_OPTIONS[0])

  const {
    search,
    setSearch,
    statusFilter: moduleFilter,
    setStatusFilter: setModuleFilter,
    filtered: filteredEntries,
    clearFilters: handleClearFiltersBase,
  } = useFilteredList(
    LOG_ENTRIES,
    MODULE_OPTIONS[0],
    (entry, keyword, moduleFilter) =>
      (!keyword ||
        entry.id.toLowerCase().includes(keyword) ||
        entry.actorName.toLowerCase().includes(keyword) ||
        entry.description.toLowerCase().includes(keyword) ||
        entry.objectId.toLowerCase().includes(keyword)) &&
      (moduleFilter === MODULE_OPTIONS[0] || entry.moduleLabel === moduleFilter) &&
      (actionFilter === ACTION_OPTIONS[0] || entry.actionLabel === actionFilter) &&
      (actorFilter === ACTOR_OPTIONS[0] || entry.actorName === actorFilter),
  )

  const handleClearFilters = () => {
    handleClearFiltersBase()
    setActionFilter(ACTION_OPTIONS[0])
    setActorFilter(ACTOR_OPTIONS[0])
  }

  const {
    page,
    totalPages,
    paginated: paginatedEntries,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredEntries, 10)

  const totalActionsToday = LOG_ENTRIES.length
  const orderActionsCount = LOG_ENTRIES.filter((e) => e.moduleLabel === 'Đơn hàng').length
  const paymentActionsCount = LOG_ENTRIES.filter((e) => e.moduleLabel === 'Thanh toán').length
  const aiActions = LOG_ENTRIES.filter((e) => e.moduleLabel === 'Gợi ý AI')
  const aiApprovedCount = aiActions.filter((e) => e.actionLabel === 'Phê duyệt').length
  const aiRejectedCount = aiActions.filter((e) => e.actionLabel === 'Từ chối').length

  return (
    <>
      {/* Trailing Action: Export Data */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <button
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50/50 text-slate-700 rounded-lg text-sm font-semibold shadow-sm transition"
          type="button"
          onClick={() => {
            downloadCsv(
              `nhat-ky-thao-tac-${Date.now()}.csv`,
              filteredEntries.map((entry) => ({
                'Thời gian': entry.time,
                'Người thực hiện': entry.actorName,
                'Phân hệ': entry.moduleLabel,
                'Thao tác': entry.actionLabel,
                'Đối tượng': entry.objectId,
                'Mô tả': entry.description,
                'Kết quả': entry.resultLabel,
              })),
            )
            showToast(`Đã xuất dữ liệu nhật ký (${filteredEntries.length} bản ghi)`)
          }}
        >
          <Download size={18} className="text-slate-500" />
          <span className="">Xuất dữ liệu nhật ký</span>
        </button>
      </div>

      {/* ==================== 4 SUMMARY KPI CARDS ==================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-500">Tổng thao tác hôm nay</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <History size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl text-slate-900 font-bold">{totalActionsToday}</span>
            <span className="text-sm text-slate-500">lượt</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Ghi nhận qua các kênh nghiệp vụ</span>
          </div>
        </div>
        {/* KPI 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-500">Đơn hàng cập nhật</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <ShoppingCart size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl text-slate-900 font-bold">{orderActionsCount}</span>
            <span className="text-sm text-slate-500">lượt</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span className="text-xs text-slate-500">Đã duyệt &amp; xuất kho</span>
          </div>
        </div>
        {/* KPI 3 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-500">Thanh toán ghi nhận</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Banknote size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl text-slate-900 font-bold">{paymentActionsCount}</span>
            <span className="text-sm text-slate-500">lượt</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            <span className="text-xs text-slate-500">Khớp lệnh VietQR &amp; tiền mặt</span>
          </div>
        </div>
        {/* KPI 4 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-500">Gợi ý AI đã xử lý</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center">
              <BrainCircuit size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl text-slate-900 font-bold">{aiActions.length}</span>
            <span className="text-sm text-slate-500">lượt</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center text-emerald-600 font-semibold text-xs">{aiApprovedCount} phê duyệt</span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center text-rose-600 font-semibold text-xs">{aiRejectedCount} từ chối</span>
          </div>
        </div>
      </section>

      {/* ==================== FILTER TOOLBAR ==================== */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mt-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm theo mã, nội dung, người thực hiện..." className="flex-1 min-w-[280px]" />
          {/* Dropdowns Group */}
          <div className="flex flex-wrap items-center gap-3">
            <FilterSelect value={moduleFilter} onChange={setModuleFilter} options={MODULE_OPTIONS} />
            <FilterSelect value={actionFilter} onChange={setActionFilter} options={ACTION_OPTIONS} />
            <FilterSelect value={actorFilter} onChange={setActorFilter} options={ACTOR_OPTIONS} />
            {/* Xóa bộ lọc */}
            <button
              className="flex items-center gap-1.5 text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-50 text-sm font-semibold transition-colors"
              type="button"
              onClick={handleClearFilters}
            >
              <RotateCcw size={16} />
              <span className="">Xóa bộ lọc</span>
            </button>
          </div>
        </div>
      </section>

      {/* ACTIVITY LOG TABLE & RECENT EVENTS */}
      <div className="space-y-4 mt-4">
          {/* Table Container */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                    <th className="py-4 px-4">Thời gian</th>
                    <th className="py-4 px-4">Người thực hiện</th>
                    <th className="py-4 px-3 text-center">Phân hệ</th>
                    <th className="py-4 px-3 text-center "></th>
                    <th className="py-4 px-3">Đối tượng</th>
                    <th className="py-4 px-4 min-w-[200px]">Mô tả nghiệp vụ</th>
                    <th className="py-4 px-3 text-center">Kết quả</th>
                    <th className="py-4 px-4 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {filteredEntries.length === 0 ? (
                    <EmptyTableRow colSpan={8} message="Không tìm thấy nhật ký phù hợp với bộ lọc." className="text-slate-400" />
                  ) : null}
                  {paginatedEntries.map((entry) => {
                    const isSelected = entry.id === selectedId
                    return (
                      <tr
                        key={entry.id}
                        onClick={() => setSelectedId(entry.id)}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-emerald-50 border-l-4 border-emerald-600' : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <td
                          className={`py-3 px-4 whitespace-nowrap font-mono text-[12px] ${
                            isSelected ? 'font-semibold text-slate-900' : 'text-slate-500'
                          }`}
                        >
                          {entry.time}
                          {entry.timeNote ? <div className="text-[10px] text-slate-400">{entry.timeNote}</div> : null}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{entry.actorName}</span>
                        </td>
                        <td className="py-4 px-3 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center justify-center min-w-[100px] px-2 py-0.5 rounded text-[11px] font-bold border ${entry.moduleClassName}`}>
                            {entry.moduleLabel}
                          </span>
                        </td>
                        <td className="py-4 px-3 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center justify-center min-w-[100px] px-2 py-0.5 rounded text-[11px] font-semibold ${entry.actionClassName}`}>
                            {entry.actionLabel}
                          </span>
                        </td>
                        <td className="py-4 px-3 whitespace-nowrap font-mono font-bold text-emerald-700">{entry.objectId}</td>
                        <td className="py-4 px-4 text-slate-900">
                          <p className="line-clamp-1 font-medium">{entry.description}</p>
                          <span className="text-[11px] text-slate-500">{entry.descriptionNote}</span>
                        </td>
                        <td className="py-4 px-3 whitespace-nowrap text-center">
                          <StatusBadge label={entry.resultLabel} className={entry.resultClassName} minWidthClassName="min-w-[105px]" />
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(entry.id);
                            }}
                            className={
                              isSelected
                                ? 'px-3 py-1 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition shadow-sm'
                                : 'px-3 py-1 rounded bg-white hover:bg-slate-50/50 border border-slate-300 text-slate-700 text-xs font-bold transition shadow-sm'
                            }
                          >
                            {isSelected ? 'Đang chọn' : 'Chi tiết'}
                          </button>
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
              unitLabel="bản ghi"
              goPrev={goPrev}
              goNext={goNext}
              setPage={setPage}
            />
          </div>
          {/* COMPACT SECTION: SỰ KIỆN QUAN TRỌNG GẦN ĐÂY */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700">
                <Flag size={20} />
                <h3 className="text-base font-bold text-slate-900">Sự kiện quan trọng gần đây</h3>
              </div>
              <span className="text-xs text-slate-500">Ghi nhận qua kênh nghiệp vụ chính thức</span>
            </div>
            <div className="space-y-3">
              {LOG_ENTRIES.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Không có sự kiện nào gần đây.</p>
              ) : (
                LOG_ENTRIES.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border mt-0.5 whitespace-nowrap ${entry.moduleClassName}`}
                    >
                      {entry.moduleLabel}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 font-medium leading-snug">{entry.description}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{entry.descriptionNote}</p>
                    </div>
                    <span className="font-mono text-slate-500 text-[11px] whitespace-nowrap font-medium">{entry.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
      </div>

      {/* DETAIL MODAL: NHẬT KÝ THAO TÁC ĐÃ CHỌN */}
      <DetailModal open={selected !== null} onClose={() => setSelectedId(null)}>
        {selected ? (
          <div className="flex flex-col overflow-hidden max-h-[85vh]">
          {/* Detail Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono font-bold text-lg text-slate-900">#{selected.id}</span>
                <StatusBadge label={selected.resultLabel} className={selected.resultClassName} />
              </div>
              <p className="text-sm text-slate-600">
                Thao tác: <span className="font-bold text-emerald-700">{selected.actionTypeLabel}</span>
              </p>
            </div>
          </div>
          {/* Body Content Zones */}
          <div className="flex-1 min-h-0 p-4 space-y-5 text-sm overflow-y-auto">
            {/* 1. THÔNG TIN CHUNG */}
            <div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider mb-2.5">
                <Info size={16} />
                <span className="">1. THÔNG TIN CHUNG</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Thời gian:</span>
                  <span className="font-medium text-slate-900 font-mono">
                    {selected.time} - {selected.timeNote ?? 'Hôm nay'} (04/12/2024)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Người thực hiện:</span>
                  <span className="font-semibold text-slate-900 text-right">
                    {selected.actorName}
                    <br />
                    <span className="text-[11px] text-slate-500 font-normal">{selected.actorRole}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Phân hệ:</span>
                  <span className="font-bold text-emerald-700">{selected.moduleLabel}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Địa chỉ IP / Thiết bị:</span>
                  <span className="font-mono text-slate-900 text-[11px]">{selected.ipDevice}</span>
                </div>
              </div>
            </div>
            {/* 2. ĐỐI TƯỢNG LIÊN QUAN */}
            <div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider mb-2.5">
                <LinkIcon size={16} />
                <span className="">2. ĐỐI TƯỢNG LIÊN QUAN</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2.5">
                {selected.relatedObjects.map((field) => (
                  <div key={field.label} className="flex justify-between items-start">
                    <span className="text-slate-500">{field.label}</span>
                    <span className="font-semibold text-slate-900 text-right">
                      {field.value}
                      {field.sub ? (
                        <>
                          <br />
                          <span className="text-[11px] text-slate-500 font-normal">{field.sub}</span>
                        </>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* 3. MÔ TẢ CHI TIẾT & BIẾN ĐỘNG TRẠNG THÁI */}
            <div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider mb-2.5">
                <SlidersHorizontal size={16} />
                <span className="">3. CHI TIẾT &amp; BIẾN ĐỘNG TRẠNG THÁI</span>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">Nội dung thao tác</span>
                  <p
                    className="text-slate-900 leading-relaxed text-sm"
                    dangerouslySetInnerHTML={{ __html: selected.operationContentHtml }}
                  />
                </div>
                {/* State transition flow */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Trước thao tác</span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${selected.beforeStateClassName}`}
                    >
                      {selected.beforeStateLabel}
                    </span>
                  </div>
                  <ArrowRight size={18} className="text-slate-400" />
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Sau thao tác</span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${selected.afterStateClassName}`}
                    >
                      {selected.afterStateLabel}
                    </span>
                  </div>
                </div>
                {/* Technical Note */}
                {selected.technicalNote ? (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-slate-700 shadow-sm">
                    <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                      <Pencil size={14} />
                      Ghi chú chuyên môn:
                    </div>
                    {selected.technicalNote}
                  </div>
                ) : null}
              </div>
            </div>
            {/* 4. LIÊN KẾT NGỮ CẢNH */}
            <div>
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider mb-2.5">
                <LinkIcon size={16} />
                <span className="">4. LIÊN KẾT NGỮ CẢNH</span>
              </div>
              <div className="space-y-2">
                {selected.relatedLinks.map((link) => (
                  <a
                    key={link.label}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50 transition-colors group shadow-sm cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      showToast('Liên kết này đang được phát triển');
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-slate-400 group-hover:text-emerald-600 transition-colors" data-icon={link.icon}>
                        {link.icon}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 group-hover:text-emerald-800 transition-colors">{link.label}</span>
                    </div>
                    {link.badgeLabel ? (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${link.badgeClassName ?? 'bg-slate-100 text-slate-700'}`}
                      >
                        {link.badgeLabel}
                      </span>
                    ) : (
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                    )}
                  </a>
                ))}
              </div>
            </div>
          </div>
          {/* 5. THAO TÁC NGỮ CẢNH (FOOTER ACTIONS) */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2.5">
            <button
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors"
              type="button"
              onClick={() => {
                navigate('/ai-recommendations')
                showToast(`Đang mở phân tích AI gốc cho ${selected.objectId}`)
              }}
            >
              <Brain size={18} />
              <span className="">Xem phân tích AI gốc</span>
            </button>
            <button
              className="w-full py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-50/50 text-slate-700 font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              type="button"
              onClick={() => {
                navigate('/farmers')
                showToast(`Đang mở hồ sơ liên quan đến ${selected.actorName}`)
              }}
            >
              <Contact size={18} className="text-slate-500" />
              <span className="">Xem hồ sơ khách hàng</span>
            </button>
          </div>
          </div>
        ) : null}
      </DetailModal>
    </>
  )
}
