import { LIST_PAGE_SIZE } from '@/utils/pagination';
import PermissionAction from '@/components/auth/PermissionAction'
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Banknote, Landmark, FilePlus2 } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { usePermission } from '@/context/PermissionContext';
import { ApiError } from '@/api/client';
import { customersApi, type CustomerResponse } from '@/api/customersApi';
import { debtApi, type DebtAccount, type DebtEntryListItem, type DebtTransaction } from '@/api/debtApi';
import { paymentsApi } from '@/api/paymentsApi';
import type { PagedResult } from '@/api/types';
import PromptModal from '@/components/ui/PromptModal'
import ServerPagination from '@/components/ui/ServerPagination'
import { formatVnd } from '@/utils/money';
import { DEBT_TRANSACTION_LABEL, formatDay, formatDayTime, label, todayVn, useRoleBase } from '@/utils/creditLabels';
import DebtEntriesTable from './DebtEntriesTable'
import DebtEntryModal from './DebtEntryModal'
import CollectCashModal from './CollectCashModal'

const PAGE_SIZE = LIST_PAGE_SIZE
type Tab = 'entries' | 'ledger'

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

function Kpi({ title, value, tone }: { title: string; value: string; tone?: 'danger' }) {
  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
      <div className={`mt-2 text-xl font-bold tabular-nums ${tone === 'danger' ? 'text-rose-600' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

// One customer's debt (FLOW_3 §6–§7): entries + actions, ledger, cash collection, bank transfer, manual entry.
export default function CustomerDebtPage() {
  const { id = '' } = useParams()
  const { showToast } = useToast()
  const { has } = usePermission()
  const base = useRoleBase()

  const [customer, setCustomer] = useState<CustomerResponse | null>(null)
  const [account, setAccount] = useState<DebtAccount | null>(null)
  const [noAccount, setNoAccount] = useState(false)
  const [tab, setTab] = useState<Tab>('entries')
  const [entries, setEntries] = useState<PagedResult<DebtEntryListItem> | null>(null)
  const [openEntries, setOpenEntries] = useState<DebtEntryListItem[]>([])
  const [ledger, setLedger] = useState<PagedResult<DebtTransaction> | null>(null)
  const [entriesPage, setEntriesPage] = useState(1)
  const [ledgerPage, setLedgerPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [modal, setModal] = useState<'cash' | 'bank' | 'manual' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const permission = modal === 'cash' ? 'PAYMENTS.RECEIVE_CASH' : modal === 'bank' ? 'BANK_PAYMENTS.RECORD' : 'DEBT.MANUAL'
    if (modal && !has(permission)) setModal(null)
  }, [has, modal])

  usePageHeader({ title: customer ? `Công nợ — ${customer.fullName}` : 'Công nợ khách hàng', subtitle: 'Khoản nợ, sổ cái và thu nợ' })

  const loadHeader = async () => {
    try {
      const c = await customersApi.getCustomer(id)
      setCustomer(c)
    } catch (err) {
      showToast(errorText(err, 'Không tải được khách hàng'), 'error')
    }
    try {
      setAccount(await debtApi.getCustomerDebt(id))
      setNoAccount(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNoAccount(true)
      else showToast(errorText(err, 'Không tải được sổ nợ'), 'error')
    }
  }

  const loadEntries = async () => {
    setLoading(true)
    try {
      const [page, open] = await Promise.all([
        debtApi.getEntries({ farmerProfileId: id, sortBy: 'DueDate', page: entriesPage, pageSize: PAGE_SIZE }),
        // Open entries for the "choose entries" cash collection.
        debtApi.getEntries({ farmerProfileId: id, sortBy: 'DueDate', pageSize: 100 }),
      ])
      setEntries(page)
      setOpenEntries(open.items.filter((e) => e.outstandingAmount > 0 && e.status !== 'CANCELLED'))
    } catch (err) {
      showToast(errorText(err, 'Không tải được khoản nợ'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadLedger = async () => {
    try {
      setLedger(await debtApi.getTransactions(id, { page: ledgerPage, pageSize: PAGE_SIZE }))
    } catch {
      setLedger(null)
    }
  }

  const refreshAll = () => {
    loadHeader()
    loadEntries()
    if (tab === 'ledger') loadLedger()
  }

  useEffect(() => {
    loadHeader()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    loadEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, entriesPage])

  useEffect(() => {
    if (tab === 'ledger') loadLedger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tab, ledgerPage])

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await action()
      showToast(success, 'success')
      setModal(null)
      refreshAll()
    } catch (err) {
      showToast(errorText(err, 'Thao tác thất bại'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const name = customer?.fullName ?? ''
  const balance = account?.currentBalance ?? 0

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-space-lg p-space-md">
      <Link to={`${base}/debts`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 w-fit">
        <ArrowLeft size={16} /> Danh sách công nợ
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{name || '...'}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {customer?.phoneNumber ?? ''}
            {customer?.customerGroup ? ` · ${customer.customerGroup.name}` : ''}
            {customer?.paymentTermDays != null ? ` · kỳ hạn nợ ${customer.paymentTermDays} ngày` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionAction codes={["PAYMENTS.RECEIVE_CASH"]}><button
            type="button"
            disabled={noAccount || balance <= 0}
            className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
            onClick={() => setModal('cash')}
          >
            <Banknote size={16} /> Thu tiền mặt
          </button></PermissionAction>
          <PermissionAction codes={["BANK_PAYMENTS.RECORD"]}><button
            type="button"
            disabled={noAccount || balance <= 0}
            className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5"
            onClick={() => setModal('bank')}
          >
            <Landmark size={16} /> Ghi nhận chuyển khoản
          </button></PermissionAction>
          <PermissionAction codes={["DEBT.MANUAL"]}>
            <button
              type="button"
              disabled={noAccount}
              className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5"
              onClick={() => setModal('manual')}
            >
              <FilePlus2 size={16} /> Ghi nợ thủ công
            </button>
          </PermissionAction>
        </div>
      </div>

      {noAccount ? (
        <div className="p-6 rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-600 text-center">
          Khách chưa có sổ nợ. Sổ nợ được tạo khi mở tín dụng cho khách (trang Khách hàng → Tín dụng).
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Kpi title="Dư nợ" value={formatVnd(balance)} />
          <Kpi title="Quá hạn" value={formatVnd(account?.overdueAmount ?? 0)} tone={(account?.overdueAmount ?? 0) > 0 ? 'danger' : undefined} />
          <Kpi title="Khoản nợ đang mở" value={String(account?.openEntryCount ?? 0)} />
          <Kpi title="Hạn trả sớm nhất" value={formatDay(account?.oldestDueDate)} />
          <Kpi title="Còn được mua chịu" value={customer ? formatVnd(customer.availableCredit) : '--'} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col">
        <div className="px-4 border-b border-slate-100 flex gap-1" role="tablist">
          {(['entries', 'ledger'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`px-3 py-3 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              onClick={() => setTab(t)}
            >
              {t === 'entries' ? 'Khoản nợ' : 'Sổ cái'}
            </button>
          ))}
        </div>

        {tab === 'entries' ? (
          <>
            <DebtEntriesTable entries={entries?.items ?? []} loading={loading} showCustomer={false} onOpen={(e) => setSelectedEntryId(e.id)} />
            {entries && (
              <ServerPagination page={entriesPage} pageSize={PAGE_SIZE} totalCount={entries.totalCount} totalPages={entries.totalPages} unitLabel="khoản nợ" onPageChange={setEntriesPage} />
            )}
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold text-left">
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-3">Loại</th>
                    <th className="py-3 px-3">Ghi chú</th>
                    <th className="py-3 px-3 text-right">Phát sinh</th>
                    <th className="py-3 px-4 text-right">Dư nợ sau</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {!ledger ? (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-500">Đang tải...</td></tr>
                  ) : ledger.items.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-500">Chưa có bút toán.</td></tr>
                  ) : (
                    ledger.items.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2.5 px-4 whitespace-nowrap">{formatDayTime(t.occurredAt)}</td>
                        <td className="py-2.5 px-3">{label(DEBT_TRANSACTION_LABEL, t.transactionType)}</td>
                        <td className="py-2.5 px-3 text-slate-600">{t.note ?? '--'}</td>
                        <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${t.amountDelta < 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {t.amountDelta > 0 ? '+' : ''}
                          {formatVnd(t.amountDelta)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums">{formatVnd(t.balanceAfter)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {ledger && (
              <ServerPagination page={ledgerPage} pageSize={PAGE_SIZE} totalCount={ledger.totalCount} totalPages={ledger.totalPages} unitLabel="bút toán" onPageChange={setLedgerPage} />
            )}
          </>
        )}
      </div>

      <DebtEntryModal entryId={selectedEntryId} onClose={() => setSelectedEntryId(null)} onChanged={refreshAll} />

      <PermissionAction codes={["PAYMENTS.RECEIVE_CASH"]}><CollectCashModal
        open={modal === 'cash'}
        farmerProfileId={id}
        customerName={name}
        outstanding={balance}
        openEntries={openEntries}
        onClose={() => setModal(null)}
        onCollected={() => {
          setModal(null)
          refreshAll()
        }}
      /></PermissionAction>

      {modal === 'bank' && (
        <PermissionAction codes={["BANK_PAYMENTS.RECORD"]}><PromptModal
          open
          loading={busy}
          title={`Ghi nhận chuyển khoản — ${name}`}
          description="Khoản trả nợ ở trạng thái Chờ xác nhận; chủ cửa hàng đối soát sao kê rồi xác nhận mới trừ nợ (khoản đến hạn trước được trừ trước)."
          fields={[
            { key: 'amount', label: 'Số tiền (đ)', type: 'number', required: true, min: '1' },
            { key: 'paymentDate', label: 'Ngày chuyển', type: 'date' },
            { key: 'reference', label: 'Mã giao dịch / nội dung CK' },
            { key: 'note', label: 'Ghi chú', type: 'textarea' },
          ]}
          initialValues={{ paymentDate: todayVn() }}
          submitLabel="Ghi nhận"
          onClose={() => setModal(null)}
          onSubmit={(v) =>
            run(
              () =>
                paymentsApi.createBankDebtPayment({
                  farmerProfileId: id,
                  amount: Number(v.amount),
                  paymentDate: v.paymentDate || null,
                  reference: v.reference.trim() || null,
                  note: v.note.trim() || null,
                }),
              'Đã ghi nhận chuyển khoản, chờ chủ cửa hàng xác nhận',
            )
          }
        /></PermissionAction>
      )}

      {modal === 'manual' && (
        <PermissionAction codes={["DEBT.MANUAL"]}><PromptModal
          open
          loading={busy}
          title={`Ghi nợ thủ công — ${name}`}
          description="Cách duy nhất để tăng nợ bằng tay (ví dụ nợ cũ chuyển sang hệ thống). Được ghi vào nhật ký."
          fields={[
            { key: 'amount', label: 'Số tiền (đ)', type: 'number', required: true, min: '1' },
            { key: 'dueDate', label: 'Hạn trả', type: 'date', required: true, min: todayVn() },
            { key: 'reason', label: 'Lý do', type: 'textarea', required: true },
          ]}
          submitLabel="Ghi nợ"
          onClose={() => setModal(null)}
          onSubmit={(v) => run(() => debtApi.createManualEntry(id, { amount: Number(v.amount), dueDate: v.dueDate, reason: v.reason.trim() }), 'Đã ghi khoản nợ thủ công')}
        /></PermissionAction>
      )}
    </div>
  )
}
