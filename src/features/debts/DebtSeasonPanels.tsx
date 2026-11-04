import { AlertTriangle, Gauge } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import type { CreditLimitAlert, DebtDashboard, DebtEntryListItem } from '@/api/debtApi'
import { formatDay, useRoleBase } from '@/utils/creditLabels'
import { formatVnd } from '@/utils/money'
import { DueStateBadge, EntryFlags, SeasonPair } from './DebtSeasonBits'

// FE_GUIDE_FLOW_3 §3.1 mục 6 and 10: the season part of the debt dashboard. The server decides what needs a decision and
// who is near the credit limit; this only shows it.

const panel = 'rounded-xl border border-slate-100 bg-white p-4 shadow-sm'

function Heading({ title, count, hint }: { title: string; count: number; hint: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold text-slate-900">{title}{count > 0 && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">{count}</span>}</h2>
      <span className="text-xs text-slate-500">{hint}</span>
    </div>
  )
}

function DecisionRow({ entry, onOpen }: { entry: DebtEntryListItem; onOpen: (id: string) => void }) {
  const navigate = useNavigate(), base = useRoleBase()
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{entry.fullName ?? '--'} <span className="font-mono text-xs font-normal text-slate-500">{entry.entryNumber}</span></p>
        <p className="mt-0.5 text-xs text-slate-600">Hạn {formatDay(entry.dueDate)}{entry.isOverdue ? ` · quá hạn ${entry.overdueDays} ngày` : ''}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2"><DueStateBadge state={entry.dueState} /><SeasonPair entry={entry} /></div>
        <EntryFlags entry={entry} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-sm font-semibold tabular-nums text-slate-900">{formatVnd(entry.outstandingAmount)}</span>
        <RowActionsMenu triggerLabel={`Thao tác khoản nợ ${entry.entryNumber}`} actions={[
          { label: 'Xử lý khoản nợ (gia hạn, giảm, xóa…)', icon: 'edit_note', onClick: () => onOpen(entry.id) },
          { label: 'Xem công nợ của khách', icon: 'person', onClick: () => navigate(`${base}/debts/${entry.farmerProfileId}`) },
        ]} />
      </div>
    </li>
  )
}

function LimitRow({ alert }: { alert: CreditLimitAlert }) {
  const navigate = useNavigate(), base = useRoleBase()
  const atLimit = alert.state === 'AT_LIMIT'
  const percent = alert.creditLimit > 0 ? Math.min(100, Math.round((alert.usedCredit / alert.creditLimit) * 100)) : 100
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{alert.fullName}{alert.phoneNumber && <span className="ml-2 text-xs font-normal text-slate-500">{alert.phoneNumber}</span>}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Đã dùng ${percent}% hạn mức`}><div className={`h-full rounded-full ${atLimit ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${percent}%` }} /></div>
          <span className="text-xs tabular-nums text-slate-600">{percent}% · còn {formatVnd(alert.availableCredit)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Đã dùng {formatVnd(alert.usedCredit)} / hạn mức {formatVnd(alert.creditLimit)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${atLimit ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {atLimit ? <AlertTriangle size={12} aria-hidden /> : <Gauge size={12} aria-hidden />}{atLimit ? 'Hết hạn mức' : 'Sắp hết hạn mức'}
        </span>
        <RowActionsMenu triggerLabel={`Thao tác hạn mức ${alert.fullName}`} actions={[
          { label: 'Xem công nợ để thu một phần hoặc xử lý', icon: 'payments', onClick: () => navigate(`${base}/debts/${alert.farmerProfileId}`) },
          { label: 'Mở hồ sơ để nâng hạn mức', icon: 'credit_score', permissionCodes: ['CREDIT.UPDATE'], onClick: () => navigate(`${base}/farmers?customer=${alert.farmerProfileId}`) },
        ]} />
      </div>
    </li>
  )
}

interface Props {
  dashboard: DebtDashboard
  onOpenEntry: (id: string) => void
  onShowAllDecisions: () => void
}

export default function DebtSeasonPanels({ dashboard, onOpenEntry, onShowAllDecisions }: Props) {
  const decisions = dashboard.needsDecision ?? [], alerts = dashboard.creditLimitAlerts ?? []
  const decisionCount = dashboard.needsDecisionCount ?? decisions.length, alertCount = dashboard.creditLimitAlertCount ?? alerts.length
  // A server that predates the season dashboard sends none of these fields: show nothing rather than a row of zeros.
  if (dashboard.currentSeason === undefined && dashboard.dueSoonAmount === undefined && dashboard.needsDecision === undefined && dashboard.creditLimitAlerts === undefined) return null
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={panel}>
          <p className="text-xs font-medium text-slate-500">Vụ hiện tại</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{dashboard.currentSeason?.name ?? 'Chưa có vụ đang nhận đơn'}</p>
          {dashboard.currentSeason
            ? <p className="mt-0.5 text-sm text-slate-600">Nợ đang thu trong vụ: <strong className="tabular-nums text-slate-900">{formatVnd(dashboard.currentSeasonOutstanding ?? 0)}</strong></p>
            : <p className="mt-0.5 text-sm text-slate-500">Đơn chịu mới sẽ tính hạn theo hạng tín dụng.</p>}
        </div>
        <div className={panel}>
          <p className="text-xs font-medium text-slate-500">Đến hạn trong 7 ngày tới</p>
          <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">{formatVnd(dashboard.dueSoonAmount ?? 0)}</p>
          <p className="mt-0.5 text-sm text-slate-500">Gồm cả khoản đến hạn hôm nay.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className={panel} aria-label="Cần quyết định">
          <Heading title="Cần quyết định" count={decisionCount} hint="Quá hạn lâu hoặc đã gia hạn nhiều lần" />
          {decisions.length === 0
            ? <p className="py-4 text-sm text-slate-500">Không có khoản nợ nào cần quyết định.</p>
            : <ul className="divide-y divide-slate-100">{decisions.map(entry => <DecisionRow key={entry.id} entry={entry} onOpen={onOpenEntry} />)}</ul>}
          {decisionCount > decisions.length && <button type="button" className="mt-2 text-xs font-medium text-emerald-700 underline" onClick={onShowAllDecisions}>Xem tất cả {decisionCount} khoản</button>}
        </section>
        <section className={panel} aria-label="Khách sắp hết hạn mức">
          <Heading title="Khách sắp hoặc đã hết hạn mức" count={alertCount} hint="Từ 90% hạn mức trở lên" />
          {alerts.length === 0
            ? <p className="py-4 text-sm text-slate-500">Chưa có khách nào gần hết hạn mức.</p>
            : <ul className="divide-y divide-slate-100">{alerts.map(alert => <LimitRow key={alert.farmerProfileId} alert={alert} />)}</ul>}
          {alertCount > alerts.length && <p className="mt-2 text-xs text-slate-500">Còn {alertCount - alerts.length} khách khác, xem ở tab "Theo khách hàng".</p>}
        </section>
      </div>
    </div>
  )
}
