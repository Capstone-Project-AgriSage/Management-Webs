import { AlertTriangle, ShieldCheck, PencilLine, Ban } from 'lucide-react'
import type { DebtCustomer } from '../../../types'

interface DisputeResolutionPanelProps {
  customer: DebtCustomer
  onKeep: () => void
  onAdjust: () => void
  onCancel: () => void
}

/**
 * The KEEP / ADJUST / CANCEL dispute-handling block for a disputed debt. Renders nothing
 * when the customer isn't disputed (the caller in DebtsPage also gates rendering, but this
 * keeps the component safe to mount unconditionally too).
 */
export default function DisputeResolutionPanel({ customer, onKeep, onAdjust, onCancel }: DisputeResolutionPanelProps) {
  if (!customer.isDisputed) return null

  return (
    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-rose-800">Khoản nợ đang bị tranh chấp</div>
          <p className="text-xs text-rose-700 mt-1">{customer.disputeNote}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-200">
        <button
          type="button"
          onClick={onKeep}
          className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50/50 font-semibold text-xs transition-colors flex items-center gap-1.5"
        >
          <ShieldCheck size={14} />
          <span>Giữ nguyên khoản nợ</span>
        </button>
        <button
          type="button"
          onClick={onAdjust}
          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
        >
          <PencilLine size={14} />
          <span>Điều chỉnh khoản nợ</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
        >
          <Ban size={14} />
          <span>Hủy khoản nợ không hợp lệ</span>
        </button>
      </div>
    </div>
  )
}
