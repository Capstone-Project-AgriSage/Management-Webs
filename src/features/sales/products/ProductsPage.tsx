import { useState } from 'react'
import { Package, CheckCircle2, AlertTriangle, Ban, FilterX } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import KpiCard from '@/components/ui/KpiCard'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import DetailModal from '@/components/ui/DetailModal'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import StatusBadge from '@/components/ui/StatusBadge'
import { useSelectableList } from '@/hooks/useSelectableList'
import { useFilteredList } from '@/hooks/useFilteredList'
import { usePagination } from '@/hooks/usePagination'
import { products as PRODUCTS } from '@/features/sales/data/mockProducts'

const CATEGORY_OPTIONS = ['Tất cả danh mục', ...new Set(PRODUCTS.map((p) => p.categoryLabel))]
const STOCK_OPTIONS = ['Tất cả tồn kho', 'Còn hàng', 'Sắp hết', 'Hết hàng']

export default function ProductsPage() {
  usePageHeader({
    title: 'Sản phẩm',
    subtitle: 'Tra cứu giá bán, tồn kho khả dụng và thêm vào đơn tại quầy',
  })

  const { showToast } = useToast()
  const { selectedId, setSelectedId, selected: selectedProduct } = useSelectableList(PRODUCTS, (p) => p.id)

  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_OPTIONS[0])

  const {
    search,
    setSearch,
    statusFilter: stockFilter,
    setStatusFilter: setStockFilter,
    filtered: filteredProducts,
    clearFilters: handleClearFiltersBase,
  } = useFilteredList(
    PRODUCTS,
    STOCK_OPTIONS[0],
    (product, keyword, stockFilter) =>
      (!keyword || product.name.toLowerCase().includes(keyword) || product.description.toLowerCase().includes(keyword)) &&
      (categoryFilter === CATEGORY_OPTIONS[0] || product.categoryLabel === categoryFilter) &&
      (stockFilter === STOCK_OPTIONS[0] || product.stockLabel === stockFilter),
  )

  const handleClearFilters = () => {
    handleClearFiltersBase()
    setCategoryFilter(CATEGORY_OPTIONS[0])
  }

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(filteredProducts, 10)

  const handleViewProductDetail = (id: string) => {
    setSelectedId(id)
  }

  const handleAddProductToOrder = (id: string) => {
    const product = PRODUCTS.find((p) => p.id === id)
    if (product) {
      showToast(`Đã thêm ${product.name} vào đơn tại quầy`)
    }
  }

  const totalCountAll = PRODUCTS.length
  const inStockCount = PRODUCTS.filter((p) => p.stockLabel === 'Còn hàng').length
  const lowStockCount = PRODUCTS.filter((p) => p.stockLabel === 'Sắp hết').length
  const outOfStockCount = PRODUCTS.filter((p) => p.stockLabel === 'Hết hàng').length

  return (
    <>
      {/* SUMMARY METRIC CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          layout="side"
          icon={Package}
          iconClassName="bg-slate-100 text-slate-600"
          title="Tổng sản phẩm"
          value={totalCountAll}
          valueSuffix={<span className="text-xs text-slate-500 font-medium">mặt hàng</span>}
          subtitle={`${CATEGORY_OPTIONS.length - 1} danh mục`}
        />
        <KpiCard
          layout="side"
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-600"
          title="Còn hàng"
          value={inStockCount}
          valueClassName="text-emerald-700"
          subtitle="Sẵn sàng bán tại quầy"
        />
        <KpiCard
          layout="side"
          icon={AlertTriangle}
          iconClassName="bg-amber-50 text-amber-600"
          title="Sắp hết hàng"
          value={lowStockCount}
          valueClassName="text-amber-600"
          subtitle="Cần lưu ý khi tư vấn"
          subtitleClassName="text-amber-600"
          className="border-amber-200"
        />
        <KpiCard
          layout="side"
          icon={Ban}
          iconClassName="bg-rose-50 text-rose-500"
          title="Hết hàng"
          value={outOfStockCount}
          valueClassName="text-rose-600"
          subtitle="Không thể thêm vào đơn"
        />
      </section>

      {/* FILTER TOOLBAR */}
      <section className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 mt-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm sản phẩm, hoạt chất..." className="relative flex-1 min-w-[240px]" />
          <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={CATEGORY_OPTIONS} className="relative min-w-[180px]" />
          <FilterSelect value={stockFilter} onChange={setStockFilter} options={STOCK_OPTIONS} className="relative min-w-[180px]" />
          <button
            className="h-9 px-3 text-slate-500 hover:text-slate-900 text-xs font-medium flex items-center gap-1 transition-colors"
            onClick={handleClearFilters}
            type="button"
          >
            <FilterX size={14} />
            <span>Đặt lại bộ lọc</span>
          </button>
        </div>
      </section>

      {/* DATA TABLE */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-4 pl-4 px-3 min-w-[280px]">Sản phẩm &amp; Hoạt chất</th>
                <th className="py-4 px-3 min-w-[130px] text-center">Danh mục</th>
                <th className="py-4 px-3 min-w-[120px] text-center">Giá bán</th>
                <th className="py-4 px-3 min-w-[170px] text-center">Tồn kho khả dụng</th>
                <th className="py-4 pr-4 pl-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Không tìm thấy sản phẩm phù hợp với bộ lọc." />
              ) : null}
              {paginated.map((product) => {
                const isSelected = product.id === selectedId
                return (
                  <tr
                    key={product.id}
                    onClick={() => setSelectedId(product.id)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected ? 'bg-emerald-50/50 hover:bg-emerald-50 border-l-2 border-l-emerald-500' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="py-4.5 pl-4 px-3">
                      <div className="font-medium text-sm text-slate-900 group-hover:text-emerald-600 transition-colors">{product.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{product.description}</div>
                    </td>
                    <td className="py-4.5 px-3 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[110px] px-2 py-0.5 rounded-full text-[10px] font-medium border ${product.categoryClassName}`}>
                        {product.categoryLabel}
                      </span>
                    </td>
                    <td className="py-4.5 px-3 text-center font-medium font-mono text-slate-900">{product.price}</td>
                    <td className="py-4.5 px-3 text-center font-medium font-mono text-slate-900">{product.stockQuantity}</td>
                    <td className="py-4.5 pr-4 pl-3 text-center">
                      <div className="flex items-center justify-center">
                        <RowActionsMenu
                          triggerLabel={`Thao tác ${product.name}`}
                          actions={product.actions.map((action, index) => ({
                            ...action,
                            onClick: index === 0 ? () => handleViewProductDetail(product.id) : () => handleAddProductToOrder(product.id),
                          }))}
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
          startIndex={startIndex}
          endIndex={endIndex}
          totalCount={totalCount}
          unitLabel="sản phẩm"
          goPrev={goPrev}
          goNext={goNext}
          setPage={setPage}
        />
      </section>

      {/* DETAIL MODAL: CHI TIẾT SẢN PHẨM */}
      <DetailModal open={selectedProduct !== null} onClose={() => setSelectedId(null)}>
        {selectedProduct ? (
          <div className="p-4 space-y-3">
            <div>
              <h3 className="text-lg text-slate-900 font-bold">{selectedProduct.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{selectedProduct.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${selectedProduct.categoryClassName}`}>
                {selectedProduct.categoryLabel}
              </span>
              <StatusBadge label={selectedProduct.stockLabel} className={selectedProduct.stockClassName} />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-500">Giá bán</span>
              <span className="font-semibold text-lg tabular-nums text-slate-900">{selectedProduct.price}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Tồn kho khả dụng</span>
              <span className="font-semibold text-sm text-slate-900">{selectedProduct.stockQuantity}</span>
            </div>
            <button
              className="w-full px-3 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-center font-semibold text-xs transition-colors shadow-sm"
              onClick={() => {
                showToast(`Đã thêm ${selectedProduct.name} vào đơn tại quầy`)
                setSelectedId(null)
              }}
              type="button"
            >
              Thêm vào đơn
            </button>
          </div>
        ) : null}
      </DetailModal>
    </>
  )
}
