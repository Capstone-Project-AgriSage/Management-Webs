import ListToolbar from '@/components/ui/ListToolbar'
import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Link } from 'react-router-dom';
import { ChevronRight, Download, Banknote, Link2 } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import DetailModal from '@/components/ui/DetailModal'
import Pagination from '@/components/ui/Pagination'

import StatusBadge from '@/components/ui/StatusBadge'
import { formatVnd } from '@/utils/money';
import { downloadCsv } from '@/utils/csv';
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import { ordersApi } from '@/api/ordersApi';
import { paymentsApi } from '@/api/paymentsApi';
import type { OrderResponse } from '@/api/types';
import type { OrderPaymentsSummary } from '@/api/paymentsApi';
import type { PayOsPaymentResponse } from '@/api/paymentsApi'
import { usePermission } from '@/context/PermissionContext'
import { describeApiError } from '@/utils/apiError'
import PaymentDetailModal from './PaymentDetailModal'
import { paymentLink } from './paymentLink'
import PaymentsLedger from './PaymentsLedger'

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
  const { has } = usePermission()
  const [preferredView, setView] = useState<'orders' | 'payments'>('orders')
  const view = preferredView === 'orders' && has('ORDERS.READ') ? 'orders' : 'payments'
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [ledgerRevision, setLedgerRevision] = useState(0)
  const [ledgerCount, setLedgerCount] = useState(0)
  const [paymentMode, setPaymentMode] = useState<'cash' | 'payos'>('cash')
  const [createdLinks, setCreatedLinks] = useState<Record<string, PayOsPaymentResponse>>({})

  const [orders, setOrders] = useState<OrderResponse[]>([])
  const [paymentSummaries, setPaymentSummaries] = useState<Record<string, OrderPaymentsSummary>>({})
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const debouncedSearch = useDebouncedValue(search)
  const listRequest = useRef<AbortController | null>(null)

  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null)

  // Payment action state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isPaying, setIsPaying] = useState(false)

  const fetchOrdersAndPayments = useCallback(async () => {
    listRequest.current?.abort()
    const controller = new AbortController()
    listRequest.current = controller
    setIsLoading(true)
    try {
      const res = await ordersApi.getOrders({ page, pageSize: 10, search: debouncedSearch }, controller.signal)
      if (controller.signal.aborted) return
      setOrders(res.items)
      setPaymentSummaries({})
      setTotalCount(res.totalCount)
      setTotalPages(res.totalPages)
      // Show the list while its per-order payment summaries load in parallel.
      setIsLoading(false)

      // Fetch payment summaries in parallel
      const summariesPromises = res.items.map(async (order) => {
        try {
          const summary = await paymentsApi.getOrderPayments(order.id, controller.signal)
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
      if (!controller.signal.aborted) setPaymentSummaries(newSummaries)

    } catch (err: any) {
      if (!controller.signal.aborted) showToast(err.detail || 'Lỗi tải danh sách', 'error')
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [page, debouncedSearch, showToast])

  useEffect(() => {
    if (view !== 'orders' || !has('ORDERS.READ') || !has('PAYMENTS.READ')) { listRequest.current?.abort(); return }
    if (search !== debouncedSearch) { listRequest.current?.abort(); return }
    let active = true
    void Promise.resolve().then(() => { if (active) void fetchOrdersAndPayments() })
    return () => { active = false; listRequest.current?.abort() }
  }, [fetchOrdersAndPayments, search, debouncedSearch, view, has])

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
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Vui lòng nhập số tiền hợp lệ', 'error')
      return
    }
    if (amount > summary.remainingToPay) {
      showToast('Số tiền thu không được vượt quá số còn lại', 'error')
      return
    }
    if (paymentMode === 'payos' && !Number.isInteger(amount)) {
      showToast('payOS chỉ nhận số tiền nguyên đồng. Phần lẻ cần thu bằng tiền mặt.', 'error')
      return
    }

    setIsPaying(true)
    try {
      if (paymentMode === 'payos') {
        const link = await paymentsApi.createPayOsPayment({ paymentContext: 'ORDER_PAYMENT', orderId: selectedOrder.id, amount })
        setCreatedLinks(previous => ({ ...previous, [selectedOrder.id]: link }))
        showToast('Đã tạo liên kết payOS. Chờ khách thanh toán.', 'success')
      } else {
        await paymentsApi.createCashPayment({ paymentContext: 'ORDER_PAYMENT', orderId: selectedOrder.id, amount })
        showToast('Thu tiền thành công!', 'success')
      }
      setIsPaymentModalOpen(false)
      setPaymentAmount('')
      await paymentsApi.getOrderPayments(selectedOrder.id)
        .then(updated => setPaymentSummaries(previous => ({ ...previous, [selectedOrder.id]: updated })))
        .catch(err => showToast(describeApiError(err, 'Thao tác đã thành công nhưng chưa tải lại được tổng hợp thanh toán. Vui lòng tải lại dữ liệu.'), 'error'))
      setLedgerRevision(previous => previous + 1)
    } catch (err) {
      showToast(describeApiError(err, paymentMode === 'payos' ? 'Không tạo được liên kết payOS' : 'Lỗi thu tiền'), 'error')
    } finally {
      setIsPaying(false)
    }
  }

  const paymentChanged = () => {
    setLedgerRevision(previous => previous + 1)
    if (selectedOrder) setCreatedLinks(previous => { const next = { ...previous }; delete next[selectedOrder.id]; return next })
    if (selectedOrder) void paymentsApi.getOrderPayments(selectedOrder.id).then(updated => setPaymentSummaries(previous => ({ ...previous, [selectedOrder.id]: updated }))).catch(err => showToast(describeApiError(err, 'Không tải lại được tổng hợp thanh toán'), 'error'))
  }

  const startPayment = (mode: 'cash' | 'payos') => {
    setPaymentMode(mode)
    setPaymentAmount(selectedOrder ? String(paymentSummaries[selectedOrder.id]?.remainingToPay ?? '') : '')
    setIsPaymentModalOpen(true)
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
        {view === 'orders' && <button
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant text-on-surface text-sm font-medium rounded-lg hover:bg-surface-container-low transition-colors shadow-sm"
          type="button"
          onClick={handleExport}
        >
          <Download size={16} className="text-on-surface-variant" />
          <span>Xuất Excel trang này</span>
        </button>}
      </div>

      <BusinessReportCards kind="payments" searchResult={{ count: view === 'orders' ? totalCount : ledgerCount, unit: view === 'orders' ? 'đơn hàng' : 'phiếu thanh toán' }} />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Xem thanh toán">
        {has('ORDERS.READ') && has('PAYMENTS.READ') && <button type="button" role="tab" aria-selected={view === 'orders'} onClick={() => setView('orders')} className={`min-h-[42px] rounded-[10px] px-4 text-sm font-semibold ${view === 'orders' ? 'bg-primary-dark text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>Theo đơn hàng</button>}
        {has('PAYMENTS.READ') && <button type="button" role="tab" aria-selected={view === 'payments'} onClick={() => setView('payments')} className={`min-h-[42px] rounded-[10px] px-4 text-sm font-semibold ${view === 'payments' ? 'bg-primary-dark text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>Phiếu thanh toán</button>}
      </div>
      {view === 'payments' ? has('PAYMENTS.READ') ? <PaymentsLedger revision={ledgerRevision} onSelect={setPaymentId} onCountChange={setLedgerCount} /> : <p className="text-sm text-slate-500">Bạn chưa được cấp quyền xem thanh toán.</p> : <>

      <ListToolbar search={{ value: search, onChange: (val) => { setSearch(val); setPage(1) }, placeholder: "Tìm theo mã đơn, SĐT..." }} onClear={() => { setSearch(''); setPage(1) }}>

      </ListToolbar>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="overflow-x-auto">
          <table aria-busy={isLoading} className="w-full text-left border-collapse">
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
              {isLoading && orders.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Đang tải dữ liệu..." />
              ) : !isLoading && orders.length === 0 ? (
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
      </>}

      <DetailModal open={selectedOrder !== null} onClose={() => setSelectedOrder(null)} busy={isPaying}>
        {selectedOrder ? (
          <ModalLayout header={<div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg text-on-surface">#{selectedOrder.orderNumber}</span>
            </div>
          </div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
            <PermissionAction codes={['PAYMENTS.RECEIVE_CASH']}><button
              className="flex-1 h-11 bg-primary text-on-primary hover:bg-primary/90 rounded-lg font-bold flex items-center justify-center transition-colors disabled:opacity-50"
              disabled={!paymentSummaries[selectedOrder.id] || paymentSummaries[selectedOrder.id].remainingToPay <= 0 || ['COMPLETED', 'CANCELLED', 'PARTIALLY_CANCELLED'].includes(selectedOrder.status)}
              onClick={() => startPayment('cash')}
            >
              <Banknote size={18} className="mr-2" />
              Thu tiền mặt
            </button></PermissionAction>
            <PermissionAction codes={['PAYMENTS.CREATE']}><button type="button" disabled={!paymentSummaries[selectedOrder.id] || paymentSummaries[selectedOrder.id].remainingToPay <= 0 || ['COMPLETED', 'CANCELLED', 'PARTIALLY_CANCELLED'].includes(selectedOrder.status)} onClick={() => startPayment('payos')} className="flex-1 min-h-[42px] rounded-[10px] border border-primary bg-white px-4 text-primary font-semibold flex items-center justify-center disabled:opacity-50"><Link2 size={18} className="mr-2" /> Tạo liên kết payOS</button></PermissionAction>
          </div>} bodyClassName="space-y-4">
            {createdLinks[selectedOrder.id] && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2 text-sm text-emerald-900"><p>Đã tạo phiếu {createdLinks[selectedOrder.id].paymentNumber} · {formatVnd(createdLinks[selectedOrder.id].amount)}. Chờ payOS xác nhận thanh toán.</p>{paymentLink(createdLinks[selectedOrder.id].checkoutUrl) && <a href={paymentLink(createdLinks[selectedOrder.id].checkoutUrl)!} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Mở liên kết thanh toán payOS</a>}<button type="button" onClick={() => setPaymentId(createdLinks[selectedOrder.id].paymentId)} className="block text-primary font-semibold">Xem trạng thái phiếu payOS</button></div>}
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
                          <button type="button" onClick={() => setPaymentId(p.id)} className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5">Chi tiết phiếu</button>
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
          </ModalLayout>
        ) : null}
      </DetailModal>

      {/* Payment Form Modal */}
      {isPaymentModalOpen && selectedOrder && paymentSummaries[selectedOrder.id] && (
        <DetailModal open onClose={() => setIsPaymentModalOpen(false)} busy={isPaying}>
          <ModalLayout header={<div className="space-y-1"><h3 className="font-bold text-lg text-on-surface">{paymentMode === 'payos' ? 'Tạo liên kết payOS' : 'Thu tiền mặt'} · #{selectedOrder.orderNumber}</h3></div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
            <button
              className="px-6 py-2 bg-surface-container-high hover:bg-surface-container-highest font-bold rounded-xl transition-colors text-on-surface"
              onClick={() => setIsPaymentModalOpen(false)}
              disabled={isPaying}
            >
              HỦY
            </button>
            <PermissionAction codes={[paymentMode === 'payos' ? 'PAYMENTS.CREATE' : 'PAYMENTS.RECEIVE_CASH']}><button
              className="px-6 py-2 bg-primary text-on-primary hover:bg-primary/90 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              onClick={handleProcessPayment}
              disabled={isPaying || !paymentAmount}
            >
              {isPaying ? 'ĐANG XỬ LÝ...' : paymentMode === 'payos' ? 'TẠO LIÊN KẾT' : 'XÁC NHẬN THU TIỀN'}
            </button></PermissionAction>
          </div>}>
            <div className="flex justify-between items-center bg-surface-container-lowest p-3 rounded-lg border border-outline-variant">
              <span className="text-sm font-medium text-on-surface-variant">Còn phải thu:</span>
              <span className="text-xl font-bold text-rose-600">{formatVnd(paymentSummaries[selectedOrder.id].remainingToPay)}</span>
            </div><div>
              <label className="block text-sm font-bold text-on-surface mb-2">Số tiền thu (VNĐ)</label>
              <input
                type="number"
                min="0.01"
                step={paymentMode === 'payos' ? '1' : '0.01'}
                max={paymentSummaries[selectedOrder.id].remainingToPay}
                disabled={isPaying}
                className="w-full h-12 px-4 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg font-mono font-bold"
                placeholder="Nhập số tiền..."
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div><div className="flex gap-2">
              <button
                className="flex-1 py-2 bg-surface-container-high hover:bg-surface-container-highest text-sm font-bold rounded-lg border border-outline-variant transition-colors text-on-surface"
                onClick={() => setPaymentAmount(paymentSummaries[selectedOrder.id].remainingToPay.toString())}
              >
                Thu hết số còn lại
              </button>
            </div>
            {paymentMode === 'payos' && <p className="mt-3 text-xs text-slate-500">Liên kết mới sẽ thay thế liên kết payOS đang chờ của đơn này. Số tiền phải là số nguyên đồng; trạng thái thu tiền chờ xác nhận từ payOS.</p>}
          </ModalLayout>
        </DetailModal>
      )}
      {paymentId && <PaymentDetailModal key={paymentId} paymentId={paymentId} onClose={() => setPaymentId(null)} onChanged={paymentChanged} />}
    </div>
  )
}
