import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Download, FilterX, Receipt, Banknote } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import DetailModal from '@/components/ui/DetailModal'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatVnd } from '@/utils/money'
import { downloadCsv } from '@/utils/csv'
import KpiCard from '@/components/ui/KpiCard'
import { ordersApi } from '@/api/ordersApi'
import { paymentsApi } from '@/api/paymentsApi'
import type { OrderResponse } from '@/api/types'
import type { OrderPaymentsSummary } from '@/api/paymentsApi'

type PaymentStatusLabel = 'Chưa thanh toán' | 'Thanh toán 1 phần' | 'Đã thanh toán đủ' | 'Đang tải...'

const STATUS_VISUALS: Record<PaymentStatusLabel, { className: string; color: string }> = {
  'Chưa thanh toán': { className: 'bg-rose-100 text-rose-800 border-rose-300', color: 'text-rose-600' },
  'Thanh toán 1 phần': { className: 'bg-amber-100 text-amber-800 border-amber-300', color: 'text-amber-600' },
  'Đã thanh toán đủ': { className: 'bg-emerald-100 text-emerald-800 border-emerald-300', color: 'text-emerald-600' },
  'Đang tải...': { className: 'bg-slate-100 text-slate-800 border-slate-300', color: 'text-slate-500' },
}

export default function PaymentsPage() {
  usePageHeader({ title: 'Thanh toán', subtitle: 'Theo dõi dòng tiền theo đơn hàng' })
  const { showToast } = useToast()

  const [orders, setOrders] = useState<OrderResponse[]>([])
  const [paymentSummaries, setPaymentSummaries] = useState<Record<string, OrderPaymentsSummary>>({})
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null)
  
  // Payment action state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isPaying, setIsPaying] = useState(false)

  const fetchOrdersAndPayments = async () => {
    setIsLoading(true)
    try {
      const res = await ordersApi.getOrders({ page, pageSize: 10, search })
      setOrders(res.items)
      setTotalCount(res.totalCount)
      setTotalPages(res.totalPages)

      // Fetch payment summaries in parallel
      const summariesPromises = res.items.map(async (order) => {
        try {
          const summary = await paymentsApi.getOrderPayments(order.id)
          return { id: order.id, summary }
        } catch {
          return null
        }
      })
      const results = await Promise.all(summariesPromises)
      const newSummaries: Record<string, OrderPaymentsSummary> = {}
      results.forEach(r => {
        if (r) newSummaries[r.id] = r.summary
      })
      setPaymentSummaries(prev => ({ ...prev, ...newSummaries }))

    } catch (err: any) {
      showToast(err.detail || 'Lỗi tải danh sách', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(fetchOrdersAndPayments, 300)
    return () => clearTimeout(timer)
  }, [page, search])

  const getPaymentStatus = (summary?: OrderPaymentsSummary): PaymentStatusLabel => {
    if (!summary) return 'Đang tải...'
    if (summary.paidAmount === 0) return 'Chưa thanh toán'
    if (summary.paidAmount >= summary.orderTotal) return 'Đã thanh toán đủ'
    return 'Thanh toán 1 phần'
  }

  const handleProcessPayment = async () => {
    if (!selectedOrder) return
    const summary = paymentSummaries[selectedOrder.id]
    if (!summary) return
    
    const amount = Number(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      showToast('Vui lòng nhập số tiền hợp lệ', 'error')
      return
    }
    if (amount > summary.remainingToPay) {
      showToast('Số tiền thu không được vượt quá số còn lại', 'error')
      return
    }

    setIsPaying(true)
    try {
      await paymentsApi.createCashPayment({
        paymentContext: 'ORDER_PAYMENT',
        orderId: selectedOrder.id,
        amount
      })
      showToast('Thu tiền thành công!', 'success')
      setIsPaymentModalOpen(false)
      setPaymentAmount('')
      fetchOrdersAndPayments()
    } catch (err: any) {
      showToast(err.detail || 'Lỗi thu tiền', 'error')
    } finally {
      setIsPaying(false)
    }
  }

  const handleExport = () => {
    downloadCsv(
      `thanh-toan-${Date.now()}.csv`,
      orders.map((o) => {
        const sum = paymentSummaries[o.id]
        return {
          'Mã đơn': o.orderNumber,
          'Khách hàng': o.customerName,
          'Tổng đơn': sum ? formatVnd(sum.orderTotal) : '',
          'Đã thu': sum ? formatVnd(sum.paidAmount) : '',
          'Còn lại': sum ? formatVnd(sum.remainingToPay) : '',
          'Trạng thái': getPaymentStatus(sum),
        }
      })
    )
    showToast(`Đã xuất Excel ${orders.length} bản ghi`, 'success')
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1 text-body-sm text-on-surface-variant" aria-label="Breadcrumb">
          <Link className="hover:text-primary transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-on-surface font-medium">Thanh toán</span>
        </nav>
        <button
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant text-on-surface text-sm font-medium rounded-lg hover:bg-surface-container-low transition-colors shadow-sm"
          type="button"
          onClick={handleExport}
        >
          <Download size={16} className="text-on-surface-variant" />
          <span>Xuất Excel trang này</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          layout="stacked"
          icon={Receipt}
          iconClassName="bg-primary/10 text-primary"
          title="Đơn hàng"
          value={totalCount}
          valueSuffix={<span className="text-xs font-medium text-on-surface-variant">đơn</span>}
        />
      </div>

      <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm flex flex-wrap items-center justify-between gap-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput 
            value={search} 
            onChange={(val) => { setSearch(val); setPage(1) }} 
            placeholder="Tìm theo mã đơn, SĐT..." 
            className="relative flex-1 min-w-[240px]" 
          />
          <button
            className="h-9 px-3 text-on-surface-variant hover:text-on-surface text-xs font-medium flex items-center gap-1 transition-colors"
            onClick={() => { setSearch(''); setPage(1) }}
            type="button"
          >
            <FilterX size={14} />
            <span>Xóa bộ lọc</span>
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface text-label-md font-bold bg-surface-container-low">
                <th className="py-4 pl-4 px-3 w-[200px]">Đơn hàng</th>
                <th className="py-4 px-3 w-[220px]">Khách hàng</th>
                <th className="py-4 px-3 text-right">Tổng đơn</th>
                <th className="py-4 px-3 text-right">Đã thu</th>
                <th className="py-4 px-3 text-right text-rose-600">Còn lại</th>
                <th className="py-4 px-3 text-center">Trạng thái</th>
                <th className="py-4 pr-4 pl-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm text-on-surface">
              {isLoading ? (
                <EmptyTableRow colSpan={7} message="Đang tải dữ liệu..." />
              ) : orders.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Không tìm thấy dữ liệu." />
              ) : null}
              {orders.map((order) => {
                const summary = paymentSummaries[order.id]
                const status = getPaymentStatus(summary)
                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="transition-colors cursor-pointer group hover:bg-surface-container-low"
                  >
                    <td className="py-4.5 pl-4 px-3">
                      <div className="font-mono font-bold text-sm text-primary">{order.orderNumber}</div>
                      <div className="text-xs text-on-surface-variant mt-1">{new Date(order.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="py-4.5 px-3">
                      <div className="font-bold text-sm text-on-surface">{order.customerName}</div>
                      <div className="text-xs text-on-surface-variant font-mono mt-1">{order.customerPhone || ''}</div>
                    </td>
                    <td className="py-4.5 px-3 text-right font-mono font-bold text-on-surface">
                      {summary ? formatVnd(summary.orderTotal) : '...'}
                    </td>
                    <td className="py-4.5 px-3 text-right font-mono font-bold text-emerald-600">
                      {summary ? formatVnd(summary.paidAmount) : '...'}
                    </td>
                    <td className="py-4.5 px-3 text-right font-mono font-bold text-rose-600">
                      {summary ? formatVnd(summary.remainingToPay) : '...'}
                    </td>
                    <td className="py-4.5 px-3 text-center">
                      <StatusBadge label={status} className={STATUS_VISUALS[status]?.className} />
                    </td>
                    <td className="py-4.5 pr-4 pl-3 text-center">
                      <RowActionsMenu
                        triggerLabel={`Thao tác đơn ${order.orderNumber}`}
                        actions={[{ label: 'Chi tiết thanh toán', icon: 'visibility', onClick: () => setSelectedOrder(order) }]}
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
          startIndex={(page - 1) * 10}
          endIndex={Math.min(page * 10, totalCount)}
          totalCount={totalCount}
          unitLabel="đơn"
          goPrev={() => setPage(p => Math.max(1, p - 1))}
          goNext={() => setPage(p => Math.min(totalPages, p + 1))}
          setPage={setPage}
        />
      </div>

      <DetailModal open={selectedOrder !== null} onClose={() => setSelectedOrder(null)}>
        {selectedOrder ? (
          <>
            <div className="p-4 bg-surface-container-low border-b border-outline-variant flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-lg text-on-surface">#{selectedOrder.orderNumber}</span>
              </div>
            </div>
            
            <div className="p-4 bg-surface-container-lowest">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-3 border border-outline-variant rounded-xl bg-surface">
                  <div className="text-xs font-bold text-on-surface-variant uppercase mb-1">Tổng đơn</div>
                  <div className="font-mono text-lg font-bold text-on-surface">{paymentSummaries[selectedOrder.id] ? formatVnd(paymentSummaries[selectedOrder.id].orderTotal) : '...'}</div>
                </div>
                <div className="p-3 border border-emerald-200 rounded-xl bg-emerald-50 text-emerald-900">
                  <div className="text-xs font-bold text-emerald-700 uppercase mb-1">Đã thu</div>
                  <div className="font-mono text-lg font-bold">{paymentSummaries[selectedOrder.id] ? formatVnd(paymentSummaries[selectedOrder.id].paidAmount) : '...'}</div>
                </div>
                <div className="p-3 border border-rose-200 rounded-xl bg-rose-50 text-rose-900">
                  <div className="text-xs font-bold text-rose-700 uppercase mb-1">Còn lại</div>
                  <div className="font-mono text-lg font-bold">{paymentSummaries[selectedOrder.id] ? formatVnd(paymentSummaries[selectedOrder.id].remainingToPay) : '...'}</div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="font-bold text-on-surface mb-3 uppercase text-sm tracking-wider">Lịch sử thu tiền</h4>
                <div className="space-y-3">
                  {!paymentSummaries[selectedOrder.id] ? (
                    <div className="text-sm text-on-surface-variant italic">Đang tải...</div>
                  ) : paymentSummaries[selectedOrder.id].payments.length === 0 ? (
                    <div className="text-sm text-on-surface-variant italic">Chưa có khoản thu nào.</div>
                  ) : (
                    paymentSummaries[selectedOrder.id].payments.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-3 border border-outline-variant rounded-lg bg-surface">
                        <div>
                          <div className="font-bold text-on-surface">{formatVnd(p.amount)} <span className="text-xs font-normal text-on-surface-variant">({p.paymentMethod})</span></div>
                          <div className="text-xs text-on-surface-variant mt-1">{new Date(p.initiatedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} - Trạng thái: {p.status}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono text-on-surface-variant">{p.paymentNumber}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {paymentSummaries[selectedOrder.id]?.refunds?.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-bold text-rose-700 mb-3 uppercase text-sm tracking-wider">Lịch sử khoản hoàn tiền</h4>
                  <div className="space-y-3">
                    {paymentSummaries[selectedOrder.id].refunds.map(rf => (
                      <div key={rf.id} className="flex justify-between items-center p-3 border border-rose-200 rounded-lg bg-rose-50">
                        <div>
                          <div className="font-bold text-rose-800">{formatVnd(rf.amount)} <span className="text-xs font-normal text-rose-600">({rf.refundMethod})</span></div>
                          <div className="text-xs text-rose-700 mt-1">{rf.status === 'PENDING' ? 'Chờ trả lại khách' : rf.status === 'COMPLETED' ? 'Đã trả lại khách' : 'Đã huỷ'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono text-rose-600">{rf.refundNumber}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-container-low border-t border-outline-variant rounded-b-xl flex gap-3">
              <button
                className="flex-1 h-11 bg-primary text-on-primary hover:bg-primary/90 rounded-lg font-bold flex items-center justify-center transition-colors disabled:opacity-50"
                disabled={!paymentSummaries[selectedOrder.id] || paymentSummaries[selectedOrder.id].remainingToPay <= 0 || ['COMPLETED', 'CANCELLED', 'PARTIALLY_CANCELLED'].includes(selectedOrder.status)}
                onClick={() => setIsPaymentModalOpen(true)}
              >
                <Banknote size={18} className="mr-2" />
                THU TIỀN ĐƠN NÀY (M4)
              </button>
            </div>
          </>
        ) : null}
      </DetailModal>

      {/* Payment Form Modal */}
      {isPaymentModalOpen && selectedOrder && paymentSummaries[selectedOrder.id] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h3 className="font-bold text-lg text-on-surface">Thu tiền đơn #{selectedOrder.orderNumber}</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <FilterX size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center bg-surface-container-lowest p-3 rounded-lg border border-outline-variant">
                <span className="text-sm font-medium text-on-surface-variant">Còn phải thu:</span>
                <span className="text-xl font-bold text-rose-600">{formatVnd(paymentSummaries[selectedOrder.id].remainingToPay)}</span>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-on-surface mb-2">Số tiền thu (VNĐ)</label>
                <input
                  type="number"
                  className="w-full h-12 px-4 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg font-mono font-bold"
                  placeholder="Nhập số tiền..."
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 bg-surface-container-high hover:bg-surface-container-highest text-sm font-bold rounded-lg border border-outline-variant transition-colors text-on-surface"
                  onClick={() => setPaymentAmount(paymentSummaries[selectedOrder.id].remainingToPay.toString())}
                >
                  Thu hết số còn lại
                </button>
              </div>
            </div>
            
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-3">
              <button
                className="px-6 py-2 bg-surface-container-high hover:bg-surface-container-highest font-bold rounded-xl transition-colors text-on-surface"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                HỦY
              </button>
              <button
                className="px-6 py-2 bg-primary text-on-primary hover:bg-primary/90 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                onClick={handleProcessPayment}
                disabled={isPaying || !paymentAmount}
              >
                {isPaying ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN THU TIỀN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
