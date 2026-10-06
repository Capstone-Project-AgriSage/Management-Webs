import EmptyTableRow from '@/components/ui/EmptyTableRow'
import StatusBadge from '@/components/ui/StatusBadge'
import type { DebtEntryListItem } from '@/api/debtApi'
import { formatVnd } from '@/utils/money'
import { DEBT_ENTRY_STATUS_LABEL, DEBT_SOURCE_LABEL, formatDay, label } from '@/utils/creditLabels'

interface DebtEntriesTableProps {
  entries: DebtEntryListItem[]
  loading: boolean
  /** Hide the customer column on a single customer's page. */
  showCustomer?: boolean
  onOpen: (entry: DebtEntryListItem) => void
}

export default function DebtEntriesTable({ entries, loading, showCustomer = true, onOpen }: DebtEntriesTableProps) {
  const cols = showCustomer ? 7 : 6
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[860px]">
        <thead>
          <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
            <th className="py-3 px-4" scope="col">Khoản nợ</th>
            {showCustomer && <th className="py-3 px-3" scope="col">Khách hàng</th>}
            <th className="py-3 px-3 text-right" scope="col">Nợ gốc</th>
            <th className="py-3 px-3 text-right" scope="col">Đã trả</th>
            <th className="py-3 px-3 text-right" scope="col">Còn nợ</th>
            <th className="py-3 px-3" scope="col">Hạn trả</th>
            <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
          {loading && entries.length === 0 ? (
            <EmptyTableRow colSpan={cols} message="Đang tải dữ liệu..." />
          ) : entries.length === 0 ? (
            <EmptyTableRow colSpan={cols} message="Không có khoản nợ nào." />
          ) : (
            entries.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onOpen(e)}>
                <td className="py-3 px-4">
                  <div className="font-mono font-semibold text-emerald-700">{e.entryNumber}</div>
                  <div className="text-xs text-slate-500">
                    {label(DEBT_SOURCE_LABEL, e.sourceType)}
                    {e.orderNumber ? ` · ${e.orderNumber}` : ''}
                  </div>
                </td>
                {showCustomer && (
                  <td className="py-3 px-3">
                    <div className="font-medium">{e.fullName ?? '--'}</div>
                    <div className="text-xs text-slate-500">{e.phoneNumber ?? ''}</div>
                  </td>
                )}
                <td className="py-3 px-3 text-right tabular-nums">{formatVnd(e.originalAmount)}</td>
                <td className="py-3 px-3 text-right tabular-nums text-slate-600">{formatVnd(e.totalPaid)}</td>
                <td className="py-3 px-3 text-right tabular-nums font-semibold">{formatVnd(e.outstandingAmount)}</td>
                <td className="py-3 px-3">
                  <div>{formatDay(e.dueDate)}</div>
                  {e.isOverdue && <div className="text-xs font-semibold text-rose-600">Quá hạn {e.overdueDays} ngày</div>}
                </td>
                <td className="py-3 px-3 text-center">
                  <StatusBadge label={label(DEBT_ENTRY_STATUS_LABEL, e.status)} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
