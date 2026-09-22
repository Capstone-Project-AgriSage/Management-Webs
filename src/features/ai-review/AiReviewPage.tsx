import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Check, Pencil, HelpCircle, Ban, Package, Phone, MapPin } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
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
import { aiCases as INITIAL_AI_CASES } from '../../data/mockAiCases'
import type { AiCaseStatus, AiReviewDecision } from '../../types'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'Chờ duyệt', label: 'Chờ duyệt' },
  { value: 'Đã phê duyệt', label: 'Đã phê duyệt' },
  { value: 'Đã từ chối', label: 'Đã từ chối' },
  { value: 'Chưa đủ chắc chắn', label: 'Chưa đủ chắc chắn' },
]

const STATUS_BADGES: Record<AiCaseStatus, { label: string; className: string; dotClassName: string }> = {
  'Chờ duyệt': { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-800 border border-amber-300', dotClassName: 'bg-amber-600' },
  'Đã phê duyệt': { label: 'Đã phê duyệt', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300', dotClassName: 'bg-emerald-600' },
  'Đã từ chối': { label: 'Đã từ chối', className: 'bg-slate-200 text-slate-700 border border-slate-300', dotClassName: 'bg-slate-500' },
  'Chưa đủ chắc chắn': { label: 'Chưa đủ chắc chắn', className: 'bg-orange-100 text-orange-800 border border-orange-300', dotClassName: 'bg-orange-600' },
}

function confidenceBarClassName(percent: number) {
  if (percent >= 85) return 'bg-emerald-600'
  if (percent >= 70) return 'bg-amber-500'
  return 'bg-orange-500'
}

export default function AiReviewPage() {
  const { user } = useAuth()

  if (!user.can_review_ai) {
    return <Navigate to="/" replace />
  }

  return <AiReviewContent />
}

function AiReviewContent() {
  usePageHeader({ title: 'Thẩm định AI', subtitle: 'Xem và phê duyệt các ca chẩn đoán bệnh lúa do AI đề xuất' })

  const { user } = useAuth()
  const { showToast } = useToast()

  const [cases, setCases] = useState(INITIAL_AI_CASES)
  const [reviewNoteDraft, setReviewNoteDraft] = useState('')
  const [correctionDraft, setCorrectionDraft] = useState('')
  const [isCorrecting, setIsCorrecting] = useState(false)
  const [confirmedProducts, setConfirmedProducts] = useState<Record<string, boolean>>({})

  const { selectedId, setSelectedId, selected } = useSelectableList(cases, (c) => c.id)

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredCases,
    clearFilters: handleClearFilters,
  } = useFilteredList(
    cases,
    'Chờ duyệt',
    (item, keyword, status) =>
      (!keyword || item.id.toLowerCase().includes(keyword) || item.farmerName.toLowerCase().includes(keyword) || item.diseaseLabel.toLowerCase().includes(keyword)) &&
      (!status || item.status === status),
    '',
  )

  const { page, totalPages, paginated: paginatedCases, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(filteredCases, 8)

  const pendingCount = cases.filter((c) => c.status === 'Chờ duyệt').length

  const openCase = (id: string) => {
    const target = cases.find((c) => c.id === id)
    setSelectedId(id)
    setReviewNoteDraft(target?.reviewNote ?? '')
    setCorrectionDraft(target ? `${target.diseaseLabel} (${target.diseaseSubLabel})` : '')
    setIsCorrecting(false)
  }

  const applyDecision = (id: string, decision: AiReviewDecision, note: string) => {
    const target = cases.find((c) => c.id === id)
    if (!target) return

    let nextStatus: AiCaseStatus
    let resolvedNote = note.trim()

    if (decision === 'CONFIRM') {
      nextStatus = 'Đã phê duyệt'
      resolvedNote = resolvedNote || 'Đã xác nhận chẩn đoán của AI là chính xác.'
    } else if (decision === 'CORRECT') {
      nextStatus = 'Đã phê duyệt'
      resolvedNote = `Đã điều chỉnh chẩn đoán: ${correctionDraft.trim() || target.diseaseLabel}.${resolvedNote ? ` ${resolvedNote}` : ''}`
    } else {
      nextStatus = 'Chưa đủ chắc chắn'
      resolvedNote = resolvedNote || 'Chưa đủ chắc chắn để phê duyệt, cần khảo sát thực địa thêm.'
    }

    setCases((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: nextStatus,
              statusBadge: STATUS_BADGES[nextStatus],
              diseaseLabel: decision === 'CORRECT' ? correctionDraft.trim().split('(')[0].trim() || c.diseaseLabel : c.diseaseLabel,
              reviewedBy: user.name,
              reviewNote: resolvedNote,
            }
          : c,
      ),
    )
    setIsCorrecting(false)
    showToast(`Đã ghi nhận thẩm định cho ca #${id}`)
  }

  const rejectCase = (id: string, note: string) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'Đã từ chối',
              statusBadge: STATUS_BADGES['Đã từ chối'],
              reviewedBy: user.name,
              reviewNote: note.trim() || 'Đã từ chối kết quả chẩn đoán của AI.',
            }
          : c,
      ),
    )
    showToast(`Đã từ chối ca #${id}`)
  }

  const confirmProductSuggestion = (id: string) => {
    setConfirmedProducts((prev) => ({ ...prev, [id]: true }))
    showToast('Đã xác nhận khuyến nghị sản phẩm cho nông dân')
  }

  // Wires each row action by its position in the actions array (see CASE_ACTIONS in
  // mockAiCases.ts: 0 = "Xem chi tiết", 1 = "Xác nhận", 2 = "Điều chỉnh", 3 = "Chưa đủ
  // chắc chắn") instead of re-deriving intent from the label text at click time.
  const getCaseActionHandler = (index: number, id: string) => {
    switch (index) {
      case 1:
        return () => applyDecision(id, 'CONFIRM', '')
      case 2:
        return () => {
          openCase(id)
          setIsCorrecting(true)
        }
      case 3:
        return () => applyDecision(id, 'INCONCLUSIVE', '')
      default:
        return () => openCase(id)
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-amber-700">{pendingCount} ca</span> đang chờ thẩm định
        </p>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm mã ca, nông dân, tên bệnh..." className="relative flex-1" />
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[190px]" />
          <button
            className="px-3 py-1.5 h-9 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            type="button"
            onClick={handleClearFilters}
          >
            Xóa lọc
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500 select-none">
                <th className="py-3 px-4" scope="col">Mã ca</th>
                <th className="py-3 px-3" scope="col">Nông dân &amp; Thửa</th>
                <th className="py-3 px-3" scope="col">Bệnh AI chẩn đoán</th>
                <th className="py-3 px-3 text-center" scope="col">Độ tin cậy</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-4 text-center w-20" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-900">
              {paginatedCases.length === 0 ? <EmptyTableRow colSpan={6} message="Không tìm thấy ca phù hợp với bộ lọc." /> : null}
              {paginatedCases.map((item) => {
                const isSelected = item.id === selectedId
                return (
                  <tr
                    key={item.id}
                    onClick={() => openCase(item.id)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected ? 'bg-emerald-50/50 hover:bg-emerald-50 border-l-2 border-l-emerald-500' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-slate-900">#{item.id}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-900">{item.farmerName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.farmerLocationLine}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-900">{item.diseaseLabel}</div>
                      <div className="text-xs text-slate-500 italic">{item.diseaseSubLabel}</div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="font-bold text-xs tabular-nums text-slate-900">{item.confidencePercent}%</span>
                      <div className="text-[11px] text-slate-500">{item.confidenceNote}</div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <StatusBadge label={item.statusBadge.label} className={item.statusBadge.className} minWidthClassName="min-w-[130px]" />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu
                          triggerLabel={`Thao tác ca ${item.id}`}
                          actions={item.actions.map((action, index) => ({ ...action, onClick: getCaseActionHandler(index, item.id) }))}
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
          unitLabel="ca"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>

      <DetailModal open={selected !== null} onClose={() => setSelectedId(null)} widthClassName="max-w-3xl">
        {selected ? (
          <div className="flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded font-mono font-bold text-xs bg-emerald-100 text-emerald-800">#{selected.id}</span>
                <span className="font-bold text-slate-900 text-lg">Chi tiết ca thẩm định</span>
              </div>
              <StatusBadge label={selected.statusBadge.label} className={selected.statusBadge.className} />
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-5 flex flex-col gap-4">
                <div className="relative w-full h-56 rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                  <img className="w-full h-full object-contain" alt={selected.imageAlt} src={selected.imageSrc} />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bệnh AI chẩn đoán</div>
                  <div className="font-bold text-slate-900 text-base mt-1">{selected.diseaseLabel}</div>
                  <div className="text-xs text-slate-500 italic mt-0.5">{selected.diseaseSubLabel}</div>

                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-500">Độ tin cậy</span>
                      <span className="font-bold text-slate-900 tabular-nums">{selected.confidencePercent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className={`h-full rounded-full ${confidenceBarClassName(selected.confidencePercent)}`} style={{ width: `${selected.confidencePercent}%` }} />
                    </div>
                    <div className="text-xs text-slate-500 mt-1.5">{selected.confidenceNote}</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2 text-[13px] shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone size={14} />
                    <span>{selected.field.farmerName} • {selected.field.farmerPhone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin size={14} />
                    <span>{selected.field.plotLabel}, {selected.field.plotLocation}</span>
                  </div>
                  <div className="text-xs text-slate-400 pt-1">Gửi lúc {selected.field.sentTime}</div>
                </div>
              </div>

              <div className="md:col-span-7 flex flex-col gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Sản phẩm gợi ý</span>
                  {selected.product ? (
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-emerald-700 text-lg">{selected.product.name}</div>
                          <div className="text-[13px] text-slate-500 mt-1">{selected.product.category}</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          {selected.product.price}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[13px] text-emerald-700 font-semibold">
                        <Package size={14} />
                        <span>{selected.product.stockLabel}</span>
                      </div>
                      <p className="text-[13px] text-slate-500 pt-2 border-t border-slate-100">{selected.product.reasoning}</p>
                      <button
                        type="button"
                        onClick={() => confirmProductSuggestion(selected.id)}
                        disabled={confirmedProducts[selected.id]}
                        className="w-full py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] font-bold hover:bg-emerald-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {confirmedProducts[selected.id] ? 'Đã xác nhận khuyến nghị sản phẩm' : 'Xác nhận khuyến nghị sản phẩm'}
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-[13px] font-medium">
                      Độ tin cậy chưa đủ để hệ thống đưa ra gợi ý sản phẩm. Cần khảo sát thực địa trước khi tư vấn cho nông dân.
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-slate-900">Quyết định thẩm định</span>
                    <button
                      type="button"
                      onClick={() => setIsCorrecting((v) => !v)}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 transition-colors"
                    >
                      <Pencil size={12} />
                      <span>{isCorrecting ? 'Hủy điều chỉnh' : 'Điều chỉnh chẩn đoán'}</span>
                    </button>
                  </div>

                  {isCorrecting && (
                    <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700">Chẩn đoán đã điều chỉnh</label>
                      <input
                        type="text"
                        value={correctionDraft}
                        onChange={(e) => setCorrectionDraft(e.target.value)}
                        className="w-full p-2.5 text-[13px] bg-white border border-slate-300 rounded-md text-slate-900 font-semibold focus:border-emerald-500 outline-none"
                        placeholder="Ví dụ: Rầy nâu (Nilaparvata lugens)"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Ghi chú review</label>
                    <textarea
                      value={reviewNoteDraft}
                      onChange={(e) => setReviewNoteDraft(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-900 focus:border-emerald-500 outline-none placeholder:text-slate-400 resize-none shadow-sm"
                      placeholder="Ghi chú chuyên môn về chẩn đoán hoặc lý do quyết định..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => applyDecision(selected.id, 'CONFIRM', reviewNoteDraft)}
                      className="py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Check size={16} />
                      <span>Xác nhận</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isCorrecting) {
                          setIsCorrecting(true)
                          return
                        }
                        applyDecision(selected.id, 'CORRECT', reviewNoteDraft)
                      }}
                      className="py-2.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[13px] font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Pencil size={16} />
                      <span>Điều chỉnh</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDecision(selected.id, 'INCONCLUSIVE', reviewNoteDraft)}
                      className="py-2.5 px-3 rounded-lg bg-white border border-orange-300 hover:bg-orange-50 text-orange-700 text-[13px] font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <HelpCircle size={16} />
                      <span>Chưa đủ chắc chắn</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectCase(selected.id, reviewNoteDraft)}
                      className="py-2.5 px-3 rounded-lg bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-[13px] font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Ban size={16} />
                      <span>Từ chối</span>
                    </button>
                  </div>
                </div>

                {selected.reviewedBy ? (
                  <div className="text-xs text-slate-500">
                    Đã thẩm định bởi <strong className="text-slate-900">{selected.reviewedBy}</strong>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </DetailModal>
    </div>
  )
}
