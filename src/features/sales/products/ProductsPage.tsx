import { useState, useEffect } from 'react'
import { Package, FilterX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import KpiCard from '@/components/ui/KpiCard'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import DetailModal from '@/components/ui/DetailModal'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import SearchInput from '@/components/ui/SearchInput'
import { catalogApi } from '@/api/catalogApi'
import type { CatalogProduct, CatalogProductDetail } from '@/api/types'
import { formatVnd } from '@/utils/money'

export default function ProductsPage() {
  usePageHeader({
    title: 'Danh mục sản phẩm',
    subtitle: 'Tra cứu sản phẩm và giá bán lẻ',
  })

  const { showToast } = useToast()
  const navigate = useNavigate()
  
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  
  const [selectedProduct, setSelectedProduct] = useState<CatalogProductDetail | null>(null)

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true)
      try {
        const res = await catalogApi.getProducts({ search, page, pageSize: 10 })
        setProducts(res.items)
        setTotalCount(res.totalCount)
        setTotalPages(res.totalPages)
      } catch (err: any) {
        // Fallback on error if BE is down
        showToast('Lỗi tải danh mục sản phẩm', 'error')
      } finally {
        setIsLoading(false)
      }
    }
    
    const timer = setTimeout(fetchProducts, 300)
    return () => clearTimeout(timer)
  }, [search, page, showToast])

  const handleClearFilters = () => {
    setSearch('')
    setPage(1)
  }

  const handleViewProductDetail = async (id: string) => {
    try {
      const detail = await catalogApi.getProductDetail(id)
      setSelectedProduct(detail)
    } catch (err) {
      showToast('Lỗi tải chi tiết sản phẩm', 'error')
    }
  }

  const handleAddProductToOrder = () => {
    navigate('/sales/counter-sales')
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      {/* SUMMARY METRIC CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          layout="side"
          icon={Package}
          iconClassName="bg-surface-container-high text-on-surface"
          title="Tổng sản phẩm"
          value={totalCount}
          valueSuffix={<span className="text-xs text-on-surface-variant font-medium">mặt hàng</span>}
          subtitle={`Trong danh mục đang bán`}
        />
      </section>

      {/* FILTER TOOLBAR */}
      <section className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm theo mã SKU, tên sản phẩm..." className="relative flex-1 min-w-[240px]" />
          <button
            className="h-9 px-3 text-on-surface-variant hover:text-on-surface text-xs font-medium flex items-center gap-1 transition-colors"
            onClick={handleClearFilters}
            type="button"
          >
            <FilterX size={14} />
            <span>Đặt lại tìm kiếm</span>
          </button>
        </div>
      </section>

      {/* DATA TABLE */}
      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface text-label-md font-bold bg-surface-container-low">
                <th className="py-4 pl-4 px-3 min-w-[280px]">Mã &amp; Tên sản phẩm</th>
                <th className="py-4 px-3 min-w-[150px] text-center">Giá bán từ</th>
                <th className="py-4 pr-4 pl-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm text-on-surface">
              {isLoading ? (
                <EmptyTableRow colSpan={3} message="Đang tải dữ liệu..." />
              ) : products.length === 0 ? (
                <EmptyTableRow colSpan={3} message="Không tìm thấy sản phẩm phù hợp." />
              ) : null}
              {products.map((product) => {
                return (
                  <tr
                    key={product.id}
                    onClick={() => handleViewProductDetail(product.id)}
                    className={`transition-colors cursor-pointer group hover:bg-surface-container-low`}
                  >
                    <td className="py-4.5 pl-4 px-3">
                      <div className="font-medium text-sm text-on-surface group-hover:text-primary transition-colors">{product.name}</div>
                      <div className="text-xs text-on-surface-variant mt-0.5">{product.sku}</div>
                    </td>
                    <td className="py-4.5 px-3 text-center font-medium font-mono text-primary">
                      {product.fromPrice ? formatVnd(product.fromPrice) : 'Liên hệ'}
                    </td>
                    <td className="py-4.5 pr-4 pl-3 text-center">
                      <div className="flex items-center justify-center">
                        <RowActionsMenu
                          triggerLabel={`Thao tác ${product.name}`}
                          actions={[
                            { label: 'Chi tiết', icon: Package, onClick: () => handleViewProductDetail(product.id) },
                            { label: 'Bán tại quầy', icon: Package, onClick: () => handleAddProductToOrder(), tone: 'primary' }
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          startIndex={(page - 1) * 10}
          endIndex={Math.min(page * 10, totalCount)}
          totalCount={totalCount}
          unitLabel="sản phẩm"
          goPrev={() => setPage(p => Math.max(1, p - 1))}
          goNext={() => setPage(p => Math.min(totalPages, p + 1))}
          setPage={setPage}
        />
      </section>

      {/* DETAIL MODAL */}
      <DetailModal open={selectedProduct !== null} onClose={() => setSelectedProduct(null)}>
        {selectedProduct ? (
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-lg text-on-surface font-bold">{selectedProduct.name}</h3>
              <p className="text-sm text-on-surface-variant mt-1">{selectedProduct.sku}</p>
            </div>
            {selectedProduct.description && (
              <div className="text-sm text-on-surface bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                {selectedProduct.description}
              </div>
            )}
            
            <div className="border-t border-outline-variant pt-4">
              <h4 className="font-bold text-sm mb-3">Các quy cách đóng gói:</h4>
              <div className="space-y-2">
                {selectedProduct.packagings.length === 0 ? (
                  <div className="text-sm text-on-surface-variant italic">Chưa có quy cách</div>
                ) : (
                  selectedProduct.packagings.map((pack) => (
                    <div key={pack.id} className="flex justify-between items-center bg-surface-container-lowest border border-outline-variant p-2.5 rounded-lg shadow-sm">
                      <span className="font-medium text-on-surface">{pack.name}</span>
                      <span className="font-bold text-primary">{pack.price ? formatVnd(pack.price) : 'Liên hệ'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <button
              className="w-full px-3 py-3 mt-2 bg-primary text-on-primary hover:bg-primary/90 rounded-lg text-center font-bold transition-colors shadow-sm"
              onClick={() => {
                handleAddProductToOrder()
                setSelectedProduct(null)
              }}
              type="button"
            >
              Mở trang Bán tại quầy
            </button>
          </div>
        ) : null}
      </DetailModal>
    </div>
  )
}
