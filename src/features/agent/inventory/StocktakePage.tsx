import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText, CheckCircle2, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import SearchInput from '@/components/ui/SearchInput'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { usePagination } from '@/hooks/usePagination'
import { inventoryItems as INITIAL_INVENTORY } from '@/features/agent/data/mockInventory'

export default function StocktakePage() {
  usePageHeader({ title: 'Kiểm kê kho', subtitle: 'Kiểm tra và cân bằng số liệu' })

  const { showToast } = useToast()
  const [inventory] = useState(INITIAL_INVENTORY)
  const [search, setSearch] = useState('')

  const keyword = search.trim().toLowerCase()
  const filtered = inventory.filter((item) =>
    !keyword ||
    item.name.toLowerCase().includes(keyword) ||
    item.sku.toLowerCase().includes(keyword)
  )

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } =
    usePagination(filtered, 10)

  const handleAdjustClick = (name: string) => {
    showToast(`Bắt đầu quy trình kiểm đếm cho: ${name}`)
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Kiểm kê kho</span>
          </nav>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            type="button"
            onClick={() => showToast('Đã bắt đầu kỳ kiểm kê mới')}
          >
            <FileText size={16} />
            <span>Tạo kỳ kiểm kê mới</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trạng thái kỳ kiểm kê</span>
            <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">Hoàn tất</div>
            <div className="mt-1 text-xs text-slate-500">Kỳ kiểm kê tháng 10/2026</div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mặt hàng sai lệch</span>
            <div className="p-2.5 bg-rose-50 rounded-lg text-rose-500">
              <SlidersHorizontal size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600 tabular-nums">3</div>
            <div className="mt-1 text-xs text-slate-500">Đã được hiệu chỉnh</div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nhân viên phụ trách</span>
            <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600">
              <FileText size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-slate-900">TK. Lê Hoàng Nam</div>
            <div className="mt-1 text-xs text-slate-500">Ngày chốt: Hôm nay</div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm sản phẩm cần kiểm đếm..." className="relative flex-1" />
        <button
          className="px-3 py-1.5 h-9 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shrink-0"
          type="button"
          onClick={() => setSearch('')}
        >
          <RefreshCw size={14} />
          <span>Làm mới</span>
        </button>
      </div>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Sản phẩm &amp; Mã</th>
                <th className="py-3 px-3 text-center" scope="col">Tồn kho HT</th>
                <th className="py-3 px-3 text-center" scope="col">Thực tế đếm</th>
                <th className="py-3 px-3 text-center" scope="col">Lệch</th>
                <th className="py-3 px-4 text-center w-28" scope="col">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Không tìm thấy sản phẩm." />
              ) : null}
              {paginated.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="font-mono text-xs text-slate-500 mt-0.5">{item.sku}</div>
                  </td>
                  <td className="py-4 px-3 text-center font-mono font-bold text-slate-900">
                    {item.stockQuantity} <span className="font-sans font-normal text-xs text-slate-500">{item.unit}</span>
                  </td>
                  <td className="py-4 px-3 text-center text-slate-400 italic">
                    Chưa đếm
                  </td>
                  <td className="py-4 px-3 text-center text-slate-400">
                    -
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-emerald-600 text-[11px] font-semibold rounded hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                      onClick={() => handleAdjustClick(item.name)}
                    >
                      <SlidersHorizontal size={14} />
                      Kiểm đếm
                    </button>
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
          unitLabel="sản phẩm"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </div>
    </div>
  )
}
