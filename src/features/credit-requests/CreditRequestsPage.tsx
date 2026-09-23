import { useState } from 'react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
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
import { mockCreditRequests as INITIAL_CREDIT_REQUESTS } from '../../data/mockCreditRequests'
import { formatVnd } from '../../utils/money'
import type { CreditRequestStatus } from '../../types'
import { Check, X, FilterX, CreditCard, ChevronRight } from 'lucide-react'

const STATUS_OPTIONS = ['Tất cả trạng thái', 'Chờ duyệt', 'Đã duyệt', 'Từ chối']

const STATUS_LABEL: Record<CreditRequestStatus, string> = {
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
}

const STATUS_BADGE_CLASS: Record<CreditRequestStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 border-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
}

const REJECT_FIELDS: FormFieldSpec[] = [
  { key: 'note', label: 'Lý do từ chối', placeholder: 'VD: Vượt hạn mức mùa vụ còn lại của nông hộ' },
]

const emptyRejectForm = { note: '' }

export default function CreditRequestsPage() {
  usePageHeader({
    title: 'Mua chịu mùa vụ',
    subtitle: 'Duyệt yêu cầu mua chịu của Farmer trong hạn mức mùa vụ',
  })

  const { user } = useAuth()
  const { showToast } = useToast()
  const [requests, setRequests] = useState(INITIAL_CREDIT_REQUESTS)
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)

  const { values: rejectForm, update: updateRejectForm, reset: resetRejectForm } = useFormValues(emptyRejectForm)

  const pendingCount = requests.filter((cr) => cr.status === 'PENDING_APPROVAL').length

  const handleApprove = (id: string) => {
    const now = new Date().toLocaleString('vi-VN')
    setRequests((prev) =>
      prev.map((cr) =>
        cr.id === id
          ? { ...cr, status: 'APPROVED', reviewedBy: user.name, reviewedAt: now, reviewerNote: 'Đã thẩm định hạn mức, cho phép xuất kho giao hàng gối vụ.' }
          : cr,
      ),
    )
    showToast(`Đã phê duyệt yêu cầu mua chịu #${id}`)
  }

  const openRejectForm = (id: string) => {
    setRejectTargetId(id)
    resetRejectForm()
  }

  const handleRejectSubmit = () => {
    if (!rejectTargetId) return
    const note = rejectForm.note.trim()
    if (!note) {
      showToast('Vui lòng nhập lý do từ chối')
      return
    }
    const now = new Date().toLocaleString('vi-VN')
    setRequests((prev) =>
      prev.map((cr) => (cr.id === rejectTargetId ? { ...cr, status: 'REJECTED', reviewedBy: user.name, reviewedAt: now, reviewerNote: note } : cr)),
    )
    showToast(`Đã từ chối yêu cầu mua chịu #${rejectTargetId}`)
    setRejectTargetId(null)
  }

  const { selectedId, setSelectedId, selected } = useSelectableList(requests, (cr) => cr.id)

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredRequests,
    clearFilters,
  } = useFilteredList(
    requests,
    STATUS_OPTIONS[0],
    (cr, keyword, status) =>
      (!keyword ||
        cr.farmerName.toLowerCase().includes(keyword) ||
        cr.farmerPhone.toLowerCase().includes(keyword) ||
        cr.orderCode.toLowerCase().includes(keyword) ||
        cr.id.toLowerCase().includes(keyword)) &&
      (status === STATUS_OPTIONS[0] || STATUS_LABEL[cr.status] === status),
  )

  const { page, totalPages, paginated: paginatedRequests, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filteredRequests, 10)

  return (
    <>
      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
            <CreditCard size={20} />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900">Hàng đợi duyệt hạn mức tín dụng mùa vụ</h2>
            <p className="text-xs text-slate-500 mt-1">
              Nông dân đặt mua vật tư và gửi yêu cầu gối nợ mùa vụ. Nhân viên thẩm định hạn mức trước khi xuất kho giao hàng.
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-xs whitespace-nowrap self-start sm:self-auto">
          {pendingCount} yêu cầu chờ duyệt
        </span>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[300px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên nông dân, SĐT, mã đơn..." className="relative min-w-[220px] flex-1 max-w-sm" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
        </div>
        <button
          className="inline-flex items-center gap-1 px-3 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors"
          type="button"
          onClick={clearFilters}
        >
          <FilterX size={16} />
          <span>Xóa bộ lọc</span>
        </button>
      </section>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900">Danh sách yêu cầu mua chịu</h2>
          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold">{filteredRequests.length} yêu cầu</span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-4 px-4">Mã YC / Đơn hàng</th>
                <th className="py-4 px-4">Nông dân &amp; SĐT</th>
                <th className="py-4 px-3">Vụ mùa</th>
                <th className="py-4 px-3 text-center">Số tiền đề nghị</th>
                <th className="py-4 px-3 text-center">Hạn mức / Còn lại</th>
                <th className="py-4 px-3 text-center">Trạng thái</th>
                <th className="py-4 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm font-normal">

              {filteredRequests.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Không tìm thấy yêu cầu phù hợp với bộ lọc." className="text-slate-400" />
              ) : null}
              {paginatedRequests.map((cr) => {
                const isPending = cr.status === 'PENDING_APPROVAL'
                const isSelected = cr.id === selectedId
                return (
                  <tr
                    key={cr.id}
                    onClick={() => setSelectedId(cr.id)}
                    className={`transition-colors cursor-pointer ${isSelected ? 'bg-emerald-50 border-l-4 border-l-emerald-600' : 'hover:bg-slate-50/50'}`}
                  >
                    <td className="py-4.5 px-4 font-mono">
                      <div className="font-medium text-slate-900">{cr.id}</div>
                      <div className="text-slate-500 text-[11px]">{cr.orderCode}</div>
                    </td>
                    <td className="py-4.5 px-4">
                      <div className="font-medium text-slate-900">{cr.farmerName}</div>
                      <div className="text-slate-500 font-mono text-[11px]">{cr.farmerPhone}</div>
                    </td>
                    <td className="py-4.5 px-3 font-medium text-slate-700">{cr.cropSeason}</td>
                    <td className="py-4.5 px-3 text-center font-mono font-medium text-emerald-700 text-sm">{formatVnd(cr.requestedAmount)}</td>
                    <td className="py-4.5 px-3 text-center font-mono text-[11px]">
                      <div>HM: {formatVnd(cr.seasonalLimit)}</div>
                      <div className="text-emerald-700 font-medium">Còn lại: {formatVnd(cr.remainingLimit)}</div>
                    </td>
                    <td className="py-4.5 px-3 text-center">
                      <StatusBadge label={STATUS_LABEL[cr.status]} className={STATUS_BADGE_CLASS[cr.status]} minWidthClassName="min-w-[90px]" />
                    </td>
                    <td className="py-4.5 px-4 text-center">
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu
                          triggerLabel={`Thao tác yêu cầu ${cr.id}`}
                          actions={[
                            { label: 'Xem chi tiết', icon: 'visibility', onClick: () => setSelectedId(cr.id) },
                            ...(isPending
                              ? [
                                  { label: 'Duyệt', icon: 'check_circle', tone: 'primary' as const, onClick: () => handleApprove(cr.id) },
                                  { label: 'Từ chối', icon: 'cancel', tone: 'danger' as const, onClick: () => openRejectForm(cr.id) },
                                ]
                              : []),
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
          unitLabel="yêu cầu"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>

      <FormModal
        open={rejectTargetId !== null}
        onClose={() => setRejectTargetId(null)}
        title={`Từ chối yêu cầu mua chịu #${rejectTargetId ?? ''}`}
        fields={REJECT_FIELDS}
        values={rejectForm}
        onChange={updateRejectForm}
        onSubmit={handleRejectSubmit}
        submitLabel="Xác nhận từ chối"
      />

      <DetailModal open={selected !== null} onClose={() => setSelectedId(null)} widthClassName="max-w-xl">
        {selected ? (
          <>
            <div className="p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-3">
                <span>Yêu cầu mua chịu</span>
                <ChevronRight size={12} />
                <span className="text-slate-800 font-semibold">{selected.id}</span>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selected.farmerName}</h2>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    {selected.farmerPhone} • {selected.orderCode}
                  </p>
                </div>
                <StatusBadge label={STATUS_LABEL[selected.status]} className={STATUS_BADGE_CLASS[selected.status]} />
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Vụ mùa</span>
                  <div className="font-semibold text-slate-900">{selected.cropSeason}</div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Thời gian gửi</span>
                  <div className="font-semibold text-slate-900">{selected.createdAt}</div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Số tiền đề nghị:</span>
                  <span className="font-mono font-bold text-emerald-700">{formatVnd(selected.requestedAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Hạn mức mùa vụ:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatVnd(selected.seasonalLimit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Đã sử dụng:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatVnd(selected.usedLimit)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-900">Hạn mức còn lại:</span>
                  <span className="font-mono font-bold text-base text-emerald-700">{formatVnd(selected.remainingLimit)}</span>
                </div>
              </div>

              {selected.status !== 'PENDING_APPROVAL' && (
                <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                  <span className="text-xs font-semibold text-slate-500 block">Nhân viên duyệt</span>
                  <div className="text-sm font-bold text-slate-900">{selected.reviewedBy}</div>
                  <div className="text-xs text-slate-500">{selected.reviewedAt}</div>
                  {selected.reviewerNote ? <p className="text-xs text-slate-600 italic mt-2">{selected.reviewerNote}</p> : null}
                </div>
              )}
            </div>

            {selected.status === 'PENDING_APPROVAL' ? (
              <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-sm transition-colors flex items-center gap-1.5"
                  onClick={() => {
                    setSelectedId(null)
                    openRejectForm(selected.id)
                  }}
                >
                  <X size={16} />
                  <span>Từ chối</span>
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors shadow-sm flex items-center gap-1.5"
                  onClick={() => {
                    handleApprove(selected.id)
                    setSelectedId(null)
                  }}
                >
                  <Check size={16} />
                  <span>Phê duyệt</span>
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </DetailModal>
    </>
  )
}
