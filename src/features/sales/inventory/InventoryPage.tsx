import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, PackageSearch, PackageOpen, AlertTriangle } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { inventoryApi } from '@/api/inventoryApi'
import { catalogApi } from '@/api/catalogApi'
import type { InventoryLot, CatalogProduct } from '@/api/types'

interface GroupedInventory {
  storeProductId: string
  productName: string
  totalOnHand: number
  totalReserved: number
  totalAvailable: number
  lots: InventoryLot[]
}

export default function InventoryPage() {
  usePageHeader({ title: 'Tra cứu tồn kho', subtitle: 'Kiểm tra hàng hóa tại kho đại lý' })
  const { showToast } = useToast()

  const [lots, setLots] = useState<InventoryLot[]>([])
  const [productsMap, setProductsMap] = useState<Record<string, CatalogProduct>>({})
  
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Giảm pageSize để không bị 400 Bad Request
      const lotsRes = await inventoryApi.getLots({ page, pageSize: 100, search })
      
      let pMap: Record<string, CatalogProduct> = {}
      try {
        const productsRes = await catalogApi.getProducts({ page: 1, pageSize: 100 }) 
        productsRes.items.forEach(p => { pMap[p.id] = p })
      } catch (err) {
        // Lỗi gọi Catalog không làm chết màn hình kho
        console.warn("Lỗi lấy danh sách sản phẩm:", err)
      }
      
      setProductsMap(pMap)
      setLots(lotsRes.items)
      setTotalCount(lotsRes.totalCount)
      setTotalPages(lotsRes.totalPages)
    } catch (err: any) {
      if (err.errors) {
        showToast(Object.values(err.errors).flat().join(', '), 'error')
      } else {
        showToast(err.detail || err.title || 'Lỗi tải dữ liệu kho', 'error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(fetchData, 300)
    return () => clearTimeout(timer)
  }, [page, search])

  // Group lots by storeProductId
  const groupedInventory = useMemo(() => {
    const map = new Map<string, GroupedInventory>()
    
    lots.forEach(lot => {
      if (!map.has(lot.storeProductId)) {
        map.set(lot.storeProductId, {
          storeProductId: lot.storeProductId,
          productName: lot.productName || productsMap[lot.storeProductId]?.name || 'Sản phẩm không rõ',
          totalOnHand: 0,
          totalReserved: 0,
          totalAvailable: 0,
          lots: []
        })
      }
      
      const group = map.get(lot.storeProductId)!
      group.lots.push(lot)
      group.totalOnHand += lot.quantityOnHand
      group.totalReserved += lot.quantityReserved
      group.totalAvailable += lot.quantityAvailable
    })
    
    return Array.from(map.values())
  }, [lots, productsMap])

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1 text-body-sm text-on-surface-variant" aria-label="Breadcrumb">
          <Link className="hover:text-primary transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-on-surface font-medium">Tồn kho</span>
        </nav>
      </div>

      <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm flex flex-wrap items-center justify-between gap-4 mt-2">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput 
            value={search} 
            onChange={(val) => { setSearch(val); setPage(1) }} 
            placeholder="Tìm theo mã lô..." 
            className="relative flex-1 min-w-[240px]" 
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="overflow-x-auto p-4 space-y-6">
          {isLoading ? (
            <div className="py-10 text-center text-on-surface-variant animate-pulse">Đang tải dữ liệu tồn kho...</div>
          ) : groupedInventory.length === 0 ? (
            <div className="py-10 text-center text-on-surface-variant">Không có dữ liệu tồn kho.</div>
          ) : (
            groupedInventory.map(group => (
              <div key={group.storeProductId} className="border border-outline-variant rounded-xl overflow-hidden bg-surface shadow-sm">
                <div className="bg-surface-container-low p-4 flex flex-col md:flex-row md:items-center justify-between border-b border-outline-variant gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                      <PackageOpen size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface text-lg">{group.productName}</h3>
                      <div className="text-xs text-on-surface-variant mt-1 flex gap-4">
                        <span>Tồn thực tế: <strong className="text-on-surface">{group.totalOnHand}</strong></span>
                        <span>Đã giữ (chờ giao): <strong className="text-amber-600">{group.totalReserved}</strong></span>
                        <span>Khả dụng (có thể bán): <strong className="text-emerald-600">{group.totalAvailable}</strong></span>
                      </div>
                    </div>
                  </div>
                  {group.totalAvailable <= 0 && (
                    <div className="bg-rose-100 text-rose-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <AlertTriangle size={14} /> HẾT HÀNG
                    </div>
                  )}
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-container-lowest text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                      <tr>
                        <th className="py-3 px-4 font-medium">Số lô</th>
                        <th className="py-3 px-3 font-medium text-center">Hạn dùng</th>
                        <th className="py-3 px-3 font-medium text-right">Tồn khả dụng</th>
                        <th className="py-3 px-4 font-medium text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50 text-sm">
                      {group.lots.map(lot => (
                        <tr key={lot.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-on-surface">{lot.lotNumber || 'Không có'}</td>
                          <td className="py-3 px-3 text-center">
                            {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-on-surface">{lot.quantityAvailable}</td>
                          <td className="py-3 px-4 text-center">
                            {lot.isExpired ? (
                              <span className="bg-rose-100 text-rose-700 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Hết hạn</span>
                            ) : lot.status === 'BLOCKED' || lot.status === 'QUARANTINED' ? (
                              <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Đang khóa</span>
                            ) : lot.quantityAvailable > 0 ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Bán tốt</span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Hết lô</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* We use the paginated count of lots, not grouped products, because the API paginates lots */}
        <Pagination
          page={page}
          totalPages={totalPages}
          startIndex={(page - 1) * 100}
          endIndex={Math.min(page * 100, totalCount)}
          totalCount={totalCount}
          unitLabel="lô hàng"
          goPrev={() => setPage(p => Math.max(1, p - 1))}
          goNext={() => setPage(p => Math.min(totalPages, p + 1))}
          setPage={setPage}
        />
      </div>
    </div>
  )
}
