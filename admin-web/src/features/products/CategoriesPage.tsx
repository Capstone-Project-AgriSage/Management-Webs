import { useState } from 'react'

import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import FormModal from '../../components/ui/FormModal'
import Pagination from '../../components/ui/Pagination'
import { useSelectableList } from '../../hooks/useSelectableList'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { useFormValues } from '../../hooks/useFormValues'
import * as productsService from '../../services/productsService'
import type { ProductCategory, CategoryStatus, CategoryActionId } from '../../types'

export default function CategoriesPage() {
  usePageHeader({ title: 'Danh mục sản phẩm', subtitle: 'Phân loại các sản phẩm nông nghiệp trong hệ thống' })

  const [categoryList, setCategoryList] = useState<ProductCategory[]>(() => productsService.listCategories())
  const { showToast } = useToast()
  
  const [createOpen, setCreateOpen] = useState(false)
  const createForm = useFormValues({ name: '', description: '', status: 'Hoạt động' })

  const [editTarget, setEditTarget] = useState<ProductCategory | null>(null)
  const editForm = useFormValues({ name: '', description: '', status: 'Hoạt động' })

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredCategories,
  } = useFilteredList(
    categoryList,
    '',
    (item, keyword, status) =>
      (!keyword ||
        item.id.toLowerCase().includes(keyword.toLowerCase()) ||
        item.name.toLowerCase().includes(keyword.toLowerCase())) &&
      (!status || item.status === (status as CategoryStatus)),
    '',
  )

  const {
    page,
    totalPages,
    paginated: paginatedCategories,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredCategories, 12)

  const { selectedId, setSelectedId } = useSelectableList(categoryList, (c) => c.id)

  const activeCount = categoryList.filter(c => c.status === 'Hoạt động').length
  const hiddenCount = categoryList.filter(c => c.status === 'Đang ẩn').length

  const handleAction = (category: ProductCategory, actionId: CategoryActionId) => {
    switch (actionId) {
      case 'edit':
        editForm.reset({ name: category.name, description: category.description, status: category.status })
        setEditTarget(category)
        break
      case 'toggle-status':
        const newStatus = category.status === 'Hoạt động' ? 'Đang ẩn' : 'Hoạt động'
        productsService.updateCategoryStatus(category.id, newStatus)
        setCategoryList(productsService.listCategories())
        showToast(`Đã ${newStatus === 'Hoạt động' ? 'hiện' : 'ẩn'} danh mục ${category.name}`)
        break
      case 'delete':
        productsService.deleteCategory(category.id)
        setCategoryList(productsService.listCategories())
        showToast(`Đã xóa danh mục ${category.name}`)
        break
    }
  }

  const handleCreate = () => {
    const { name, description, status } = createForm.values
    productsService.createCategory({ name, description, status: status as CategoryStatus })
    setCategoryList(productsService.listCategories())
    showToast(`Đã tạo danh mục ${name}`)
    setCreateOpen(false)
    createForm.reset({ name: '', description: '', status: 'Hoạt động' })
  }

  const handleEdit = () => {
    if (!editTarget) return
    const { name, description, status } = editForm.values
    productsService.updateCategory(editTarget.id, { name, description, status: status as CategoryStatus })
    setCategoryList(productsService.listCategories())
    showToast(`Đã cập nhật danh mục ${name}`)
    setEditTarget(null)
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8 w-full px-2">
      {/* HEADER ROW */}
      <div className="flex items-start justify-between mt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold text-on-surface">Danh mục sản phẩm</h1>
          <p className="text-on-surface-variant text-sm">Quản lý và phân loại thuốc BVTV, phân bón, giống cây...</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#171833] hover:bg-black text-white rounded font-medium text-sm shadow-sm transition-colors"
            onClick={() => setCreateOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Thêm danh mục
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Tổng số danh mục</span>
          <div>
            <div className="text-3xl font-medium text-on-surface">{categoryList.length}</div>
            <div className="text-xs text-on-surface-variant mt-1">Bao gồm tất cả trạng thái</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-emerald-700 font-medium">Đang hoạt động</span>
          <div>
            <div className="text-3xl font-medium text-emerald-700">{activeCount}</div>
            <div className="text-xs text-emerald-700/80 mt-1">Đang hiển thị trên ứng dụng</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Đang ẩn</span>
          <div>
            <div className="text-3xl font-medium text-on-surface">{hiddenCount}</div>
            <div className="text-xs text-on-surface-variant mt-1">Không hiển thị cho người dùng</div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center justify-between mt-2">
        <div className="relative w-[320px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input 
            type="text" 
            placeholder="Tìm kiếm danh mục..." 
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
              <option value="Hoạt động">Hoạt động</option>
              <option value="Đang ẩn">Đang ẩn</option>
            </select>
          </div>
        </div>
      </div>

      {/* FLAT DATA TABLE */}
      <div className="border border-outline-variant/60 rounded-xl overflow-hidden bg-white shadow-sm mt-2 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-lowest border-b border-outline-variant/60">
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[25%] uppercase tracking-wider">Tên danh mục</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[35%] uppercase tracking-wider">Mô tả</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Số sản phẩm</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Trạng thái</th>
                <th className="py-3 px-2 w-[5%]"></th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/60">
              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-on-surface-variant">Không tìm thấy danh mục phù hợp.</td>
                </tr>
              )}
              {paginatedCategories.map((category) => {
                const isSelected = category.id === selectedId
                return (
                  <tr key={category.id} className={`transition-colors group hover:bg-surface-container-low ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface shrink-0">
                          <span className="material-symbols-outlined text-[20px]">category</span>
                        </div>
                        <div className="min-w-0">
                          <div 
                            className="font-medium text-on-surface text-sm cursor-pointer hover:underline truncate"
                            onClick={() => setSelectedId(category.id)}
                          >
                            {category.name}
                          </div>
                          <div className="text-[11px] text-outline font-mono mt-0.5 truncate">#{category.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="text-sm text-on-surface-variant truncate max-w-[300px]">
                        {category.description || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className="font-medium text-on-surface">{category.productCount}</span>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className={`px-2.5 py-1 rounded-md border text-[11px] uppercase tracking-wider font-semibold shadow-sm whitespace-nowrap
                        ${category.status === 'Hoạt động' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant'}
                      `}>
                        {category.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowActionsMenu
                          triggerLabel="Thao tác"
                          actions={productsService.categoryActionsFor(category.status).map(a => ({ ...a, onClick: () => handleAction(category, a.id) }))}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {/* FOOTER PAGINATION */}
        <div className="px-4 py-3 bg-white flex items-center justify-between text-sm text-on-surface-variant border-t border-outline-variant/40">
          <div>
            Hiển thị {startIndex + 1} đến {endIndex} của {totalCount} danh mục
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
        title="Thêm danh mục mới"
        values={createForm.values}
        onChange={createForm.update}
        onSubmit={handleCreate}
        submitLabel="Tạo danh mục"
        fields={[
          { key: 'name', label: 'Tên danh mục', placeholder: 'Ví dụ: Phân bón vô cơ', required: true },
          { key: 'description', label: 'Mô tả', placeholder: 'Nhập mô tả ngắn cho danh mục này...' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ['Hoạt động', 'Đang ẩn'] },
        ]}
      />
      
      <FormModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `Sửa danh mục: ${editTarget.name}` : 'Sửa danh mục'}
        values={editForm.values}
        onChange={editForm.update}
        onSubmit={handleEdit}
        submitLabel="Lưu thay đổi"
        fields={[
          { key: 'name', label: 'Tên danh mục', placeholder: 'Ví dụ: Phân bón vô cơ', required: true },
          { key: 'description', label: 'Mô tả', placeholder: 'Nhập mô tả ngắn cho danh mục này...' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ['Hoạt động', 'Đang ẩn'] },
        ]}
      />
    </div>
  )
}
