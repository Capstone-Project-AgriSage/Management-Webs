import { useState } from 'react'
import { Plus, PackageSearch, History, RefreshCw } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import DetailModal from '@/components/ui/DetailModal'
import FormModal, { type FormFieldSpec } from '@/components/ui/FormModal'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import StatusBadge from '@/components/ui/StatusBadge'
import { useFilteredList } from '@/hooks/useFilteredList'
import { useSelectableList } from '@/hooks/useSelectableList'
import { usePagination } from '@/hooks/usePagination'
import { useFormValues } from '@/hooks/useFormValues'
import { inventoryItems as INITIAL_INVENTORY, mockStockMovements as INITIAL_MOVEMENTS } from '@/features/sales/data/mockInventory'
import { resolveStockPresentation } from '@/features/sales/data/stockPresentation'
import type { StockAdjustmentReason, StockMovement } from '@/types'

const STOCK_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'Còn hàng', label: 'Còn hàng' },
  { value: 'Sắp hết', label: 'Sắp hết' },
  { value: 'Hết hàng', label: 'Hết hàng' },
]

const MOVEMENT_TYPE_OPTIONS = [
  { value: 'STOCK_IN', label: 'Nhập kho (STOCK_IN)' },
  { value: 'ADJUSTMENT', label: 'Điều chỉnh kiểm kê (ADJUSTMENT)' },
]

const ADJUST_REASON_OPTIONS: { value: StockAdjustmentReason; label: string }[] = [
  { value: 'DAMAGED', label: 'Hư hỏng / Rách vỡ bao bì' },
  { value: 'EXPIRED', label: 'Hết hạn sử dụng' },
  { value: 'LOST', label: 'Thất thoát / Hao hụt kiểm kê' },
  { value: 'MANUAL_CORRECTION', label: 'Hiệu chỉnh sai lệch kiểm đếm' },
]

const MOVEMENT_TYPE_LABELS: Record<StockMovement['movementType'], string> = {
  STOCK_IN: 'Nhập kho',
  SALE: 'Xuất bán',
  ADJUSTMENT: 'Điều chỉnh',
}

export default function InventoryPage() {
  usePageHeader({ title: 'Kho', subtitle: 'Xem tồn kho và ghi nhận biến động kho qua Stock Movement' })

  const { user } = useAuth()
  const { showToast } = useToast()

  const [inventoryItems, setInventoryItems] = useState(INITIAL_INVENTORY)
  const [stockMovements, setStockMovements] = useState(INITIAL_MOVEMENTS)

  const { selectedId, setSelectedId, selected: selectedItem } = useSelectableList(inventoryItems, (item) => item.id)

  const [categoryFilter, setCategoryFilter] = useState('Tất cả danh mục')
  const categoryOptions = ['Tất cả danh mục', ...new Set(inventoryItems.map((item) => item.categoryLabel))]

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredInventory,
    clearFilters: clearBaseFilters,
  } = useFilteredList(
    inventoryItems,
    '',
    (item, keyword, status) =>
      (!keyword || item.name.toLowerCase().includes(keyword) || item.sku.toLowerCase().includes(keyword)) &&
      (!status || item.stockLabel === status) &&
      (categoryFilter === 'Tất cả danh mục' || item.categoryLabel === categoryFilter),
  )

  const handleClearFilters = () => {
    clearBaseFilters()
    setCategoryFilter('Tất cả danh mục')
  }

  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(filteredInventory, 8)

  const [movementOpen, setMovementOpen] = useState(false)
  const { values: movementForm, update: updateMovementForm, reset: resetMovementForm } = useFormValues({
    itemId: '',
    movementType: 'STOCK_IN',
    quantity: '',
    reason: 'DAMAGED',
    note: '',
  })

  const openMovementModal = (itemId: string) => {
    resetMovementForm({ itemId, movementType: 'STOCK_IN', quantity: '', reason: 'DAMAGED', note: '' })
    setMovementOpen(true)
  }

  const movementItem = inventoryItems.find((i) => i.id === movementForm.itemId) ?? null

  const handleSubmitMovement = () => {
    const quantityRaw = Number.parseInt(movementForm.quantity, 10)
    if (!movementItem || !movementForm.quantity.trim() || Number.isNaN(quantityRaw) || quantityRaw === 0) {
      showToast('Vui lòng chọn sản phẩm và nhập số lượng hợp lệ (khác 0)')
      return
    }

    const isStockIn = movementForm.movementType === 'STOCK_IN'
    const delta = isStockIn ? Math.abs(quantityRaw) : quantityRaw
    const currentQty = Number.parseInt(movementItem.stockQuantity, 10) || 0
    const newQty = Math.max(0, currentQty + delta)
    const presentation = resolveStockPresentation(newQty)

    setInventoryItems((prev) =>
      prev.map((item) =>
        item.id === movementItem.id
          ? {
              ...item,
              stockQuantity: String(newQty),
              ...presentation,
              updatedAgo: 'Vừa xong',
              updatedBy: user.name,
            }
          : item,
      ),
    )

    const newMovement: StockMovement = {
      id: `SM-${Date.now().toString().slice(-4)}`,
      productId: movementItem.id,
      productName: movementItem.name,
      sku: movementItem.sku,
      movementType: isStockIn ? 'STOCK_IN' : 'ADJUSTMENT',
      quantityChange: delta,
      balanceAfter: newQty,
      unit: movementItem.unit,
      reason: isStockIn ? undefined : (movementForm.reason as StockAdjustmentReason),
      referenceId: isStockIn ? `PNK-${Date.now().toString().slice(-4)}` : `DCK-${Date.now().toString().slice(-4)}`,
      createdAt: 'Vừa xong',
      createdBy: user.name,
      note: movementForm.note.trim() || undefined,
    }
    setStockMovements((prev) => [newMovement, ...prev])
    showToast(`Đã ghi nhận Stock Movement (${delta > 0 ? '+' : ''}${delta} ${movementItem.unit}) cho ${movementItem.name}`)
    setMovementOpen(false)
  }

  const movementFields: FormFieldSpec[] = [
    {
      key: 'itemId',
      label: 'Sản phẩm',
      type: 'select',
      options: inventoryItems.map((item) => ({ value: item.id, label: `${item.name} (${item.sku})` })),
    },
    {
      key: 'currentStockNote',
      type: 'note',
      content: movementItem ? (
        <p className="text-sm text-slate-500">
          Tồn hiện tại: <span className="font-semibold text-slate-900">{movementItem.stockQuantity} {movementItem.unit}</span>
        </p>
      ) : null,
    },
    { key: 'movementType', label: 'Loại biến động', type: 'select', options: MOVEMENT_TYPE_OPTIONS },
    {
      key: 'quantity',
      label: movementForm.movementType === 'STOCK_IN' ? 'Số lượng nhập thêm' : 'Số lượng thay đổi (âm để giảm)',
      type: 'number',
      placeholder: movementForm.movementType === 'STOCK_IN' ? 'Ví dụ: 50' : 'Ví dụ: -2',
    },
    ...(movementForm.movementType === 'ADJUSTMENT'
      ? [{ key: 'reason', label: 'Lý do kiểm kê', type: 'select' as const, options: ADJUST_REASON_OPTIONS }]
      : []),
    { key: 'note', label: 'Ghi chú', type: 'text', placeholder: 'Ghi chú về đợt nhập/điều chỉnh này' },
  ]

  const itemMovements = selectedItem ? stockMovements.filter((m) => m.productId === selectedItem.id) : []

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <PackageSearch size={18} className="text-emerald-600" />
          <span>
            Tổng <span className="font-semibold text-slate-900">{inventoryItems.length}</span> mặt hàng trong kho {user.storeName}
          </span>
        </div>
        <button
          type="button"
          onClick={() => openMovementModal(inventoryItems[0]?.id ?? '')}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          <Plus size={16} />
          <span>Tạo Stock Movement</span>
        </button>
      </div>

      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm sản phẩm, mã SKU..." className="relative flex-1" />
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} className="relative min-w-[150px]" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STOCK_STATUS_OPTIONS} className="relative min-w-[150px]" />
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Sản phẩm</th>
                <th className="py-3 px-3" scope="col">SKU</th>
                <th className="py-3 px-3 text-center" scope="col">Danh mục</th>
                <th className="py-3 px-3 text-center" scope="col">Số lượng</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 px-3" scope="col">Cập nhật gần nhất</th>
                <th className="py-3 px-4 text-center w-20" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.length === 0 ? <EmptyTableRow colSpan={7} message="Không tìm thấy sản phẩm phù hợp với bộ lọc." /> : null}
              {paginated.map((item) => {
                const isSelected = item.id === selectedId
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`transition-colors cursor-pointer group ${
                      isSelected ? 'bg-emerald-50/50 hover:bg-emerald-50 border-l-2 border-l-emerald-500' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="py-4.5 px-4">
                      <span className="font-medium text-sm text-slate-900 group-hover:text-emerald-600 transition-colors">{item.name}</span>
                    </td>
                    <td className="py-4.5 px-3 font-mono text-xs text-slate-500 font-medium">{item.sku}</td>
                    <td className="py-4.5 px-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[100px] px-2 py-0.5 rounded-full text-[10px] font-medium border bg-slate-50 text-slate-700 border-slate-200">
                        {item.categoryLabel}
                      </span>
                    </td>
                    <td className="py-4.5 px-3 text-center">
                      <span className="font-medium font-mono text-slate-900">
                        {item.stockQuantity} <span className="font-sans font-normal text-xs text-slate-500">{item.unit}</span>
                      </span>
                    </td>
                    <td className="py-4.5 px-3 text-center">
                      <StatusBadge label={item.stockLabel} className={item.stockClassName} minWidthClassName="min-w-[100px]" />
                    </td>
                    <td className="py-4.5 px-3">
                      <div className="flex flex-col text-[11px]">
                        <span className="text-slate-900 font-medium">{item.updatedAgo}</span>
                        <span className="text-slate-500">{item.updatedBy}</span>
                      </div>
                    </td>
                    <td className="py-4.5 px-4 text-center">
                      <div className="flex items-center justify-center">
                        <RowActionsMenu
                          triggerLabel={`Thao tác ${item.name}`}
                          actions={item.actions.map((action, index) => ({
                            ...action,
                            // Position 0 = "Xem chi tiết", position 1 = "Tạo Stock Movement" -
                            // wired by position, not by re-matching the label text at click time.
                            onClick: index === 0 ? () => setSelectedId(item.id) : () => openMovementModal(item.id),
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
      </div>

      <DetailModal open={selectedItem !== null} onClose={() => setSelectedId(null)}>
        {selectedItem ? (
          <div className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">{selectedItem.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">{selectedItem.sku}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">{selectedItem.categoryLabel}</span>
              <StatusBadge label={selectedItem.stockLabel} className={selectedItem.stockClassName} />
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">Số lượng tồn</span>
              <span className="font-semibold text-slate-900 font-mono">{selectedItem.stockQuantity} {selectedItem.unit}</span>
            </div>
            <div className="text-xs text-slate-500">
              Cập nhật gần nhất: <strong className="text-slate-900">{selectedItem.updatedAgo}</strong> bởi {selectedItem.updatedBy}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <History size={16} className="text-slate-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lịch sử biến động gần đây</h4>
              </div>
              {itemMovements.length === 0 ? (
                <p className="text-xs text-slate-400">Chưa có biến động nào được ghi nhận cho sản phẩm này.</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {itemMovements.map((m) => (
                    <div key={m.id} className="py-2 flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            m.movementType === 'STOCK_IN'
                              ? 'bg-emerald-100 text-emerald-700'
                              : m.movementType === 'SALE'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {MOVEMENT_TYPE_LABELS[m.movementType]}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange} {m.unit}
                          </div>
                          <div className="text-slate-500">{m.note || m.createdBy}</div>
                        </div>
                      </div>
                      <span className="text-slate-500 font-mono shrink-0">{m.createdAt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const itemId = selectedItem.id
                  setSelectedId(null)
                  openMovementModal(itemId)
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                Tạo Stock Movement cho mặt hàng này
              </button>
            </div>
          </div>
        ) : null}
      </DetailModal>

      <FormModal
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        title="Tạo Stock Movement"
        fields={movementFields}
        values={movementForm}
        onChange={updateMovementForm}
        onSubmit={handleSubmitMovement}
        submitLabel="Ghi nhận Stock Movement"
      />
    </div>
  )
}
