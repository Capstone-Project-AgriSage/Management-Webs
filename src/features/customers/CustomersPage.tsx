import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import { LIST_PAGE_SIZE } from '@/utils/pagination';
import PermissionAction from '@/components/auth/PermissionAction'
import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { customersApi, type CustomerResponse, type CustomerSortBy } from '@/api/customersApi';
import { customerGroupsApi, type CustomerGroupResponse } from '@/api/customerGroupsApi';
import { creditTiersApi, type CreditTierResponse } from '@/api/creditTiersApi';
import type { PagedResult } from '@/api/types';

import EmptyTableRow from '@/components/ui/EmptyTableRow'
import StatusBadge from '@/components/ui/StatusBadge'
import ServerPagination from '@/components/ui/ServerPagination'
import { formatVnd } from '@/utils/money';
import { CUSTOMER_STATUS_LABEL, label } from '@/utils/creditLabels';
import CustomerFormModal from './CustomerFormModal'
import CustomerDetailModal from './CustomerDetailModal'
import ListReportCards from '@/features/agent/reports/ListReportCards'

const PAGE_SIZE = LIST_PAGE_SIZE

const SORT_OPTIONS: { value: string; label: string; sortBy: CustomerSortBy; descending: boolean }[] = [
  { value: 'name', label: 'Tên A → Z', sortBy: 'NAME', descending: false },
  { value: 'debt', label: 'Dư nợ cao nhất', sortBy: 'CURRENT_DEBT', descending: true },
  { value: 'orders', label: 'Nhiều đơn nhất', sortBy: 'TOTAL_ORDERS', descending: true },
  { value: 'newest', label: 'Mới tạo gần đây', sortBy: 'CREATED_AT', descending: true },
]



// CUSTOMER_MANAGEMENT.md — registered customers (farmers). Shared by the store owner and sales staff.
export default function CustomersPage() {
  usePageHeader({ title: 'Khách hàng', subtitle: 'Hồ sơ nông dân, nhóm khách, tín dụng và công nợ' })
  const { showToast } = useToast()

  const [data, setData] = useState<PagedResult<CustomerResponse> | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [groupId, setGroupId] = useState('')
  const [debtFilter, setDebtFilter] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('name')

  const [groups, setGroups] = useState<CustomerGroupResponse[]>([])
  const [tiers, setTiers] = useState<CreditTierResponse[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<{ customer: CustomerResponse | null } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    customerGroupsApi.getCustomerGroups({ pageSize: 100 }).then((r) => setGroups(r.items || [])).catch(() => {})
    creditTiersApi.getCreditTiers({ pageSize: 100 }).then((r) => setTiers(r.items || [])).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    setListError(false)
    const s = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0]
    try {
      setData(
        await customersApi.getCustomers({
          search: debouncedSearch || undefined,
          customerGroupId: groupId || undefined,
          status: status || undefined,
          hasDebt: debtFilter === '' ? undefined : debtFilter === 'yes',
          sortBy: s.sortBy,
          descending: s.descending,
          page,
          pageSize: PAGE_SIZE,
        }),
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không tải được danh sách khách hàng', 'error')
      setListError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, groupId, debtFilter, status, sort])

  // Any filter change goes back to the first page.
  useEffect(() => setPage(1), [debouncedSearch, groupId, debtFilter, status, sort])

  const resetFilters = () => {
    setSearch('')
    setGroupId('')
    setDebtFilter('')
    setStatus('')
    setSort('name')
    setPage(1)
  }

  const items = data?.items ?? []

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <ListReportCards title="Tổng hợp khách hàng" totalCount={data?.totalCount ?? null} unit="khách hàng" loading={loading} error={listError} metrics={[
        { label: 'Dư nợ khách hàng', value: items.reduce((sum, item) => sum + item.currentDebt, 0), kind: 'money' },
        { label: 'Nợ quá hạn', value: items.some(item => !item.debtSummary) ? null : items.reduce((sum, item) => sum + (item.debtSummary?.overdueDebt ?? 0), 0), kind: 'money' },
        { label: 'Khách được mua chịu', value: items.filter(item => item.allowCreditPurchase).length },
      ]} />
      <ListToolbar search={{ value: search, onChange: value => { setSearch(value); setPage(1) }, placeholder: "Tìm theo tên hoặc số điện thoại..." }} onClear={resetFilters} actions={<><PermissionAction codes={["CUSTOMERS.CREATE"]}><button type="button" className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center gap-1.5" onClick={() => setForm({ customer: null })}>
            <UserPlus size={16} /> Thêm khách hàng
          </button></PermissionAction></>}>
        <FilterSelect label="Nhóm khách hàng" value={groupId} onChange={value => { setGroupId(value); setPage(1) }} options={[{ value: '', label: 'Tất cả nhóm' }, ...groups.map(group => ({ value: group.id, label: group.name }))]} />
        <FilterSelect label="Công nợ" value={debtFilter} onChange={value => { setDebtFilter(value); setPage(1) }} options={[{ value: '', label: 'Mọi công nợ' }, { value: 'yes', label: 'Đang có nợ' }, { value: 'no', label: 'Không có nợ' }]} />
        <FilterSelect label="Trạng thái" value={status} onChange={value => { setStatus(value); setPage(1) }} options={[{ value: '', label: 'Mọi trạng thái' }, ...Object.entries(CUSTOMER_STATUS_LABEL).map(([value, text]) => ({ value, label: text }))]} />
        <FilterSelect label="Sắp xếp" value={sort} onChange={value => { setSort(value); setPage(1) }} options={SORT_OPTIONS} />
      </ListToolbar>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Khách hàng</th>
                <th className="py-3 px-3" scope="col">Nhóm</th>
                <th className="py-3 px-3 text-right" scope="col">Đơn / Đã mua</th>
                <th className="py-3 px-3 text-right" scope="col">Dư nợ</th>
                <th className="py-3 px-3 text-right" scope="col">Còn được mua chịu</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {loading && !data ? (
                <EmptyTableRow colSpan={6} message="Đang tải dữ liệu..." />
              ) : items.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không tìm thấy khách hàng nào." />
              ) : (
                items.map((c) => {
                  const overdue = c.debtSummary?.overdueDebt ?? 0
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedId(c.id)}>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{c.fullName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{c.phoneNumber ?? c.email ?? '--'}</div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">{c.customerGroup?.name ?? 'Nhóm mặc định'}</td>
                      <td className="py-3.5 px-3 text-right tabular-nums">
                        <div>{c.totalOrders} đơn</div>
                        <div className="text-xs text-slate-500">{formatVnd(c.totalPurchaseAmount)}</div>
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums">
                        <div className={c.currentDebt > 0 ? 'font-semibold text-slate-900' : 'text-slate-400'}>{formatVnd(c.currentDebt)}</div>
                        {overdue > 0 && <div className="text-xs font-medium text-rose-600">Quá hạn {formatVnd(overdue)}</div>}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums">
                        {c.allowCreditPurchase ? (
                          <>
                            <div className={c.availableCredit < 0 ? 'text-rose-600 font-semibold' : 'text-emerald-700 font-semibold'}>{formatVnd(c.availableCredit)}</div>
                            <div className="text-xs text-slate-500">/ {formatVnd(c.creditLimit)}</div>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Không mua chịu</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <StatusBadge label={label(CUSTOMER_STATUS_LABEL, c.status)} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {data && (
          <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={data.totalCount} totalPages={data.totalPages} unitLabel="khách hàng" onPageChange={setPage} />
        )}
      </div>

      <CustomerDetailModal
        customerId={selectedId}
        groups={groups}
        tiers={tiers}
        onClose={() => setSelectedId(null)}
        onEdit={(customer) => setForm({ customer })}
        onChanged={load}
      />

      <CustomerFormModal
        open={form !== null}
        customer={form?.customer ?? null}
        groups={groups}
        tiers={tiers}
        onClose={() => setForm(null)}
        onSaved={(saved) => {
          const wasCreate = form?.customer === null
          setForm(null)
          load()
          if (wasCreate) setSelectedId(saved.id)
          else {
            // Re-open the detail so it shows the saved values.
            setSelectedId(null)
            setTimeout(() => setSelectedId(saved.id), 0)
          }
        }}
      />
    </div>
  )
}
