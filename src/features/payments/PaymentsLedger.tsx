import { useEffect, useState } from 'react'
import { paymentsApi } from '@/api/paymentsApi'
import type { PaymentListItem } from '@/api/customersApi'
import type { PagedResult } from '@/api/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { describeApiError } from '@/utils/apiError'
import { formatVnd } from '@/utils/money'
import { LIST_PAGE_SIZE } from '@/utils/pagination'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import ServerPagination from '@/components/ui/ServerPagination'

const statuses = [{ value: '', label: 'Mọi trạng thái' }, { value: 'PENDING', label: 'Chờ thanh toán' }, { value: 'PAID', label: 'Đã thanh toán' }, { value: 'FAILED', label: 'Thất bại' }, { value: 'CANCELLED', label: 'Đã hủy' }, { value: 'PARTIALLY_REFUNDED', label: 'Đã hoàn một phần' }, { value: 'REFUNDED', label: 'Đã hoàn tiền' }]
const methods = [{ value: '', label: 'Mọi phương thức' }, { value: 'CASH', label: 'Tiền mặt' }, { value: 'PAYOS', label: 'payOS' }, { value: 'BANK_TRANSFER', label: 'Chuyển khoản' }]

export default function PaymentsLedger({ revision, onSelect, onCountChange }: { revision: number; onSelect: (id: string) => void; onCountChange: (total: number) => void }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [context, setContext] = useState('')
  const [page, setPage] = useState(1)
  const [snapshot, setSnapshot] = useState<{ key: string; data: PagedResult<PaymentListItem> | null; error: string }>({ key: '', data: null, error: '' })
  const keyword = useDebouncedValue(search.trim())
  const key = [page, keyword, status, method, context, revision].join(':')
  const loading = snapshot.key !== key
  const data = snapshot.data
  const error = loading ? '' : snapshot.error
  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      return paymentsApi.getPayments({ page, pageSize: LIST_PAGE_SIZE, search: keyword || undefined, status: status || undefined, paymentMethod: method || undefined, paymentContext: context as 'ORDER_PAYMENT' | 'DEBT_REPAYMENT' || undefined }, controller.signal)
    })
      .then(result => {
        if (controller.signal.aborted) return
        const lastPage = Math.max(1, result.totalPages)
        if (page > lastPage) { setPage(lastPage); return }
        setSnapshot({ key, data: result, error: '' }); onCountChange(result.totalCount)
      }).catch(err => { if (!controller.signal.aborted) { setSnapshot({ key, data: null, error: describeApiError(err, 'Không tải được danh sách phiếu thanh toán') }); onCountChange(0) } })
    return () => controller.abort()
  }, [page, keyword, status, method, context, revision, onCountChange, key])
  return <>
    <ListToolbar search={{ value: search, onChange: value => { setSearch(value.slice(0, 100)); setPage(1) }, placeholder: 'Tìm theo mã phiếu thanh toán...' }} onClear={() => { setSearch(''); setStatus(''); setMethod(''); setContext(''); setPage(1) }}>
      <FilterSelect label="Trạng thái" value={status} onChange={value => { setStatus(value); setPage(1) }} options={statuses} />
      <FilterSelect label="Phương thức" value={method} onChange={value => { setMethod(value); setPage(1) }} options={methods} />
      <FilterSelect label="Mục đích thanh toán" value={context} onChange={value => { setContext(value); setPage(1) }} options={[{ value: '', label: 'Mọi mục đích' }, { value: 'ORDER_PAYMENT', label: 'Thanh toán đơn hàng' }, { value: 'DEBT_REPAYMENT', label: 'Trả công nợ' }]} />
    </ListToolbar>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Danh sách phiếu thanh toán">
      <div className="overflow-x-auto"><table aria-busy={loading} className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Phiếu thanh toán', 'Người thanh toán', 'Mục đích', 'Phương thức', 'Số tiền', 'Trạng thái', 'Thao tác'].map(label => <th key={label} className="p-3" scope="col">{label}</th>)}</tr></thead><tbody>
        {loading && !data ? <EmptyTableRow colSpan={7} message="Đang tải phiếu thanh toán..." /> : data?.items.map(payment => <tr key={payment.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="p-3"><div className="font-mono font-semibold">{payment.paymentNumber}</div><div className="mt-1 text-xs text-slate-500">{new Date(payment.initiatedAt).toLocaleString('vi-VN')}</div></td><td className="p-3">{payment.payerName ?? 'Khách lẻ'}</td><td className="p-3">{payment.paymentContext === 'DEBT_REPAYMENT' ? 'Trả công nợ' : 'Đơn hàng'}</td><td className="p-3">{methods.find(item => item.value === payment.paymentMethod)?.label ?? payment.paymentMethod}</td><td className="p-3 font-semibold whitespace-nowrap">{formatVnd(payment.amount)}</td><td className="p-3">{statuses.find(item => item.value === payment.status)?.label ?? payment.status}</td><td className="p-3"><button type="button" onClick={() => onSelect(payment.id)} className="rounded-lg px-3 py-2 font-semibold text-primary hover:bg-primary/5">Xem chi tiết</button></td></tr>)}
        {!loading && !data?.items.length && <EmptyTableRow colSpan={7} message={error ? 'Không tải được dữ liệu.' : 'Không có phiếu phù hợp với bộ lọc.'} />}
      </tbody></table></div>
      <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalCount={data?.totalCount ?? 0} totalPages={data?.totalPages ?? 1} unitLabel="phiếu thanh toán" onPageChange={setPage} />
    </section>
  </>
}
