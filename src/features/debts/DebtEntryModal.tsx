import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useEffect, useState } from 'react'
import DetailModal from '@/components/ui/DetailModal'
import StatusBadge from '@/components/ui/StatusBadge'
import PromptModal, { type PromptField } from '@/components/ui/PromptModal'
import { debtApi, type DebtEntry } from '@/api/debtApi'
import { useToast } from '@/context/ToastContext'
import { formatVnd } from '@/utils/money'
import {
  DEBT_ACTION_LABEL,
  DEBT_ENTRY_STATUS_LABEL,
  DEBT_SOURCE_LABEL,
  DEBT_TRANSACTION_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  formatDay,
  formatDayTime,
  label,
  todayVn,
  useCanManage,
} from '@/utils/creditLabels'

type Action = 'dispute' | 'keep' | 'changeDueDate' | 'adjust' | 'cancel'

interface DebtEntryModalProps {
  entryId: string | null
  onClose: () => void
  onChanged: () => void
}

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

// FLOW_3 §6: DISPUTE / KEEP / CHANGE_DUE_DATE (Operate), ADJUST / CANCEL (Manage). Posted rows are never edited.
export default function DebtEntryModal({ entryId, onClose, onChanged }: DebtEntryModalProps) {
  const { showToast } = useToast()
  const canManage = useCanManage(["DEBT.ADJUST", "DEBT.CANCEL"])
  const [entry, setEntry] = useState<DebtEntry | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async (id: string) => {
    try {
      setEntry(await debtApi.getEntry(id))
    } catch (err) {
      showToast(errorText(err, 'Không tải được khoản nợ'), 'error')
      onClose()
    }
  }

  useEffect(() => {
    if (entryId) {
      setEntry(null)
      load(entryId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId])

  const closed = entry ? ['PAID', 'CANCELLED'].includes(entry.status) : true
  const disputed = entry?.status === 'DISPUTED'

  const specs: Record<Action, { title: string; description?: string; fields: PromptField[]; submitLabel: string; danger?: boolean; run: (v: Record<string, string>) => Promise<DebtEntry> }> | null = entry
    ? {
      dispute: {
        title: 'Ghi nhận khiếu nại',
        description: 'Khoản nợ chuyển sang "Đang tranh chấp"; khách vẫn trả được. Giải quyết bằng Giữ nguyên, Điều chỉnh hoặc Hủy.',
        fields: [{ key: 'reason', label: 'Nội dung khiếu nại', type: 'textarea', required: true }],
        submitLabel: 'Ghi nhận',
        run: (v) => debtApi.dispute(entry.id, v.reason.trim()),
      },
      keep: {
        title: 'Giữ nguyên khoản nợ',
        description: 'Kết thúc tranh chấp, giữ nguyên số tiền.',
        fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }],
        submitLabel: 'Giữ nguyên',
        run: (v) => debtApi.keep(entry.id, v.reason.trim()),
      },
      changeDueDate: {
        title: 'Đổi hạn trả',
        fields: [
          { key: 'newDueDate', label: 'Hạn trả mới', type: 'date', required: true, min: todayVn(), hint: 'Không được là ngày trong quá khứ.' },
          { key: 'reason', label: 'Lý do', type: 'textarea', required: true },
        ],
        submitLabel: 'Đổi hạn',
        run: (v) => debtApi.changeDueDate(entry.id, v.newDueDate, v.reason.trim()),
      },
      adjust: {
        title: 'Điều chỉnh giảm nợ',
        description: `Nhập số tiền cần GIẢM (tối đa ${formatVnd(entry.outstandingAmount)}). Muốn tăng nợ thì tạo khoản nợ thủ công.`,
        fields: [
          { key: 'amount', label: 'Số tiền giảm (đ)', type: 'number', required: true, min: '1' },
          { key: 'reason', label: 'Lý do', type: 'textarea', required: true },
        ],
        submitLabel: 'Điều chỉnh',
        run: (v) => {
          const amount = Number(v.amount)
          if (!(amount > 0) || amount > entry.outstandingAmount) return Promise.reject(new Error(`Số tiền phải trong khoảng 1 – ${formatVnd(entry.outstandingAmount)}`))
          return debtApi.adjust(entry.id, amount, v.reason.trim())
        },
      },
      cancel: {
        title: 'Hủy khoản nợ',
        description: `Ghi giảm toàn bộ ${formatVnd(entry.outstandingAmount)} còn lại và đóng khoản nợ. Không hoàn tác được.`,
        fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }],
        submitLabel: 'Hủy khoản nợ',
        danger: true,
        run: (v) => debtApi.cancel(entry.id, v.reason.trim()),
      },
    }
    : null

  const submit = async (v: Record<string, string>) => {
    if (!action || !specs) return
    setBusy(true)
    try {
      setEntry(await specs[action].run(v))
      showToast('Đã cập nhật khoản nợ', 'success')
      setAction(null)
      onChanged()
    } catch (err) {
      showToast(errorText(err, 'Thao tác thất bại'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const btn = 'px-3 py-1.5 rounded-lg border text-sm font-medium'

  return (
    <DetailModal open={entryId !== null} onClose={onClose} widthClassName="max-w-2xl">
      {!entry ? (
        <ModalLayout bodyClassName="space-y-4">Đang tải...
        </ModalLayout>
      ) : (
        <ModalLayout header={<div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-bold text-slate-900">{entry.entryNumber}</span>
            <StatusBadge label={label(DEBT_ENTRY_STATUS_LABEL, entry.status)} />
            {entry.isOverdue && <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-0.5">Quá hạn {entry.overdueDays} ngày</span>}
          </div>
          <div className="text-sm text-slate-600">
            {entry.customer?.fullName ?? '--'} · {label(DEBT_SOURCE_LABEL, entry.sourceType)}
            {entry.orderNumber ? ` · đơn ${entry.orderNumber}` : ''}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {[
              ['Nợ gốc', formatVnd(entry.originalAmount)],
              ['Đã trả', formatVnd(entry.totalPaid)],
              ['Còn nợ', formatVnd(entry.outstandingAmount)],
              ['Hạn trả', formatDay(entry.dueDate)],
            ].map(([t, val]) => (
              <div key={t} className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t}</div>
                <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">{val}</div>
              </div>
            ))}
          </div>
          {entry.prepaymentAppliedAmount > 0 && (
            <p className="text-xs text-slate-500">
              Giá trị giao {formatVnd(entry.fulfillmentValue)}, đã trừ tiền trả trước {formatVnd(entry.prepaymentAppliedAmount)}.
            </p>
          )}
        </div>} bodyClassName="space-y-4">{!closed && (
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">
            {!disputed && (
              <PermissionAction codes={["DEBT.DISPUTE"]}><button type="button" className={`${btn} border-amber-300 text-amber-800 hover:bg-amber-50`} onClick={() => setAction('dispute')}>
                Khiếu nại
              </button></PermissionAction>
            )}
            {disputed && (
              <PermissionAction codes={["DEBT.KEEP"]}><button type="button" className={`${btn} border-slate-200 hover:bg-slate-50`} onClick={() => setAction('keep')}>
                Giữ nguyên
              </button></PermissionAction>
            )}
            <PermissionAction codes={["DEBT.DUE_DATE"]}><button type="button" className={`${btn} border-slate-200 hover:bg-slate-50`} onClick={() => setAction('changeDueDate')}>
              Đổi hạn trả
            </button></PermissionAction>
            {canManage && (
              <>
                <PermissionAction codes={["DEBT.ADJUST"]}><button type="button" className={`${btn} border-slate-200 hover:bg-slate-50`} onClick={() => setAction('adjust')}>
                  Điều chỉnh giảm
                </button></PermissionAction>
                <PermissionAction codes={["DEBT.CANCEL"]}><button type="button" className={`${btn} border-rose-300 text-rose-700 hover:bg-rose-50`} onClick={() => setAction('cancel')}>
                  Hủy khoản nợ
                </button></PermissionAction>
              </>
            )}
          </div>
        )}<div className="p-5 space-y-5">
            {entry.order?.items && entry.order.items.length > 0 && (
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sản phẩm của đơn {entry.order.orderNumber}</h4>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                  {entry.order.items.map((i) => (
                    <li key={i.id} className="px-3 py-2 flex justify-between gap-3">
                      <span>
                        {i.productName} <span className="text-slate-500">({i.packagingName}) × {i.quantity}</span>
                      </span>
                      <span className="tabular-nums">{formatVnd(i.lineTotalAmount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {entry.actions.length > 0 && (
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Xử lý</h4>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                  {entry.actions.map((a) => (
                    <li key={a.id} className="px-3 py-2">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium">
                          {label(DEBT_ACTION_LABEL, a.actionType)}
                          {a.adjustmentAmount != null && ` · ${formatVnd(Math.abs(a.adjustmentAmount))}`}
                          {a.newDueDate && ` · ${formatDay(a.oldDueDate)} → ${formatDay(a.newDueDate)}`}
                        </span>
                        <span className="text-xs text-slate-500 shrink-0">{formatDayTime(a.createdAt)}</span>
                      </div>
                      {a.reason && <div className="text-xs text-slate-500 mt-0.5">{a.reason}</div>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sổ cái khoản nợ</h4>
              {entry.transactions.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có bút toán.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                  {entry.transactions.map((t) => (
                    <li key={t.id} className="px-3 py-2 flex justify-between gap-3">
                      <div>
                        <div className="font-medium">{label(DEBT_TRANSACTION_LABEL, t.transactionType)}</div>
                        <div className="text-xs text-slate-500">{formatDayTime(t.occurredAt)}{t.note ? ` · ${t.note}` : ''}</div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className={t.amountDelta < 0 ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>
                          {t.amountDelta > 0 ? '+' : ''}
                          {formatVnd(t.amountDelta)}
                        </div>
                        <div className="text-xs text-slate-500">dư nợ {formatVnd(t.balanceAfter)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {entry.payments.length > 0 && (
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Thanh toán đã trừ vào khoản này</h4>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                  {entry.payments.map((p) => (
                    <li key={p.id} className="px-3 py-2 flex justify-between gap-3">
                      <span>
                        <span className="font-mono">{p.paymentNumber}</span> · {label(PAYMENT_METHOD_LABEL, p.paymentMethod)}
                      </span>
                      <span className="text-right">
                        <span className="tabular-nums">{formatVnd(p.amount)}</span>
                        <span className="text-xs text-slate-500"> · {label(PAYMENT_STATUS_LABEL, p.status)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </ModalLayout>
      )}

      {action && specs && (
        <PermissionAction codes={[({ dispute: 'DEBT.DISPUTE', keep: 'DEBT.KEEP', changeDueDate: 'DEBT.DUE_DATE', adjust: 'DEBT.ADJUST', cancel: 'DEBT.CANCEL' })[action]]}><PromptModal
          open
          loading={busy}
          title={specs[action].title}
          description={specs[action].description}
          fields={specs[action].fields}
          submitLabel={specs[action].submitLabel}
          danger={specs[action].danger}
          onClose={() => setAction(null)}
          onSubmit={submit}
        /></PermissionAction>
      )}
    </DetailModal>
  )
}
