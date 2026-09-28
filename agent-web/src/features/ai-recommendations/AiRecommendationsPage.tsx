import { useRef, useState, useMemo } from 'react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import DetailModal from '../../components/ui/DetailModal'
import Pagination from '../../components/ui/Pagination'
import SearchInput from '../../components/ui/SearchInput'
import FilterSelect from '../../components/ui/FilterSelect'
import StatusBadge from '../../components/ui/StatusBadge'
import { useSelectableList } from '../../hooks/useSelectableList'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { aiCases as INITIAL_AI_CASES } from '../../data/mockAiRecommendations'
import { products as STORE_PRODUCTS } from '../../data/mockProducts'

import {
  Download,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Pencil,
  X,
  Check,
  CheckCircle,
  Package,
  ChevronRight,
} from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  'cho-duyet': 'Chờ duyệt',
  'da-duyet': 'Đã phê duyệt',
  'da-tu-choi': 'Đã từ chối',
  'chua-chac-chan': 'Chưa đủ chắc chắn',
}

const REJECT_REASON_LABELS: Record<string, string> = {
  mo: 'Ảnh mờ / Cháy sáng',
  nham: 'Nhận diện nhầm bệnh',
  'ngoai-pham-vi': 'Không phải lá lúa / Ngoài phạm vi 5 bệnh',
  'sai-giai-doan': 'Sai giai đoạn phát triển',
  'khang-thuoc': 'Khu vực đã kháng hoạt chất này',
}

const CANONICAL_RICE_DISEASES = [
  { id: 'dao-on', label: 'Bệnh đạo ôn lá (Pyricularia oryzae)' },
  { id: 'bac-la', label: 'Bệnh bạc lá vi khuẩn (Xanthomonas oryzae)' },
  { id: 'kho-van', label: 'Bệnh khô vằn (Rhizoctonia solani)' },
  { id: 'dom-nau', label: 'Bệnh đốm nâu (Bipolaris oryzae)' },
  { id: 'khoe-manh', label: 'Lúa sinh trưởng khỏe mạnh' },
]

const DISEASE_KEYWORDS: Record<string, string> = {
  'dao-on': 'Đạo ôn',
  'bac-la': 'Bạc lá',
  'kho-van': 'Khô vằn',
  'dom-nau': 'Đốm nâu',
}

const CONFIDENCE_RANGES: Record<string, (percent: number) => boolean> = {
  high: (percent) => percent > 90,
  med: (percent) => percent >= 75 && percent <= 90,
  low: (percent) => percent < 75,
}

const DISEASE_OPTIONS = [
  { value: '', label: 'Tất cả bệnh' },
  { value: 'dao-on', label: 'Đạo ôn lá' },
  { value: 'bac-la', label: 'Bạc lá vi khuẩn' },
  { value: 'kho-van', label: 'Khô vằn' },
  { value: 'dom-nau', label: 'Đốm nâu' },
]

const AI_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'cho-duyet', label: 'Chờ duyệt' },
  { value: 'da-duyet', label: 'Đã phê duyệt' },
  { value: 'da-tu-choi', label: 'Đã từ chối' },
  { value: 'chua-chac-chan', label: 'Cần khảo sát (<70%)' },
]

const CONFIDENCE_OPTIONS = [
  { value: '', label: 'Tất cả độ tin cậy' },
  { value: 'high', label: '>90% (Cao)' },
  { value: 'med', label: '75-90% (Phù hợp)' },
  { value: 'low', label: '<75% (Thấp)' },
]

type TabKey = 'all' | 'pending' | 'approved' | 'rejected'

export default function AiRecommendationsPage() {
  usePageHeader({ title: '' }) // Flat layout doesn't use global page header background

  const { user } = useAuth()
  const [cases, setCases] = useState(INITIAL_AI_CASES)
  const { showToast } = useToast()
  const agentNoteRef = useRef<HTMLTextAreaElement>(null)
  const rejectReasonRef = useRef<HTMLSelectElement>(null)

  const [activeTab, setActiveTab] = useState<TabKey>('all')

  // Correction Mode State
  const [isCorrecting, setIsCorrecting] = useState(false)
  const [correctedDisease, setCorrectedDisease] = useState(CANONICAL_RICE_DISEASES[0].label)
  const [correctedProductId, setCorrectedProductId] = useState(STORE_PRODUCTS[0]?.id ?? '')

  const approveCase = (id: string) => {
    if (!user.can_review_ai) {
      showToast('Tài khoản của bạn không có quyền Thẩm định viên AI')
      return
    }
    const note = agentNoteRef.current?.value.trim()
    setCases((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
            ...c,
            status: 'Đã phê duyệt',
            statusBadge: { label: 'Đã phê duyệt', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300', dotClassName: 'bg-emerald-600' },
            panelBadge: { label: 'Đã gửi đến nông dân', className: 'bg-emerald-100 text-emerald-800', dotClassName: 'bg-emerald-600' },
            actionsMode: 'sent' as const,
            rowClassName: undefined,
            agentNote: note || c.agentNote,
          }
          : c,
      ),
    )
    showToast(`Đã phê duyệt gợi ý #${id} - đã gửi đến nông dân`)
  }

  const approveWithCorrection = (id: string) => {
    if (!user.can_review_ai) {
      showToast('Tài khoản của bạn không có quyền Thẩm định viên AI')
      return
    }
    const matchedProduct = STORE_PRODUCTS.find((p) => p.id === correctedProductId)
    const note = agentNoteRef.current?.value.trim()
    setCases((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              diseaseLabel: correctedDisease.split('(')[0].replace('Bệnh ', '').trim(),
              diseaseFullLabel: correctedDisease,
              statusBadge: { label: 'Đã phê duyệt', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300', dotClassName: 'bg-emerald-600' },
              panelBadge: { label: 'Đã hiệu chỉnh & gửi', className: 'bg-emerald-100 text-emerald-800', dotClassName: 'bg-emerald-600' },
              actionsMode: 'sent' as const,
              rowClassName: undefined,
              agentNote: note || `Đại lý đã hiệu chỉnh bệnh thành: ${correctedDisease}. Chỉ định thuốc ${matchedProduct?.name}.`,
              productLine: matchedProduct?.name,
              productSubLine: matchedProduct?.description,
              product: matchedProduct
                ? {
                    name: matchedProduct.name,
                    category: matchedProduct.categoryLabel,
                    activeIngredient: matchedProduct.description,
                    fitTag: 'Đại lý hiệu chỉnh phác đồ',
                    price: matchedProduct.price,
                    priceUnit: `/ ${matchedProduct.unit}`,
                    stockLabel: `Kho: ${matchedProduct.stockQuantity} ${matchedProduct.unit}`,
                    stockNote: 'Sẵn hàng tại kho Thới Lai',
                    reasoning: 'Thẩm định viên chuyên môn đã hiệu chỉnh bệnh thực tế và chỉ định thuốc đặc trị phù hợp.',
                  }
                : c.product,
            }
          : c,
      ),
    )
    showToast(`Đã hiệu chỉnh và phê duyệt ca #${id}`)
    setIsCorrecting(false)
  }

  const rejectCase = (id: string) => {
    const reasonValue = rejectReasonRef.current?.value
    const reasonLabel = reasonValue ? REJECT_REASON_LABELS[reasonValue] : undefined
    setCases((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
            ...c,
            status: 'Đã từ chối',
            statusBadge: { label: 'Đã từ chối', className: 'bg-slate-200 text-slate-700 border border-slate-300', dotClassName: 'bg-slate-500' },
            panelBadge: { label: 'Đã từ chối', className: 'bg-slate-200 text-slate-700', dotClassName: 'bg-slate-500' },
            rowClassName: undefined,
            rejectReasonLabel: reasonLabel,
          }
          : c,
      ),
    )
    showToast(`Đã từ chối gợi ý #${id}`)
  }

  const requestFieldSurvey = (id: string, farmerName: string) => {
    showToast(`Đã gửi yêu cầu khảo sát thực địa cho ${farmerName} (#${id})`)
  }

  const handleCaseAction = (id: string, label: string) => {
    if (label === 'Duyệt nhanh gợi ý') approveCase(id)
    else if (label === 'Từ chối') rejectCase(id)
  }

  const { selectedId, setSelectedId, selected } = useSelectableList(cases, (c) => c.id)

  const [diseaseFilter, setDiseaseFilter] = useState('')
  const [confidenceFilter, setConfidenceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const {
    search,
    setSearch,
    filtered: filteredCases,
    clearFilters: handleClearFiltersBase,
  } = useFilteredList(
    cases,
    'all',
    (item, keyword) => {
      // 1. Text Search
      const matchKey = !keyword || item.id.toLowerCase().includes(keyword) || item.farmerName.toLowerCase().includes(keyword) || item.field.farmerPhone.toLowerCase().includes(keyword)
      // 2. Tab Filter
      const matchTab = activeTab === 'all' ||
        (activeTab === 'pending' && item.statusBadge.label === 'Chờ duyệt') ||
        (activeTab === 'approved' && item.statusBadge.label === 'Đã phê duyệt') ||
        (activeTab === 'rejected' && item.statusBadge.label === 'Đã từ chối')
      // 3. Dropdowns
      const matchStatus = !statusFilter || item.statusBadge.label === STATUS_LABELS[statusFilter]
      const matchDisease = !diseaseFilter || item.diseaseLabel.includes(DISEASE_KEYWORDS[diseaseFilter])
      const matchConf = !confidenceFilter || CONFIDENCE_RANGES[confidenceFilter](item.confidencePercent)

      return matchKey && matchTab && matchStatus && matchDisease && matchConf
    },
    '',
  )

  const handleClearFilters = () => {
    handleClearFiltersBase()
    setDiseaseFilter('')
    setConfidenceFilter('')
    setStatusFilter('')
  }

  const {
    page,
    totalPages,
    paginated: paginatedCases,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredCases, 20)

  // GROUP THE DATA
  const groupedCases = useMemo(() => {
    const groups: Record<string, typeof paginatedCases> = {}
    paginatedCases.forEach((c) => {
      const groupName = c.diseaseLabel || 'Bệnh khác'
      if (!groups[groupName]) groups[groupName] = []
      groups[groupName].push(c)
    })
    return groups
  }, [paginatedCases])

  const uncertainCount = cases.filter((c) => c.statusBadge.label === 'Chưa đủ chắc chắn').length

  const TABS: { key: TabKey, label: string }[] = [
    { key: 'all', label: 'Tất cả ca' },
    { key: 'pending', label: 'Chờ duyệt' },
    { key: 'approved', label: 'Đã phê duyệt' },
    { key: 'rejected', label: 'Đã từ chối' }
  ]

  return (
    <div className="bg-white -m-4 lg:-m-6 p-4 lg:p-8 min-h-[calc(100vh-4rem)] text-slate-900">

      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Thẩm định chẩn đoán bệnh lúa</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý và phê duyệt các phác đồ điều trị do AI đề xuất từ ảnh chụp của nông dân.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50/50 text-slate-700 rounded-md text-[13px] font-semibold transition-colors shadow-sm"
            onClick={() => showToast('Đang xuất báo cáo JSON')}
          >
            <Download size={15} />
            <span>Xuất JSON</span>
          </button>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[13px] font-semibold transition-colors shadow-sm border border-slate-900"
            onClick={() => showToast('Đã đồng bộ ca mới nhất từ App nông dân')}
          >
            <RefreshCw size={14} />
            <span>Đồng bộ từ App</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 border-b border-slate-200 flex items-center gap-6 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1) }}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.key
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Warning Alert (if needed) */}
      {uncertainCount > 0 && activeTab === 'all' && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-[13px] font-bold text-amber-900">Cần xem xét kỹ ({uncertainCount} ca)</h3>
              <p className="text-[13px] text-amber-700 mt-0.5">Có {uncertainCount} ca thẩm định chưa đủ độ tin cậy (dưới 70%), kỹ sư cần kiểm tra kỹ lại ảnh hoặc yêu cầu khảo sát thực địa trước khi duyệt.</p>
            </div>
          </div>
          <button
            className="shrink-0 text-[13px] font-semibold text-amber-900 hover:text-amber-700 flex items-center gap-1"
            onClick={() => { setStatusFilter('chua-chac-chan'); setActiveTab('all') }}
          >
            Lọc ca này <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mt-6">
        <div className="relative max-w-sm flex-1 min-w-[240px]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm kiếm mã AI, nông dân..."
            className="w-full bg-white border-slate-300"
          />
        </div>
        <FilterSelect value={diseaseFilter} onChange={setDiseaseFilter} options={DISEASE_OPTIONS} className="w-auto" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={AI_STATUS_OPTIONS} className="w-auto" />
        <FilterSelect value={confidenceFilter} onChange={setConfidenceFilter} options={CONFIDENCE_OPTIONS} className="w-auto" />

        {(search || diseaseFilter || statusFilter || confidenceFilter) && (
          <button
            className="px-3 py-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 font-semibold text-[13px] flex items-center gap-1.5 transition-colors"
            onClick={handleClearFilters}
          >
            <RotateCcw size={14} />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      {/* Grouped Table */}
      <div className="mt-6 border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-4 px-4 w-28">Mã ca</th>
                <th className="py-4 px-4">Nông dân & Thửa</th>
                <th className="py-4 px-3">Ảnh lá</th>
                <th className="py-4 px-3 text-center">Độ tin cậy</th>
                <th className="py-4 px-3">Sản phẩm gợi ý</th>
                <th className="py-4 px-3 w-40 text-center">Trạng thái</th>
                <th className="py-4 px-4 w-10 "></th>
              </tr>
            </thead>

            {filteredCases.length === 0 && (
              <tbody className="divide-y divide-slate-50 text-[13px]">
                <EmptyTableRow colSpan={7} message="Không tìm thấy kết quả phù hợp với bộ lọc." className="text-slate-500 py-10" />
              </tbody>
            )}

            {Object.entries(groupedCases).map(([groupName, groupCases]) => (
              <tbody key={groupName} className="divide-y divide-slate-50 text-[13px]">
                {/* GROUP SUBHEADER */}
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <td colSpan={7} className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-slate-700">{groupName}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold">{groupCases.length} ca</span>
                    </div>
                  </td>
                </tr>

                {/* GROUP ITEMS */}
                {groupCases.map((item) => {
                  const isSelected = item.id === selectedId
                  return (
                    <tr
                      key={item.id}
                      onClick={() => { setSelectedId(item.id); setIsCorrecting(false) }}
                      className={`transition-colors cursor-pointer group ${isSelected
                        ? 'border-l-2 border-l-emerald-600 bg-emerald-50 hover:bg-emerald-50'
                        : `hover:bg-slate-50/50 border-l-2 border-l-transparent ${item.rowClassName ?? ''}`
                        }`}
                    >
                      <td className="py-4 px-4">
                        <span className={`font-mono font-bold ${isSelected ? 'text-emerald-700' : item.idClassName}`}>#{item.id}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900">{item.farmerName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{item.farmerLocationLine}</div>
                      </td>
                      <td className="py-4 px-3">
                        <div className={`w-10 h-10 rounded-md border overflow-hidden relative group-hover:border-emerald-300 transition-colors ${item.imageBorderClassName}`}>
                          <img className={`w-full h-full object-cover ${item.imageBlurred ? 'blur-[1px] opacity-80' : ''}`} data-alt={item.imageAlt} src={item.imageSrc} />
                        </div>
                      </td>
                      <td className="py-4 px-3 text-center">
                        <span className={`font-bold text-[11px] tabular-nums ${item.confidenceTextClassName}`}>{item.confidencePercent}%</span>
                        <span className={`text-[11px] block mt-1 font-medium ${item.confidenceNoteClassName}`}>{item.confidenceNote}</span>
                      </td>
                      <td className="py-4 px-3">
                        {item.productLine ? (
                          <>
                            <div className="font-semibold text-slate-900">{item.productLine}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{item.productSubLine}</div>
                          </>
                        ) : (
                          <span className="text-slate-400 font-medium">—</span>
                        )}
                        {!item.productLine ? <div className="text-[11px] text-amber-700 font-bold mt-1">Chưa đủ tin cậy</div> : null}
                      </td>
                      <td className="py-4 px-3 text-center">
                        <StatusBadge label={item.statusBadge.label} className={item.statusBadge.className} minWidthClassName="min-w-[120px]" />
                      </td>
                      <td className="py-4 px-4 text-center">
                        {item.actionsMode === 'menu' ? (
                          <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                            <RowActionsMenu
                              triggerLabel={`Thao tác`}
                              actions={(item.actions ?? []).map((action) => ({
                                ...action,
                                onClick: () => handleCaseAction(item.id, action.label),
                              }))}
                            />
                          </div>
                        ) : item.actionsMode === 'sent' ? (
                          <span className="text-[11px] text-emerald-700 font-bold">Đã duyệt</span>
                        ) : (
                          <button
                            className="px-2.5 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50/50 text-slate-700 text-[11px] font-bold transition-colors shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              requestFieldSurvey(item.id, item.farmerName)
                            }}
                          >
                            Khảo sát
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-slate-200 bg-white">
          <Pagination
            page={page}
            totalPages={totalPages}
            startIndex={startIndex}
            endIndex={endIndex}
            totalCount={totalCount}
            unitLabel="ca"
            goPrev={goPrev}
            goNext={goNext}
            setPage={setPage}
          />
        </div>
      </div>

      {/* DETAIL MODAL (No changes to internal layout, keeps its excellent ergonomic design) */}
      <DetailModal open={selected !== null} onClose={() => setSelectedId(null)} widthClassName="max-w-3xl">
        {selected ? (
          <div className="flex flex-col bg-white rounded-xl overflow-hidden shadow-xl">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded font-mono font-bold text-xs bg-emerald-100 text-emerald-800">#{selected.id}</span>
                <span className="font-bold text-slate-900 text-lg">Chi tiết ca thẩm định</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge label={selected.panelBadge.label} className={selected.panelBadge.className} />
              </div>
            </div>

            {/* Modal 2-Column Body */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: Leaf Image & AI Result */}
              <div className="md:col-span-5 flex flex-col gap-4">
                <div className="relative w-full h-56 rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                  <img
                    className={`w-full h-full object-contain ${selected.imageBlurred ? 'blur-sm' : ''}`}
                    data-alt={selected.imageAlt}
                    src={selected.imageSrc}
                  />
                  <div className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm font-semibold">
                    Mô hình Rice v2.1
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bệnh AI phân loại</div>
                  <div className="font-bold text-slate-900 text-base mt-1">
                    {selected.diseaseFullLabel}
                  </div>
                  {selected.diseaseLatin ? (
                    <div className="text-xs text-slate-500 italic mt-0.5">{selected.diseaseLatin}</div>
                  ) : null}

                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Độ tin cậy:</span>
                    <span className={`font-bold text-sm tabular-nums ${selected.confidenceFullClassName}`}>
                      {selected.confidenceFullLabel}
                    </span>
                  </div>
                </div>

                {/* Farmer quick metadata */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2 text-[13px] shadow-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nông dân:</span>
                    <span className="font-semibold text-slate-900">{selected.field.farmerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">SĐT:</span>
                    <span className="font-mono text-emerald-700 font-semibold">{selected.field.farmerPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Thửa ruộng:</span>
                    <span className="text-slate-900 font-medium">{selected.field.plotLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Giống lúa:</span>
                    <span className="text-slate-900 font-medium">{selected.field.varietyLabel}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Proposed Pharmacy & Agent Decision */}
              <div className="md:col-span-7 flex flex-col gap-4">
                {/* Proposed Medication Card */}
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Phác đồ thuốc đề xuất
                  </span>
                  {selected.product ? (
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-emerald-700 text-lg">{selected.product.name}</div>
                          <div className="text-[13px] text-slate-500 mt-1">{selected.product.activeIngredient}</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {selected.product.fitTag}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-[13px]">
                        <div>
                          <span className="text-slate-500 block mb-1">Giá niêm yết</span>
                          <span className="font-semibold text-slate-900">{selected.product.price} <span className="text-xs text-slate-500">{selected.product.priceUnit}</span></span>
                        </div>
                        <div>
                          <span className="text-slate-500 block mb-1">Kho Thới Lai</span>
                          <span className="font-semibold text-emerald-700 flex items-center gap-1.5">
                            <Package size={14} />
                            <span>{selected.product.stockLabel}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-[13px] font-medium">
                      {selected.noProductNote}
                    </div>
                  )}
                </div>

                {/* Agent Decision Panel */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-slate-900">Đại lý phê duyệt</span>
                    <button
                      type="button"
                      onClick={() => setIsCorrecting(!isCorrecting)}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 transition-colors"
                    >
                      <Pencil size={12} />
                      <span>{isCorrecting ? 'Hủy hiệu chỉnh' : 'Đổi bệnh / thuốc khác'}</span>
                    </button>
                  </div>

                  {isCorrecting && (
                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                          Chọn lại bệnh chính xác:
                        </label>
                        <select
                          value={correctedDisease}
                          onChange={(e) => setCorrectedDisease(e.target.value)}
                          className="w-full p-2.5 text-[13px] bg-white border border-slate-300 rounded-md text-slate-900 font-semibold focus:border-emerald-500 outline-none"
                        >
                          {CANONICAL_RICE_DISEASES.map((d) => (
                            <option key={d.id} value={d.label}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                          Chỉ định thuốc từ kho:
                        </label>
                        <select
                          value={correctedProductId}
                          onChange={(e) => setCorrectedProductId(e.target.value)}
                          className="w-full p-2.5 text-[13px] bg-white border border-slate-300 rounded-md text-slate-900 font-semibold focus:border-emerald-500 outline-none"
                        >
                          {STORE_PRODUCTS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.price})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Ghi chú chuyên môn gửi nông dân:
                    </label>
                    <textarea
                      key={selected.id}
                      ref={agentNoteRef}
                      className="w-full p-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-900 focus:border-emerald-500 outline-none placeholder:text-slate-400 resize-none shadow-sm"
                      placeholder="Ghi chú thêm về liều lượng phun xịt hoặc cách xử lý nước ruộng..."
                      rows={3}
                      defaultValue={selected.agentNote ?? selected.defaultAgentNote}
                    />
                  </div>

                  {!isCorrecting && (
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-500 shrink-0">Lý do từ chối:</span>
                      <select
                        key={selected.id}
                        ref={rejectReasonRef}
                        className="p-2 text-[13px] bg-white border border-slate-300 rounded-md text-slate-700 font-medium flex-1 focus:border-emerald-500 outline-none shadow-sm"
                        defaultValue=""
                      >
                        <option value="">-- Nếu từ chối, chọn lý do --</option>
                        <option value="mo">Ảnh mờ / Cháy sáng</option>
                        <option value="nham">Nhận diện nhầm bệnh</option>
                        <option value="ngoai-pham-vi">Không phải lá lúa / Ngoài phạm vi 5 bệnh</option>
                        <option value="sai-giai-doan">Sai giai đoạn phát triển</option>
                        <option value="khang-thuoc">Khu vực đã kháng hoạt chất này</option>
                      </select>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      className="py-2.5 px-4 rounded-lg bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-[13px] font-bold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={selected.actionsMode === 'sent'}
                      onClick={() => rejectCase(selected.id)}
                    >
                      <X size={16} />
                      <span>Từ chối</span>
                    </button>

                    {isCorrecting ? (
                      <button
                        className="py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                        onClick={() => approveWithCorrection(selected.id)}
                      >
                        <CheckCircle size={16} />
                        <span>Hiệu chỉnh &amp; Duyệt</span>
                      </button>
                    ) : (
                      <button
                        className="py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={selected.actionsMode === 'sent'}
                        onClick={() => approveCase(selected.id)}
                      >
                        <Check size={16} />
                        <span>{selected.actionsMode === 'sent' ? 'Đã duyệt' : 'Phê duyệt phác đồ'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DetailModal>
    </div>
  )
}
