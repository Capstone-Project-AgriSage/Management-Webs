import { useState } from 'react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import DetailModal from '@/components/ui/DetailModal'
import FormModal, { type FormFieldSpec } from '@/components/ui/FormModal'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import StatusBadge from '@/components/ui/StatusBadge'
import { useSelectableList } from '@/hooks/useSelectableList'
import { useFilteredList } from '@/hooks/useFilteredList'
import { usePagination } from '@/hooks/usePagination'
import { useFormValues } from '@/hooks/useFormValues'
import { debtCustomers as INITIAL_DEBT_CUSTOMERS, mockDebtPaymentRequests as INITIAL_PAYMENT_REQUESTS } from '@/features/sales/data/mockDebts'
import { parseVnd, formatVnd } from '@/utils/money'
import type { DebtStatus, DisputeAction } from '@/types'
import { PAID_STATUS_BADGE } from '@/features/sales/debts/debtStatusBadges'
import DisputeResolutionPanel from '@/features/sales/debts/components/DisputeResolutionPanel'
import PendingPaymentRequestsPanel from '@/features/sales/debts/components/PendingPaymentRequestsPanel'
import { Landmark, AlarmClock, CheckCircle2, FilterX, ChevronRight, AlertTriangle } from 'lucide-react'

const STATUS_OPTIONS = ['Tất cả trạng thái công nợ', 'Bình thường', 'Sắp đến hạn', 'Đến hạn', 'Quá hạn', 'Đã thanh toán']

const STATUS_ROW_HIGHLIGHT: Partial<Record<DebtStatus, string>> = {
  'Quá hạn': 'text-rose-700 font-bold',
  'Đến hạn': 'text-orange-700 font-semibold',
  'Sắp đến hạn': 'text-amber-700',
}

const ADJUST_FIELDS: FormFieldSpec[] = [
  { key: 'newRemaining', label: 'Số tiền còn nợ mới (đ)', placeholder: 'VD: 3.000.000' },
  { key: 'reason', label: 'Lý do điều chỉnh', placeholder: 'VD: Đối soát lại theo chứng từ chuyển khoản' },
]

const emptyAdjustForm = { newRemaining: '', reason: '' }

export default function DebtsPage() {
  usePageHeader({
    title: 'Công nợ',
    subtitle: 'Theo dõi khoản nợ Farmer, xử lý tranh chấp và ghi nhận trả nợ',
  })

  const { user } = useAuth()
  const { showToast } = useToast()
  const [customers, setCustomers] = useState(INITIAL_DEBT_CUSTOMERS)
  const [paymentRequests, setPaymentRequests] = useState(INITIAL_PAYMENT_REQUESTS)
  const [adjustTargetId, setAdjustTargetId] = useState<string | null>(null)

  const { values: adjustForm, update: updateAdjustForm, reset: resetAdjustForm } = useFormValues(emptyAdjustForm)

  const disputedCount = customers.filter((c) => c.isDisputed).length

  const handleConfirmPayment = (id: string) => {
    const request = paymentRequests.find((pr) => pr.id === id)
    if (!request) return
    const now = new Date().toLocaleString('vi-VN')
    setPaymentRequests((prev) => prev.map((pr) => (pr.id === id ? { ...pr, status: 'CONFIRMED', confirmedBy: user.name, confirmedAt: now } : pr)))
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === request.debtId
          ? {
              ...c,
              remaining: formatVnd(Math.max(0, parseVnd(c.remaining) - request.amount)),
              status: parseVnd(c.remaining) - request.amount <= 0 ? 'Đã thanh toán' : c.status,
              statusBadge: parseVnd(c.remaining) - request.amount <= 0 ? PAID_STATUS_BADGE : c.statusBadge,
            }
          : c,
      ),
    )
    showToast(`Đã xác nhận thu nợ ${formatVnd(request.amount)} từ ${request.farmerName}`)
  }

  const handleRejectPayment = (id: string) => {
    setPaymentRequests((prev) => prev.map((pr) => (pr.id === id ? { ...pr, status: 'REJECTED' } : pr)))
    showToast(`Đã từ chối ghi nhận giao dịch trả nợ #${id}`)
  }

  const handleDisputeAction = (id: string, action: DisputeAction) => {
    const customer = customers.find((c) => c.id === id)
    if (!customer) return
    // Defense in depth: this should only ever be invoked from UI gated on isDisputed,
    // but guard here too so a stray call can't silently mutate a non-disputed debt.
    if (!customer.isDisputed) return

    if (action === 'KEEP') {
      setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, isDisputed: false } : c)))
      showToast(`Đã giữ nguyên khoản nợ của ${customer.name}`)
      return
    }

    if (action === 'CANCEL') {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                remaining: '0 đ',
                status: 'Đã thanh toán',
                statusBadge: PAID_STATUS_BADGE,
                isDisputed: false,
                disputeNote: `Khoản nợ đã được hủy do tranh chấp hợp lệ (xử lý bởi ${user.name}).`,
              }
            : c,
        ),
      )
      showToast(`Đã hủy khoản nợ không hợp lệ của ${customer.name}`)
      return
    }

    setAdjustTargetId(id)
    resetAdjustForm()
  }

  const handleAdjustSubmit = () => {
    if (!adjustTargetId) return
    const customer = customers.find((c) => c.id === adjustTargetId)
    if (!customer) return
    const newAmount = parseVnd(adjustForm.newRemaining)
    const reason = adjustForm.reason.trim()
    if (!adjustForm.newRemaining.trim() || newAmount < 0 || !reason) {
      showToast('Vui lòng nhập số tiền và lý do điều chỉnh hợp lệ')
      return
    }
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === adjustTargetId
          ? {
              ...c,
              remaining: formatVnd(newAmount),
              status: newAmount === 0 ? 'Đã thanh toán' : c.status,
              statusBadge: newAmount === 0 ? PAID_STATUS_BADGE : c.statusBadge,
              isDisputed: false,
              disputeNote: `Đã điều chỉnh còn lại ${formatVnd(newAmount)} bởi ${user.name}: ${reason}`,
            }
          : c,
      ),
    )
    showToast(`Đã điều chỉnh khoản nợ của ${customer.name}`)
    setAdjustTargetId(null)
  }

  const { selectedId, setSelectedId, selected } = useSelectableList(customers, (c) => c.id)

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredCustomers,
    clearFilters,
  } = useFilteredList(
    customers,
    STATUS_OPTIONS[0],
    (customer, keyword, status) =>
      (!keyword ||
        customer.name.toLowerCase().includes(keyword) ||
        customer.phone.toLowerCase().includes(keyword) ||
        customer.addressShort.toLowerCase().includes(keyword)) &&
      (status === STATUS_OPTIONS[0] || customer.statusBadge.label === status),
  )

  const { page, totalPages, paginated: paginatedCustomers, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filteredCustomers, 10)

  const totalDebtAmount = customers.reduce((sum, c) => sum + parseVnd(c.remaining), 0)
  const dueTodayCustomers = customers.filter((c) => c.statusBadge.label === 'Đến hạn')
  const overdueCustomers = customers.filter((c) => c.statusBadge.label === 'Quá hạn')
  const overdueAmount = [...dueTodayCustomers, ...overdueCustomers].reduce((sum, c) => sum + parseVnd(c.remaining), 0)
  const totalCollected = customers.reduce((sum, c) => sum + parseVnd(c.paidAmount), 0)

  const selectedPaymentRequests = selected ? paymentRequests.filter((pr) => pr.debtId === selected.id) : []
  const pendingPaymentRequests = paymentRequests.filter((pr) => pr.status === 'PENDING_STAFF_CONFIRMATION')

  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs uppercase tracking-wider font-bold">Tổng công nợ</span>
            <Landmark className="text-slate-400" size={20} />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono my-1">{formatVnd(totalDebtAmount)}</div>
          <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">Tổng nợ của {customers.length} nông hộ</div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs uppercase tracking-wider font-bold">Đến hạn &amp; quá hạn</span>
            <AlarmClock className="text-amber-600" size={20} />
          </div>
          <div className="text-2xl font-bold text-amber-900 font-mono my-1">{formatVnd(overdueAmount)}</div>
          <div className="text-xs text-amber-800 pt-1 border-t border-amber-100 flex items-center justify-between">
            <span>{dueTodayCustomers.length} hộ đến hạn</span>
            <span className="font-semibold">{overdueCustomers.length} hộ quá hạn</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs uppercase tracking-wider font-bold">Đã thu hồi nợ</span>
            <CheckCircle2 className="text-emerald-600" size={20} />
          </div>
          <div className="text-2xl font-bold text-emerald-800 font-mono my-1">{formatVnd(totalCollected)}</div>
          <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">{disputedCount} khoản nợ đang tranh chấp</div>
        </div>
      </section>

      <PendingPaymentRequestsPanel requests={pendingPaymentRequests} onConfirm={handleConfirmPayment} onReject={handleRejectPayment} variant="full" />

      <section className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[300px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm tên nông dân, SĐT, ấp..." className="relative min-w-[220px] flex-1 max-w-sm" />
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
          <h2 className="text-sm font-bold text-slate-900">Danh sách công nợ khách hàng</h2>
          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold">{filteredCustomers.length} nông hộ</span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-4 px-4">Khách hàng &amp; SĐT</th>
                <th className="py-4 px-3 text-center">Tổng mua</th>
                <th className="py-4 px-3 text-center">Đã trả</th>
                <th className="py-4 px-3 text-center font-bold text-slate-900">Còn nợ</th>
                <th className="py-4 px-3 text-center">Hạn trả</th>
                <th className="py-4 px-3 text-center">Trạng thái</th>
                <th className="py-4 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs sm:text-sm">
              {filteredCustomers.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Không tìm thấy khách hàng phù hợp với bộ lọc." className="text-slate-400" />
              ) : null}
              {paginatedCustomers.map((customer) => {
                const isSelected = customer.id === selectedId
                const remainingAmount = parseVnd(customer.remaining)
                return (
                  <tr
                    key={customer.id}
                    onClick={() => setSelectedId(customer.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-l-4 border-l-emerald-600'
                        : customer.isDisputed
                          ? 'bg-rose-50/60 hover:bg-rose-50'
                          : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-900 flex items-center gap-1.5">
                        <span>{customer.name}</span>
                        {customer.cropBadge && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded font-medium">{customer.cropBadge}</span>
                        )}
                        {customer.isDisputed && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] rounded font-medium border border-rose-200">
                            <AlertTriangle size={11} /> Tranh chấp
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {customer.phone} · {customer.addressShort}
                      </div>
                    </td>
                    <td className="py-4 px-3 text-center font-mono text-slate-600">{customer.totalPurchase}</td>
                    <td className="py-4 px-3 text-center font-mono text-emerald-700 font-medium">{customer.paidAmount}</td>
                    <td className={`py-3 px-3 text-center font-mono font-medium ${remainingAmount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {customer.remaining}
                    </td>
                    <td className={`py-3 px-3 text-center font-mono text-xs ${STATUS_ROW_HIGHLIGHT[customer.status] ?? 'text-slate-700'}`}>
                      {customer.dueDate}
                    </td>
                    <td className="py-4 px-3 text-center">
                      <StatusBadge label={customer.statusBadge.label} className={customer.statusBadge.className} minWidthClassName="min-w-[110px]" />
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu
                          triggerLabel={`Thao tác công nợ ${customer.name}`}
                          actions={customer.actions.map((action) => ({
                            ...action,
                            // Both "Xem chi tiết" and "Xử lý tranh chấp" open the same
                            // detail modal - dispute resolution controls live inside it.
                            onClick: () => setSelectedId(customer.id),
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
          unitLabel="khách hàng"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>

      <FormModal
        open={adjustTargetId !== null}
        onClose={() => setAdjustTargetId(null)}
        title="Điều chỉnh khoản nợ"
        fields={ADJUST_FIELDS}
        values={adjustForm}
        onChange={updateAdjustForm}
        onSubmit={handleAdjustSubmit}
        submitLabel="Lưu điều chỉnh"
      />

      <DetailModal open={selected !== null} onClose={() => setSelectedId(null)} widthClassName="max-w-2xl">
        {selected ? (
          <>
            <div className="p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-3">
                <span>Công nợ</span>
                <ChevronRight size={12} />
                <span className="text-slate-800 font-semibold">{selected.id}</span>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>{selected.name}</span>
                    {selected.cropBadge && (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded font-bold">{selected.cropBadge}</span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    {selected.phone} • {selected.addressShort}
                  </p>
                </div>
                <StatusBadge label={selected.statusBadge.label} className={selected.statusBadge.className} />
              </div>
            </div>

            <div className="p-5 overflow-y-auto max-h-[65vh] space-y-5">
              <DisputeResolutionPanel
                customer={selected}
                onKeep={() => handleDisputeAction(selected.id, 'KEEP')}
                onAdjust={() => handleDisputeAction(selected.id, 'ADJUST')}
                onCancel={() => handleDisputeAction(selected.id, 'CANCEL')}
              />

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Tổng mua:</span>
                  <span className="font-mono font-bold text-slate-900">{selected.totalPurchase}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Đã trả:</span>
                  <span className="font-mono font-bold text-emerald-700">{selected.paidAmount}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-900">Còn nợ:</span>
                  <span className="font-mono font-bold text-base text-rose-700">{selected.remaining}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 pt-1">
                  <span>Hạn trả: {selected.dueDate}</span>
                  <span>Quá hạn: {selected.overdueDays}</span>
                </div>
              </div>

              {selectedPaymentRequests.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-2">Yêu cầu trả nợ</span>
                  <PendingPaymentRequestsPanel
                    requests={selectedPaymentRequests}
                    onConfirm={handleConfirmPayment}
                    onReject={handleRejectPayment}
                    variant="compact"
                  />
                </div>
              )}

              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-2">Đơn hàng liên quan</span>
                <div className="space-y-2">
                  {selected.relatedOrders.map((order) => (
                    <div key={order.id} className="p-3 border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-slate-900 text-xs">{order.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${order.statusClassName}`}>{order.status}</span>
                      </div>
                      {order.dateNote && <div className="text-[11px] text-slate-400 mt-1">{order.dateNote}</div>}
                      <div className="flex items-center justify-between mt-1.5 text-xs">
                        <span className="text-slate-600">{order.totalNote}</span>
                        <span className={`font-semibold ${order.remainingClassName}`}>{order.remainingLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-2">Lịch sử thanh toán</span>
                <div className="space-y-2">
                  {selected.paymentHistory.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2.5 border border-slate-100 rounded-lg bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-900">{entry.title}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">{entry.dateNote}</div>
                      </div>
                      <span className={`font-mono font-bold ${entry.amountClassName}`}>{entry.amountLabel}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DetailModal>
    </>
  )
}
