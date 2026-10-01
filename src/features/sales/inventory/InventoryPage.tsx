import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, PackageSearch } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { inventoryItems as INITIAL_INVENTORY } from '@/features/agent/data/mockInventory'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

export default function InventoryPage() {
  usePageHeader({ title: 'Tra cứu tồn kho', subtitle: 'Kiểm tra hàng hóa tại kho đại lý' })
  const [items] = useState(INITIAL_INVENTORY)
  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(items, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/sales">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Tồn kho</span>
      </nav>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4">Tên sản phẩm</th>
                <th className="py-3 px-3 text-right">Tồn kho</th>
                <th className="py-3 px-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-4 px-4 font-medium">{item.name}</td>
                  <td className="py-4 px-3 text-right font-mono font-semibold">{item.stockQuantity}</td>
                  <td className="py-4 px-3">
                    <span className={`text-xs font-bold ${item.stockLabel === 'Tồn kho tốt' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.stockLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="sản phẩm" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
