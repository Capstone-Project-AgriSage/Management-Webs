import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Download, SlidersHorizontal, Plus, Package, History, TrendingDown, AlertTriangle, Ban, DollarSign, RefreshCw, Receipt, ArrowRight, X, FileText, CheckCircle2, ShoppingCart } from 'lucide-react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import DetailModal from '../../components/ui/DetailModal'
import FormModal, { type FormFieldSpec } from '../../components/ui/FormModal'
import Pagination from '../../components/ui/Pagination'
import EmptyTableRow from '../../components/ui/EmptyTableRow'
import SearchInput from '../../components/ui/SearchInput'
import FilterSelect from '../../components/ui/FilterSelect'
import { useSelectableList } from '../../hooks/useSelectableList'
import { usePagination } from '../../hooks/usePagination'
import { useFormValues } from '../../hooks/useFormValues'
import { downloadCsv } from '../../utils/csv'
import {
  inventoryItems as INITIAL_INVENTORY,
  mockStockMovements as INITIAL_MOVEMENTS,
} from '../../data/mockInventory'
import type { InventoryItem, StockMovement, StockAdjustmentReason } from '../../types'

const CATEGORY_OPTIONS = ['Tất cả danh mục', ...new Set(INITIAL_INVENTORY.map((item) => item.categoryLabel))]

const CATEGORY_BADGE_CLASSNAMES: Record<string, string> = {
  'Phân bón': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Thuốc BVTV': 'bg-amber-50 text-amber-800 border-amber-200',
  'Lúa giống': 'bg-blue-50 text-blue-800 border-blue-200',
}
const getCategoryBadgeClassName = (categoryLabel: string) =>
  CATEGORY_BADGE_CLASSNAMES[categoryLabel] ?? 'bg-slate-50 text-slate-700 border-slate-200'
const STOCK_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'Tồn kho tốt', label: 'Tồn kho tốt' },
  { value: 'Sắp hết', label: 'Sắp hết hàng' },
  { value: 'Hết hàng', label: 'Hết hàng' },
]

const MOVEMENT_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả loại biến động' },
  { value: 'STOCK_IN', label: 'Nhập kho (STOCK_IN)' },
  { value: 'SALE', label: 'Xuất bán hàng (SALE)' },
  { value: 'ADJUSTMENT', label: 'Điều chỉnh kiểm kê (ADJUSTMENT)' },
]

const ADJUST_REASONS: { value: StockAdjustmentReason; label: string; desc: string }[] = [
  { value: 'DAMAGED', label: 'Hư hỏng / Rách vỡ bao bì (DAMAGED)', desc: 'Vật tư bị hỏng do bảo quản hoặc vận chuyển' },
  { value: 'EXPIRED', label: 'Hết hạn sử dụng (EXPIRED)', desc: 'Vật tư quá date lưu kho theo quy chuẩn BVTV' },
  { value: 'LOST', label: 'Thất thoát / Hao hụt kiểm kê (LOST)', desc: 'Không tìm thấy hiện vật khi đối chiếu kho thực tế' },
  { value: 'MANUAL_CORRECTION', label: 'Hiệu chỉnh sai lệch kiểm đếm (MANUAL_CORRECTION)', desc: 'Cân bằng số dư thẻ kho với kiểm kê thực tế' },
]

export default function InventoryPage() {
  usePageHeader({
    title: 'Quản lý kho hàng & Thẻ kho (WF-05)',
  })

  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'stock' | 'ledger'>('stock')
  const [inventoryItems, setInventoryItems] = useState(INITIAL_INVENTORY)
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(INITIAL_MOVEMENTS)
  const { selectedId, setSelectedId, selected: selectedItem } = useSelectableList(inventoryItems, (item) => item.id)

  // Stock Filter State
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_OPTIONS[0])
  const [stockFilter, setStockFilter] = useState('')

  // Ledger Filter State
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL')

  // Restock Modal State
  const [restockOpen, setRestockOpen] = useState(false)
  const { values: restockForm, update: updateRestockForm, reset: resetRestockForm } = useFormValues({ itemId: '', amount: '' })

  // Adjustment Modal State (WF-05 Append-Only)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null)
  const [adjustChangeType, setAdjustChangeType] = useState<'decrease' | 'increase'>('decrease')
  const [adjustAmount, setAdjustAmount] = useState('1')
  const [adjustReason, setAdjustReason] = useState<StockAdjustmentReason>('DAMAGED')
  const [adjustNote, setAdjustNote] = useState('')

  // Filtered Stock Items
  const keyword = search.trim().toLowerCase()
  const filteredInventory = inventoryItems.filter(
    (item) =>
      (!keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.sku.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword)) &&
      (categoryFilter === CATEGORY_OPTIONS[0] || item.categoryLabel === categoryFilter) &&
      (!stockFilter || item.stockLabel === stockFilter),
  )

  const handleClearFilters = () => {
    setSearch('')
    setCategoryFilter(CATEGORY_OPTIONS[0])
    setStockFilter('')
  }

  const { page, totalPages, paginated, startIndex, endIndex, totalCount: pageTotalCount, goPrev, goNext, setPage } =
    usePagination(filteredInventory, 10)

  // Filtered Ledger Movements
  const ledgerKeyword = ledgerSearch.trim().toLowerCase()
  const filteredMovements = stockMovements.filter((m) => {
    const matchesSearch =
      !ledgerKeyword ||
      m.id.toLowerCase().includes(ledgerKeyword) ||
      m.productName.toLowerCase().includes(ledgerKeyword) ||
      m.sku.toLowerCase().includes(ledgerKeyword) ||
      (m.referenceId && m.referenceId.toLowerCase().includes(ledgerKeyword)) ||
      (m.createdBy && m.createdBy.toLowerCase().includes(ledgerKeyword)) ||
      (m.note && m.note.toLowerCase().includes(ledgerKeyword))

    const matchesType = ledgerTypeFilter === 'ALL' || m.movementType === ledgerTypeFilter

    return matchesSearch && matchesType
  })

  const {
    page: ledgerPage,
    totalPages: ledgerTotalPages,
    paginated: paginatedMovements,
    startIndex: ledgerStartIndex,
    endIndex: ledgerEndIndex,
    totalCount: ledgerTotalCount,
    goPrev: ledgerGoPrev,
    goNext: ledgerGoNext,
    setPage: setLedgerPage,
  } = usePagination(filteredMovements, 10)

  const handleInventoryAction = (id: string, label: string) => {
    if (label === 'Xem chi tiết') {
      setSelectedId(id)
      return
    }
    if (label === 'Nhập hàng ngay' || label === 'Tạo đề nghị nhập khẩn') {
      resetRestockForm({ itemId: id, amount: '' })
      setRestockOpen(true)
      return
    }
    if (label === 'Ngừng kinh doanh' || label === 'Tiếp tục kinh doanh') {
      const item = inventoryItems.find((i) => i.id === id)
      if (!item) return
      
      const isCurrentlyActive = label === 'Ngừng kinh doanh'
      setInventoryItems(prev => prev.map(i => i.id === id ? {
        ...i,
        stockClassName: isCurrentlyActive ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
        stockLabel: isCurrentlyActive ? 'Ngừng KD' : 'Tồn kho tốt',
        actions: i.actions.map(a => a.label === label ? { ...a, label: isCurrentlyActive ? 'Tiếp tục kinh doanh' : 'Ngừng kinh doanh', icon: isCurrentlyActive ? 'play_arrow' : 'block' } : a)
      } : i))
      
      showToast(`Đã ${isCurrentlyActive ? 'ngừng' : 'tiếp tục'} kinh doanh sản phẩm ${item.name}`)
      return
    }
    if (label === 'Điều chỉnh kho') {
      setAdjustItem(inventoryItems.find((i) => i.id === id) ?? null)
      setAdjustChangeType('decrease')
      setAdjustAmount('1')
      setAdjustReason('DAMAGED')
      setAdjustNote('')
      setAdjustOpen(true)
      return
    }
    const item = inventoryItems.find((i) => i.id === id)
    showToast(`Đã thực hiện "${label}" cho ${item?.name ?? id}`)
  }

  const restockItem = inventoryItems.find((i) => i.id === restockForm.itemId) ?? null

  const handleConfirmRestock = () => {
    const amount = Number.parseInt(restockForm.amount, 10)
    if (!restockItem || !restockForm.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      showToast('Vui lòng nhập số lượng hợp lệ')
      return
    }
    const currentQty = Number.parseInt(restockItem.stockQuantity, 10) || 0
    const unit = restockItem.unit
    const newQty = currentQty + amount
    setInventoryItems((prev) =>
      prev.map((item) =>
        item.id === restockItem.id
          ? {
              ...item,
              stockQuantity: String(newQty),
              stockBarClassName: 'bg-emerald-600',
              stockBarWidth: '100%',
              stockLabel: 'Tồn kho tốt',
              stockClassName: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
              stockDotClassName: 'bg-[#16A34A]',
              updatedAgo: 'Vừa xong',
              updatedBy: 'Bạn (Thủ kho)',
            }
          : item,
      ),
    )

    const newMovement: StockMovement = {
      id: `SM-${Date.now().toString().slice(-4)}`,
      productId: restockItem.id,
      productName: restockItem.name,
      sku: restockItem.sku,
      movementType: 'STOCK_IN',
      quantityChange: amount,
      balanceAfter: newQty,
      unit: unit || 'đơn vị',
      referenceId: `PNK-${Date.now().toString().slice(-4)}`,
      createdAt: 'Vừa xong',
      createdBy: 'Bạn (Thủ kho)',
      note: 'Nhập kho bổ sung vật tư đại lý Hai Thắng',
    }
    setStockMovements((prev) => [newMovement, ...prev])
    showToast(`Đã nhập thêm ${amount} ${unit} vào kho cho ${restockItem.name}`)
    setRestockOpen(false)
  }

  const handleConfirmAdjust = () => {
    const targetItem = adjustItem || inventoryItems[0]
    const amount = Number.parseInt(adjustAmount, 10)
    if (!targetItem || !adjustAmount.trim() || Number.isNaN(amount) || amount <= 0) {
      showToast('Vui lòng chọn sản phẩm và nhập số lượng điều chỉnh hợp lệ (> 0)')
      return
    }
    const currentQty = Number.parseInt(targetItem.stockQuantity, 10) || 0
    const unit = targetItem.unit
    const delta = adjustChangeType === 'decrease' ? -amount : amount
    const newQty = Math.max(0, currentQty + delta)

    setInventoryItems((prev) =>
      prev.map((item) =>
        item.id === targetItem.id
          ? {
              ...item,
              stockQuantity: String(newQty),
              stockLabel: newQty === 0 ? 'Hết hàng' : newQty < 20 ? 'Sắp hết' : 'Tồn kho tốt',
              stockClassName:
                newQty === 0
                  ? 'bg-[#FEE2E2] text-error border-error/30'
                  : newQty < 20
                  ? 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                  : 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
              stockDotClassName:
                newQty === 0 ? 'bg-error' : newQty < 20 ? 'bg-[#D97706]' : 'bg-[#16A34A]',
              updatedAgo: 'Vừa xong',
              updatedBy: 'Bạn (Thủ kho)',
            }
          : item,
      ),
    )

    const reasonObj = ADJUST_REASONS.find((r) => r.value === adjustReason)
    const newMovement: StockMovement = {
      id: `SM-${Date.now().toString().slice(-4)}`,
      productId: targetItem.id,
      productName: targetItem.name,
      sku: targetItem.sku,
      movementType: 'ADJUSTMENT',
      quantityChange: delta,
      balanceAfter: newQty,
      unit: unit || 'đơn vị',
      reason: adjustReason,
      referenceId: `DCK-${Date.now().toString().slice(-4)}`,
      createdAt: 'Vừa xong',
      createdBy: 'Bạn (Thủ kho)',
      note: adjustNote.trim() || `Điều chỉnh kho (${reasonObj?.label ?? adjustReason})`,
    }
    setStockMovements((prev) => [newMovement, ...prev])
    showToast(`Đã ghi nhận điều chỉnh kho (${delta > 0 ? '+' : ''}${delta} ${unit}) cho ${targetItem.name}`)
    setAdjustOpen(false)
  }

  const handleExportInventory = () => {
    downloadCsv(
      `bien-ban-kiem-ke-${Date.now()}.csv`,
      filteredInventory.map((item) => ({
        'Mã kho': item.id,
        'Tên sản phẩm': item.name,
        'SKU': item.sku,
        'Danh mục': item.categoryLabel,
        'Số lượng': item.stockQuantity,
        'Đơn vị': item.unit,
        'Trạng thái': item.stockLabel,
      })),
    )
    showToast(`Đã xuất biên bản kiểm kê ${filteredInventory.length} mặt hàng`)
  }

  const handleExportLedger = () => {
    downloadCsv(
      `so-bien-dong-the-kho-${Date.now()}.csv`,
      filteredMovements.map((m) => ({
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
    showToast(`Đã xuất sổ biến động thẻ kho (${filteredMovements.length} bản ghi)`)
  }

  const totalCount = inventoryItems.length
  const lowStockCount = inventoryItems.filter((item) => item.stockLabel === 'Sắp hết').length
  const outOfStockCount = inventoryItems.filter((item) => item.stockLabel === 'Hết hàng').length

  const totalMovementsCount = stockMovements.length
  const stockInCount = stockMovements.filter((m) => m.movementType === 'STOCK_IN').length
  const saleCount = stockMovements.filter((m) => m.movementType === 'SALE').length
  const adjustmentCount = stockMovements.filter((m) => m.movementType === 'ADJUSTMENT').length

  const restockFields: FormFieldSpec[] = [
    {
      key: 'itemId',
      label: 'Sản phẩm',
      type: 'select',
      options: inventoryItems.map((item) => ({ value: item.id, label: `${item.name} (${item.sku})` })),
    },
    {
      key: 'currentStockNote',
      type: 'note',
      content: restockItem ? (
        <p className="text-body-sm text-outline">
          Tồn hiện tại: <span className="font-semibold text-on-surface">{restockItem.stockQuantity} {restockItem.unit}</span>
        </p>
      ) : null,
    },
    { key: 'amount', label: 'Số lượng nhập thêm', type: 'number', min: '1', placeholder: 'Nhập số lượng' },
  ]

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      {/* BREADCRUMB & HEADER SECTION */}
      {/* BREADCRUMB & HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link className="hover:text-slate-900 transition-colors" to="/">Bảng điều khiển</Link>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Quản lý kho &amp; Thẻ kho (WF-05)</span>
          </nav>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Đại lý Hai Thắng • ĐBSCL
          </span>
        </div>
        {/* Major Operational Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50/50 transition-colors shadow-sm"
            type="button"
            onClick={activeTab === 'stock' ? handleExportInventory : handleExportLedger}
          >
            <Download size={16} className="text-slate-500" />
            <span>{activeTab === 'stock' ? 'Xuất kiểm kê CSV' : 'Xuất thẻ kho CSV'}</span>
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 text-sm font-medium rounded-lg transition-colors shadow-sm"
            type="button"
            onClick={() => {
              setAdjustItem(inventoryItems[0] ?? null)
              setAdjustChangeType('decrease')
              setAdjustAmount('1')
              setAdjustReason('DAMAGED')
              setAdjustNote('')
              setAdjustOpen(true)
            }}
          >
            <SlidersHorizontal size={16} className="text-amber-600" />
            <span>Điều chỉnh kho (WF-05)</span>
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            type="button"
            onClick={() => {
              resetRestockForm({ itemId: inventoryItems[0]?.id ?? '', amount: '' })
              setRestockOpen(true)
            }}
          >
            <Plus size={16} />
            <span>Nhập kho</span>
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'stock'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Package size={18} />
          <span>Tồn kho hiện tại</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            activeTab === 'stock' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {totalCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ledger'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Receipt size={18} />
          <span>Sổ biến động thẻ kho (Append-Only)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            activeTab === 'ledger' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {totalMovementsCount}
          </span>
        </button>
      </div>

      {/* TAB 1: TỒN KHO HIỆN TẠI */}
      {activeTab === 'stock' && (
        <div className="space-y-space-lg">
          {/* 4 KPI SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1: Total Stocked Items */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng mặt hàng trong kho</span>
                <div className="p-2.5 bg-slate-100 rounded-lg text-emerald-600">
                  <Package size={20} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900 tabular-nums">{totalCount} <span className="text-xs font-medium text-slate-500">mặt hàng</span></div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>9 danh mục vật tư lúa ĐBSCL</span>
                </div>
              </div>
            </div>

            {/* Card 2: Low Stock Warning */}
            <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sắp hết hàng</span>
                <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600">
                  <AlertTriangle size={20} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-amber-600 tabular-nums">{lowStockCount} <span className="text-xs font-medium text-slate-500">mặt hàng</span></div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                  <TrendingDown size={14} />
                  <span>Dưới ngưỡng an toàn, cần nhập thêm</span>
                </div>
              </div>
            </div>

            {/* Card 3: Out of Stock Alert */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hết hàng</span>
                <div className="p-2.5 bg-rose-50 rounded-lg text-rose-500">
                  <Ban size={20} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-rose-600 tabular-nums">{outOfStockCount} <span className="text-xs font-medium text-slate-500">mặt hàng</span></div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-500 font-medium">
                  <AlertTriangle size={14} />
                  <span>Tồn kho 0, tạm ngưng bán</span>
                </div>
              </div>
            </div>

            {/* Card 4: Total Inventory Value */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Giá trị tồn kho</span>
                <div className="p-2.5 bg-slate-100 rounded-lg text-emerald-600">
                  <DollarSign size={20} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-emerald-600 tabular-nums">1.845.600.000 <span className="text-xs font-medium text-slate-500">₫</span></div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Giá vốn kho Đại lý Hai Thắng</span>
                </div>
              </div>
            </div>
          </div>

          {/* FILTERS & SEARCH CONTROLS */}
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm sản phẩm, mã SKU, hoạt chất..." className="relative flex-1" />
            <div className="flex flex-wrap items-center gap-2.5">
              <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={CATEGORY_OPTIONS} className="relative min-w-[150px]" />
              <FilterSelect value={stockFilter} onChange={setStockFilter} options={STOCK_OPTIONS} className="relative min-w-[150px]" />
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

          {/* MAIN INVENTORY DATA TABLE */}
          <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                    <th className="py-3 px-4" scope="col">Sản phẩm &amp; Hoạt chất</th>
                    <th className="py-3 px-3" scope="col">SKU</th>
                    <th className="py-3 px-3 text-center" scope="col">Danh mục</th>
                    <th className="py-3 px-3 text-center" scope="col">Số lượng</th>
                    <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                    <th className="py-3 px-3" scope="col">Cập nhật gần nhất</th>
                    <th className="py-3 px-4 text-center w-28" scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
                  {paginated.length === 0 ? (
                    <EmptyTableRow colSpan={7} message="Không tìm thấy sản phẩm phù hợp với bộ lọc." />
                  ) : null}
                  {paginated.map((item) => {
                    const isSelected = item.id === selectedId
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-emerald-50/50 hover:bg-emerald-50 border-l-2 border-l-emerald-500'
                            : `hover:bg-slate-50/50 ${item.rowClassName ?? ''}`
                        }`}
                      >
                        <td className="py-4.5 px-4">
                          <div className="flex flex-col">
                            <span className={`font-semibold text-sm group-hover:text-emerald-600 transition-colors ${item.nameClassName ?? 'text-slate-900'}`}>
                              {item.name}
                            </span>
                            <span className="text-xs text-slate-500 mt-0.5">{item.description}</span>
                          </div>
                        </td>
                        <td className="py-4.5 px-3 font-mono text-xs text-slate-500 font-medium">{item.sku}</td>
                        <td className="py-4.5 px-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[110px] px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getCategoryBadgeClassName(item.categoryLabel)}`}>{item.categoryLabel}</span>
                        </td>
                        <td className="py-4.5 px-3 text-center">
                          <span className={`font-semibold font-mono ${item.stockQuantityClassName ?? 'text-slate-900'}`}>{item.stockQuantity}</span>
                        </td>
                        <td className="py-4.5 px-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[120px] px-2 py-0.5 rounded-full text-[11px] font-semibold border ${item.stockClassName}`}>
                            {item.stockLabel}
                          </span>
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
                              actions={item.actions.map((action) => ({
                                ...action,
                                onClick: () => handleInventoryAction(item.id, action.label),
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
              totalCount={pageTotalCount}
              unitLabel="sản phẩm"
              goPrev={goPrev}
              goNext={goNext}
              setPage={setPage}
            />
          </div>

          {/* 2-COLUMN AUXILIARY LOWER SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* COLUMN 1: CẢNH BÁO SẮP HẾT HÀNG KHẨN CẤP */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <h2 className="font-semibold text-slate-900 text-sm">Vật tư cần nhập khẩn</h2>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-medium">Ngưỡng báo động</span>
              </div>
              <div className="p-4 divide-y divide-slate-50">
                {/* Alert Item 1: Virtako 40WG */}
                <div className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-xs">Thuốc Trừ Sâu Virtako 40WG</h3>
                      <div className="text-[11px] text-rose-600 font-medium">Tồn 0 / Ngưỡng 40 gói (Kho D)</div>
                    </div>
                  </div>
                  <button
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium transition-colors shadow-sm"
                    type="button"
                    onClick={() => showToast('Đã tạo đề nghị nhập khẩn: Thuốc Trừ Sâu Virtako 40WG')}
                  >
                    Nhập khẩn
                  </button>
                </div>
                {/* Alert Item 2: Beam 75WP */}
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <TrendingDown size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-xs">Thuốc Trừ Bệnh Beam 75WP</h3>
                      <div className="text-[11px] text-amber-600 font-medium">Tồn 8 / Ngưỡng 50 gói (Kho D)</div>
                    </div>
                  </div>
                  <button
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50/50 text-slate-700 text-xs font-medium transition-colors"
                    type="button"
                    onClick={() => showToast('Đã tạo đề nghị nhập: Thuốc Trừ Bệnh Beam 75WP')}
                  >
                    Đề nghị nhập
                  </button>
                </div>
                {/* Alert Item 3: Phân NPK Đầu Trâu */}
                <div className="py-2.5 last:pb-0 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <TrendingDown size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-xs">Phân NPK Đầu Trâu 20-20-15+TE</h3>
                      <div className="text-[11px] text-amber-600 font-medium">Tồn 14 / Ngưỡng 30 bao (Kho B)</div>
                    </div>
                  </div>
                  <button
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50/50 text-slate-700 text-xs font-medium transition-colors"
                    type="button"
                    onClick={() => showToast('Đã tạo đề nghị nhập: Phân NPK Đầu Trâu 20-20-15+TE')}
                  >
                    Đề nghị nhập
                  </button>
                </div>
              </div>
            </div>

            {/* COLUMN 2: NHẬT KÝ XUẤT NHẬP KHO GẦN ĐÂY */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-emerald-600" />
                  <h2 className="font-semibold text-slate-900 text-sm">Biến động thẻ kho gần đây</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('ledger')}
                  className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <span>Xem sổ thẻ kho</span>
                  <ArrowRight size={14} />
                </button>
              </div>
              <div className="p-4 divide-y divide-slate-50">
                {stockMovements.slice(0, 3).map((m) => (
                  <div key={m.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          m.movementType === 'STOCK_IN'
                            ? 'bg-emerald-100 text-emerald-700'
                            : m.movementType === 'SALE'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        {m.movementType === 'STOCK_IN' ? 'NHẬP' : m.movementType === 'SALE' ? 'XUẤT' : 'ĐIỀU CHỈNH'}
                      </span>
                      <div>
                        <span className="font-semibold text-slate-900 text-xs">
                          {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange} {m.unit} {m.productName}
                        </span>
                        <div className="text-[11px] text-slate-500">
                          {m.referenceId ? `${m.referenceId} • ` : ''}{m.note || m.createdBy}
                        </div>
                      </div>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px] shrink-0">{m.createdAt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SỔ BIẾN ĐỘNG THẺ KHO (APPEND-ONLY LEDGER - WF-05) */}
      {activeTab === 'ledger' && (
        <div className="space-y-space-lg">
          {/* LEDGER 4 KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng giao dịch thẻ kho</span>
                <div className="p-2.5 bg-slate-100 rounded-lg text-emerald-600">
                  <History size={20} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900 tabular-nums">{totalMovementsCount} <span className="text-xs font-medium text-slate-500">lượt ghi sổ</span></div>
                <div className="mt-1 text-xs text-slate-500">Lịch sử append-only bất biến</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lượt nhập kho (STOCK_IN)</span>
                <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
                  <Plus size={20} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-emerald-700 tabular-nums">{stockInCount} <span className="text-xs font-medium text-slate-500">lần nhập</span></div>
                <div className="mt-1 text-xs text-emerald-700 font-medium">Nhập từ nhà phân phối</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lượt xuất bán (SALE)</span>
                <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600">
                  <ShoppingCart size={20} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-blue-700 tabular-nums">{saleCount} <span className="text-xs font-medium text-slate-500">đơn xuất</span></div>
                <div className="mt-1 text-xs text-blue-600">Khấu trừ tự động theo đơn</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Điều chỉnh kiểm kê</span>
                <div className="p-2.5 bg-purple-50 rounded-lg text-purple-600">
                  <FileText size={20} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-purple-700 tabular-nums">{adjustmentCount} <span className="text-xs font-medium text-slate-500">lần điều chỉnh</span></div>
                <div className="mt-1 text-xs text-purple-700 font-medium">Ghi nhận hư hỏng / hao hụt</div>
              </div>
            </div>
          </div>

          {/* AUDIT POLICY BANNER (CLEAN & COMPACT) */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-900">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <span className="font-semibold">Thẻ kho điện tử kiểm toán (WF-05)</span>
              <span className="text-slate-500 hidden sm:inline">• Lịch sử bất biến (Append-Only)</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 flex-wrap">
              <span>Mã kiểm toán:</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 font-semibold">DAMAGED</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 font-semibold">EXPIRED</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 font-semibold">LOST</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900 font-semibold">MANUAL_CORRECTION</span>
            </div>
          </div>

          {/* LEDGER SEARCH & FILTER BAR */}
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <SearchInput
              value={ledgerSearch}
              onChange={setLedgerSearch}
              placeholder="Tìm theo mã GD, SKU, sản phẩm, mã đơn, người lập..."
              className="relative flex-1"
            />
            <div className="flex items-center gap-3">
              <FilterSelect
                value={ledgerTypeFilter}
                onChange={setLedgerTypeFilter}
                options={MOVEMENT_TYPE_OPTIONS}
                className="relative min-w-[200px]"
              />
              <button
                type="button"
                onClick={() => {
                  setLedgerSearch('')
                  setLedgerTypeFilter('ALL')
                }}
                className="px-3 py-1.5 h-9 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw size={14} />
                <span>Đặt lại</span>
              </button>
            </div>
          </div>

          {/* STOCK MOVEMENTS TABLE */}
          <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                    <th className="py-3 px-4" scope="col">Mã GD &amp; Thời gian</th>
                    <th className="py-3 px-3" scope="col">Sản phẩm &amp; SKU</th>
                    <th className="py-3 px-3 text-center" scope="col">Loại biến động</th>
                    <th className="py-3 px-3 text-center" scope="col">Biến động</th>
                    <th className="py-3 px-3 text-center" scope="col">Tồn sau GD</th>
                    <th className="py-3 px-3" scope="col">Lý do / Tham chiếu</th>
                    <th className="py-3 px-3" scope="col">Người thực hiện</th>
                    <th className="py-3 px-4" scope="col">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {paginatedMovements.length === 0 ? (
                    <EmptyTableRow colSpan={8} message="Không có bản ghi biến động thẻ kho phù hợp." />
                  ) : null}
                  {paginatedMovements.map((m) => {
                    const isPositive = m.quantityChange > 0
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-bold text-slate-900">{m.id}</span>
                            <span className="text-[11px] text-slate-500 mt-0.5">{m.createdAt}</span>
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-slate-900">{m.productName}</span>
                            <span className="font-mono text-[11px] text-slate-500">{m.sku}</span>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              m.movementType === 'STOCK_IN'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : m.movementType === 'SALE'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                m.movementType === 'STOCK_IN'
                                  ? 'bg-emerald-500'
                                  : m.movementType === 'SALE'
                                  ? 'bg-blue-600'
                                  : 'bg-purple-600'
                              }`}
                            ></span>
                            {m.movementType === 'STOCK_IN'
                              ? 'Nhập kho'
                              : m.movementType === 'SALE'
                              ? 'Xuất bán'
                              : 'Điều chỉnh'}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span
                            className={`font-semibold font-mono ${
                              isPositive ? 'text-emerald-600' : 'text-slate-900'
                            }`}
                          >
                            {isPositive ? `+${m.quantityChange}` : m.quantityChange} {m.unit}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                            {m.balanceAfter} <span className="font-normal text-xs text-slate-500">{m.unit}</span>
                          </span>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex flex-col gap-1">
                            {m.reason ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                                {m.reason}
                              </span>
                            ) : null}
                            {m.referenceId ? (
                              <span className="font-mono text-xs text-slate-500 font-medium">
                                Ref: {m.referenceId}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-3 text-xs text-slate-900 font-medium">
                          {m.createdBy}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 max-w-[240px] truncate" title={m.note}>
                          {m.note || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={ledgerPage}
              totalPages={ledgerTotalPages}
              startIndex={ledgerStartIndex}
              endIndex={ledgerEndIndex}
              totalCount={ledgerTotalCount}
              unitLabel="giao dịch thẻ kho"
              goPrev={ledgerGoPrev}
              goNext={ledgerGoNext}
              setPage={setLedgerPage}
            />
          </div>
        </div>
      )}

      {/* DETAIL MODAL: CHI TIẾT THẺ KHO */}
      <DetailModal open={selectedItem !== null} onClose={() => setSelectedId(null)}>
        {selectedItem ? (
          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-slate-900">{selectedItem.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{selectedItem.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] text-slate-500 font-medium px-2 py-0.5 bg-slate-50 border border-slate-200 rounded">{selectedItem.sku}</span>
              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">{selectedItem.categoryLabel}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${selectedItem.stockClassName}`}>
                {selectedItem.stockLabel}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Số lượng</span>
                <span className="font-semibold text-slate-900 tabular-nums">{selectedItem.stockQuantity}</span>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Cập nhật gần nhất: <strong className="text-slate-900">{selectedItem.updatedAgo}</strong> bởi {selectedItem.updatedBy}
            </div>
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const item = selectedItem
                  setSelectedId(null)
                  setAdjustItem(item)
                  setAdjustChangeType('decrease')
                  setAdjustAmount('1')
                  setAdjustReason('DAMAGED')
                  setAdjustNote('')
                  setAdjustOpen(true)
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold hover:bg-amber-100"
              >
                Điều chỉnh kho mặt hàng này
              </button>
            </div>
          </div>
        ) : null}
      </DetailModal>

      {/* MODAL: NHẬP KHO */}
      <FormModal
        open={restockOpen}
        onClose={() => setRestockOpen(false)}
        title="Nhập kho vật tư Hai Thắng"
        fields={restockFields}
        values={restockForm}
        onChange={updateRestockForm}
        onSubmit={handleConfirmRestock}
        submitLabel="Xác nhận nhập kho"
      />

      {/* MODAL: ĐIỀU CHỈNH KHO KIỂM KÊ (WF-05 AUDITABLE ADJUSTMENT) */}
      {adjustOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Điều chỉnh tồn kho kiểm kê</h3>
                  <p className="text-xs text-slate-500">Ghi sổ thẻ kho append-only theo quy chuẩn WF-05</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Sản phẩm điều chỉnh <span className="text-rose-500">*</span>
                </label>
                <select
                  value={adjustItem?.id ?? inventoryItems[0]?.id ?? ''}
                  onChange={(e) => {
                    const found = inventoryItems.find((i) => i.id === e.target.value) ?? null
                    setAdjustItem(found)
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.sku}) - Hiện tồn: {item.stockQuantity} {item.unit}
                    </option>
                  ))}
                </select>
                {adjustItem && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Hiện tại kho ghi nhận: <strong className="text-slate-900">{adjustItem.stockQuantity} {adjustItem.unit}</strong>
                  </p>
                )}
              </div>

              {/* Adjustment Direction */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Hình thức điều chỉnh <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustChangeType('decrease')}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                      adjustChangeType === 'decrease'
                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50/50'
                    }`}
                  >
                    <TrendingDown size={18} />
                    <span>Giảm tồn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustChangeType('increase')}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                      adjustChangeType === 'increase'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50/50'
                    }`}
                  >
                    <Plus size={18} />
                    <span>Tăng tồn</span>
                  </button>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Số lượng thay đổi <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="Nhập số lượng"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold"
                  />
                  <span className="text-xs font-semibold text-slate-500 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                    {adjustItem?.unit || 'đơn vị'}
                  </span>
                </div>
              </div>

              {/* Mandatory Reason Select (WF-05 / ERD physical specification) */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Lý do kiểm kê bắt buộc (Audit Reason) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as StockAdjustmentReason)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  {ADJUST_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  {ADJUST_REASONS.find((r) => r.value === adjustReason)?.desc}
                </p>
              </div>

              {/* Note / Audit Trail */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Ghi chú biên bản kiểm kê / Vị trí bao bì
                </label>
                <textarea
                  rows={2}
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="Ví dụ: Rách vỏ do vận chuyển ghe từ Cần Thơ, biên bản kiểm đếm BB-042..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Calculation Preview Banner */}
              {adjustItem && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Dự tính tồn mới sau ghi sổ:</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {Math.max(
                      0,
                      (Number.parseInt(adjustItem.stockQuantity, 10) || 0) +
                        (adjustChangeType === 'decrease'
                          ? -(Number.parseInt(adjustAmount, 10) || 0)
                          : Number.parseInt(adjustAmount, 10) || 0),
                    )}{' '}
                    {adjustItem.unit}
                  </span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAdjustOpen(false)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50/50 text-sm font-medium transition-colors shadow-sm"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmAdjust}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-sm"
              >
                Xác nhận điều chỉnh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
