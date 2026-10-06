import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { debtApi, type DebtAccountResponse, type DebtTransactionResponse } from '@/api/debtApi'
import { formatVnd } from '@/utils/money'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import FormModal from '@/components/ui/FormModal'
import { ArrowLeft, PlusCircle, MinusCircle, Wallet, ArrowDownRight, ArrowUpRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

export default function CustomerDebtDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  usePageHeader({
    title: 'Chi tiết Sổ Nợ',
    subtitle: 'Lịch sử giao dịch và Thu tiền'
  })

  const [account, setAccount] = useState<DebtAccountResponse | null>(null)
  const [loadingAcct, setLoadingAcct] = useState(false)
  const [transactions, setTransactions] = useState<DebtTransactionResponse[]>([])
  const [loadingTx, setLoadingTx] = useState(false)
  
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 10

  // Modals state
  const [repayModal, setRepayModal] = useState<{ open: boolean, type: 'CASH' | 'BANK' }>({ open: false, type: 'CASH' })
  const [repayAmount, setRepayAmount] = useState('')
  const [repayNote, setRepayNote] = useState('')
  const [repayRef, setRepayRef] = useState('')
  const [submittingRepay, setSubmittingRepay] = useState(false)

  const [adjustModal, setAdjustModal] = useState<{ open: boolean, isIncrease: boolean }>({ open: false, isIncrease: true })
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [submittingAdjust, setSubmittingAdjust] = useState(false)

  useEffect(() => {
    if (id) {
      fetchAccount()
    }
  }, [id])

  useEffect(() => {
    if (id) {
      fetchTransactions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page])

  const fetchAccount = async () => {
    try {
      setLoadingAcct(true)
      const res = await debtApi.getCustomerDebt(id!)
      setAccount(res)
    } catch (err: any) {
      showToast(err.message || 'Lỗi tải thông tin nợ', 'error')
    } finally {
      setLoadingAcct(false)
    }
  }

  const fetchTransactions = async () => {
    try {
      setLoadingTx(true)
      const res = await debtApi.getDebtTransactions(id!, { page, pageSize })
      setTransactions(res.items || [])
      setTotalCount(res.totalCount || 0)
    } catch (err: any) {
      showToast(err.message || 'Lỗi tải lịch sử giao dịch', 'error')
    } finally {
      setLoadingTx(false)
    }
  }

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repayAmount || Number(repayAmount) <= 0) {
      showToast('Số tiền không hợp lệ', 'error')
      return
    }
    try {
      setSubmittingRepay(true)
      if (repayModal.type === 'CASH') {
        await debtApi.repayCash(id!, { amount: Number(repayAmount), note: repayNote })
      } else {
        await debtApi.repayBankTransfer(id!, { amount: Number(repayAmount), note: repayNote, referenceCode: repayRef })
      }
      showToast('Thu tiền thành công', 'success')
      setRepayModal({ open: false, type: 'CASH' })
      setRepayAmount('')
      setRepayNote('')
      setRepayRef('')
      fetchAccount()
      fetchTransactions()
    } catch (err: any) {
      showToast(err.message || 'Lỗi thu tiền', 'error')
    } finally {
      setSubmittingRepay(false)
    }
  }

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustAmount || Number(adjustAmount) <= 0) {
      showToast('Số tiền không hợp lệ', 'error')
      return
    }
    if (!adjustNote.trim()) {
      showToast('Cần nhập lý do điều chỉnh', 'error')
      return
    }
    try {
      setSubmittingAdjust(true)
      await debtApi.adjustDebt(id!, { amount: Number(adjustAmount), isIncrease: adjustModal.isIncrease, note: adjustNote })
      showToast('Điều chỉnh thành công', 'success')
      setAdjustModal({ open: false, isIncrease: true })
      setAdjustAmount('')
      setAdjustNote('')
      fetchAccount()
      fetchTransactions()
    } catch (err: any) {
      showToast(err.message || 'Lỗi điều chỉnh', 'error')
    } finally {
      setSubmittingAdjust(false)
    }
  }

  const handleVerify = async (txId: string, isApproved: boolean) => {
    try {
      await debtApi.verifyRepayment(id!, txId, isApproved)
      showToast(isApproved ? 'Đã duyệt giao dịch' : 'Đã từ chối giao dịch', 'success')
      fetchAccount()
      fetchTransactions()
    } catch (err: any) {
      showToast(err.message || 'Lỗi duyệt giao dịch', 'error')
    }
  }

  const getTxVisuals = (txType: string, status: string) => {
    const isIncrease = txType === 'ORDER_DEBT' || txType === 'ADJUSTMENT_INCREASE'
    const isPending = status === 'PENDING_VERIFICATION'
    
    let icon = isIncrease ? <ArrowUpRight size={16} className="text-rose-500" /> : <ArrowDownRight size={16} className="text-emerald-500" />
    let color = isIncrease ? 'text-rose-600' : 'text-emerald-600'
    let prefix = isIncrease ? '+' : '-'
    
    if (status === 'REJECTED') {
      color = 'text-slate-400 line-through'
      icon = <XCircle size={16} className="text-slate-400" />
    } else if (isPending) {
      color = 'text-amber-600'
    }

    return { icon, color, prefix, isPending }
  }

  const getStatusVisuals = (status: string) => {
    switch (status) {
      case 'NORMAL': return { label: 'Bình thường', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'WARNING': return { label: 'Cảnh báo', className: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'OVERDUE': return { label: 'Quá hạn', className: 'bg-rose-50 text-rose-700 border-rose-200' }
      case 'SUSPENDED': return { label: 'Đã khoá', className: 'bg-slate-100 text-slate-700 border-slate-300' }
      default: return { label: status, className: 'bg-slate-50 text-slate-700' }
    }
  }

  const getTxTypeLabel = (type: string, method?: string) => {
    switch (type) {
      case 'ORDER_DEBT': return 'Mua nợ đơn hàng'
      case 'REPAYMENT': return method === 'CASH' ? 'Thanh toán tiền mặt' : 'Thanh toán chuyển khoản'
      case 'ADJUSTMENT_INCREASE': return 'Điều chỉnh tăng nợ'
      case 'ADJUSTMENT_DECREASE': return 'Điều chỉnh giảm nợ'
      default: return type
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-slate-900">Chi tiết Sổ Nợ KH: {account?.customerName || '...'}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        <div className="md:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Tổng quan Sổ Nợ</h3>
          
          {loadingAcct ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-1/2"></div>
              <div className="h-8 bg-slate-100 rounded w-3/4"></div>
            </div>
          ) : account ? (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Mã KH:</span>
                <span className="font-mono font-medium text-slate-900">{account.customerCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Trạng thái:</span>
                <StatusBadge label={getStatusVisuals(account.status).label} className={getStatusVisuals(account.status).className} />
              </div>
              
              <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 mt-2">
                <div className="text-sm text-rose-800 font-medium mb-1">Dư nợ hiện tại (Phải thu)</div>
                <div className="text-3xl font-bold text-rose-600 tracking-tight">{formatVnd(account.outstandingReceivable)}</div>
                
                {account.totalOverdueAmount > 0 && (
                  <div className="mt-2 text-sm text-rose-700 font-medium flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    Trong đó quá hạn: {formatVnd(account.totalOverdueAmount)}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 mt-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-600">Hạn mức Tín dụng:</span>
                  <span className="font-medium text-slate-900">{formatVnd(account.creditLimit)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Khả dụng:</span>
                  <span className="font-bold text-emerald-600">{formatVnd(account.availableCredit)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">Không tìm thấy thông tin.</div>
          )}
        </div>

        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900">Lịch sử Giao dịch Nợ</h3>
            <div className="flex gap-2">
              <Button size="small" variant="outlined" onClick={() => setAdjustModal({ open: true, isIncrease: false })}>
                <MinusCircle size={16} className="mr-1.5" /> Điều chỉnh
              </Button>
              <Button size="small" variant="primary" onClick={() => setRepayModal({ open: true, type: 'CASH' })}>
                <Wallet size={16} className="mr-1.5" /> Thu nợ
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-3 font-semibold">Thời gian</th>
                  <th className="py-3 px-3 font-semibold">Loại GD</th>
                  <th className="py-3 px-3 font-semibold">Ghi chú/Tham chiếu</th>
                  <th className="py-3 px-3 font-semibold text-right">Số tiền</th>
                  <th className="py-3 px-3 font-semibold text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {loadingTx ? (
                  <EmptyTableRow colSpan={5} message="Đang tải dữ liệu..." />
                ) : transactions.length === 0 ? (
                  <EmptyTableRow colSpan={5} message="Chưa có giao dịch nào." />
                ) : (
                  transactions.map(tx => {
                    const vis = getTxVisuals(tx.transactionType, tx.status)
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 text-slate-600 text-xs">
                          {new Date(tx.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900">
                          {getTxTypeLabel(tx.transactionType, tx.paymentMethod)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-900">{tx.note || '-'}</div>
                          {tx.referenceId && <div className="text-xs font-mono text-slate-500 mt-0.5">Ref: {tx.referenceId}</div>}
                        </td>
                        <td className={`py-3 px-3 text-right font-bold flex items-center justify-end gap-1 ${vis.color}`}>
                          {vis.icon} {vis.prefix}{formatVnd(tx.amount)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {tx.status === 'PENDING_VERIFICATION' ? (
                            <div className="flex flex-col items-center gap-1">
                              <StatusBadge label="Chờ duyệt" className="bg-amber-50 text-amber-700 border-amber-200" />
                              <div className="flex gap-1 mt-1">
                                <button onClick={() => handleVerify(tx.id, true)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded" title="Duyệt">
                                  <CheckCircle size={14} />
                                </button>
                                <button onClick={() => handleVerify(tx.id, false)} className="text-rose-600 hover:bg-rose-50 p-1 rounded" title="Từ chối">
                                  <XCircle size={14} />
                                </button>
                              </div>
                            </div>
                          ) : tx.status === 'REJECTED' ? (
                            <StatusBadge label="Bị từ chối" className="bg-slate-100 text-slate-500 border-slate-200" />
                          ) : (
                            <StatusBadge label="Hoàn tất" className="bg-emerald-50 text-emerald-700 border-emerald-200" />
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loadingTx && transactions.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              startIndex={(page - 1) * pageSize + 1}
              endIndex={Math.min(page * pageSize, totalCount)}
              totalCount={totalCount}
              unitLabel="giao dịch"
              goPrev={() => setPage(p => Math.max(1, p - 1))}
              goNext={() => setPage(p => Math.min(totalPages, p + 1))}
              setPage={setPage}
            />
          )}
        </div>
      </div>

      {/* Repay Modal */}
      <FormModal
        open={repayModal.open}
        onClose={() => !submittingRepay && setRepayModal({ ...repayModal, open: false })}
        title="Thu Tiền Trả Nợ"
      >
        <form onSubmit={handleRepay} className="space-y-4 pt-2">
          <div className="flex gap-4 border-b border-slate-100 pb-4">
            <label className="flex-1 cursor-pointer border border-slate-200 rounded-lg p-3 hover:bg-slate-50 flex items-center gap-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input 
                type="radio" 
                name="repayType" 
                checked={repayModal.type === 'CASH'} 
                onChange={() => setRepayModal({ ...repayModal, type: 'CASH' })}
                className="w-4 h-4 text-primary accent-primary" 
              />
              <span className="font-medium text-slate-900">Tiền mặt</span>
            </label>
            <label className="flex-1 cursor-pointer border border-slate-200 rounded-lg p-3 hover:bg-slate-50 flex items-center gap-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input 
                type="radio" 
                name="repayType" 
                checked={repayModal.type === 'BANK'} 
                onChange={() => setRepayModal({ ...repayModal, type: 'BANK' })}
                className="w-4 h-4 text-primary accent-primary" 
              />
              <span className="font-medium text-slate-900">Chuyển khoản (Cần duyệt)</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Số tiền thanh toán (VNĐ) *</label>
            <input
              type="number"
              className="w-full border-slate-300 rounded-md shadow-sm focus:border-primary focus:ring-primary text-lg py-2"
              required
              value={repayAmount}
              onChange={e => setRepayAmount(e.target.value)}
              placeholder="0"
            />
            {repayAmount && (
              <div className="mt-1 flex justify-between text-xs font-medium">
                <span className="text-primary">{formatVnd(Number(repayAmount))}</span>
                {account && (
                  <button type="button" className="text-primary hover:underline" onClick={() => setRepayAmount(account.outstandingReceivable.toString())}>
                    Thanh toán toàn bộ nợ
                  </button>
                )}
              </div>
            )}
          </div>

          {repayModal.type === 'BANK' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mã tham chiếu CK (tuỳ chọn)</label>
              <input
                type="text"
                className="w-full border-slate-300 rounded-md shadow-sm focus:border-primary focus:ring-primary"
                value={repayRef}
                onChange={e => setRepayRef(e.target.value)}
                placeholder="Ví dụ: MB123456"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú *</label>
            <textarea
              className="w-full border-slate-300 rounded-md shadow-sm focus:border-primary focus:ring-primary"
              rows={2}
              required
              value={repayNote}
              onChange={e => setRepayNote(e.target.value)}
              placeholder="Ghi chú về khoản thanh toán này"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outlined" onClick={() => setRepayModal({ ...repayModal, open: false })} disabled={submittingRepay}>
              Huỷ
            </Button>
            <Button type="submit" variant="primary" disabled={submittingRepay}>
              {submittingRepay ? 'Đang xử lý...' : 'Xác nhận Thu tiền'}
            </Button>
          </div>
        </form>
      </FormModal>

      {/* Adjust Modal */}
      <FormModal
        open={adjustModal.open}
        onClose={() => !submittingAdjust && setAdjustModal({ ...adjustModal, open: false })}
        title="Điều chỉnh Sổ Nợ"
      >
        <form onSubmit={handleAdjust} className="space-y-4 pt-2">
          <div className="flex gap-4 border-b border-slate-100 pb-4">
            <label className="flex-1 cursor-pointer border border-rose-200 rounded-lg p-3 hover:bg-rose-50 flex items-center gap-3 transition-colors has-[:checked]:bg-rose-50 has-[:checked]:border-rose-300">
              <input 
                type="radio" 
                name="adjustType" 
                checked={adjustModal.isIncrease} 
                onChange={() => setAdjustModal({ ...adjustModal, isIncrease: true })}
                className="w-4 h-4 text-rose-600 accent-rose-600" 
              />
              <span className="font-medium text-rose-800">Tăng nợ</span>
            </label>
            <label className="flex-1 cursor-pointer border border-emerald-200 rounded-lg p-3 hover:bg-emerald-50 flex items-center gap-3 transition-colors has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-300">
              <input 
                type="radio" 
                name="adjustType" 
                checked={!adjustModal.isIncrease} 
                onChange={() => setAdjustModal({ ...adjustModal, isIncrease: false })}
                className="w-4 h-4 text-emerald-600 accent-emerald-600" 
              />
              <span className="font-medium text-emerald-800">Giảm nợ</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Số tiền điều chỉnh (VNĐ) *</label>
            <input
              type="number"
              className="w-full border-slate-300 rounded-md shadow-sm focus:border-primary focus:ring-primary text-lg py-2"
              required
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
              placeholder="0"
            />
            {adjustAmount && (
              <div className={`mt-1 text-xs font-medium ${adjustModal.isIncrease ? 'text-rose-600' : 'text-emerald-600'}`}>
                {adjustModal.isIncrease ? '+' : '-'}{formatVnd(Number(adjustAmount))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lý do điều chỉnh *</label>
            <textarea
              className="w-full border-slate-300 rounded-md shadow-sm focus:border-primary focus:ring-primary"
              rows={2}
              required
              value={adjustNote}
              onChange={e => setAdjustNote(e.target.value)}
              placeholder="Sai sót, khuyến mãi, trả hàng..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outlined" onClick={() => setAdjustModal({ ...adjustModal, open: false })} disabled={submittingAdjust}>
              Huỷ
            </Button>
            <Button type="submit" variant="primary" disabled={submittingAdjust}>
              {submittingAdjust ? 'Đang xử lý...' : 'Xác nhận Điều chỉnh'}
            </Button>
          </div>
        </form>
      </FormModal>
    </div>
  )
}
