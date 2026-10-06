import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { debtApi, type DebtAccountResponse } from '@/api/debtApi'
import { formatVnd } from '@/utils/money'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { Wallet, AlertTriangle } from 'lucide-react'

const FILTER_OPTIONS = ['Tất cả', 'Có dư nợ', 'Có nợ quá hạn']

export default function DebtAccountsPage() {
  usePageHeader({
    title: 'Sổ Nợ Khách Hàng',
    subtitle: 'Quản lý dư nợ, xem chi tiết và thu nợ'
  })

  const { showToast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DebtAccountResponse[]>([])
  
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(FILTER_OPTIONS[0])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 15

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter, search])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await debtApi.getDebtAccounts({
        page,
        pageSize,
        search: search || undefined,
        hasOverdue: filter === 'Có nợ quá hạn' ? true : undefined
      })
      // If 'Có dư nợ' is selected, API should ideally support it. For now, filter client-side if API doesn't support it directly or assume API handles it.
      // Since our simple API mock takes hasOverdue, we will filter client side if 'Có dư nợ'
      let items = res.items || []
      if (filter === 'Có dư nợ') {
        items = items.filter(i => i.outstandingReceivable > 0)
      }
      
      setData(items)
      setTotalCount(res.totalCount || 0)
    } catch (err: any) {
      showToast(err.message || 'Lỗi tải danh sách sổ nợ', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusVisuals = (status?: string | null) => {
    switch (status) {
      case 'NORMAL': return { label: 'Bình thường', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'WARNING': return { label: 'Cảnh báo', className: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'OVERDUE': return { label: 'Quá hạn', className: 'bg-rose-50 text-rose-700 border-rose-200' }
      case 'SUSPENDED': return { label: 'Đã khoá', className: 'bg-slate-100 text-slate-700 border-slate-300' }
      default: return { label: status || 'Bình thường', className: 'bg-slate-50 text-slate-700' }
    }
  }

  const handleRowClick = (id: string) => {
    navigate(`/debt/${id}`)
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm theo tên KH, mã KH..."
            className="relative min-w-[220px] flex-1 max-w-xs"
          />
          <FilterSelect value={filter} onChange={setFilter} options={FILTER_OPTIONS} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-sm font-bold bg-slate-50/50">
                <th className="py-4 px-4">Khách hàng</th>
                <th className="py-4 px-4">Liên hệ</th>
                <th className="py-4 px-4 text-right">Hạn mức</th>
                <th className="py-4 px-4 text-right">Dư nợ (Phải thu)</th>
                <th className="py-4 px-4 text-right">Nợ quá hạn</th>
                <th className="py-4 px-4 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {loading ? (
                <EmptyTableRow colSpan={6} message="Đang tải dữ liệu..." />
              ) : data.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không có dữ liệu sổ nợ." />
              ) : (
                data.map(item => {
                  const sv = getStatusVisuals(item.status)
                  return (
                    <tr 
                      key={item.customerId} 
                      onClick={() => handleRowClick(item.customerId)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900">{item.customerName}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{item.customerCode}</div>
                      </td>
                      <td className="py-4 px-4 text-slate-600 font-mono text-xs">{item.customerPhone}</td>
                      <td className="py-4 px-4 text-right font-medium text-slate-700">{formatVnd(item.creditLimit)}</td>
                      <td className="py-4 px-4 text-right font-bold text-rose-600">{formatVnd(item.outstandingReceivable)}</td>
                      <td className="py-4 px-4 text-right">
                        {item.totalOverdueAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <AlertTriangle size={12} />
                            {formatVnd(item.totalOverdueAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <StatusBadge label={sv.label} className={sv.className} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && data.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            startIndex={(page - 1) * pageSize + 1}
            endIndex={Math.min(page * pageSize, totalCount)}
            totalCount={totalCount}
            unitLabel="Sổ nợ"
            goPrev={() => setPage(p => Math.max(1, p - 1))}
            goNext={() => setPage(p => Math.min(totalPages, p + 1))}
            setPage={setPage}
          />
        )}
      </div>
    </div>
  )
}
