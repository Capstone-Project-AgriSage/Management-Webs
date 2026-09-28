import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FilterX, Clock, CheckCircle2, XCircle, FileText } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import Pagination from '../../components/ui/Pagination'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import SearchInput from '../../components/ui/SearchInput'
import FilterSelect from '../../components/ui/FilterSelect'
import StatusBadge from '../../components/ui/StatusBadge'
import FormModal from '../../components/ui/FormModal'
import { usePagination } from '../../hooks/usePagination'
import { mockCreditRequests as INITIAL_REQUESTS } from '../../data/mockDebts'
import { useFormValues } from '../../hooks/useFormValues'
import { formatVndShort } from '../../utils/money'
import type { CreditRequest } from '../../types'

const STATUS_OPTIONS = ['Tất cả trạng thái', 'Chờ duyệt', 'Đã duyệt', 'Đã từ chối']

const mapStatusToOption = (status: CreditRequest['status']) => {
  switch (status) {
    case 'PENDING_APPROVAL': return 'Chờ duyệt'
    case 'APPROVED': return 'Đã duyệt'
    case 'REJECTED': return 'Đã từ chối'
    default: return ''
  }
}

export default function SeasonalCreditPage() {
  usePageHeader({
    title: 'Yêu cầu mua chịu',
  })

  const { showToast } = useToast()
  const [requests, setRequests] = useState(INITIAL_REQUESTS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0])
  const [actionReqId, setActionReqId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null)

  const { values: noteForm, update: updateNoteForm, reset: resetNoteForm } = useFormValues({ note: '' })

  const keyword = search.trim().toLowerCase()
  const filteredRequests = requests.filter(
    (r) =>
      (!keyword || r.id.toLowerCase().includes(keyword) || r.farmerName.toLowerCase().includes(keyword) || r.orderCode.toLowerCase().includes(keyword)) &&
      (statusFilter === STATUS_OPTIONS[0] || mapStatusToOption(r.status) === statusFilter)
  )

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter(STATUS_OPTIONS[0])
  }

  const { page, totalPages, paginated, startIndex, endIndex, totalCount: pageTotalCount, goPrev, goNext, setPage } =
    usePagination(filteredRequests, 10)

  const handleAction = (id: string, label: string) => {
    if (label === 'Duyệt yêu cầu') {
      setActionReqId(id)
      setActionType('APPROVE')
      resetNoteForm()
    } else if (label === 'Từ chối yêu cầu') {
      setActionReqId(id)
      setActionType('REJECT')
      resetNoteForm()
    } else {
      showToast(`Đã thực hiện "${label}" cho yêu cầu ${id}`)
    }
  }

  const handleConfirmAction = () => {
    if (!actionReqId || !actionType) return

    const newStatus = actionType === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    const reviewerName = 'Store Owner (Quản lý)' // Mô phỏng người đang đăng nhập

    setRequests(prev => prev.map(r => r.id === actionReqId ? {
      ...r,
      status: newStatus,
      reviewerNote: `${noteForm.note ? noteForm.note + ' - ' : ''}Bởi: ${reviewerName}`,
      reviewedAt: new Date().toISOString()
    } : r))
    
    showToast(`Đã ${actionType === 'APPROVE' ? 'duyệt' : 'từ chối'} yêu cầu mua chịu ${actionReqId}`)
    setActionReqId(null)
    setActionType(null)
  }

  const totalCount = requests.length
  const pendingCount = requests.filter(r => r.status === 'PENDING_APPROVAL').length
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length

  const getStatusBadgeProps = (status: CreditRequest['status']) => {
    switch (status) {
      case 'PENDING_APPROVAL': return { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'APPROVED': return { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'REJECTED': return { label: 'Đã từ chối', className: 'bg-rose-50 text-rose-700 border-rose-200' }
    }
  }

  return (
    <>
      <section className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <Link className="hover:text-slate-900 transition-colors" to="/debts">Công nợ</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Mua chịu</span>
        </nav>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng yêu cầu</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{totalCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
            <FileText size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Chờ duyệt</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700 tabular-nums">{pendingCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600">
            <Clock size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đã duyệt</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">{approvedCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đã từ chối</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-600 tabular-nums">{rejectedCount}</span>
            </div>
          </div>
          <div className="p-2.5 bg-rose-50 rounded-lg text-rose-500">
            <XCircle size={20} />
          </div>
        </div>
      </section>

      <section className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Khách hàng, Mã YC, Đơn hàng..." className="relative flex-1 min-w-[300px]" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[200px]" />
          <button
            className="h-9 px-3 text-slate-500 hover:text-slate-900 text-xs font-medium flex items-center gap-1 transition-colors"
            onClick={handleClearFilters}
            type="button"
          >
            <FilterX size={14} />
            <span>Xóa tìm kiếm</span>
          </button>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-4 pl-4 px-3 w-[150px]">Yêu cầu & Đơn</th>
                <th className="py-4 px-3 min-w-[180px]">Khách hàng</th>
                <th className="py-4 px-3 min-w-[130px] text-right">Hạn mức còn lại</th>
                <th className="py-4 px-3 min-w-[130px] text-right">Số tiền yêu cầu</th>
                <th className="py-4 px-3 min-w-[140px]">Trạng thái</th>
                <th className="py-4 pr-4 pl-3 w-10 "></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không tìm thấy yêu cầu nào." />
              ) : null}
              {paginated.map((req) => {
                const badge = getStatusBadgeProps(req.status)
                const isOverLimit = req.requestedAmount > req.remainingLimit
                return (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 pl-4 px-3">
                      <div className="font-semibold text-slate-900">{req.id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{req.orderCode}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-900">{req.farmerName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{req.cropSeason}</div>
                    </td>
                    <td className="py-4 px-3 text-right font-semibold font-mono text-slate-900">
                      {formatVndShort(req.remainingLimit)}
                    </td>
                    <td className="py-4 px-3 text-right">
                      <div className={`font-semibold font-mono ${isOverLimit ? 'text-rose-600' : 'text-slate-900'}`}>{formatVndShort(req.requestedAmount)}</div>
                      {isOverLimit && <div className="text-[10px] text-rose-500 mt-0.5">Vượt hạn mức!</div>}
                    </td>
                    <td className="py-4 px-3">
                      <StatusBadge label={badge.label} className={badge.className} />
                      {req.reviewerNote && (
                        <div className="text-[10px] text-slate-500 mt-1 max-w-[140px] truncate" title={req.reviewerNote}>{req.reviewerNote}</div>
                      )}
                    </td>
                    <td className="py-4 pr-4 pl-3 text-center">
                      <RowActionsMenu
                        triggerLabel={`Thao tác ${req.id}`}
                        actions={(
                          req.status === 'PENDING_APPROVAL' ? [
                            { label: 'Duyệt yêu cầu', icon: 'check_circle' },
                            { label: 'Từ chối yêu cầu', icon: 'cancel' },
                            { label: 'Xem chi tiết đơn', icon: 'visibility' }
                          ] : [
                            { label: 'Xem chi tiết đơn', icon: 'visibility' }
                          ]
                        ).map(action => ({
                          ...action,
                          onClick: () => handleAction(req.id, action.label)
                        }))}
                      />
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
          totalCount={pageTotalCount}
          unitLabel="yêu cầu"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </section>

      {/* ACTION MODAL */}
      <FormModal
        open={actionReqId !== null}
        onClose={() => setActionReqId(null)}
        title={actionType === 'APPROVE' ? 'Duyệt yêu cầu mua chịu' : 'Từ chối yêu cầu mua chịu'}
        fields={[
          { key: 'note', label: 'Ghi chú (Tùy chọn)', placeholder: 'Ghi chú của người duyệt...' }
        ]}
        values={noteForm}
        onChange={updateNoteForm}
        onSubmit={handleConfirmAction}
        submitLabel={actionType === 'APPROVE' ? 'Duyệt' : 'Từ chối'}
      />
    </>
  )
}
