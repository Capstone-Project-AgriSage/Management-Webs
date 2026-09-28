import { Check, QrCode, Wallet } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatVnd } from '@/utils/money'
import type { DebtPaymentRequest } from '@/types'

interface PendingPaymentRequestsPanelProps {
  requests: DebtPaymentRequest[]
  onConfirm: (id: string) => void
  onReject: (id: string) => void
  /**
   * 'full' — standalone banner above the customer table: shows farmer name/phone/order
   * code and a header with a count badge. Every request passed in is assumed pending.
   * 'compact' — used inside a customer's detail modal, where the customer is already
   * known: omits farmer info, and renders a status badge instead of action buttons for
   * requests that are no longer pending.
   */
  variant?: 'full' | 'compact'
}

export default function PendingPaymentRequestsPanel({ requests, onConfirm, onReject, variant = 'full' }: PendingPaymentRequestsPanelProps) {
  if (requests.length === 0) return null

  if (variant === 'compact') {
    return (
      <div className="space-y-2">
        {requests.map((pr) => (
          <div key={pr.id} className="p-3 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-mono font-bold text-slate-900 text-sm">+{formatVnd(pr.amount)}</div>
              <div className="text-xs text-slate-500">
                {pr.paymentMethod === 'VIETQR' ? 'VietQR' : 'Tiền mặt'} • {pr.createdAt}
              </div>
            </div>
            {pr.status === 'PENDING_STAFF_CONFIRMATION' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onConfirm(pr.id)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                >
                  Xác nhận
                </button>
                <button
                  type="button"
                  onClick={() => onReject(pr.id)}
                  className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-[11px] transition-colors"
                >
                  Từ chối
                </button>
              </div>
            ) : (
              <StatusBadge
                label={pr.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Từ chối'}
                className={pr.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden shrink-0">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Yêu cầu xác nhận trả nợ</h2>
        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-xs">{requests.length} khoản chờ khớp</span>
      </div>
      <div className="divide-y divide-slate-50">
        {requests.map((pr) => (
          <div key={pr.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[200px]">
              <div className="font-semibold text-slate-900 text-sm">{pr.farmerName}</div>
              <div className="text-xs text-slate-500 font-mono">
                {pr.farmerPhone} • {pr.orderCode}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {pr.paymentMethod === 'VIETQR' ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <QrCode size={14} /> VietQR
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                  <Wallet size={14} /> Tiền mặt
                </span>
              )}
            </div>
            <div className="font-mono font-bold text-emerald-700 text-sm">+{formatVnd(pr.amount)}</div>
            <div className="text-xs text-slate-500 max-w-[220px]">{pr.note}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onConfirm(pr.id)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1"
              >
                <Check size={14} />
                <span>Xác nhận</span>
              </button>
              <button
                type="button"
                onClick={() => onReject(pr.id)}
                className="px-2.5 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs transition-colors"
              >
                Từ chối
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
