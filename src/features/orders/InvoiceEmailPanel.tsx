import { useEffect, useRef, useState } from 'react'
import { Mail, RefreshCw } from 'lucide-react'
import { invoicesApi, type InvoiceEmail, type InvoiceResponse } from '@/api/invoicesApi'
import type { PagedResult } from '@/api/types'
import { describeError } from '@/api/client'
import { usePermission } from '@/context/PermissionContext'
import { vnDateTime } from '@/utils/date'
import Pagination from '@/components/ui/Pagination'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'

const labels: Record<InvoiceEmail['status'], string> = { SENDING: 'Đang gửi / Chưa xác nhận kết quả', SENT: 'Đã gửi', FAILED: 'Gửi thất bại', UNKNOWN: 'Chưa xác định kết quả' }

export default function InvoiceEmailPanel({ invoice, autoFocusRecipient = false, onSendingChange }: {
  invoice: InvoiceResponse
  autoFocusRecipient?: boolean
  onSendingChange?: (sending: boolean) => void
}) {
  const { has } = usePermission()
  const canSend = has('INVOICES.SEND_EMAIL')
  const sectionRef = useRef<HTMLElement>(null)
  const recipientRef = useRef<HTMLInputElement>(null)
  const [recipient, setRecipient] = useState(invoice.customerEmail ?? '')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [snapshot, setSnapshot] = useState<{ key: string; history: PagedResult<InvoiceEmail> | null; error: string }>({ key: '', history: null, error: '' })
  const requestKey = JSON.stringify([invoice.id, page, revision])
  const loadingHistory = snapshot.key !== requestKey
  const history = snapshot.history
  const historyError = loadingHistory ? '' : snapshot.error
  const [message, setMessage] = useState('')
  const pending = useRef<{ recipient: string; id: string } | null>(null)

  useEffect(() => { onSendingChange?.(sending) }, [sending, onSendingChange])
  useEffect(() => {
    if (autoFocusRecipient && canSend) {
      sectionRef.current?.scrollIntoView({ block: 'start' })
      recipientRef.current?.focus({ preventScroll: true })
    }
  }, [autoFocusRecipient, canSend])

  useEffect(() => {
    let active = true
    invoicesApi.emails(invoice.id, page).then(value => { if (active) setSnapshot({ key: requestKey, history: value, error: '' }) })
      .catch(error => { if (active) setSnapshot({ key: requestKey, history: null, error: describeError(error, 'Không tải được lịch sử gửi email.') }) })
    return () => { active = false }
  }, [invoice.id, page, revision, requestKey])

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (sending || !canSend) return
    const email = recipient.trim()
    if (!pending.current || pending.current.recipient !== email) pending.current = { recipient: email, id: crypto.randomUUID() }
    setSending(true); setError(''); setMessage('')
    try {
      const result = await invoicesApi.send(invoice.id, email, pending.current.id)
      setMessage(result.status === 'SENT' ? `Đã gửi hóa đơn tới ${result.recipient}.` : labels[result.status])
      if (result.error) setError(result.error)
      // A lost response keeps the same id; a deliberate resend after a known result gets a new id.
      if (result.status !== 'SENDING') pending.current = null
      setPage(1); setRevision(value => value + 1)
    } catch (error) { setError(describeError(error, 'Không gửi được email. Bạn có thể thử lại.')) }
    finally { setSending(false) }
  }

  return <section ref={sectionRef} aria-label="Email hóa đơn" className="min-w-0 space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-sm sm:p-5">
    <h3 className="font-semibold text-on-surface">Gửi email &amp; lịch sử gửi</h3>
    {canSend && <form onSubmit={send} className="space-y-2">
      <label htmlFor={`invoice-email-${invoice.id}`} className="block font-medium">Email nhận hóa đơn</label>
      <div className="flex flex-wrap gap-2">
        <input ref={recipientRef} id={`invoice-email-${invoice.id}`} type="email" required maxLength={255} value={recipient} onChange={event => setRecipient(event.target.value)} disabled={sending} placeholder="khachhang@example.com" className="min-h-11 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary disabled:opacity-50" />
        <Button type="submit" disabled={sending}><Mail size={16} aria-hidden="true" /> {sending ? 'Đang gửi...' : 'Gửi email'}</Button>
      </div>
      <p className="text-xs text-on-surface-variant">Đính kèm bản PDF đã lưu của hóa đơn {invoice.invoiceNumber}.</p>
    </form>}
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-outline-variant bg-surface-container-low p-3 break-words">{message}</p>}
    <div className="flex flex-wrap justify-between items-center gap-2 border-t border-outline-variant pt-4"><h4 className="font-medium">Lịch sử gửi email</h4><Button variant="outlined" size="small" disabled={loadingHistory} onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} aria-hidden="true" /> Làm mới lịch sử gửi</Button></div>
    {historyError && <p role="alert" className="text-rose-700">{historyError}</p>}
    {!history && !historyError && <p role="status" className="text-on-surface-variant">Đang tải lịch sử gửi...</p>}
    {history?.items.length === 0 && <p className="text-on-surface-variant">Chưa gửi hóa đơn qua email.</p>}
    {history && history.items.length > 0 && <ul aria-busy={loadingHistory} className="divide-y divide-outline-variant">
      {history.items.map(item => <li key={item.id} className="py-3 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="break-all font-medium">{item.recipient}</span><StatusBadge label={labels[item.status]} className={item.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : item.status === 'FAILED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200'} /></div>
        <p className="text-xs text-on-surface-variant">{vnDateTime(item.sentAt ?? item.createdAt)}</p>
        {item.error && <p className="text-xs text-rose-700">{item.error}</p>}
      </li>)}
    </ul>}
    {history && history.totalPages > 1 && <Pagination page={page} totalPages={history.totalPages} totalCount={history.totalCount} startIndex={(page - 1) * 5} endIndex={Math.min(page * 5, history.totalCount)} unitLabel="lần gửi" goPrev={() => setPage(value => Math.max(1, value - 1))} goNext={() => setPage(value => Math.min(history.totalPages, value + 1))} setPage={setPage} />}
  </section>
}
