import PermissionAction from '@/components/auth/PermissionAction'
import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { customerCreditApi, type CreditEligibility, type CreditLimitHistory, type CreditReservation, type CreditSummary } from '@/api/customerCreditApi'
import type { CreditTierResponse } from '@/api/creditTiersApi'
import { useToast } from '@/context/ToastContext'
import PromptModal, { type PromptField } from '@/components/ui/PromptModal'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatVnd } from '@/utils/money'
import { CREDIT_STATUS_LABEL, formatDay, formatDayTime, label, useCanManage } from '@/utils/creditLabels'

interface CreditPanelProps {
  farmerProfileId: string
  tiers: CreditTierResponse[]
  /** Called after any change so the customer row/summary can refresh. */
  onChanged: () => void
}

type Prompt = 'open' | 'limit' | 'activate' | 'suspend' | 'block' | 'eligibility'

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

function Figure({ title, value, tone }: { title: string; value: string; tone?: 'danger' | 'success' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`mt-1 text-sm font-bold tabular-nums ${tone === 'danger' ? 'text-rose-600' : tone === 'success' ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

// FLOW_3 §4.3 — open the profile, change limit/tier (Operate, reason required), activate/suspend/block (Manage).
export default function CreditPanel({ farmerProfileId, tiers, onChanged }: CreditPanelProps) {
  const { showToast } = useToast()
  const canManage = useCanManage(["CREDIT.CREATE", "CREDIT.UPDATE", "CREDIT.ACTIVATE", "CREDIT.SUSPEND", "CREDIT.BLOCK"])
  const [credit, setCredit] = useState<CreditSummary | null>(null)
  const [noProfile, setNoProfile] = useState(false)
  const [history, setHistory] = useState<CreditLimitHistory[]>([])
  const [reservations, setReservations] = useState<CreditReservation[]>([])
  const [eligibility, setEligibility] = useState<CreditEligibility | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [prompt, setPrompt] = useState<Prompt | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const summary = await customerCreditApi.getCredit(farmerProfileId)
      setCredit(summary)
      setNoProfile(false)
      const [h, r] = await Promise.all([
        customerCreditApi.getHistory(farmerProfileId).catch(() => []),
        customerCreditApi.getReservations(farmerProfileId, true).catch(() => []),
      ])
      setHistory(h)
      setReservations(r)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setCredit(null)
        setNoProfile(true)
      } else {
        showToast(errorText(err, 'Không tải được hồ sơ tín dụng'), 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmerProfileId])

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await action()
      showToast(success, 'success')
      setPrompt(null)
      await load()
      onChanged()
    } catch (err) {
      showToast(errorText(err, 'Thao tác thất bại'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const tierOptions = tiers
    .filter((t) => t.isActive)
    .map((t) => ({ value: t.id, label: `${t.name} — ${formatVnd(t.defaultCreditLimit)}, ${t.defaultPaymentTermDays} ngày` }))

  const promptSpec: { title: string; description?: string; fields: PromptField[]; initialValues?: Record<string, string>; submitLabel: string; danger?: boolean; onSubmit: (v: Record<string, string>) => void } | null =
    prompt === 'open'
      ? {
          title: 'Mở tín dụng cho khách',
          description: 'Bỏ trống hạng để lấy theo nhóm khách; bỏ trống hạn mức để lấy hạn mức mặc định của hạng. Hệ thống tạo luôn sổ nợ cho khách.',
          fields: [
            { key: 'creditTierId', label: 'Hạng tín dụng', type: 'select', options: tierOptions },
            { key: 'creditLimit', label: 'Hạn mức (đ)', type: 'number', min: '0' },
            { key: 'note', label: 'Ghi chú', type: 'textarea' },
          ],
          submitLabel: 'Mở tín dụng',
          onSubmit: (v) =>
            run(
              () => customerCreditApi.createCredit(farmerProfileId, { creditTierId: v.creditTierId || null, creditLimit: v.creditLimit ? Number(v.creditLimit) : null, note: v.note || null }),
              'Đã mở tín dụng',
            ),
        }
      : prompt === 'limit' && credit
        ? {
            title: 'Đổi hạn mức / hạng tín dụng',
            description: 'Hạn mức thấp hơn dư nợ hiện tại vẫn được phép, chỉ chặn đơn mua chịu mới.',
            fields: [
              { key: 'creditLimit', label: 'Hạn mức mới (đ)', type: 'number', required: true, min: '0' },
              { key: 'creditTierId', label: 'Hạng tín dụng (bỏ trống = giữ nguyên)', type: 'select', options: tierOptions },
              { key: 'reason', label: 'Lý do', type: 'textarea', required: true },
            ],
            initialValues: { creditLimit: String(credit.creditLimit) },
            submitLabel: 'Lưu',
            onSubmit: (v) =>
              run(
                () => customerCreditApi.changeLimit(farmerProfileId, { creditLimit: Number(v.creditLimit), reason: v.reason.trim(), creditTierId: v.creditTierId || null }),
                'Đã cập nhật hạn mức',
              ),
          }
        : prompt === 'activate' || prompt === 'suspend' || prompt === 'block'
          ? {
              title: prompt === 'activate' ? 'Kích hoạt tín dụng' : prompt === 'suspend' ? 'Tạm dừng tín dụng' : 'Khóa tín dụng',
              description:
                prompt === 'activate'
                  ? 'Khách được mua chịu trở lại (cần sổ nợ đang hoạt động).'
                  : 'Giữ nguyên hạn mức, dư nợ và phần đang giữ cho đơn; chỉ chặn đơn mua chịu mới.',
              fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }],
              submitLabel: prompt === 'activate' ? 'Kích hoạt' : prompt === 'suspend' ? 'Tạm dừng' : 'Khóa',
              danger: prompt !== 'activate',
              onSubmit: (v) =>
                run(
                  () => customerCreditApi[prompt](farmerProfileId, v.reason.trim()),
                  prompt === 'activate' ? 'Đã kích hoạt tín dụng' : prompt === 'suspend' ? 'Đã tạm dừng tín dụng' : 'Đã khóa tín dụng',
                ),
            }
          : prompt === 'eligibility'
            ? {
                title: 'Kiểm tra mua chịu cho đơn',
                description: 'Kiểm tra trước khi lập đơn mua chịu. Hạn mức chỉ bị giữ khi đơn được xác nhận.',
                fields: [{ key: 'amount', label: 'Giá trị đơn (đ)', type: 'number', required: true, min: '1' }],
                submitLabel: 'Kiểm tra',
                onSubmit: async (v) => {
                  setBusy(true)
                  try {
                    setEligibility(await customerCreditApi.checkEligibility(farmerProfileId, Number(v.amount)))
                    setPrompt(null)
                  } catch (err) {
                    showToast(errorText(err, 'Không kiểm tra được'), 'error')
                  } finally {
                    setBusy(false)
                  }
                },
              }
            : null

  if (loading && !credit && !noProfile) return <div className="p-6 text-sm text-slate-500">Đang tải tín dụng...</div>

  return (
    <div className="space-y-4">
      {noProfile ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center space-y-3">
          <p className="text-sm text-slate-600">Khách chưa có hồ sơ tín dụng nên chưa được mua chịu.</p>
          <PermissionAction codes={["CREDIT.CREATE"]}><button type="button" className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700" onClick={() => setPrompt('open')}>
            Mở tín dụng
          </button></PermissionAction>
        </div>
      ) : credit ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge label={label(CREDIT_STATUS_LABEL, credit.status)} />
              <span className="text-sm text-slate-700">
                Hạng <strong>{credit.creditTier?.name ?? '--'}</strong> · kỳ hạn nợ <strong>{credit.paymentTermDays ?? '--'} ngày</strong>
              </span>
            </div>
            {!credit.allowCreditPurchase && <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">Hiện không được mua chịu</span>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Figure title="Hạn mức" value={formatVnd(credit.creditLimit)} />
            <Figure title="Dư nợ" value={formatVnd(credit.outstandingReceivable)} />
            <Figure title="Đang giữ cho đơn" value={formatVnd(credit.reservedCredit)} />
            <Figure title="Còn được mua chịu" value={formatVnd(credit.availableCredit)} tone={credit.availableCredit < 0 ? 'danger' : 'success'} />
            <Figure title="Quá hạn" value={formatVnd(credit.overdueAmount)} tone={credit.overdueAmount > 0 ? 'danger' : undefined} />
            <Figure title="Đã trả" value={formatVnd(credit.totalPaid)} />
            <Figure title="Khoản nợ đang mở" value={String(credit.openDebtCount)} />
            <Figure title="Hạn trả sớm nhất" value={formatDay(credit.oldestDueDate)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <PermissionAction codes={["CREDIT.UPDATE"]}><button type="button" className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50" onClick={() => setPrompt('limit')}>
              Đổi hạn mức / hạng
            </button></PermissionAction>
            <PermissionAction codes={["CREDIT.CHECK"]}><button type="button" className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50" onClick={() => setPrompt('eligibility')}>
              Kiểm tra mua chịu
            </button></PermissionAction>
            {canManage && credit.status !== 'ACTIVE' && (
              <PermissionAction codes={["CREDIT.ACTIVATE"]}><button type="button" className="px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-50" onClick={() => setPrompt('activate')}>
                Kích hoạt
              </button></PermissionAction>
            )}
            {canManage && credit.status === 'ACTIVE' && (
              <PermissionAction codes={["CREDIT.SUSPEND"]}><button type="button" className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 text-sm font-medium hover:bg-amber-50" onClick={() => setPrompt('suspend')}>
                Tạm dừng
              </button></PermissionAction>
            )}
            {canManage && credit.status !== 'BLOCKED' && (
              <PermissionAction codes={["CREDIT.BLOCK"]}><button type="button" className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 text-sm font-medium hover:bg-rose-50" onClick={() => setPrompt('block')}>
                Khóa
              </button></PermissionAction>
            )}
          </div>

          {eligibility && (
            <div className={`rounded-lg border p-3 text-sm ${eligibility.eligible ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
              <div className="font-semibold">
                Đơn {formatVnd(eligibility.orderAmount)}: {eligibility.eligible ? 'được mua chịu' : 'không được mua chịu'}
              </div>
              {eligibility.message && <div className="mt-0.5">{eligibility.message}</div>}
              <div className="mt-1 text-xs">Còn lại sau đơn: {formatVnd(eligibility.availableCreditAfterOrder)}{eligibility.hasOverdueDebt ? ` · đang quá hạn ${formatVnd(eligibility.overdueAmount)}` : ''}</div>
            </div>
          )}

          {reservations.length > 0 && (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Hạn mức đang giữ cho đơn</h4>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                {reservations.map((r) => (
                  <li key={r.id} className="px-3 py-2 flex justify-between gap-3">
                    <span className="font-mono">{r.orderNumber ?? r.orderId.slice(0, 8)}</span>
                    <span className="text-slate-600">còn giữ <strong className="text-slate-900">{formatVnd(r.remainingAmount)}</strong> / {formatVnd(r.reservedAmount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {history.length > 0 && (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Lịch sử hạn mức</h4>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="px-3 py-2">
                    <div className="flex justify-between gap-3">
                      <span>
                        {formatVnd(h.oldCreditLimit)} → <strong>{formatVnd(h.newCreditLimit)}</strong>
                        {h.oldCreditTier?.id !== h.newCreditTier?.id && ` · hạng ${h.oldCreditTier?.name ?? '--'} → ${h.newCreditTier?.name ?? '--'}`}
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">{formatDayTime(h.changedAt)}</span>
                    </div>
                    {h.reason && <div className="text-xs text-slate-500 mt-0.5">{h.reason}</div>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : null}

      {promptSpec && prompt && <PermissionAction codes={[({ open: 'CREDIT.CREATE', limit: 'CREDIT.UPDATE', activate: 'CREDIT.ACTIVATE', suspend: 'CREDIT.SUSPEND', block: 'CREDIT.BLOCK', eligibility: 'CREDIT.CHECK' })[prompt]]}><PromptModal open loading={busy} onClose={() => setPrompt(null)} {...promptSpec} /></PermissionAction>}
    </div>
  )
}
