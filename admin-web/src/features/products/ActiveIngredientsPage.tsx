import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
import type { ActiveIngredient, ToxicityClass, IngredientActionId } from '../../types'

export default function ActiveIngredientsPage() {
  usePageHeader({ title: 'Hoạt chất', subtitle: 'Quản lý cơ sở dữ liệu các thành phần hóa học/sinh học' })

  const [ingredientList, setIngredientList] = useState<ActiveIngredient[]>(() => productsService.listIngredients())
  const { showToast } = useToast()
  const navigate = useNavigate()
  
  const [createOpen, setCreateOpen] = useState(false)
  const createForm = useFormValues({ name: '', chemicalName: '', type: 'Thuốc trừ sâu', toxicityClass: 'Nhóm III', description: '' })

  const [editTarget, setEditTarget] = useState<ActiveIngredient | null>(null)
  const editForm = useFormValues({ name: '', chemicalName: '', type: '', toxicityClass: '', description: '' })

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredIngredients,
  } = useFilteredList(
    ingredientList,
    '',
    (item, keyword, status) =>
      (!keyword ||
        item.name.toLowerCase().includes(keyword.toLowerCase()) ||
        item.chemicalName.toLowerCase().includes(keyword.toLowerCase())) &&
      (!status || item.toxicityClass === (status as ToxicityClass)),
    '',
  )

  const {
    page,
    totalPages,
    paginated: paginatedIngredients,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredIngredients, 12)

  const { selectedId, setSelectedId } = useSelectableList(ingredientList, (i) => i.id)

  const handleAction = (ingredient: ActiveIngredient, actionId: IngredientActionId) => {
    switch (actionId) {
      case 'edit':
        editForm.reset({ name: ingredient.name, chemicalName: ingredient.chemicalName, type: ingredient.type, toxicityClass: ingredient.toxicityClass, description: ingredient.description })
        setEditTarget(ingredient)
        break
      case 'view-products':
        navigate(`/products/master?search=${encodeURIComponent(ingredient.name)}`)
        break
      case 'delete':
        showToast('Không thể xóa hoạt chất đang được sử dụng trong sản phẩm.')
        break
    }
  }

  const handleCreate = () => {
    const { name, chemicalName, type, toxicityClass, description } = createForm.values
    productsService.createIngredient({ name, chemicalName, type, toxicityClass: toxicityClass as ToxicityClass, description })
    setIngredientList(productsService.listIngredients())
    showToast(`Đã tạo hoạt chất ${name}`)
    setCreateOpen(false)
    createForm.reset({ name: '', chemicalName: '', type: 'Thuốc trừ sâu', toxicityClass: 'Nhóm III', description: '' })
  }

  const handleEdit = () => {
    if (!editTarget) return
    const { name, chemicalName, type, toxicityClass, description } = editForm.values
    productsService.updateIngredient(editTarget.id, { name, chemicalName, type, toxicityClass: toxicityClass as ToxicityClass, description })
    setIngredientList(productsService.listIngredients())
    showToast(`Đã cập nhật hoạt chất ${name}`)
    setEditTarget(null)
  }

  const getToxicityColor = (cls: ToxicityClass) => {
    switch(cls) {
      case 'Nhóm I': return 'border-error text-error bg-error/10'
      case 'Nhóm II': return 'border-amber-500 text-amber-700 bg-amber-50'
      case 'Nhóm III': return 'border-blue-400 text-blue-700 bg-blue-50'
      case 'Nhóm IV': return 'border-emerald-400 text-emerald-700 bg-emerald-50'
      default: return 'border-outline-variant text-on-surface'
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8 w-full px-2">
      {/* HEADER ROW */}
      <div className="flex items-start justify-between mt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold text-on-surface">Cơ sở dữ liệu Hoạt chất</h1>
          <p className="text-on-surface-variant text-sm">Quản lý danh sách thành phần, nhóm hóa học, mức độ độc hại phục vụ AI tư vấn.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#171833] hover:bg-black text-white rounded font-medium text-sm shadow-sm transition-colors"
            onClick={() => setCreateOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Thêm hoạt chất
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Tổng số hoạt chất</span>
          <div>
            <div className="text-3xl font-medium text-on-surface">{ingredientList.length}</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border-l-4 border-l-error border-y border-r border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-error font-medium flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">warning</span> Rất độc (Nhóm I)</span>
          <div>
            <div className="text-3xl font-medium text-error">{ingredientList.filter(i => i.toxicityClass === 'Nhóm I').length}</div>
            <div className="text-xs text-error/80 mt-1">Cần quản lý nghiêm ngặt</div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center justify-between mt-2">
        <div className="relative w-[320px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input 
            type="text" 
            placeholder="Tìm kiếm theo tên hoạt chất..." 
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-on-surface">
            <span className="text-on-surface-variant font-medium">Nhóm độc:</span>
            <select className="bg-transparent font-medium outline-none cursor-pointer border-b border-dashed border-outline-variant pb-0.5" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="Nhóm I">Nhóm I (Rất độc)</option>
              <option value="Nhóm II">Nhóm II (Độc cao)</option>
              <option value="Nhóm III">Nhóm III (Độc trung bình)</option>
              <option value="Nhóm IV">Nhóm IV (Ít độc)</option>
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
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[25%] uppercase tracking-wider">Tên hoạt chất</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[20%] uppercase tracking-wider">Tên hóa học</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Phân loại</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Nhóm độc hại</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Số sản phẩm</th>
                <th className="py-3 px-2 w-[5%]"></th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/60">
              {filteredIngredients.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant">Không tìm thấy hoạt chất phù hợp.</td>
                </tr>
              )}
              {paginatedIngredients.map((ingredient) => {
                const isSelected = ingredient.id === selectedId
                return (
                  <tr key={ingredient.id} className={`transition-colors group hover:bg-surface-container-low ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface shrink-0">
                          <span className="material-symbols-outlined text-[20px]">science</span>
                        </div>
                        <div className="min-w-0">
                          <div 
                            className="font-medium text-on-surface text-sm cursor-pointer hover:underline truncate"
                            onClick={() => setSelectedId(ingredient.id)}
                          >
                            {ingredient.name}
                          </div>
                          <div className="text-[11px] text-outline font-mono mt-0.5 truncate">#{ingredient.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="text-sm text-on-surface-variant truncate">
                        {ingredient.chemicalName}
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className="font-medium text-on-surface">{ingredient.type}</span>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className={`px-2.5 py-1 rounded-md border text-[11px] tracking-wider font-semibold shadow-sm whitespace-nowrap
                        ${getToxicityColor(ingredient.toxicityClass)}
                      `}>
                        {ingredient.toxicityClass}
                      </span>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span 
                        className="font-medium text-primary hover:underline cursor-pointer"
                        onClick={() => handleAction(ingredient, 'view-products')}
                      >
                        {ingredient.productCount}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowActionsMenu
                          triggerLabel="Thao tác"
                          actions={productsService.ingredientActionsFor().map(a => ({ ...a, onClick: () => handleAction(ingredient, a.id) }))}
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
            Hiển thị {startIndex + 1} đến {endIndex} của {totalCount} hoạt chất
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
        title="Thêm hoạt chất mới"
        values={createForm.values}
        onChange={createForm.update}
        onSubmit={handleCreate}
        submitLabel="Tạo hoạt chất"
        fields={[
          { key: 'name', label: 'Tên hoạt chất (Thương mại)', placeholder: 'Ví dụ: Abamectin', required: true },
          { key: 'chemicalName', label: 'Tên hóa học', placeholder: 'Ví dụ: Avermectin...', required: true },
          { key: 'type', label: 'Phân loại', type: 'select', options: ['Thuốc trừ sâu', 'Thuốc trừ nấm', 'Thuốc trừ cỏ', 'Khác'] },
          { key: 'toxicityClass', label: 'Nhóm độc hại', type: 'select', options: ['Nhóm I', 'Nhóm II', 'Nhóm III', 'Nhóm IV'] },
          { key: 'description', label: 'Mô tả / Đặc trị', placeholder: 'Công dụng chính...', type: 'text' },
        ]}
      />

      <FormModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `Sửa hoạt chất: ${editTarget.name}` : 'Sửa hoạt chất'}
        values={editForm.values}
        onChange={editForm.update}
        onSubmit={handleEdit}
        submitLabel="Lưu thay đổi"
        fields={[
          { key: 'name', label: 'Tên hoạt chất (Thương mại)', placeholder: 'Ví dụ: Abamectin', required: true },
          { key: 'chemicalName', label: 'Tên hóa học', placeholder: 'Ví dụ: Avermectin...', required: true },
          { key: 'type', label: 'Phân loại', type: 'select', options: ['Thuốc trừ sâu', 'Thuốc trừ nấm', 'Thuốc trừ cỏ', 'Khác'] },
          { key: 'toxicityClass', label: 'Nhóm độc hại', type: 'select', options: ['Nhóm I', 'Nhóm II', 'Nhóm III', 'Nhóm IV'] },
          { key: 'description', label: 'Mô tả / Đặc trị', placeholder: 'Công dụng chính...', type: 'text' },
        ]}
      />
    </div>
  )
}
