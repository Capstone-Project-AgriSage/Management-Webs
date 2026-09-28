import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Download, Plus, FilterX, Banknote, QrCode, Wallet, History } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import type { RowAction } from '@/components/ui/RowActionsMenu'
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
import { payments as INITIAL_PAYMENTS } from '@/features/sales/data/mockPayments'
import { parseVnd, formatVnd } from '@/utils/money'
import { downloadCsv } from '@/utils/csv'
import { PAYMENT_METHOD_VISUALS } from '@/features/sales/constants/paymentMethod'
import KpiCard from '@/components/ui/KpiCard'
import type { Payment, PaymentStatus, OrderPaymentMethod } from '@/types'

const STATUS_OPTIONS: ('Tất cả trạng thái' | PaymentStatus)[] = [
  'Tất cả trạng thái',
  'Chưa thanh toán',
  'Thanh toán 1 phần',
  'Đã thanh toán',
]
const NEW_PAYMENT_METHODS: OrderPaymentMethod[] = ['Tiền mặt tại quầy', 'VietQR', 'Cọc 50%', 'Gối nợ vụ mùa']
const METHOD_OPTIONS: ('Tất cả phương thức' | OrderPaymentMethod)[] = ['Tất cả phương thức', ...NEW_PAYMENT_METHODS]

const STATUS_VISUALS: Record<PaymentStatus, { className: string; dotClassName: string }> = {
  'Chưa thanh toán': { className: 'bg-red-100 text-red-800 border-red-300', dotClassName: 'bg-red-600' },
  'Thanh toán 1 phần': { className: 'bg-amber-100 text-amber-800 border-amber-300', dotClassName: 'bg-amber-600' },
  'Đã thanh toán': { className: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotClassName: 'bg-emerald-600' },
}

function buildActions(hasRemaining: boolean, methodLabel: OrderPaymentMethod): RowAction[] {
  const actions: RowAction[] = [{ label: 'Xem', icon: 'visibility' }]
  if (hasRemaining) {
    if (methodLabel === 'VietQR') {
      actions.push({ label: 'Xác nhận VietQR', icon: 'verified', tone: 'primary' })
    } else if (PAYMENT_METHOD_VISUALS[methodLabel].isCash) {
      // Only push the cash-recording action when cash actually changes hands at the counter —
      // e.g. 'Gối nợ vụ mùa' (seasonal carryover debt) has a remaining balance but isn't collected here.
      actions.push({ label: 'Ghi nhận Cash', icon: 'payments', tone: 'primary' })
    }
  }
  return actions
}

function computeStatus(paid: number, total: number): PaymentStatus {
  if (paid <= 0) return 'Chưa thanh toán'
  if (paid < total) return 'Thanh toán 1 phần'
  return 'Đã thanh toán'
}

// Single source of truth for the "còn lại" (remaining) amount color: amber when there's still a
// balance to collect, slate once it's fully settled — used both when recording/creating a payment
// so a row never shows a different color depending on where it came from.
function getRemainingAmountClassName(hasRemaining: boolean) {
  return hasRemaining ? 'text-amber-700' : 'text-slate-400'
}

const emptyPaymentForm = {
  orderId: '',
  customerName: '',
  customerPhone: '',
  totalAmount: '',
  paidAmount: '',
  methodLabel: NEW_PAYMENT_METHODS[0] ?? '',
}

const CREATE_PAYMENT_FIELDS: FormFieldSpec[] = [
  { key: 'orderId', label: 'Mã đơn hàng gốc (VD: #DH-3010)' },
  { key: 'customerName', label: 'Tên khách hàng' },
  { key: 'customerPhone', label: 'Số điện thoại' },
  { key: 'totalAmount', label: 'Tổng giá trị đơn (₫)', placeholder: 'VD: 6.850.000', group: 'amounts' },
  { key: 'paidAmount', label: 'Số tiền đã thu (₫)', placeholder: 'VD: 3.000.000 (để trống nếu chưa thu)', group: 'amounts' },
  { key: 'methodLabel', label: 'Phương thức thanh toán', type: 'select', options: NEW_PAYMENT_METHODS },
]

export default function PaymentsPage() {
  usePageHeader({ title: 'Thanh toán', subtitle: 'Ghi nhận và xác nhận thanh toán tại quầy' })

  const [payments, setPayments] = useState(INITIAL_PAYMENTS)
  const { showToast } = useToast()
  const { user } = useAuth()

  const recordPayment = (id: string, amount: number, note: string) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const total = parseVnd(p.totalAmount)
        const alreadyPaid = parseVnd(p.paidAmount)
        const newPaid = Math.min(total, alreadyPaid + amount)
        const remaining = total - newPaid
        const hasRemaining = remaining > 0
        const status = computeStatus(newPaid, total)
        const historyEntry = {
          title: `Vừa xong — ${note}`,
          note: `Ghi nhận bởi ${user.name}`,
          amountLabel: `+${formatVnd(amount)}`,
          amountClassName: 'text-emerald-700',
          cardClassName: 'bg-slate-50 border border-slate-200',
        }
        return {
          ...p,
          paidAmount: formatVnd(newPaid),
          paidAmountClassName: newPaid > 0 ? 'text-emerald-700' : 'text-slate-400',
          remainingAmount: formatVnd(remaining),
          remainingAmountClassName: getRemainingAmountClassName(hasRemaining),
          status,
          statusBadge: { label: status, ...STATUS_VISUALS[status] },
          recordedBy: user.name,
          paymentHistory: [...p.paymentHistory, historyEntry],
          actions: buildActions(hasRemaining, p.methodLabel),
        }
      }),
    )
  }

  const markPaymentPaid = (id: string) => {
    const payment = payments.find((p) => p.id === id)
    if (!payment) return
    const remaining = parseVnd(payment.remainingAmount)
    if (remaining <= 0) return
    recordPayment(id, remaining, payment.methodLabel === 'VietQR' ? 'Xác nhận VietQR' : 'Ghi nhận thanh toán tiền mặt')
    showToast(`Đã ghi nhận thanh toán ${id}`)
  }

  const handlePaymentAction = (id: string, label: string) => {
    if (label === 'Xem') setSelectedId(id)
    else if (label === 'Ghi nhận Cash' || label === 'Xác nhận VietQR') markPaymentPaid(id)
  }

  const [createOpen, setCreateOpen] = useState(false)
  const { values: createForm, update: updateCreateForm, reset: resetCreateForm } = useFormValues(emptyPaymentForm)

  const handleCreatePayment = () => {
    const { orderId, customerName, customerPhone, totalAmount, paidAmount, methodLabel } = createForm
    const total = parseVnd(totalAmount)
    const paid = paidAmount.trim() ? parseVnd(paidAmount) : 0
    if (!orderId.trim() || !customerName.trim() || !customerPhone.trim() || total <= 0 || paid > total) {
      showToast('Vui lòng nhập đầy đủ và hợp lệ thông tin thanh toán')
      return
    }
    const maxNum = payments.reduce((max, p) => {
      const n = Number.parseInt(p.id.split('-').pop() ?? '0', 10)
      return Number.isNaN(n) ? max : Math.max(max, n)
    }, 0)
    const remaining = total - paid
    const hasRemaining = remaining > 0
    const status = computeStatus(paid, total)
    const method = methodLabel as OrderPaymentMethod
    const newPayment: Payment = {
      id: `TT-${maxNum + 1}`,
      orderId: orderId.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      totalAmount: formatVnd(total),
      paidAmount: formatVnd(paid),
      paidAmountClassName: paid > 0 ? 'text-emerald-700' : 'text-slate-400',
      remainingAmount: formatVnd(remaining),
      remainingAmountClassName: getRemainingAmountClassName(hasRemaining),
      methodLabel: method,
      methodIcon: PAYMENT_METHOD_VISUALS[method].icon,
      methodClassName: PAYMENT_METHOD_VISUALS[method].badgeClassName,
      status,
      statusBadge: { label: status, ...STATUS_VISUALS[status] },
      time: 'Vừa xong',
      recordedBy: user.name,
      paymentHistory:
        paid > 0
          ? [
              {
                title: 'Vừa xong — Ghi nhận thanh toán',
                note: `Ghi nhận thủ công bởi ${user.name}`,
                amountLabel: `+${formatVnd(paid)}`,
                amountClassName: 'text-emerald-700',
                cardClassName: 'bg-slate-50 border border-slate-200',
              },
            ]
          : [
              {
                title: 'Phát sinh giao dịch chờ thu',
                note: `Đơn hàng ${orderId.trim()}`,
                amountLabel: formatVnd(total),
                amountClassName: 'text-red-700',
                cardClassName: 'border border-dashed border-red-300 bg-red-50/50',
              },
            ],
      actions: buildActions(hasRemaining, method),
    }
    setPayments((prev) => [newPayment, ...prev])
    showToast(`Đã ghi nhận thanh toán ${newPayment.id}`)
    resetCreateForm()
    setCreateOpen(false)
  }

  const handleExportPayments = () => {
    downloadCsv(
      `giao-dich-thanh-toan-${Date.now()}.csv`,
      filteredPayments.map((p) => ({
        'Mã TT': p.id,
        'Mã đơn': p.orderId,
        'Khách hàng': p.customerName,
        'Tổng đơn': p.totalAmount,
        'Đã thu': p.paidAmount,
        'Còn lại': p.remainingAmount,
        'Phương thức': p.methodLabel,
        'Trạng thái': p.statusBadge.label,
      })),
    )
    showToast(`Đã xuất báo cáo ${filteredPayments.length} giao dịch`)
  }

  const { selectedId, setSelectedId, selected: selectedPayment } = useSelectableList(payments, (p) => p.id)

  const [methodFilter, setMethodFilter] = useState(METHOD_OPTIONS[0])

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredPaymentsBase,
    clearFilters: clearFiltersBase,
  } = useFilteredList(
    payments,
    STATUS_OPTIONS[0],
    (item, keyword, status) =>
      (!keyword ||
        item.id.toLowerCase().includes(keyword) ||
        item.orderId.toLowerCase().includes(keyword) ||
        item.customerName.toLowerCase().includes(keyword)) &&
      (status === STATUS_OPTIONS[0] || item.status === status),
  )

  const clearFilters = () => {
    clearFiltersBase()
    setMethodFilter(METHOD_OPTIONS[0])
  }

  const filteredPayments = filteredPaymentsBase.filter(
    (item) => methodFilter === METHOD_OPTIONS[0] || item.methodLabel === methodFilter,
  )

  const {
    page,
    totalPages,
    paginated: paginatedPayments,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredPayments, 8)

  const totalCollected = payments.reduce((sum, p) => sum + parseVnd(p.paidAmount), 0)
  const totalOutstanding = payments.reduce((sum, p) => sum + parseVnd(p.remainingAmount), 0)
  const unpaidCount = payments.filter((p) => p.status === 'Chưa thanh toán').length
  const partialCount = payments.filter((p) => p.status === 'Thanh toán 1 phần').length

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1 text-[12px] text-slate-500" aria-label="Breadcrumb">
          <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Thanh toán</span>
        </nav>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50/50 transition-colors shadow-sm"
            type="button"
            onClick={handleExportPayments}
          >
            <Download size={16} className="text-slate-500" />
            <span>Xuất dữ liệu</span>
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} />
            <span>Tạo thanh toán</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard layout="stacked" icon={Wallet} iconClassName="bg-emerald-50 text-emerald-600" title="Đã thu" value={formatVnd(totalCollected)}>
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 mt-2">Tổng số giao dịch: {payments.length}</div>
        </KpiCard>

        <KpiCard
          layout="stacked"
          icon={Banknote}
          iconClassName="bg-amber-50 text-amber-500"
          title="Còn phải thu"
          value={formatVnd(totalOutstanding)}
          valueClassName="text-amber-600"
          className="border-amber-200"
        >
          <div className="text-xs text-amber-600 border-t border-amber-100/50 pt-2 mt-2">
            {unpaidCount} chưa thu • {partialCount} thu 1 phần
          </div>
        </KpiCard>

        <KpiCard
          layout="stacked"
          icon={QrCode}
          iconClassName="bg-blue-50 text-blue-500"
          title="VietQR chờ xác nhận"
          value={payments.filter((p) => p.methodLabel === 'VietQR' && p.status !== 'Đã thanh toán').length}
          valueSuffix={<span className="text-xs font-medium text-blue-600">giao dịch</span>}
        >
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 mt-2">Cần đối chiếu sao kê ngân hàng</div>
        </KpiCard>

        <KpiCard
          layout="stacked"
          icon={History}
          iconClassName="bg-emerald-50 text-emerald-500"
          title="Đã thanh toán"
          value={payments.filter((p) => p.status === 'Đã thanh toán').length}
          valueClassName="text-emerald-600"
          valueSuffix={<span className="text-xs font-medium text-emerald-600">giao dịch</span>}
        >
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 mt-2">Thu đủ, không còn công nợ</div>
        </KpiCard>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm mã thanh toán, mã đơn, tên khách hàng..."
            className="relative min-w-[280px] flex-1 max-w-md"
          />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="relative min-w-[160px]" />
          <FilterSelect
            value={methodFilter}
            onChange={(value) => setMethodFilter(value as (typeof METHOD_OPTIONS)[number])}
            options={METHOD_OPTIONS}
            className="relative min-w-[170px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 px-2 py-1"
            type="button"
            onClick={clearFilters}
          >
            <FilterX size={14} />
            <span>Xóa bộ lọc</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Danh sách giao dịch thanh toán</span>
            <span className="text-[10px] font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{filteredPayments.length} bản ghi</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-4 pl-4 px-3">Mã TT / Đơn</th>
                <th className="py-4 px-3">Khách hàng</th>
                <th className="py-4 px-3 text-center">Tổng đơn</th>
                <th className="py-4 px-3 text-center">Đã thu</th>
                <th className="py-4 px-3 text-center">Còn lại</th>
                <th className="py-4 px-3 text-center">Phương thức</th>
                <th className="py-4 px-3 text-center">Trạng thái</th>
                <th className="py-4 pr-4 pl-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm font-normal">

              {filteredPayments.length === 0 ? <EmptyTableRow colSpan={8} message="Không tìm thấy giao dịch nào." /> : null}
              {paginatedPayments.map((item) => {
                const isSelected = item.id === selectedId
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected ? 'bg-emerald-50/50 hover:bg-emerald-50 border-l-2 border-l-emerald-500' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="py-4 pl-4 px-3">
                      <div className="font-medium font-mono text-xs text-slate-900">{item.id}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.orderId}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-slate-900 text-sm">{item.customerName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.customerPhone}</div>
                    </td>
                    <td className="py-4 px-3 text-center font-mono font-medium text-slate-900">{item.totalAmount}</td>
                    <td className={`py-3 px-3 text-center font-mono font-medium ${item.paidAmountClassName}`}>{item.paidAmount}</td>
                    <td className={`py-3 px-3 text-center font-mono font-medium ${item.remainingAmountClassName}`}>{item.remainingAmount}</td>
                    <td className="py-4 px-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${item.methodClassName}`}>
                        <span className="material-symbols-outlined text-[14px]">{item.methodIcon}</span>
                        {item.methodLabel}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-center whitespace-nowrap">
                      <StatusBadge label={item.statusBadge.label} className={item.statusBadge.className} minWidthClassName="min-w-[120px]" />
                    </td>
                    <td className="py-4 pr-4 pl-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <RowActionsMenu
                          triggerLabel={`Thao tác giao dịch ${item.id}`}
                          actions={item.actions.map((action) => ({ ...action, onClick: () => handlePaymentAction(item.id, action.label) }))}
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
          unitLabel="giao dịch"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>

      <DetailModal open={selectedPayment !== null} onClose={() => setSelectedId(null)} widthClassName="max-w-2xl">
        {selectedPayment ? (
          <>
            <div className="p-5 border-b border-slate-200 bg-slate-50 rounded-t-xl">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Chi tiết thanh toán</h2>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    Mã TT: {selectedPayment.id} • Mã đơn: {selectedPayment.orderId}
                  </p>
                </div>
                <StatusBadge label={selectedPayment.statusBadge.label} className={selectedPayment.statusBadge.className} />
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Khách hàng</span>
                  <div className="font-bold text-slate-900 mt-1">{selectedPayment.customerName}</div>
                  <div className="text-xs text-slate-500">{selectedPayment.customerPhone}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phương thức</span>
                  <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${selectedPayment.methodClassName}`}>
                    <span className="material-symbols-outlined text-[14px]">{selectedPayment.methodIcon}</span>
                    {selectedPayment.methodLabel}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Thông tin tài chính</span>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tổng đơn:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedPayment.totalAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Đã thu:</span>
                    <span className={`font-mono font-bold ${selectedPayment.paidAmountClassName}`}>{selectedPayment.paidAmount}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-900">Còn lại:</span>
                    <span className={`font-mono font-bold text-base ${selectedPayment.remainingAmountClassName}`}>{selectedPayment.remainingAmount}</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Lịch sử thanh toán</span>
                <div className="space-y-2">
                  {selectedPayment.paymentHistory.map((entry, i) => (
                    <div key={i} className={`p-3 rounded-lg ${entry.cardClassName}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-semibold text-slate-900">{entry.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{entry.note}</p>
                        </div>
                        <span className={`font-mono font-bold text-[13px] whitespace-nowrap ${entry.amountClassName}`}>{entry.amountLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 rounded-b-xl">
              <button
                className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700 text-[13px] font-bold rounded-lg shadow-sm"
                type="button"
                onClick={() => setSelectedId(null)}
              >
                Đóng
              </button>
              {selectedPayment.status !== 'Đã thanh toán' ? (
                <button
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold rounded-lg shadow-sm flex items-center gap-1.5"
                  type="button"
                  onClick={() => markPaymentPaid(selectedPayment.id)}
                >
                  <Banknote size={16} />
                  <span>{selectedPayment.methodLabel === 'VietQR' ? 'Xác nhận VietQR' : 'Thu số dư còn lại'}</span>
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </DetailModal>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ghi nhận thanh toán mới"
        fields={CREATE_PAYMENT_FIELDS}
        values={createForm}
        onChange={updateCreateForm}
        onSubmit={handleCreatePayment}
        submitLabel="Lưu giao dịch"
      />
    </>
  )
}
