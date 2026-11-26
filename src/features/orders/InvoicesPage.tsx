import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { invoicesApi, invoiceEmailStatusLabels, type InvoiceEmailStatus, type InvoiceListItem } from '@/api/invoicesApi'
import { describeError } from '@/api/client'
import type { PagedResult } from '@/api/types'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { usePermission } from '@/context/PermissionContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useBusinessDataRefresh } from '@/hooks/useBusinessDataRefresh'
import Button from '@/components/ui/Button'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import DateFilter from '@/components/ui/DateFilter'
import StatusBadge from '@/components/ui/StatusBadge'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import ServerPagination from '@/components/ui/ServerPagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import ListReportCards from '@/features/agent/reports/ListReportCards'
import { LIST_PAGE_SIZE } from '@/utils/pagination'
import { formatInvoiceMoney as formatVnd } from './invoiceFormat'
import { vnDateTime } from '@/utils/date'
import OrderInvoiceModal from './OrderInvoiceModal'

function amountInCents(value: string): bigint | null {
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

export default function InvoicesPage() {
  usePageHeader({ title: 'Hóa đơn bán hàng', subtitle: 'Lịch sử hóa đơn, tải lại PDF và gửi qua email' })
  const { showToast } = useToast()
  const { has } = usePermission()
  const canRead = has('INVOICES.READ')
  const [search, setSearch] = useState('')
  const keyword = useDebouncedValue(search.trim())
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [hasCustomerEmail, setHasCustomerEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<InvoiceEmailStatus | ''>('')
  const debouncedMin = useDebouncedValue(minAmount)
  const debouncedMax = useDebouncedValue(maxAmount)
  const minimum = amountInCents(minAmount)
  const maximum = amountInCents(maxAmount)
  const amountError = minAmount !== '' && minimum === null || maxAmount !== '' && maximum === null ? 'Số tiền phải không âm, có tối đa 16 chữ số phần nguyên và hai chữ số thập phân.'
    : minimum !== null && maximum !== null && minimum > maximum ? 'Tổng tiền đến phải lớn hơn hoặc bằng tổng tiền từ.' : ''
  const dateError = fromDate && toDate && fromDate > toDate ? 'Ngày lập đến phải bằng hoặc sau ngày lập từ.' : ''
  const filterError = dateError || amountError
  const pendingFilters = keyword !== search.trim() || debouncedMin !== minAmount || debouncedMax !== maxAmount
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [snapshot, setSnapshot] = useState<{ key: string; result: PagedResult<InvoiceListItem> | null; error: string }>({ key: '', result: null, error: '' })
  const requestKey = JSON.stringify([page, keyword, revision, fromDate, toDate, debouncedMin, debouncedMax, hasCustomerEmail, emailStatus])
  const loading = canRead && !filterError && (snapshot.key !== requestKey || pendingFilters)
  const result = filterError ? null : snapshot.result
  const error = filterError || (loading ? '' : snapshot.error)
  const [selected, setSelected] = useState<{ id: string; section: 'document' | 'email' } | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useBusinessDataRefresh(refresh)
  useEffect(() => {
    if (!canRead || filterError || pendingFilters) return
    const controller = new AbortController()
    invoicesApi.list({ page, pageSize: LIST_PAGE_SIZE, search: keyword, fromDate, toDate, minAmount: debouncedMin, maxAmount: debouncedMax,
      hasCustomerEmail: hasCustomerEmail === '' ? undefined : hasCustomerEmail === 'true', emailStatus }, controller.signal).then(value => {
      if (controller.signal.aborted) return
      if (page > Math.max(1, value.totalPages)) { setPage(Math.max(1, value.totalPages)); return }
      setSnapshot({ key: requestKey, result: value, error: '' })
    }).catch(error => { if (!controller.signal.aborted) setSnapshot({ key: requestKey, result: null, error: describeError(error, 'Không tải được lịch sử hóa đơn.') }) })
    return () => controller.abort()
  }, [canRead, page, keyword, revision, requestKey, fromDate, toDate, debouncedMin, debouncedMax, hasCustomerEmail, emailStatus, filterError, pendingFilters])
  const download = async (invoice: InvoiceListItem) => {
    setDownloading(invoice.id)
    try { await invoicesApi.download(invoice.id, invoice.invoiceNumber) }
    catch (error) { showToast(describeError(error, 'Không tải được PDF.'), 'error') }
    finally { setDownloading(null) }
  }
  const pageAmount = result?.items.reduce((total, invoice) => total + invoice.totalAmount, 0) ?? null
  return <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
    {canRead && <ListReportCards title="Tổng hợp hóa đơn" totalCount={result?.totalCount ?? null} unit="hóa đơn" loading={loading} error={!!error} metrics={[
      { label: 'Giá trị hóa đơn', value: pageAmount, kind: 'money', note: 'Tổng giá trị trên trang đang hiển thị' },
      { label: 'Giá trị trung bình', value: result ? (result.items.length ? (pageAmount ?? 0) / result.items.length : 0) : null, kind: 'money', note: 'Trung bình mỗi hóa đơn trên trang đang hiển thị' },
      { label: 'Có email khách hàng', value: result?.items.filter(invoice => invoice.customerEmail?.trim()).length ?? null, kind: 'count', note: 'Số hóa đơn có email trên trang đang hiển thị' },
    ]} />}
    <ListToolbar layout="grid" search={{ value: search, onChange: value => { setSearch(value.slice(0, 100)); setPage(1) }, placeholder: 'Tìm mã hóa đơn, mã đơn hoặc khách hàng...' }} onClear={() => { setSearch(''); setFromDate(''); setToDate(''); setMinAmount(''); setMaxAmount(''); setHasCustomerEmail(''); setEmailStatus(''); setPage(1) }}
      actions={canRead && <Button variant="outlined" disabled={loading || !!filterError} onClick={refresh}><RefreshCw size={16} aria-hidden="true" /> Làm mới</Button>}>
      <DateFilter label="Ngày lập từ" value={fromDate} min="0001-01-02" max={toDate || '9999-12-30'} onChange={event => { setFromDate(event.target.value); setPage(1) }} />
      <DateFilter label="Ngày lập đến" value={toDate} min={fromDate || '0001-01-02'} max="9999-12-30" onChange={event => { setToDate(event.target.value); setPage(1) }} />
      <FilterSelect label="Trạng thái email gần nhất" value={emailStatus} onChange={value => { setEmailStatus(value as InvoiceEmailStatus | ''); setPage(1) }} options={[{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(invoiceEmailStatusLabels).map(([value, label]) => ({ value, label }))]} />
      <FilterSelect label="Email khách hàng" value={hasCustomerEmail} onChange={value => { setHasCustomerEmail(value); setPage(1) }} options={[{ value: '', label: 'Tất cả hóa đơn' }, { value: 'true', label: 'Có email' }, { value: 'false', label: 'Chưa có email' }]} />
      {[{ label: 'Tổng tiền từ (đ)', value: minAmount, setValue: setMinAmount }, { label: 'Tổng tiền đến (đ)', value: maxAmount, setValue: setMaxAmount }].map(field => <label key={field.label} className="agrisage-filter relative block" data-label-placement="inside">
        <span className="agrisage-filter-caption" aria-hidden="true">{field.label}</span>
        <input type="number" inputMode="decimal" min="0" max="9999999999999999.99" step="0.01" aria-label={field.label} aria-invalid={!!amountError} aria-describedby={amountError ? 'invoice-filter-error' : undefined} value={field.value} onChange={event => { field.setValue(event.target.value); setPage(1) }} placeholder="Không giới hạn" className="h-[54px] w-full min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-3.5 pt-[22px] pb-[7px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary" />
      </label>)}
    </ListToolbar>
    <p className="text-sm text-on-surface-variant">Lập hóa đơn từ chi tiết đơn hàng đã hoàn thành. Chọn một hóa đơn để xem, in, tải PDF hoặc gửi email.</p>
    {error && <p id="invoice-filter-error" role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error} {!filterError && <button type="button" className="font-semibold underline" onClick={refresh}>Thử lại</button>}</p>}
    <section aria-label="Danh sách hóa đơn" className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm" aria-busy={canRead && loading}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-outline-variant bg-surface-container-low text-xs uppercase tracking-wider text-on-surface-variant"><tr>{['Mã hóa đơn', 'Đơn hàng', 'Khách hàng', 'Ngày lập', 'Tổng tiền', 'Trạng thái email', 'Thao tác'].map(title => <th key={title} scope="col" className={`px-4 py-3 font-medium whitespace-nowrap ${['Tổng tiền', 'Thao tác'].includes(title) ? 'text-right' : title === 'Trạng thái email' ? 'text-center' : ''}`}>{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-outline-variant/50">
            {!canRead ? <EmptyTableRow colSpan={7} message="Bạn chưa được cấp quyền xem danh sách hóa đơn." /> : loading ? <EmptyTableRow colSpan={7} message="Đang tải hóa đơn..." /> : !result?.items.length ? <EmptyTableRow colSpan={7} message={filterError ? 'Vui lòng điều chỉnh bộ lọc để xem hóa đơn.' : error ? 'Không tải được danh sách. Vui lòng thử lại.' : 'Chưa có hóa đơn phù hợp.'} /> : result.items.map(invoice => <tr key={invoice.id} className="transition-colors hover:bg-surface-container-low">
              <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap"><button type="button" className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setSelected({ id: invoice.id, section: 'document' })}>{invoice.invoiceNumber}</button></td>
              <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{invoice.orderNumber}</td>
              <td className="px-4 py-3"><p className="font-medium">{invoice.customerName || 'Khách lẻ'}</p>{invoice.customerEmail && <p className="mt-1 break-all text-xs text-on-surface-variant">{invoice.customerEmail}</p>}</td>
              <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant">{vnDateTime(invoice.issuedAt)}</td>
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatVnd(invoice.totalAmount)}</td>
              <td className="px-4 py-3 text-center"><StatusBadge label={invoiceEmailStatusLabels[invoice.emailStatus]} className={invoice.emailStatus === 'SENT' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : ''} /></td>
              <td className="px-4 py-3 text-right"><RowActionsMenu triggerLabel={`Thao tác hóa đơn ${invoice.invoiceNumber}`} disabled={downloading === invoice.id} actions={[
                { label: 'Xem / In hóa đơn', icon: 'visibility', permissionCodes: ['INVOICES.READ'], onClick: () => setSelected({ id: invoice.id, section: 'document' }) },
                { label: 'Tải PDF', icon: 'download', permissionCodes: ['INVOICES.READ'], onClick: () => { void download(invoice) } },
                { label: 'Gửi email', icon: 'mail', permissionCodes: ['INVOICES.SEND_EMAIL'], onClick: () => setSelected({ id: invoice.id, section: 'email' }) },
              ]} /></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {canRead && <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalPages={result?.totalPages ?? 1} totalCount={result?.totalCount ?? 0} unitLabel="hóa đơn" onPageChange={setPage} />}
    </section>
    {selected && <OrderInvoiceModal key={selected.id} invoiceId={selected.id} initialSection={selected.section} onClose={() => setSelected(null)} />}
  </div>
}
