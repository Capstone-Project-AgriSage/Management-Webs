import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Download, RefreshCw, Receipt } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { usePagination } from '@/hooks/usePagination'
import { downloadCsv } from '@/utils/csv'
import { mockStockMovements as INITIAL_MOVEMENTS } from '@/features/agent/data/mockInventory'

const MOVEMENT_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả loại biến động' },
  { value: 'STOCK_IN', label: 'Nhập kho (STOCK_IN)' },
  { value: 'SALE', label: 'Xuất bán hàng (SALE)' },
  { value: 'ADJUSTMENT', label: 'Điều chỉnh kiểm kê (ADJUSTMENT)' },
]

export default function InventoryMovementsPage() {
  usePageHeader({ title: 'Biến động kho', subtitle: 'Lịch sử nhập/xuất và thay đổi số lượng' })

  const { showToast } = useToast()
  const [stockMovements] = useState(INITIAL_MOVEMENTS)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')

  const keyword = search.trim().toLowerCase()
  const filtered = stockMovements.filter((m) => {
    const matchesSearch =
      !keyword ||
      m.id.toLowerCase().includes(keyword) ||
      m.productName.toLowerCase().includes(keyword) ||
      m.sku.toLowerCase().includes(keyword) ||
      (m.referenceId && m.referenceId.toLowerCase().includes(keyword)) ||
      (m.createdBy && m.createdBy.toLowerCase().includes(keyword)) ||
      (m.note && m.note.toLowerCase().includes(keyword))

    const filterObj = MOVEMENT_TYPE_OPTIONS.find(o => o.label === typeFilter)
    const filterVal = filterObj ? filterObj.value : 'ALL'
    const matchesType = filterVal === 'ALL' || m.movementType === filterVal
    return matchesSearch && matchesType
  })

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filtered, 10)

  const handleExport = () => {
    downloadCsv(
      `so-bien-dong-the-kho-${Date.now()}.csv`,
      filtered.map((m) => ({
        'Mã GD': m.id,
        'Thời gian': m.createdAt,
        'Tên sản phẩm': m.productName,
        'SKU': m.sku,
        'Loại biến động': m.movementType,
        'Biến động': m.quantityChange,
        'Tồn sau': m.balanceAfter,
        'Đơn vị': m.unit,
        'Lý do': m.reason ?? '',
        'Mã tham chiếu': m.referenceId ?? '',
        'Người thực hiện': m.createdBy,
        'Ghi chú': m.note ?? '',
      })),
    )
    showToast(`Đã xuất sổ biến động thẻ kho (${filtered.length} bản ghi)`)
  }

  const handleClearFilters = () => {
    setSearch('')
    setTypeFilter('Tất cả loại biến động')
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Biến động kho</span>
          </nav>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            type="button"
            onClick={handleExport}
          >
            <Download size={16} className="text-slate-500" />
            <span>Xuất thẻ kho CSV</span>
          </button>
        </div>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã GD, sản phẩm, SKU..." className="relative flex-1" />
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterSelect value={typeFilter} onChange={setTypeFilter} options={MOVEMENT_TYPE_OPTIONS.map(o => o.label)} className="relative min-w-[200px]" />
          <button
            className="px-3 py-1.5 h-9 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            type="button"
            onClick={handleClearFilters}
          >
            <RefreshCw size={14} />
            <span>Xóa lọc</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50 text-slate-700">
          <Receipt size={18} className="text-emerald-600" />
          <h2 className="font-semibold text-sm">Lịch sử thẻ kho điện tử (Append-Only)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Mã GD / Thời gian</th>
                <th className="py-3 px-3" scope="col">Sản phẩm &amp; SKU</th>
                <th className="py-3 px-3 text-center" scope="col">Loại biến động</th>
                <th className="py-3 px-3 text-right" scope="col">Biến động</th>
                <th className="py-3 px-3 text-right" scope="col">Tồn sau</th>
                <th className="py-3 px-4" scope="col">Thông tin thêm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không tìm thấy biến động phù hợp với bộ lọc." />
              ) : null}
              {paginated.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-mono font-semibold text-emerald-600 text-[13px]">{m.id}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{m.createdAt}</div>
                  </td>
                  <td className="py-4 px-3">
                    <div className="font-medium text-slate-900">{m.productName}</div>
                    <div className="font-mono text-xs text-slate-500 mt-0.5">{m.sku}</div>
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.movementType === 'STOCK_IN'
                          ? 'bg-emerald-100 text-emerald-700'
                          : m.movementType === 'SALE'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}
                    >
                      {m.movementType === 'STOCK_IN' ? 'NHẬP KHO' : m.movementType === 'SALE' ? 'XUẤT BÁN' : 'ĐIỀU CHỈNH'}
                    </span>
                  </td>
                  <td className="py-4 px-3 text-right">
                    <span className={`font-mono font-bold ${m.quantityChange > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {m.quantityChange > 0 ? '+' : ''}{m.quantityChange}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">{m.unit}</span>
                  </td>
                  <td className="py-4 px-3 text-right font-mono font-bold text-slate-900">
                    {m.balanceAfter} <span className="font-sans font-normal text-xs text-slate-500">{m.unit}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-[11px] text-slate-500">
                      {m.referenceId && <span className="font-mono bg-slate-100 px-1 py-0.5 rounded mr-1">Ref: {m.referenceId}</span>}
                      Bởi: <span className="font-medium text-slate-700">{m.createdBy}</span>
                    </div>
                    {m.note && <div className="text-[11px] text-slate-500 mt-1 line-clamp-2" title={m.note}>{m.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalCount={totalCount}
          unitLabel="bản ghi"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>
    </div>
  )
}
