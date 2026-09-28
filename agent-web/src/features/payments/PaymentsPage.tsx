import { useState } from 'react'
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
import { useSelectableList } from '../../hooks/useSelectableList'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { useFormValues } from '../../hooks/useFormValues'
import { payments as INITIAL_PAYMENTS } from '../../data/mockPayments'
import { parseVnd, formatVnd } from '../../utils/money'
import { downloadCsv } from '../../utils/csv'
import type { Payment } from '../../types'

import {
  ChevronRight,
  Download,
  Plus,
  FilterX,
  User,
  Banknote,
  MessageCircle,
  RefreshCw,
  ScanLine,
  History,
  MoreHorizontal
} from 'lucide-react'

const STATUS_OPTIONS = ['Tất cả trạng thái', 'Chưa thanh toán', 'Thanh toán 1 phần', 'Đã thanh toán', 'Chờ đối soát', 'Đã đối soát', 'Hoàn tiền']
const METHOD_OPTIONS = ['Tất cả phương thức', ...new Set(INITIAL_PAYMENTS.map((p) => p.methodLabel))]
const NEW_PAYMENT_METHODS = METHOD_OPTIONS.slice(1)
const emptyPaymentForm = {
  orderId: '',
  customerName: '',
  customerPhone: '',
  addressShort: '',
  totalAmount: '',
  paidAmount: '',
  methodLabel: NEW_PAYMENT_METHODS[0] ?? '',
}

const CREATE_PAYMENT_FIELDS: FormFieldSpec[] = [
  { key: 'orderId', label: 'Mã đơn hàng gốc (VD: #DH-2024-1082)' },
  { key: 'customerName', label: 'Tên khách hàng' },
  { key: 'customerPhone', label: 'Số điện thoại' },
  { key: 'addressShort', label: 'Địa chỉ' },
  { key: 'totalAmount', label: 'Tổng giá trị đơn (₫)', placeholder: 'VD: 8.245.000', group: 'amounts' },
  { key: 'paidAmount', label: 'Số tiền đã thu (₫)', placeholder: 'VD: 5.000.000 (để trống nếu chưa thu)', group: 'amounts' },
  { key: 'methodLabel', label: 'Phương thức thanh toán', type: 'select', options: NEW_PAYMENT_METHODS },
]

export default function PaymentsPage() {
  usePageHeader({ title: '' }) // Flat layout

  const [payments, setPayments] = useState(INITIAL_PAYMENTS)
  const { showToast } = useToast()
  
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'debts'>('overview')

  const markPaymentPaid = (id: string) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              paidAmount: p.totalAmount,
              paidAmountClassName: 'text-emerald-700',
              remainingAmount: '0 đ',
              remainingAmountClassName: 'text-slate-400',
              status: 'Đã thanh toán',
              statusBadge: { label: 'Đã thanh toán', className: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotClassName: 'bg-emerald-600' },
              collectedLabel: `${p.totalAmount} (100%)`,
              progressWidth: '100%',
              hasRemaining: false,
            }
          : p,
      ),
    )
    showToast(`Đã ghi nhận thanh toán #${id}`)
  }

  const markPaymentReconciled = (id: string) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'Đã thanh toán',
              paidAmount: p.totalAmount,
              paidAmountClassName: 'text-emerald-700',
              remainingAmount: '0 đ',
              remainingAmountClassName: 'text-slate-400',
              statusBadge: { label: 'Đã đối soát', className: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotClassName: 'bg-emerald-600' },
              collectedLabel: `${p.totalAmount} (100%)`,
              progressWidth: '100%',
              hasRemaining: false,
            }
          : p,
      ),
    )
    showToast(`Đã đối soát khớp tiền Vietcombank STK 19006828999 cho giao dịch #${id}`)
  }

  const handlePaymentAction = (id: string, label: string) => {
    if (label === 'Thu tiếp' || label === 'Ghi nhận TT') markPaymentPaid(id)
    else if (label === 'Đối soát') markPaymentReconciled(id)
    else if (label === 'Xem') setSelectedId(id)
    else showToast(`Đã thực hiện "${label}" cho giao dịch #${id}`)
  }

  const [createOpen, setCreateOpen] = useState(false)
  const { values: createForm, update: updateCreateForm, reset: resetCreateForm } = useFormValues(emptyPaymentForm)

  const handleCreatePayment = () => {
    const { orderId, customerName, customerPhone, addressShort, totalAmount, paidAmount, methodLabel } = createForm
    const total = parseVnd(totalAmount)
    const paid = paidAmount.trim() ? parseVnd(paidAmount) : 0
    if (!orderId.trim() || !customerName.trim() || !customerPhone.trim() || !addressShort.trim() || total <= 0 || paid > total) {
      showToast('Vui lòng nhập đầy đủ và hợp lệ thông tin thanh toán')
      return
    }
    const maxNum = payments.reduce((max, p) => {
      const n = Number.parseInt(p.id.split('-').pop() ?? '0', 10)
      return Number.isNaN(n) ? max : Math.max(max, n)
    }, 0)
    const remaining = total - paid
    const hasRemaining = remaining > 0
    const newPayment: Payment = {
      id: `TT-${maxNum + 1}`,
      orderId: orderId.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      addressShort: addressShort.trim(),
      totalAmount: formatVnd(total),
      paidAmount: formatVnd(paid),
      paidAmountClassName: paid > 0 ? 'text-emerald-700' : 'text-slate-400',
      remainingAmount: formatVnd(remaining),
      remainingAmountClassName: hasRemaining ? 'text-amber-700' : 'text-slate-400',
      methodLabel,
      methodClassName: 'bg-slate-100 text-slate-800',
      status: hasRemaining ? (paid > 0 ? 'Thanh toán 1 phần' : 'Chưa thanh toán') : 'Đã thanh toán',
      statusBadge: hasRemaining
        ? paid > 0
          ? { label: 'Thanh toán 1 phần', className: 'bg-amber-100 text-amber-800 border-amber-300', dotClassName: 'bg-amber-600' }
          : { label: 'Chưa thanh toán', className: 'bg-slate-100 text-slate-800 border-slate-300', dotClassName: 'bg-slate-500' }
        : { label: 'Đã thanh toán', className: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotClassName: 'bg-emerald-600' },
      time: 'Vừa xong',
      actions: [
        { label: 'Xem', icon: 'visibility' },
        { label: 'Thu tiếp', icon: 'payments', tone: 'primary' },
      ],
      subtitle: 'Giao dịch thu vật tư nông nghiệp',
      customerNote: addressShort.trim(),
      goodsNote: 'Chưa có chi tiết vật tư',
      collectedLabel: `${formatVnd(paid)} (${total > 0 ? Math.round((paid / total) * 1000) / 10 : 0}%)`,
      progressWidth: `${total > 0 ? Math.round((paid / total) * 1000) / 10 : 0}%`,
      hasRemaining,
      recordedBy: 'Bạn',
      paymentHistory:
        paid > 0
          ? [
              {
                title: 'Vừa xong — Ghi nhận thanh toán',
                note: 'Ghi nhận thủ công',
                amountLabel: `+${formatVnd(paid)}`,
                amountClassName: 'text-emerald-700',
                cardClassName: 'bg-slate-50 border-slate-200',
              },
            ]
          : [],
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

  const { selectedId, setSelectedId, selected } = useSelectableList(payments, (p) => p.id)

  const [methodFilter, setMethodFilter] = useState('Tất cả phương thức')

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredPaymentsBase,
    clearFilters: clearFiltersBase,
  } = useFilteredList(
    payments,
    'Tất cả trạng thái',
    (item, keyword, status) =>
      (!keyword ||
        item.id.toLowerCase().includes(keyword) ||
        item.orderId.toLowerCase().includes(keyword) ||
        item.customerName.toLowerCase().includes(keyword)) &&
      (status === 'Tất cả trạng thái' || item.statusBadge.label === status),
    'Tất cả trạng thái',
  )

  const clearFilters = () => {
    clearFiltersBase()
    setMethodFilter('Tất cả phương thức')
  }

  // Combine filters: useFilteredList + methodFilter + activeTab
  const filteredPayments = filteredPaymentsBase.filter((item) => {
    // 1. Method filter
    if (methodFilter !== 'Tất cả phương thức' && item.methodLabel !== methodFilter) return false
    
    // 2. Tab filter
    if (activeTab === 'transactions') {
      // Only show completed/paid transactions
      if (item.hasRemaining) return false
    } else if (activeTab === 'debts') {
      // Only show debts
      if (!item.hasRemaining) return false
    }
    
    return true
  })

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
  } = usePagination(filteredPayments, 15)

  // Current Date logic for subtitle
  const today = new Date()
  const dateStr = today.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // Quick Action state
  const [quickAmount, setQuickAmount] = useState('')

  return (
    <div className="bg-white -m-4 lg:-m-6 p-4 lg:p-8 min-h-[calc(100vh-4rem)] text-slate-900">
      {/* 1. Header & Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý thanh toán</h1>
          <p className="text-[13px] text-slate-500 mt-1 font-medium capitalize">{dateStr}</p>
          <div className="mt-8 flex items-center gap-6">
            <button 
              className={`pb-2.5 text-[13px] font-bold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('overview')}
            >
              Tổng quan
            </button>
            <button 
              className={`pb-2.5 text-[13px] font-bold border-b-2 transition-colors ${activeTab === 'transactions' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('transactions')}
            >
              Giao dịch
            </button>
            <button 
              className={`pb-2.5 text-[13px] font-bold border-b-2 transition-colors ${activeTab === 'debts' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('debts')}
            >
              Công nợ
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 pb-2 shrink-0">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium mr-2">
            <RefreshCw size={12} /> Cập nhật 5 phút trước
          </span>
          <button 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-md text-[13px] font-bold hover:bg-slate-50/50 shadow-sm text-slate-700 transition-colors"
            onClick={handleExportPayments}
          >
            <Download size={14} /> Xuất dữ liệu
          </button>
          <button 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-[13px] font-bold hover:bg-emerald-700 shadow-sm transition-colors"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} /> Tạo thanh toán
          </button>
        </div>
      </div>
      <div className="border-b border-slate-200 -mt-[1px]"></div>

      {/* 2. KPIs Row (Like "Net worth" / "Available cash") */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
         <div className="p-4 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-500 mb-1">Tổng thu trong kỳ</h3>
            <div className="flex items-end justify-between">
               <span className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">40.8M</span>
               <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px] mb-1">+8.4%</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">+2.4M so với tháng trước</p>
         </div>

         <div className="p-4 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-500 mb-1">Tiền mặt khả dụng</h3>
            <div className="flex items-end justify-between">
               <span className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">12.8M</span>
               <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px] mb-1">+3.2%</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">+1.2M trên trung bình 30 ngày</p>
         </div>

         <div className="p-4 rounded-xl border border-slate-200 shadow-sm hidden xl:block">
            <h3 className="text-xs font-semibold text-slate-500 mb-1">Tỷ lệ thu hồi nợ</h3>
            <div className="flex items-end justify-between">
               <span className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">28%</span>
               <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px] mb-1">+2.4%</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Tăng từ 25.6% tháng trước</p>
         </div>

         <div className="p-4 rounded-xl border border-slate-200 shadow-sm lg:col-span-1 xl:col-span-1 flex flex-col justify-between">
            <h3 className="text-xs font-semibold text-slate-500 mb-2">Cơ cấu nguồn thu</h3>
            <div className="flex items-center gap-1 w-full h-3 rounded-full overflow-hidden">
               <div className="bg-emerald-600 h-full w-[60%]"></div>
               <div className="bg-emerald-400 h-full w-[25%]"></div>
               <div className="bg-emerald-100 h-full w-[15%]"></div>
            </div>
            <div className="flex justify-between text-[10px] font-semibold text-slate-500 mt-3">
               <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-600 block"></span> Tiền mặt (60%)</div>
               <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 block"></span> VietQR (25%)</div>
               <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-100 block"></span> Khác (15%)</div>
            </div>
         </div>
      </div>

      {/* 3. Main Layout: Table + Sidebar */}
      <div className="flex flex-col lg:flex-row mt-8 gap-8">
         
         {/* Left Side: Table Area */}
         <div className="flex-1 min-w-0">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative max-w-sm flex-1 min-w-[240px]">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Tìm mã thanh toán, mã đơn..."
                  className="w-full bg-white border-slate-300 shadow-sm"
                />
              </div>
              <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} className="shadow-sm border-slate-300" />
              <FilterSelect value={methodFilter} onChange={setMethodFilter} options={METHOD_OPTIONS} className="shadow-sm border-slate-300" />
              
              {(search || statusFilter !== 'Tất cả trạng thái' || methodFilter !== 'Tất cả phương thức') && (
                <button
                  className="px-3 py-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 font-semibold text-[13px] flex items-center gap-1.5 transition-colors"
                  onClick={clearFilters}
                >
                  <FilterX size={14} />
                  <span>Xóa lọc</span>
                </button>
              )}
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                      <th className="py-4 px-4 w-32">Mã TT / Đơn</th>
                      <th className="py-4 px-4">Khách hàng</th>
                      <th className="py-4 px-4 text-center">Tổng đơn</th>
                      <th className="py-4 px-4 text-center">Đã thu</th>
                      <th className="py-4 px-4 text-center">Còn lại</th>
                      <th className="py-4 px-4 text-center">Phương thức</th>
                      <th className="py-4 px-4 text-center">Trạng thái</th>
                      <th className="py-4 px-4 w-10 "></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-[13px]">
                    {paginatedPayments.length === 0 ? (
                      <EmptyTableRow colSpan={8} message="Không tìm thấy giao dịch nào." className="text-slate-400 py-10" />
                    ) : null}
                    {paginatedPayments.map((item) => {
                      const isSelected = item.id === selectedId
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          className={`transition-colors cursor-pointer group ${
                            isSelected
                              ? 'bg-slate-50/80 border-l-2 border-l-slate-900'
                              : 'hover:bg-slate-50/50 border-l-2 border-l-transparent'
                          }`}
                        >
                          <td className="py-4 px-4">
                            <div className="font-bold font-mono text-slate-900">{item.id}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.orderId}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-semibold text-slate-900">{item.customerName}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{item.customerPhone}</div>
                          </td>
                          <td className="py-4 px-4 text-center font-mono font-semibold text-slate-900">{item.totalAmount}</td>
                          <td className={`py-3 px-4 text-center font-mono font-semibold ${item.paidAmountClassName}`}>{item.paidAmount}</td>
                          <td className={`py-3 px-4 text-center font-mono font-bold ${item.remainingAmountClassName}`}>
                            {item.remainingAmount}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border border-slate-200 ${item.methodClassName}`}>
                              {item.methodLabel}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <StatusBadge label={item.statusBadge.label} className={item.statusBadge.className} minWidthClassName="min-w-[120px]" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                              <RowActionsMenu
                                triggerLabel={`Thao tác giao dịch ${item.id}`}
                                actions={item.actions.map((action) => ({
                                  ...action,
                                  onClick: () => handlePaymentAction(item.id, action.label),
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
              <div className="border-t border-slate-200 bg-white">
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
            </div>
         </div>

         {/* Right Side: Sidebar */}
         <div className="lg:w-[320px] shrink-0 space-y-6">
            
            {/* Quick Transfer Box */}
            <div className="border border-slate-200 rounded-xl p-5 shadow-sm bg-white">
               <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
                 Ghi nhận nhanh
                 <span className="text-[10px] text-slate-400 font-medium">TIỀN MẶT</span>
               </h3>
               <div className="flex items-center gap-2">
                 <div className="relative flex-1">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₫</span>
                   <input 
                     type="text" 
                     placeholder="0"
                     value={quickAmount}
                     onChange={(e) => setQuickAmount(e.target.value)}
                     className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-900 font-mono font-bold focus:border-slate-400 focus:bg-white outline-none transition-colors"
                   />
                 </div>
                 <button 
                   className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-bold hover:bg-emerald-700 transition-colors"
                   onClick={() => {
                     if (quickAmount) {
                       showToast(`Ghi nhận thu tiền mặt: ${quickAmount} đ`)
                       setQuickAmount('')
                     } else {
                       showToast('Vui lòng nhập số tiền')
                     }
                   }}
                 >
                   Lưu
                 </button>
               </div>
            </div>

            {/* Shortcuts Box */}
            <div className="border border-slate-200 rounded-xl p-5 shadow-sm bg-white">
               <h3 className="text-sm font-bold text-slate-900 mb-4">Lối tắt (Shortcuts)</h3>
               <div className="grid grid-cols-3 gap-4">
                  <button onClick={() => showToast('Chức năng Quét QR đang được phát triển')} className="flex flex-col items-center gap-2 group">
                    <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 group-hover:border-slate-300 transition-all">
                      <ScanLine size={20} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-900">Quét QR</span>
                  </button>
                  <button onClick={() => showToast('Chức năng Đối soát đang được phát triển')} className="flex flex-col items-center gap-2 group">
                    <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 group-hover:border-slate-300 transition-all">
                      <RefreshCw size={20} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-900">Đối soát</span>
                  </button>
                  <button onClick={() => showToast('Chức năng Nhắc nợ đang được phát triển')} className="flex flex-col items-center gap-2 group">
                    <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 group-hover:border-slate-300 transition-all">
                      <MessageCircle size={20} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-900">Nhắc nợ</span>
                  </button>
                  <button onClick={() => showToast('Chức năng Lịch sử đang được phát triển')} className="flex flex-col items-center gap-2 group">
                    <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 group-hover:border-slate-300 transition-all">
                      <History size={20} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-900">Lịch sử</span>
                  </button>
                  <button onClick={() => showToast('Chức năng KH nợ đang được phát triển')} className="flex flex-col items-center gap-2 group">
                    <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 group-hover:border-slate-300 transition-all">
                      <User size={20} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-900">KH nợ</span>
                  </button>
                  <button onClick={() => showToast('Các chức năng khác đang được phát triển')} className="flex flex-col items-center gap-2 group">
                    <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 group-hover:border-slate-300 transition-all">
                      <MoreHorizontal size={20} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-900">Thêm</span>
                  </button>
               </div>
            </div>

            {/* Upcoming / Alerts */}
            <div className="border border-slate-200 rounded-xl p-5 shadow-sm bg-white">
               <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
                 Nhắc nhở
                 <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold">2</span>
               </h3>
               <div className="space-y-3">
                 <div className="p-3 border border-slate-100 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                   <div className="flex justify-between items-start">
                     <span className="text-[13px] font-bold text-slate-900">Thu nợ Nguyễn Văn Hùng</span>
                     <ChevronRight size={16} className="text-slate-400" />
                   </div>
                   <div className="text-[11px] text-slate-500 mt-1">Đến hạn hôm nay • 1.270.000 đ</div>
                 </div>
                 <div className="p-3 border border-slate-100 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                   <div className="flex justify-between items-start">
                     <span className="text-[13px] font-bold text-slate-900">Đối soát lệnh VietQR</span>
                     <ChevronRight size={16} className="text-slate-400" />
                   </div>
                   <div className="text-[11px] text-slate-500 mt-1">2 giao dịch đang chờ khớp lệnh</div>
                 </div>
               </div>
            </div>

         </div>
      </div>

      {/* MODALS */}
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

      <DetailModal open={selected !== null} onClose={() => setSelectedId(null)} widthClassName="max-w-2xl">
        {selected ? (
          <>
            {/* Same detail modal structure as before, just restyled to be cleaner */}
            <div className="p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Chi tiết thanh toán</h2>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    Mã TT: {selected.id} • Mã đơn: {selected.orderId}
                  </p>
                </div>
                <StatusBadge label={selected.statusBadge.label} className={selected.statusBadge.className} />
              </div>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Khách hàng</span>
                  <div className="font-bold text-slate-900">{selected.customerName}</div>
                  <div className="text-xs text-slate-500">{selected.customerPhone}</div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Phương thức</span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border border-slate-200 ${selected.methodClassName}`}>
                    {selected.methodLabel}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                 <span className="text-xs font-semibold text-slate-500 block mb-2">Thông tin tài chính</span>
                 <div className="space-y-2 text-[13px]">
                   <div className="flex justify-between">
                     <span className="text-slate-600">Tổng đơn:</span>
                     <span className="font-mono font-bold text-slate-900">{selected.totalAmount}</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-slate-600">Đã thu:</span>
                     <span className={`font-mono font-bold ${selected.paidAmountClassName}`}>{selected.paidAmount}</span>
                   </div>
                   <div className="flex justify-between pt-2 border-t border-slate-200">
                     <span className="font-bold text-slate-900">Còn lại:</span>
                     <span className={`font-mono font-bold text-base ${selected.remainingAmountClassName}`}>{selected.remainingAmount}</span>
                   </div>
                 </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button 
                className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700 text-[13px] font-bold rounded-lg shadow-sm"
                onClick={() => setSelectedId(null)}
              >
                Đóng
              </button>
              {selected.hasRemaining && (
                <button 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold rounded-lg shadow-sm flex items-center gap-1.5"
                  onClick={() => markPaymentPaid(selected.id)}
                >
                  <Banknote size={16} /> Thu số dư còn lại
                </button>
              )}
            </div>
          </>
        ) : null}
      </DetailModal>
    </div>
  )
}
