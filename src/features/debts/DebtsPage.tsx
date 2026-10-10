import ListToolbar from '@/components/ui/ListToolbar'
import { LIST_PAGE_SIZE } from '@/utils/pagination';
import PermissionAction from '@/components/auth/PermissionAction'
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import { usePermission } from '@/context/PermissionContext';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { debtApi, type DebtAccountListItem, type DebtDashboard, type DebtEntryListItem, type DebtEntrySortBy } from '@/api/debtApi';
import { paymentsApi } from '@/api/paymentsApi';
import type { PaymentListItem } from '@/api/customersApi';
import type { PagedResult } from '@/api/types';

import EmptyTableRow from '@/components/ui/EmptyTableRow'
import ServerPagination from '@/components/ui/ServerPagination'
import PromptModal from '@/components/ui/PromptModal'
import { formatVnd } from '@/utils/money';
import { DEBT_ENTRY_STATUS_LABEL, PAYMENT_METHOD_LABEL, formatDay, formatDayTime, label, useCanManage, useRoleBase } from '@/utils/creditLabels';
import DebtEntriesTable from './DebtEntriesTable'
import DebtEntryModal from './DebtEntryModal'

type Tab = 'accounts' | 'entries' | 'transfers'
const PAGE_SIZE = LIST_PAGE_SIZE

const ENTRY_SORTS: { value: string; label: string; sortBy: DebtEntrySortBy; descending: boolean }[] = [
  { value: 'due', label: 'Hạn trả gần nhất', sortBy: 'DueDate', descending: false },
  { value: 'overdue', label: 'Quá hạn lâu nhất', sortBy: 'DaysOverdue', descending: true },
  { value: 'amount', label: 'Còn nợ nhiều nhất', sortBy: 'OutstandingAmount', descending: true },
  { value: 'newest', label: 'Mới phát sinh', sortBy: 'CreatedAt', descending: true },
]

const selectClassName = 'h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

function Kpi({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: 'danger' | 'success' }) {
  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className={`mt-2 text-xl font-bold tabular-nums ${tone === 'danger' ? 'text-rose-600' : tone === 'success' ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

// FLOW_3 §6–§7: debt accounts, debt entries and pending bank-transfer repayments.
export default function DebtsPage() {
  const { has } = usePermission()
  usePageHeader({ title: 'Công nợ', subtitle: 'Sổ nợ khách hàng, khoản nợ và thu hồi công nợ' })
  const { showToast } = useToast()
  const navigate = useNavigate()
  const canManage = useCanManage(["DEBT.ADJUST", "DEBT.CANCEL", "BANK_PAYMENTS.CONFIRM", "BANK_PAYMENTS.REJECT"])
  const canReadDashboard = has('DEBT.READ_DASHBOARD')
  const base = useRoleBase()

  const [tab, setTab] = useState<Tab>('accounts')
  const [dashboard, setDashboard] = useState<DebtDashboard | null>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [entryStatus, setEntryStatus] = useState('')
  const [entrySort, setEntrySort] = useState('due')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [accounts, setAccounts] = useState<PagedResult<DebtAccountListItem> | null>(null)
  const [entries, setEntries] = useState<PagedResult<DebtEntryListItem> | null>(null)
  const [transfers, setTransfers] = useState<PagedResult<PaymentListItem> | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<PaymentListItem | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  const loadDashboard = () => {
    if (canReadDashboard) debtApi.getDashboard().then(setDashboard).catch(() => setDashboard(null))
    else setDashboard(null)
  }

  const load = async () => {
    setLoading(true)
    try {
      if (tab === 'accounts') {
        setAccounts(await debtApi.getDebtAccounts({ search: debounced || undefined, hasOutstanding: true, overdueOnly: overdueOnly || undefined, page, pageSize: PAGE_SIZE }))
      } else if (tab === 'entries') {
        const s = ENTRY_SORTS.find((o) => o.value === entrySort) ?? ENTRY_SORTS[0]
        setEntries(
          await debtApi.getEntries({
            search: debounced || undefined,
            status: entryStatus || undefined,
            overdueOnly: overdueOnly || undefined,
            sortBy: s.sortBy,
            descending: s.descending,
            page,
            pageSize: PAGE_SIZE,
          }),
        )
      } else {
        setTransfers(await paymentsApi.getPayments({ paymentContext: 'DEBT_REPAYMENT', status: 'PENDING', search: debounced || undefined, page, pageSize: PAGE_SIZE }))
      }
    } catch (err) {
      showToast(errorText(err, 'Không tải được dữ liệu công nợ'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(loadDashboard, [canReadDashboard])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, debounced, overdueOnly, entryStatus, entrySort, page])

  useEffect(() => setPage(1), [tab, debounced, overdueOnly, entryStatus, entrySort])

  const refresh = () => {
    loadDashboard()
    load()
  }

  const confirmTransfer = async (p: PaymentListItem) => {
    if (!window.confirm(`Xác nhận đã nhận ${formatVnd(p.amount)} từ ${p.payerName ?? 'khách'}? Khoản đến hạn trước sẽ được trừ trước.`)) return
    setBusyId(p.id)
    try {
      await paymentsApi.confirmPayment(p.id)
      showToast('Đã xác nhận chuyển khoản và trừ nợ', 'success')
      refresh()
    } catch (err) {
      showToast(errorText(err, 'Xác nhận thất bại'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const rejectTransfer = async (reason: string) => {
    if (!rejecting) return
    setBusyId(rejecting.id)
    try {
      await paymentsApi.rejectPayment(rejecting.id, reason)
      showToast('Đã từ chối khoản chuyển khoản', 'success')
      setRejecting(null)
      refresh()
    } catch (err) {
      showToast(errorText(err, 'Từ chối thất bại'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const paged = tab === 'accounts' ? accounts : tab === 'entries' ? entries : transfers

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      {canReadDashboard && dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi title="Tổng dư nợ" value={formatVnd(dashboard.totalOutstandingDebt)} sub={`${dashboard.customersWithDebt} khách đang nợ`} />
          <Kpi title="Quá hạn" value={formatVnd(dashboard.totalOverdueDebt)} sub={`${dashboard.customersWithOverdueDebt} khách quá hạn`} tone={dashboard.totalOverdueDebt > 0 ? 'danger' : undefined} />
          <Kpi title="Thu hôm nay" value={formatVnd(dashboard.collectedToday)} tone="success" />
          <Kpi title="Thu tháng này" value={formatVnd(dashboard.collectedThisMonth)} tone="success" />
        </div>
      )}

      <BusinessReportCards kind="debt" />
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col">
        <div className="px-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1" role="tablist">
            {([
              ['accounts', 'Theo khách hàng'],
              ['entries', 'Khoản nợ'],
              ['transfers', 'Chuyển khoản chờ duyệt'],
            ] as [Tab, string][]).map(([t, text]) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`px-3 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === t ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                onClick={() => setTab(t)}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <ListToolbar search={{ value: search, onChange: value => { setSearch(value); setPage(1) }, placeholder: tab === 'entries' ? 'Tìm tên, SĐT, mã khoản nợ, mã đơn...' : 'Tìm tên hoặc số điện thoại...' }} onClear={() => { setSearch(''); setOverdueOnly(false); setEntryStatus(''); setEntrySort('due'); setPage(1) }} actions={<><button type="button" className="h-9 px-3 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5" onClick={refresh}>
              <RefreshCw size={14} /> Làm mới
            </button></>}>
{tab !== 'transfers' && (
              <label className="flex items-center gap-2 text-sm text-slate-700 h-9 px-3 rounded-lg border border-slate-200 bg-white">
                <input type="checkbox" className="accent-rose-600" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
                Chỉ quá hạn
              </label>
            )}
{tab === 'entries' && (
              <>
                <select aria-label="Trạng thái khoản nợ" className={selectClassName} value={entryStatus} onChange={(e) => setEntryStatus(e.target.value)}>
                  <option value="">Mọi trạng thái</option>
                  {Object.entries(DEBT_ENTRY_STATUS_LABEL).map(([value, text]) => (
                    <option key={value} value={value}>{text}</option>
                  ))}
                </select>
                <select aria-label="Sắp xếp" className={selectClassName} value={entrySort} onChange={(e) => setEntrySort(e.target.value)}>
                  {ENTRY_SORTS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </>
            )}
      </ListToolbar>

        {tab === 'accounts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                  <th className="py-3 px-4">Khách hàng</th>
                  <th className="py-3 px-3">Nhóm</th>
                  <th className="py-3 px-3 text-right">Dư nợ</th>
                  <th className="py-3 px-3 text-right">Quá hạn</th>
                  <th className="py-3 px-4">Hạn trả sớm nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {loading && !accounts ? (
                  <EmptyTableRow colSpan={5} message="Đang tải dữ liệu..." />
                ) : (accounts?.items ?? []).length === 0 ? (
                  <EmptyTableRow colSpan={5} message="Không có khách hàng nào đang nợ." />
                ) : (
                  accounts!.items.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`${base}/debts/${a.farmerProfileId}`)}>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{a.fullName ?? '--'}</div>
                        <div className="text-xs text-slate-500">{a.phoneNumber ?? ''}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700">{a.customerGroup?.name ?? 'Nhóm mặc định'}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold">{formatVnd(a.currentBalance)}</td>
                      <td className={`py-3 px-3 text-right tabular-nums ${a.overdueAmount > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>{formatVnd(a.overdueAmount)}</td>
                      <td className="py-3 px-4">{formatDay(a.oldestDueDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'entries' && <DebtEntriesTable entries={entries?.items ?? []} loading={loading} onOpen={(e) => setSelectedEntryId(e.id)} />}

        {tab === 'transfers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                  <th className="py-3 px-4">Phiếu</th>
                  <th className="py-3 px-3">Khách hàng</th>
                  <th className="py-3 px-3 text-right">Số tiền</th>
                  <th className="py-3 px-3">Ghi nhận lúc</th>
                  <th className="py-3 px-4 text-right">{canManage ? 'Xử lý' : ''}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {loading && !transfers ? (
                  <EmptyTableRow colSpan={5} message="Đang tải dữ liệu..." />
                ) : (transfers?.items ?? []).length === 0 ? (
                  <EmptyTableRow colSpan={5} message="Không có khoản chuyển khoản nào chờ duyệt." />
                ) : (
                  transfers!.items.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold">{p.paymentNumber}</div>
                        <div className="text-xs text-slate-500">{label(PAYMENT_METHOD_LABEL, p.paymentMethod)}</div>
                      </td>
                      <td className="py-3 px-3">{p.payerName ?? '--'}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold">{formatVnd(p.amount)}</td>
                      <td className="py-3 px-3">{formatDayTime(p.initiatedAt)}</td>
                      <td className="py-3 px-4 text-right">
                        {canManage && p.paymentMethod !== 'PAYOS' && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 text-xs font-medium hover:bg-rose-50 disabled:opacity-50"
                              onClick={() => setRejecting(p)}
                            >
                              Từ chối
                            </button>
                            <PermissionAction codes={["BANK_PAYMENTS.CONFIRM"]}><button
                              type="button"
                              disabled={busyId === p.id}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                              onClick={() => confirmTransfer(p)}
                            >
                              Xác nhận đã nhận
                            </button></PermissionAction>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {paged && (
          <ServerPagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={paged.totalCount}
            totalPages={paged.totalPages}
            unitLabel={tab === 'accounts' ? 'khách hàng' : tab === 'entries' ? 'khoản nợ' : 'phiếu'}
            onPageChange={setPage}
          />
        )}
      </div>

      <DebtEntryModal entryId={selectedEntryId} onClose={() => setSelectedEntryId(null)} onChanged={refresh} />

      {rejecting && (
        <PermissionAction codes={["BANK_PAYMENTS.REJECT"]}><PromptModal
          open
          danger
          loading={busyId === rejecting.id}
          title={`Từ chối ${rejecting.paymentNumber}`}
          description={`Không tìm thấy ${formatVnd(rejecting.amount)} trong sao kê? Khoản này sẽ bị đánh dấu thất bại và không trừ nợ.`}
          fields={[{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }]}
          submitLabel="Từ chối"
          onClose={() => setRejecting(null)}
          onSubmit={(v) => rejectTransfer(v.reason.trim())}
        /></PermissionAction>
      )}
    </div>
  )
}
