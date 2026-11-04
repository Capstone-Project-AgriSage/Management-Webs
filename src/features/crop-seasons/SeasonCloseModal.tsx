import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { ApiError } from '@/api/client'
import { cropSeasonsApi, type ClosingBlocker, type ClosingCheck, type CropSeason } from '@/api/cropSeasonsApi'
import { useToast } from '@/context/ToastContext'
import { describeApiError } from '@/utils/apiError'
import { useRoleBase } from '@/utils/creditLabels'
import { formatVnd } from '@/utils/money'

// FE_GUIDE_FLOW_3 §3.1 mục 7: ask the server whether the season can close and show what is in the way, so the owner can
// deal with it (extend, collect, write off, finish or cancel the credit orders) and check again. Closing is final.

const BLOCKER_TEXT: Record<ClosingBlocker, string> = {
  ALREADY_CLOSED: 'Vụ đã đóng.',
  HARVEST_NOT_ENDED: 'Vụ chưa hết thu hoạch nên chưa bắt đầu thu nợ.',
  OPEN_ENTRIES: 'Còn khoản nợ đang thu trong vụ (kể cả khoản đang khiếu nại). Thu đủ, gia hạn sang vụ sau, giảm hoặc xóa nợ rồi kiểm tra lại.',
  OPEN_CREDIT_ORDERS: 'Còn đơn mua chịu của vụ chưa hoàn tất hoặc chưa hủy. Hoàn tất hoặc hủy đơn rồi kiểm tra lại.',
}

export default function SeasonCloseModal({ season, onClose, onDone }: { season: CropSeason; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast()
  const navigate = useNavigate(), base = useRoleBase()
  const [check, setCheck] = useState<ClosingCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setCheck(await cropSeasonsApi.getClosingCheck(season.id)) } catch (err) { setCheck(null); setError(describeApiError(err, 'Không kiểm tra được điều kiện đóng vụ')) } finally { setLoading(false) }
  }, [season.id])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const close = async () => {
    if (!check?.canClose || busy) return
    setBusy(true); setError('')
    try {
      await cropSeasonsApi.close(season.id, season.version, note.trim())
      showToast(`Đã đóng vụ ${season.name}`, 'success')
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) { showToast('Vụ vừa được người khác thay đổi. Đã tải lại, hãy kiểm tra rồi đóng lại.', 'error'); onDone() }
      else setError(describeApiError(err, 'Không đóng được vụ'))
    } finally { setBusy(false) }
  }

  const ready = !!check?.canClose
  return (
    <ConfirmModal open title={`Đóng vụ ${season.name}`} confirmLabel="Đóng vụ" tone="danger" busy={busy} confirmDisabled={!ready || loading} onClose={onClose} onConfirm={() => void close()}
      message="Sau khi đóng, số liệu của vụ được chốt cho báo cáo; vụ không sửa, không mở lại và không nhận nợ mới.">
      {loading && <p role="status" className="text-sm text-slate-500">Đang kiểm tra điều kiện đóng vụ…</p>}
      {check && ready && (
        <div className="space-y-3">
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Đủ điều kiện đóng vụ: không còn khoản nợ đang thu và không còn đơn chịu chưa xong.</p>
          <div className="space-y-1">
            <label htmlFor="close-note" className="text-sm font-medium text-slate-700">Ghi chú (không bắt buộc)</label>
            <textarea id="close-note" rows={2} maxLength={1000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
          </div>
        </div>
      )}
      {check && !ready && (
        <div className="space-y-3">
          <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {check.reasons.map(reason => <li key={reason}>{BLOCKER_TEXT[reason] ?? reason}</li>)}
          </ul>
          {check.openEntryCount > 0 && (
            <section>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Khoản nợ còn đang thu ({check.openEntryCount})</h4>
              <ul className="max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
                {check.openEntries.map(e => (
                  <li key={e.entryId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <button type="button" className="min-w-0 text-left" onClick={() => navigate(`${base}/debts/${e.farmerProfileId}`)}>
                      <span className="font-mono text-xs text-emerald-700 underline">{e.entryNumber}</span>
                      <span className="ml-2 truncate text-slate-800">{e.fullName}</span>
                      {e.status === 'DISPUTED' && <span className="ml-2 text-xs text-amber-700">đang khiếu nại</span>}
                    </button>
                    <span className="shrink-0 tabular-nums">{formatVnd(e.outstandingAmount)}</span>
                  </li>
                ))}
              </ul>
              {check.openEntryCount > check.openEntries.length && <p className="mt-1 text-xs text-slate-500">Chỉ hiện {check.openEntries.length} khoản đầu; còn {check.openEntryCount - check.openEntries.length} khoản nữa.</p>}
            </section>
          )}
          {check.openCreditOrderCount > 0 && (
            <section>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Đơn chịu chưa xong ({check.openCreditOrderCount})</h4>
              <ul className="max-h-36 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
                {check.openCreditOrders.map(o => <li key={o.orderId} className="flex justify-between px-3 py-2"><span className="font-mono text-xs">{o.orderNumber}</span><span className="text-xs text-slate-500">{o.status}</span></li>)}
              </ul>
              {check.openCreditOrderCount > check.openCreditOrders.length && <p className="mt-1 text-xs text-slate-500">Chỉ hiện {check.openCreditOrders.length} đơn đầu; còn {check.openCreditOrderCount - check.openCreditOrders.length} đơn nữa.</p>}
            </section>
          )}
        </div>
      )}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <button type="button" disabled={loading || busy} onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 underline disabled:opacity-50"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} />Kiểm tra lại</button>
    </ConfirmModal>
  )
}
