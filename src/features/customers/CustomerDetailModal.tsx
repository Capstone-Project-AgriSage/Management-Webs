import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DetailModal from '@/components/ui/DetailModal'
import StatusBadge from '@/components/ui/StatusBadge'
import ServerPagination from '@/components/ui/ServerPagination'
import PromptModal from '@/components/ui/PromptModal'
import { customersApi, type CustomerOrder, type CustomerPayment, type CustomerResponse, type CustomerStatus, type GroupAssignment } from '@/api/customersApi'
import type { CustomerGroupResponse } from '@/api/customerGroupsApi'
import type { CreditTierResponse } from '@/api/creditTiersApi'
import type { PagedResult } from '@/api/types'
import { useToast } from '@/context/ToastContext'
import { usePermission } from '@/context/PermissionContext'
import { formatVnd } from '@/utils/money'
import {
  CUSTOMER_STATUS_LABEL,
  ORDER_PAYMENT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  formatDay,
  formatDayTime,
  label,
  useRoleBase,
} from '@/utils/creditLabels'
import CreditPanel from './CreditPanel'

type Tab = 'overview' | 'credit' | 'group' | 'orders' | 'payments'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'credit', label: 'Tín dụng' },
  { key: 'group', label: 'Nhóm khách' },
  { key: 'orders', label: 'Đơn hàng' },
  { key: 'payments', label: 'Thanh toán nợ' },
]

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị',
  READY_FOR_FULFILLMENT: 'Sẵn sàng giao',
  PARTIALLY_FULFILLED: 'Giao một phần',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  PARTIALLY_CANCELLED: 'Hủy một phần',
}

const PAGE_SIZE = 10
const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

interface CustomerDetailModalProps {
  customerId: string | null
  groups: CustomerGroupResponse[]
  tiers: CreditTierResponse[]
  onClose: () => void
  onEdit: (customer: CustomerResponse) => void
  /** Any change (group, credit, status) — the list refreshes the row. */
  onChanged: () => void
}

function Stat({ title, value, tone }: { title: string; value: string; tone?: 'danger' }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`mt-1 text-sm font-bold tabular-nums ${tone === 'danger' ? 'text-rose-600' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

export default function CustomerDetailModal({ customerId, groups, tiers, onClose, onEdit, onChanged }: CustomerDetailModalProps) {
  const { showToast } = useToast()
  const { has } = usePermission()
  const base = useRoleBase()
  const [tab, setTab] = useState<Tab>('overview')
  const [customer, setCustomer] = useState<CustomerResponse | null>(null)
  const [groupHistory, setGroupHistory] = useState<GroupAssignment[]>([])
  const [orders, setOrders] = useState<PagedResult<CustomerOrder> | null>(null)
  const [payments, setPayments] = useState<PagedResult<CustomerPayment> | null>(null)
  const [ordersPage, setOrdersPage] = useState(1)
  const [paymentsPage, setPaymentsPage] = useState(1)
  const [prompt, setPrompt] = useState<'group' | 'status' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (prompt && !has(prompt === 'status' ? 'CUSTOMERS.STATUS' : 'CUSTOMERS.UPDATE')) setPrompt(null)
  }, [has, prompt])

  const loadCustomer = async (id: string) => {
    try {
      setCustomer(await customersApi.getCustomer(id))
    } catch (err) {
      showToast(errorText(err, 'Không tải được khách hàng'), 'error')
      onClose()
    }
  }

  useEffect(() => {
    setPrompt(null)
    if (!customerId) return
    setTab('overview')
    setCustomer(null)
    setOrders(null)
    setPayments(null)
    setOrdersPage(1)
    setPaymentsPage(1)
    loadCustomer(customerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  useEffect(() => {
    if (!customerId) return
    if (tab === 'group') customersApi.getGroupHistory(customerId).then(setGroupHistory).catch(() => setGroupHistory([]))
    if (tab === 'orders') customersApi.getOrders(customerId, { page: ordersPage, pageSize: PAGE_SIZE }).then(setOrders).catch(() => setOrders(null))
    if (tab === 'payments') customersApi.getPayments(customerId, { page: paymentsPage, pageSize: PAGE_SIZE }).then(setPayments).catch(() => setPayments(null))
  }, [customerId, tab, ordersPage, paymentsPage])

  const refresh = () => {
    if (customerId) loadCustomer(customerId)
    onChanged()
  }

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await action()
      showToast(success, 'success')
      setPrompt(null)
      refresh()
      if (customerId && tab === 'group') customersApi.getGroupHistory(customerId).then(setGroupHistory).catch(() => { })
    } catch (err) {
      showToast(errorText(err, 'Thao tác thất bại'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const c = customer
  const debt = c?.debtSummary

  return (
    <DetailModal open={customerId !== null} onClose={onClose} widthClassName="max-w-3xl">
      {!c ? (
        <ModalLayout bodyClassName="space-y-4">Đang tải...
        </ModalLayout>
      ) : (
        <ModalLayout header={<div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{c.fullName}</h3>
            <div className="text-sm text-slate-600 mt-0.5">
              {c.phoneNumber ?? '--'}
              {c.email ? ` · ${c.email}` : ''}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <StatusBadge label={label(CUSTOMER_STATUS_LABEL, c.status)} />
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{c.customerGroup?.name ?? 'Nhóm mặc định'}</span>
              {c.allowCreditPurchase && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Được mua chịu</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PermissionAction codes={["CUSTOMERS.UPDATE"]}><button type="button" className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50" onClick={() => onEdit(c)}>
              Sửa thông tin
            </button></PermissionAction>
            <PermissionAction codes={["CUSTOMERS.STATUS"]}>
              <button type="button" className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50" onClick={() => setPrompt('status')}>
                Đổi trạng thái
              </button>
            </PermissionAction>
            <PermissionAction codes={["DEBT.READ"]}>
            <Link to={`${base}/debts/${c.id}`} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
              Công nợ
            </Link>
            </PermissionAction>
          </div>
        </div>} bodyClassName="space-y-4"><div className="px-5 border-b border-slate-100 flex gap-1 overflow-x-auto" role="tablist">
            {TABS.filter(t => t.key !== 'credit' || has('CREDIT.READ')).map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === t.key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div><div className="p-5 overflow-y-auto">
            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Stat title="Đơn hàng" value={String(c.totalOrders)} />
                  <Stat title="Đã mua (hoàn thành)" value={formatVnd(c.totalPurchaseAmount)} />
                  <Stat title="Dư nợ" value={formatVnd(c.currentDebt)} tone={c.currentDebt > 0 ? 'danger' : undefined} />
                  <Stat title="Quá hạn" value={formatVnd(debt?.overdueDebt ?? 0)} tone={(debt?.overdueDebt ?? 0) > 0 ? 'danger' : undefined} />
                  <Stat title="Hạn mức" value={formatVnd(c.creditLimit)} />
                  <Stat title="Đang giữ cho đơn" value={formatVnd(c.reservedCredit)} />
                  <Stat title="Còn được mua chịu" value={formatVnd(c.availableCredit)} tone={c.availableCredit < 0 ? 'danger' : undefined} />
                  <Stat title="Kỳ hạn nợ" value={c.paymentTermDays != null ? `${c.paymentTermDays} ngày` : '--'} />
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Địa chỉ mặc định</dt>
                    <dd className="text-slate-800">
                      {c.address?.addressLine
                        ? [c.address.addressLine, c.address.ward, c.address.district, c.address.province].filter(Boolean).join(', ')
                        : '--'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Khách từ</dt>
                    <dd className="text-slate-800">{formatDay(c.createdAt)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Ghi chú</dt>
                    <dd className="text-slate-800 whitespace-pre-line">{c.notes || '--'}</dd>
                  </div>
                </dl>
              </div>
            )}

            {tab === 'credit' && <PermissionAction codes={['CREDIT.READ']}><CreditPanel farmerProfileId={c.id} tiers={tiers} onChanged={refresh} /></PermissionAction>}

            {tab === 'group' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-700">
                    Nhóm hiện tại: <strong>{c.customerGroup?.name ?? 'Nhóm mặc định'}</strong>
                  </p>
                  <PermissionAction codes={["CUSTOMERS.UPDATE"]}><button type="button" className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50" onClick={() => setPrompt('group')}>
                    Chuyển nhóm
                  </button></PermissionAction>
                </div>
                <p className="text-xs text-slate-500">Chuyển nhóm đổi bảng giá áp dụng; nếu khách có hồ sơ tín dụng, hạng tín dụng theo nhóm mới (hạn mức giữ nguyên).</p>
                {groupHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa từng chuyển nhóm (đang thuộc nhóm mặc định hoặc nhóm khi tạo).</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                    {groupHistory.map((h) => (
                      <li key={h.id} className="px-3 py-2">
                        <div className="flex justify-between gap-3">
                          <span className="font-medium">{h.customerGroup.name}</span>
                          <span className="text-xs text-slate-500">
                            {formatDay(h.effectiveFrom)} → {h.effectiveTo ? formatDay(h.effectiveTo) : 'nay'}
                          </span>
                        </div>
                        {h.reason && <div className="text-xs text-slate-500 mt-0.5">{h.reason}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'orders' && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Mã đơn</th>
                      <th className="text-left px-3 py-2 font-semibold">Ngày</th>
                      <th className="text-right px-3 py-2 font-semibold">Tổng tiền</th>
                      <th className="text-left px-3 py-2 font-semibold">Thanh toán</th>
                      <th className="text-left px-3 py-2 font-semibold">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!orders ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Đang tải...</td></tr>
                    ) : orders.items.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Khách chưa có đơn hàng.</td></tr>
                    ) : (
                      orders.items.map((o) => (
                        <tr key={o.orderId}>
                          <td className="px-3 py-2 font-mono">{o.orderNumber}</td>
                          <td className="px-3 py-2">{formatDay(o.orderDate)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatVnd(o.totalAmount)}</td>
                          <td className="px-3 py-2">
                            {label(ORDER_PAYMENT_STATUS_LABEL, o.paymentStatus)}
                            {o.paymentMethods.length > 0 && <span className="text-xs text-slate-500"> · {o.paymentMethods.map((m) => label(PAYMENT_METHOD_LABEL, m)).join(', ')}</span>}
                          </td>
                          <td className="px-3 py-2">{label(ORDER_STATUS_LABEL, o.orderStatus)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {orders && orders.totalCount > PAGE_SIZE && (
                  <ServerPagination page={ordersPage} pageSize={PAGE_SIZE} totalCount={orders.totalCount} totalPages={orders.totalPages} unitLabel="đơn" onPageChange={setOrdersPage} />
                )}
              </div>
            )}

            {tab === 'payments' && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Phiếu thu</th>
                      <th className="text-left px-3 py-2 font-semibold">Ngày</th>
                      <th className="text-right px-3 py-2 font-semibold">Số tiền</th>
                      <th className="text-left px-3 py-2 font-semibold">Trừ vào khoản nợ</th>
                      <th className="text-left px-3 py-2 font-semibold">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!payments ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Đang tải...</td></tr>
                    ) : payments.items.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Chưa có lần trả nợ nào.</td></tr>
                    ) : (
                      payments.items.map(({ payment: p, debtEntries }) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2">
                            <div className="font-mono">{p.paymentNumber}</div>
                            <div className="text-xs text-slate-500">{label(PAYMENT_METHOD_LABEL, p.paymentMethod)}</div>
                          </td>
                          <td className="px-3 py-2">{formatDayTime(p.confirmedAt ?? p.initiatedAt)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatVnd(p.amount)}</td>
                          <td className="px-3 py-2 text-xs">
                            {debtEntries.length ? debtEntries.map((a) => `${a.entryNumber ?? '--'}: ${formatVnd(a.allocatedAmount)}`).join(' · ') : '--'}
                          </td>
                          <td className="px-3 py-2">{label(PAYMENT_STATUS_LABEL, p.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {payments && payments.totalCount > PAGE_SIZE && (
                  <ServerPagination page={paymentsPage} pageSize={PAGE_SIZE} totalCount={payments.totalCount} totalPages={payments.totalPages} unitLabel="phiếu" onPageChange={setPaymentsPage} />
                )}
              </div>
            )}
          </div>
        </ModalLayout>
      )}

      {c && prompt === 'group' && (
        <PermissionAction codes={["CUSTOMERS.UPDATE"]}><PromptModal
          open
          loading={busy}
          title={`Chuyển nhóm cho ${c.fullName}`}
          fields={[
            {
              key: 'customerGroupId',
              label: 'Nhóm mới',
              type: 'select',
              required: true,
              options: groups.filter((g) => g.isActive).map((g) => ({ value: g.id, label: `${g.name}${g.defaultCreditTier ? ` · hạng ${g.defaultCreditTier.name}` : ''}` })),
            },
            { key: 'reason', label: 'Lý do', type: 'textarea' },
          ]}
          initialValues={{ customerGroupId: c.customerGroup?.id ?? '' }}
          submitLabel="Chuyển nhóm"
          onClose={() => setPrompt(null)}
          onSubmit={(v) => run(() => customersApi.assignGroup(c.id, v.customerGroupId, v.reason.trim()), 'Đã chuyển nhóm khách')}
        /></PermissionAction>
      )}

      {c && prompt === 'status' && (
        <PermissionAction codes={["CUSTOMERS.STATUS"]}><PromptModal
          open
          loading={busy}
          title={`Trạng thái tài khoản — ${c.fullName}`}
          fields={[
            {
              key: 'status',
              label: 'Trạng thái',
              type: 'select',
              required: true,
              options: Object.entries(CUSTOMER_STATUS_LABEL).map(([value, text]) => ({ value, label: text })),
            },
          ]}
          initialValues={{ status: c.status }}
          submitLabel="Lưu"
          onClose={() => setPrompt(null)}
          onSubmit={(v) => run(() => customersApi.setStatus(c.id, v.status as CustomerStatus), 'Đã đổi trạng thái khách')}
        /></PermissionAction>
      )}
    </DetailModal>
  )
}
