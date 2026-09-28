import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import DetailModal from '../../components/ui/DetailModal'
import Pagination from '../../components/ui/Pagination'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import SearchInput from '../../components/ui/SearchInput'
import FilterSelect from '../../components/ui/FilterSelect'
import StatusBadge from '../../components/ui/StatusBadge'
import { useSelectableList } from '../../hooks/useSelectableList'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { contactRequests as INITIAL_REQUESTS } from '../../data/mockContactRequests'
import type { ContactRequestStatus } from '../../types'

import {
  ChevronRight,
  MessageSquare,
  AlertCircle,
  RefreshCcw,
  CheckCircle2,
  FilterX,
  MapPin,
  Phone,
  MessageCircle,
  UserCheck,
  CheckCircle,
  MessageSquareWarning,
  Smartphone
} from 'lucide-react'

const STATUS_OPTIONS = ['Tất cả trạng thái', 'Chưa xử lý', 'Đang xử lý', 'Đã xử lý']
const REQUEST_TYPE_OPTIONS = ['Tất cả loại yêu cầu', 'Kỹ thuật canh tác', 'Đặt vật tư', 'Sổ nợ mùa vụ', 'Khác']

const STATUS_VISUALS: Record<ContactRequestStatus, { className: string; dotClassName: string }> = {
  'Chưa xử lý': { className: 'bg-amber-100 text-amber-800 border-amber-300', dotClassName: 'bg-amber-500' },
  'Đang xử lý': { className: 'bg-sky-100 text-sky-800 border-sky-300', dotClassName: 'bg-sky-500' },
  'Đã xử lý': { className: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotClassName: 'bg-emerald-600' },
}

export default function ContactPage() {
  usePageHeader({
    title: 'Yêu cầu hỗ trợ',
  })

  const { showToast } = useToast()
  const { user } = useAuth()
  const [requests, setRequests] = useState(INITIAL_REQUESTS)

  const setRequestStatus = (id: string, label: ContactRequestStatus) => {
    const visuals = STATUS_VISUALS[label]
    if (!visuals) return
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: label,
              statusBadge: { label, className: visuals.className, dotClassName: visuals.dotClassName },
              assignedTo: label === 'Chưa xử lý' ? undefined : `${user.name} (${user.role})`,
              actions:
                label === 'Đã xử lý'
                  ? [{ label: 'Xem chi tiết', icon: 'Eye' }]
                  : [
                      { label: 'Xem chi tiết', icon: 'Eye' },
                      { label: 'Đánh dấu đã xử lý', icon: 'CheckCircle', tone: 'primary' },
                    ],
            }
          : r,
      ),
    )
  }

  const handleRequestAction = (id: string, label: string) => {
    if (label === 'Xem chi tiết') {
      setSelectedId(id)
    } else if (label === 'Nhận xử lý') {
      setRequestStatus(id, 'Đang xử lý')
      showToast(`Bạn đã nhận xử lý yêu cầu #${id}`)
    } else if (label === 'Đánh dấu đã xử lý') {
      setRequestStatus(id, 'Đã xử lý')
      showToast(`Đã đánh dấu hoàn tất yêu cầu #${id}`)
    }
  }

  const { selectedId, setSelectedId, selected } = useSelectableList(requests, (r) => r.id)

  const [requestTypeFilter, setRequestTypeFilter] = useState(REQUEST_TYPE_OPTIONS[0])

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredRequests,
    clearFilters: handleClearFiltersBase,
  } = useFilteredList(
    requests,
    STATUS_OPTIONS[0],
    (request, keyword, status) =>
      (!keyword ||
        request.senderName.toLowerCase().includes(keyword) ||
        request.senderPhone.toLowerCase().includes(keyword) ||
        request.message.toLowerCase().includes(keyword)) &&
      (status === STATUS_OPTIONS[0] || request.statusBadge.label === status) &&
      (requestTypeFilter === REQUEST_TYPE_OPTIONS[0] || request.requestType === requestTypeFilter),
  )

  const handleClearFilters = () => {
    handleClearFiltersBase()
    setRequestTypeFilter(REQUEST_TYPE_OPTIONS[0])
  }

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filteredRequests, 10)

  const pendingCount = requests.filter((r) => r.statusBadge.label === 'Chưa xử lý').length
  const inProgressCount = requests.filter((r) => r.statusBadge.label === 'Đang xử lý').length
  const resolvedCount = requests.filter((r) => r.statusBadge.label === 'Đã xử lý').length

  const getChannelIcon = (iconName: string) => {
    if (iconName === 'chat' || iconName === 'sms') return <MessageSquareWarning size={14} className="text-slate-500" />
    if (iconName === 'phone_android') return <Smartphone size={14} className="text-slate-500" />
    return <MessageCircle size={14} className="text-slate-500" />
  }

  return (
    <>
      {/* BREADCRUMB */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
        <Link className="hover:text-emerald-700 transition-colors" to="/">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-emerald-700 font-medium">Yêu cầu hỗ trợ</span>
      </nav>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start justify-between hover:border-slate-300 transition-colors">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Tổng yêu cầu</span>
            <div className="text-2xl text-slate-900 font-bold mt-1">{requests.length}</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl text-slate-600">
            <MessageSquare size={24} />
          </div>
        </div>
        <div className="bg-white border-2 border-amber-300 rounded-xl p-4 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-amber-700 font-semibold">Chưa xử lý</span>
            <div className="text-2xl text-amber-700 font-bold mt-1">{pendingCount}</div>
          </div>
          <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700">
            <AlertCircle size={24} />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start justify-between hover:border-slate-300 transition-colors">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Đang xử lý</span>
            <div className="text-2xl text-sky-700 font-bold mt-1">{inProgressCount}</div>
          </div>
          <div className="p-2.5 bg-sky-50 rounded-xl text-sky-700">
            <RefreshCcw size={24} />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start justify-between hover:border-slate-300 transition-colors">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Đã xử lý</span>
            <div className="text-2xl text-emerald-700 font-bold mt-1">{resolvedCount}</div>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-700">
            <CheckCircle2 size={24} />
          </div>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mt-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên, số điện thoại, nội dung..." className="relative flex-1" />
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[160px]" />
          <FilterSelect value={requestTypeFilter} onChange={setRequestTypeFilter} options={REQUEST_TYPE_OPTIONS} className="relative min-w-[180px]" />
          <button
            className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1.5"
            type="button"
            onClick={handleClearFilters}
          >
            <FilterX size={16} />
            <span>Xóa lọc</span>
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4 font-semibold" scope="col">Người gửi &amp; Liên hệ</th>
                <th className="py-3 px-3 font-semibold text-center" scope="col">Loại yêu cầu</th>
                <th className="py-3 px-3 font-semibold" scope="col">Nội dung</th>
                <th className="py-3 px-3 font-semibold" scope="col">Thời gian gửi</th>
                <th className="py-3 px-3 font-semibold text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-4 font-semibold text-right" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không tìm thấy yêu cầu phù hợp với bộ lọc." className="text-slate-400" />
              ) : null}
              {paginated.map((request) => {
                const isSelected = request.id === selectedId
                return (
                  <tr
                    key={request.id}
                    onClick={() => setSelectedId(request.id)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected ? 'bg-emerald-50 hover:bg-emerald-50 border-l-4 border-l-emerald-600' : 'hover:bg-slate-50/50/80'
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {request.senderName}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                        {getChannelIcon(request.channelIcon)}
                        {request.senderPhone} · {request.channel}
                      </div>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {request.requestType}
                      </span>
                    </td>
                    <td className="py-4 px-3 max-w-[280px]">
                      <div className="text-sm text-slate-700 truncate" title={request.message}>{request.message}</div>
                    </td>
                    <td className="py-4 px-3 text-sm text-slate-500 whitespace-nowrap">{request.submittedAgo}</td>
                    <td className="py-4 px-3 text-center">
                      <StatusBadge label={request.statusBadge.label} className={request.statusBadge.className} minWidthClassName="min-w-[105px]" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end">
                        <RowActionsMenu
                          triggerLabel={`Thao tác yêu cầu #${request.id}`}
                          actions={request.actions.map((action) => ({
                            ...action,
                            onClick: () => handleRequestAction(request.id, action.label),
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
          unitLabel="yêu cầu"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>

      {/* DETAIL MODAL */}
      <DetailModal open={selected !== null} onClose={() => setSelectedId(null)}>
        {selected ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-emerald-700 text-lg">#{selected.id}</span>
              <StatusBadge label={selected.statusBadge.label} className={selected.statusBadge.className} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{selected.senderName}</h3>
              <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-1.5">
                <MapPin size={16} />
                {selected.senderArea}
              </div>
              <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                {getChannelIcon(selected.channelIcon)}
                {selected.senderPhone} · Gửi qua {selected.channel} · {selected.submittedAgo}
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                {selected.requestType}
              </span>
              <p className="text-sm text-slate-800 leading-relaxed">{selected.message}</p>
            </div>
            {selected.assignedTo ? (
              <div className="text-sm text-slate-600">
                Người phụ trách: <strong className="text-slate-900">{selected.assignedTo}</strong>
              </div>
            ) : null}
            <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100">
              <a
                href={`tel:${selected.senderPhone.replace(/\./g, '')}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-300 hover:bg-slate-50/50 text-slate-700 rounded-xl text-sm font-bold transition-colors shadow-sm"
              >
                <Phone size={18} className="text-emerald-700" />
                Gọi cho nông dân
              </a>
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-300 hover:bg-slate-50/50 text-slate-700 rounded-xl text-sm font-bold transition-colors shadow-sm"
                type="button"
                onClick={() => showToast(`Đã gửi phản hồi qua Zalo/SMS cho ${selected.senderName}`)}
              >
                <MessageCircle size={18} className="text-blue-600" />
                Gửi phản hồi qua Zalo/SMS
              </button>
              {selected.statusBadge.label === 'Chưa xử lý' ? (
                <button
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                  type="button"
                  onClick={() => {
                    handleRequestAction(selected.id, 'Nhận xử lý')
                  }}
                >
                  <UserCheck size={18} />
                  Nhận xử lý
                </button>
              ) : selected.statusBadge.label === 'Đang xử lý' ? (
                <button
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                  type="button"
                  onClick={() => {
                    handleRequestAction(selected.id, 'Đánh dấu đã xử lý')
                  }}
                >
                  <CheckCircle size={18} />
                  Đánh dấu đã xử lý
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </DetailModal>
    </>
  )
}
