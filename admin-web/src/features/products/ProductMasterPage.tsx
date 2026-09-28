import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import FormModal from '../../components/ui/FormModal'
import DetailModal from '../../components/ui/DetailModal'
import Pagination from '../../components/ui/Pagination'
import { useSelectableList } from '../../hooks/useSelectableList'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { useFormValues } from '../../hooks/useFormValues'
import * as productsService from '../../services/productsService'
import type { ProductMaster, ProductStatus, ProductActionId } from '../../types'

export default function ProductMasterPage() {
  usePageHeader({ title: 'Sản phẩm gốc', subtitle: 'Quản lý cơ sở dữ liệu các sản phẩm nông nghiệp chuẩn' })

  const [productList, setProductList] = useState<ProductMaster[]>(() => productsService.listProducts())
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') || ''

  
  const categories = productsService.listCategories()
  const ingredients = productsService.listIngredients()

  const [createOpen, setCreateOpen] = useState(false)
  const createForm = useFormValues({ sku: '', name: '', categoryId: categories[0]?.id || '', activeIngredientId: ingredients[0]?.id || '', manufacturer: '', unit: '', status: 'Chờ duyệt' })

  const [editTarget, setEditTarget] = useState<ProductMaster | null>(null)
  const editForm = useFormValues({ sku: '', name: '', categoryId: '', activeIngredientId: '', manufacturer: '', unit: '', status: 'Chờ duyệt' })

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Không rõ'
  const getIngredientName = (id: string) => ingredients.find(i => i.id === id)?.name || 'Không rõ'

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredProducts,
  } = useFilteredList(
    productList,
    initialSearch,
    (item, keyword, status) =>
      (!keyword ||
        item.sku.toLowerCase().includes(keyword.toLowerCase()) ||
        item.name.toLowerCase().includes(keyword.toLowerCase()) ||
        item.manufacturer.toLowerCase().includes(keyword.toLowerCase()) ||
        getCategoryName(item.categoryId).toLowerCase().includes(keyword.toLowerCase()) ||
        getIngredientName(item.activeIngredientId).toLowerCase().includes(keyword.toLowerCase())) &&
      (!status || item.status === (status as ProductStatus)),
    '',
  )

  const {
    page,
    totalPages,
    paginated: paginatedProducts,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredProducts, 12)

  const { selectedId, setSelectedId, selected } = useSelectableList(productList, (p) => p.id)

  const activeCount = productList.filter(p => p.status === 'Đang lưu hành').length
  const pendingCount = productList.filter(p => p.status === 'Chờ duyệt').length

  const handleAction = (product: ProductMaster, actionId: ProductActionId) => {
    switch (actionId) {
      case 'view':
        setSelectedId(product.id)
        break
      case 'edit':
        editForm.reset({ sku: product.sku, name: product.name, categoryId: product.categoryId, activeIngredientId: product.activeIngredientId, manufacturer: product.manufacturer, unit: product.unit, status: product.status })
        setEditTarget(product)
        break
      case 'approve':
        productsService.updateProductStatus(product.id, 'Đang lưu hành')
        setProductList(productsService.listProducts())
        showToast(`Đã duyệt sản phẩm ${product.name}`)
        break
      case 'reject':
        productsService.updateProductStatus(product.id, 'Ngừng kinh doanh')
        setProductList(productsService.listProducts())
        showToast(`Đã từ chối sản phẩm ${product.name}`)
        break
      case 'delete':
        productsService.deleteProduct(product.id)
        setProductList(productsService.listProducts())
        showToast(`Đã xóa sản phẩm ${product.name}`)
        break
    }
  }

  const handleCreate = () => {
    const { sku, name, categoryId, activeIngredientId, manufacturer, unit, status } = createForm.values
    productsService.createProduct({ sku, name, categoryId, activeIngredientId, manufacturer, unit, status: status as ProductStatus })
    setProductList(productsService.listProducts())
    showToast(`Đã tạo sản phẩm ${name}`)
    setCreateOpen(false)
    createForm.reset({ sku: '', name: '', categoryId: categories[0]?.id || '', activeIngredientId: ingredients[0]?.id || '', manufacturer: '', unit: '', status: 'Chờ duyệt' })
  }

  const handleEdit = () => {
    if (!editTarget) return
    const { sku, name, categoryId, activeIngredientId, manufacturer, unit, status } = editForm.values
    productsService.updateProduct(editTarget.id, { sku, name, categoryId, activeIngredientId, manufacturer, unit, status: status as ProductStatus })
    setProductList(productsService.listProducts())
    showToast(`Đã cập nhật sản phẩm ${name}`)
    setEditTarget(null)
  }

  const handleImportExcel = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel'
    input.onchange = () => {
      // Giả lập delay upload
      showToast('Đang tải lên và xử lý dữ liệu...')
      setTimeout(() => {
        showToast('Đã import dữ liệu thành công từ file Excel (Mock)!')
      }, 1500)
    }
    input.click()
  }



  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8 w-full px-2">
      {/* HEADER ROW */}
      <div className="flex items-start justify-between mt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold text-on-surface">Sản phẩm gốc</h1>
          <p className="text-on-surface-variant text-sm">Quản lý kho dữ liệu chung về thuốc bảo vệ thực vật, phân bón...</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleImportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-outline-variant rounded bg-white hover:bg-surface-container-low text-on-surface font-medium text-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">upload</span> Import Excel
          </button>
          <button 
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#171833] hover:bg-black text-white rounded font-medium text-sm shadow-sm transition-colors"
            onClick={() => setCreateOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Thêm sản phẩm
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Tổng sản phẩm</span>
          <div>
            <div className="text-3xl font-medium text-on-surface">{productList.length}</div>
            <div className="text-xs text-on-surface-variant mt-1">Trong hệ thống</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-emerald-700 font-medium">Đang lưu hành</span>
          <div>
            <div className="text-3xl font-medium text-emerald-700">{activeCount}</div>
            <div className="text-xs text-emerald-700/80 mt-1">Được phép sử dụng</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border-2 border-amber-400/80 bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-amber-700 font-medium">Chờ duyệt</span>
          <div>
            <div className="text-3xl font-medium text-on-surface">{pendingCount}</div>
            <div className="text-xs text-amber-700 mt-1">Sản phẩm mới cần kiểm duyệt</div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center justify-between mt-2">
        <div className="relative w-[320px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input 
            type="text" 
            placeholder="Tìm kiếm theo tên, SKU, nhà SX..." 
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-on-surface">
            <span className="text-on-surface-variant font-medium">Trạng thái:</span>
            <select className="bg-transparent font-medium outline-none cursor-pointer border-b border-dashed border-outline-variant pb-0.5" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="Đang lưu hành">Đang lưu hành</option>
              <option value="Chờ duyệt">Chờ duyệt</option>
              <option value="Ngừng kinh doanh">Ngừng kinh doanh</option>
            </select>
          </div>
        </div>
      </div>

      {/* FLAT DATA TABLE */}
      <div className="border border-outline-variant/60 rounded-xl overflow-hidden bg-white shadow-sm mt-2 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container-lowest border-b border-outline-variant/60">
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[25%] uppercase tracking-wider">Sản phẩm</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[15%] uppercase tracking-wider">SKU</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[20%] uppercase tracking-wider">Danh mục & Hoạt chất</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Nhà sản xuất</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Trạng thái</th>
                <th className="py-3 px-2 w-[5%]"></th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/60">
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant">Không tìm thấy sản phẩm phù hợp.</td>
                </tr>
              )}
              {paginatedProducts.map((product) => {
                const isSelected = product.id === selectedId
                return (
                  <tr key={product.id} className={`transition-colors group hover:bg-surface-container-low ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface shrink-0">
                          <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                        </div>
                        <div className="min-w-0">
                          <div 
                            className="font-medium text-on-surface text-sm cursor-pointer hover:underline truncate"
                            onClick={() => setSelectedId(product.id)}
                          >
                            {product.name}
                          </div>
                          <div className="text-[11px] text-outline font-mono mt-0.5 truncate">{product.unit}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <span className="font-mono text-sm">{product.sku}</span>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded w-fit">{getCategoryName(product.categoryId)}</span>
                        <span className="text-xs text-on-surface-variant">{getIngredientName(product.activeIngredientId)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      {product.manufacturer}
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className={`px-2.5 py-1 rounded-md border text-[11px] uppercase tracking-wider font-semibold shadow-sm whitespace-nowrap
                        ${product.status === 'Chờ duyệt' ? 'border-amber-400 text-amber-700 bg-amber-50' : ''}
                        ${product.status === 'Đang lưu hành' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}
                        ${product.status === 'Ngừng kinh doanh' ? 'border-error/40 text-error bg-error/5' : ''}
                      `}>
                        {product.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowActionsMenu
                          triggerLabel="Thao tác"
                          actions={productsService.productActionsFor(product.status).map(a => ({ ...a, onClick: () => handleAction(product, a.id) }))}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        <div className="px-4 py-3 bg-white flex items-center justify-between text-sm text-on-surface-variant border-t border-outline-variant/40">
          <div>
            Hiển thị {startIndex + 1} đến {endIndex} của {totalCount} sản phẩm
          </div>
          <div className="flex items-center gap-6">
            <Pagination
              page={page}
              totalPages={totalPages}
              startIndex={startIndex}
              endIndex={endIndex}
              totalCount={totalCount}
              unitLabel=""
              goPrev={goPrev}
              goNext={goNext}
              setPage={setPage}
            />
          </div>
        </div>
      </div>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm sản phẩm gốc mới"
        values={createForm.values}
        onChange={createForm.update}
        onSubmit={handleCreate}
        submitLabel="Tạo sản phẩm"
        fields={[
          { key: 'sku', label: 'Mã SKU', placeholder: 'VD: SP-001', required: true, group: 'Chung' },
          { key: 'name', label: 'Tên sản phẩm', placeholder: 'Nhập tên...', required: true, group: 'Chung' },
          { key: 'categoryId', label: 'Danh mục', type: 'select', options: categories.map(c => c.id), renderOption: (opt) => categories.find(c => c.id === opt)?.name || opt, group: 'Phân loại' },
          { key: 'activeIngredientId', label: 'Hoạt chất', type: 'select', options: ingredients.map(i => i.id), renderOption: (opt) => ingredients.find(i => i.id === opt)?.name || opt, group: 'Phân loại' },
          { key: 'manufacturer', label: 'Nhà sản xuất', placeholder: 'Nhập tên công ty...', group: 'Sản xuất' },
          { key: 'unit', label: 'Đơn vị tính (Quy cách)', placeholder: 'Chai 500ml, Gói 1kg...', group: 'Sản xuất' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ['Đang lưu hành', 'Chờ duyệt', 'Ngừng kinh doanh'], group: 'Hệ thống' },
        ]}
      />

      <FormModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `Sửa sản phẩm: ${editTarget.name}` : 'Sửa sản phẩm'}
        values={editForm.values}
        onChange={editForm.update}
        onSubmit={handleEdit}
        submitLabel="Lưu thay đổi"
        fields={[
          { key: 'sku', label: 'Mã SKU', placeholder: 'VD: SP-001', required: true, group: 'Chung' },
          { key: 'name', label: 'Tên sản phẩm', placeholder: 'Nhập tên...', required: true, group: 'Chung' },
          { key: 'categoryId', label: 'Danh mục', type: 'select', options: categories.map(c => c.id), renderOption: (opt) => categories.find(c => c.id === opt)?.name || opt, group: 'Phân loại' },
          { key: 'activeIngredientId', label: 'Hoạt chất', type: 'select', options: ingredients.map(i => i.id), renderOption: (opt) => ingredients.find(i => i.id === opt)?.name || opt, group: 'Phân loại' },
          { key: 'manufacturer', label: 'Nhà sản xuất', placeholder: 'Nhập tên công ty...', group: 'Sản xuất' },
          { key: 'unit', label: 'Đơn vị tính (Quy cách)', placeholder: 'Chai 500ml, Gói 1kg...', group: 'Sản xuất' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ['Đang lưu hành', 'Chờ duyệt', 'Ngừng kinh doanh'], group: 'Hệ thống' },
        ]}
      />

      <DetailModal open={selected !== null} onClose={() => setSelectedId(null)} widthClassName="max-w-xl">
        {selected && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface shrink-0">
                  <span className="material-symbols-outlined text-[32px]">inventory_2</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-on-surface">{selected.name}</h2>
                  <div className="text-sm text-outline font-mono mt-1">SKU: {selected.sku}</div>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full font-semibold text-xs border ${
                selected.status === 'Chờ duyệt' ? 'border-amber-400 text-amber-700 bg-amber-50' : 
                selected.status === 'Đang lưu hành' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-error/40 text-error bg-error/5'
              }`}>{selected.status}</span>
            </div>
            
            <div className="space-y-4 text-sm text-on-surface mt-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-outline-variant/40 rounded-lg p-3 bg-surface-container-lowest">
                  <span className="text-xs text-on-surface-variant font-medium block mb-1">Danh mục</span>
                  <span className="font-medium text-primary">{getCategoryName(selected.categoryId)}</span>
                </div>
                <div className="border border-outline-variant/40 rounded-lg p-3 bg-surface-container-lowest">
                  <span className="text-xs text-on-surface-variant font-medium block mb-1">Hoạt chất</span>
                  <span className="font-medium">{getIngredientName(selected.activeIngredientId)}</span>
                </div>
              </div>
              
              <div className="flex justify-between border-b border-outline-variant/40 pb-2 mt-4">
                <span className="text-on-surface-variant font-medium">Quy cách / Đơn vị:</span>
                <span>{selected.unit}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant font-medium">Nhà sản xuất:</span>
                <span>{selected.manufacturer}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/40 pb-2">
                <span className="text-on-surface-variant font-medium">Ngày tạo:</span>
                <span>{selected.createdAt}</span>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button className="px-4 py-2 bg-surface-container-low text-on-surface rounded font-medium hover:bg-outline-variant/50 transition-colors" onClick={() => setSelectedId(null)}>Đóng</button>
              {selected.status === 'Chờ duyệt' && (
                <button className="px-4 py-2 bg-primary text-on-primary rounded font-medium hover:bg-primary/90 transition-colors" onClick={() => {
                  productsService.updateProductStatus(selected.id, 'Đang lưu hành');
                  setProductList(productsService.listProducts());
                  setSelectedId(null);
                  showToast('Đã duyệt sản phẩm thành công');
                }}>Duyệt sản phẩm</button>
              )}
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  )
}
