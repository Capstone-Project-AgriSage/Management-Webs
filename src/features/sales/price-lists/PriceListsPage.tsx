import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, FilterX, Edit, Trash2, CheckCircle, Power, PowerOff } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import DetailModal from '@/components/ui/DetailModal'
import { priceListsApi } from '@/api/priceListsApi'
import type { PriceList, PriceListItem } from '@/api/priceListsApi'

export default function PriceListsPage() {
  usePageHeader({ title: 'Bảng giá', subtitle: 'Quản lý bảng giá tại cửa hàng' })
  const { showToast } = useToast()
  const { user } = useAuth()
  
  // isAdmin logic based on role or context. Assuming agent owner or admin has full rights.
  const isReadOnly = user?.role === 'sales_staff'

  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [selectedList, setSelectedList] = useState<PriceList | null>(null)
  const [items, setItems] = useState<PriceListItem[]>([])
  const [isItemsLoading, setIsItemsLoading] = useState(false)
  
  // Future: Add form state for Create/Update here (for simplicity now, just listing and actions)

  const fetchPriceLists = async () => {
    setIsLoading(true)
    try {
      const res = await priceListsApi.getPriceLists({ search, status: statusFilter || undefined })
      // Notice: backend does not paginate priceLists directly but returns Paged structure. Assuming page 1 returns all if no page param passed.
      setPriceLists(res.items)
      setTotalCount(res.totalCount)
      setTotalPages(res.totalPages)
    } catch (err: any) {
      showToast(err.detail || 'Lỗi tải danh sách', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(fetchPriceLists, 300)
    return () => clearTimeout(timer)
  }, [search, statusFilter, page])

  const handleOpenDetail = async (list: PriceList) => {
    setSelectedList(list)
    setIsItemsLoading(true)
    try {
      const res = await priceListsApi.getItems(list.id)
      setItems(res.items)
    } catch (err: any) {
      showToast(err.detail || 'Lỗi lấy chi tiết bảng giá', 'error')
    } finally {
      setIsItemsLoading(false)
    }
  }

  const handleToggleActive = async (list: PriceList) => {
    if (isReadOnly) return
    try {
      if (list.status === 'ACTIVE') {
        await priceListsApi.deactivate(list.id)
        showToast('Đã vô hiệu hóa bảng giá', 'success')
      } else {
        await priceListsApi.activate(list.id)
        showToast('Đã kích hoạt bảng giá', 'success')
      }
      fetchPriceLists()
      if (selectedList?.id === list.id) setSelectedList(null)
    } catch (err: any) {
      showToast(err.detail || 'Lỗi thao tác', 'error')
    }
  }

  const handleDelete = async (list: PriceList) => {
    if (isReadOnly) return
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bảng giá ${list.code}?`)) return
    try {
      await priceListsApi.delete(list.id)
      showToast('Xóa thành công', 'success')
      fetchPriceLists()
    } catch (err: any) {
      showToast(err.detail || 'Lỗi xóa', 'error')
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1 text-body-sm text-on-surface-variant" aria-label="Breadcrumb">
          <Link className="hover:text-primary transition-colors" to="/">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-on-surface font-medium">Bảng giá</span>
        </nav>
        {!isReadOnly && (
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            onClick={() => showToast('Chức năng tạo mới sẽ làm ở form riêng', 'info')}
          >
            <Plus size={16} />
            <span>Tạo bảng giá</span>
          </button>
        )}
      </div>

      <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm flex flex-wrap items-center justify-between gap-4 mt-2">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <SearchInput 
            value={search} 
            onChange={(val) => { setSearch(val); setPage(1) }} 
            placeholder="Tìm theo mã, tên..." 
            className="relative flex-1 min-w-[240px]" 
          />
          <div className="relative min-w-[180px]">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-full h-10 px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="DRAFT">Nháp</option>
              <option value="ACTIVE">Đang áp dụng</option>
              <option value="INACTIVE">Ngưng áp dụng</option>
            </select>
          </div>
          <button
            className="h-9 px-3 text-on-surface-variant hover:text-on-surface text-xs font-medium flex items-center gap-1 transition-colors"
            onClick={() => { setSearch(''); setStatusFilter(''); setPage(1) }}
            type="button"
          >
            <FilterX size={14} />
            <span>Xóa bộ lọc</span>
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface text-label-md font-bold bg-surface-container-low">
                <th className="py-4 pl-4 px-3 w-[150px]">Mã BG</th>
                <th className="py-4 px-3 min-w-[200px]">Tên bảng giá</th>
                <th className="py-4 px-3">Hiệu lực</th>
                <th className="py-4 px-3 text-center">Trạng thái</th>
                <th className="py-4 px-3 text-center">Mặc định</th>
                <th className="py-4 pr-4 pl-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm text-on-surface">
              {isLoading ? (
                <EmptyTableRow colSpan={6} message="Đang tải dữ liệu..." />
              ) : priceLists.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không tìm thấy bảng giá nào." />
              ) : null}
              {priceLists.map((list) => {
                return (
                  <tr
                    key={list.id}
                    onClick={() => handleOpenDetail(list)}
                    className="transition-colors cursor-pointer group hover:bg-surface-container-low"
                  >
                    <td className="py-4 pl-4 px-3 font-mono font-bold text-primary">
                      {list.code}
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-bold text-on-surface">{list.name}</div>
                      {list.description && <div className="text-xs text-on-surface-variant line-clamp-1">{list.description}</div>}
                    </td>
                    <td className="py-4 px-3 text-sm text-on-surface-variant">
                      <div>Từ: {new Date(list.effectiveFrom).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                      <div>Đến: {list.effectiveTo ? new Date(list.effectiveTo).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Vô thời hạn'}</div>
                    </td>
                    <td className="py-4 px-3 text-center">
                      {list.status === 'ACTIVE' && <StatusBadge label="Đang áp dụng" className="bg-emerald-100 text-emerald-800" />}
                      {list.status === 'INACTIVE' && <StatusBadge label="Ngưng áp dụng" className="bg-slate-100 text-slate-800" />}
                      {list.status === 'DRAFT' && <StatusBadge label="Nháp" className="bg-amber-100 text-amber-800" />}
                    </td>
                    <td className="py-4 px-3 text-center">
                      {list.isWalkInDefault && <CheckCircle size={16} className="text-emerald-600 inline-block" />}
                    </td>
                    <td className="py-4 pr-4 pl-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isReadOnly && list.status === 'DRAFT' && (
                          <button
                            title="Xóa"
                            onClick={(e) => { e.stopPropagation(); handleDelete(list) }}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {!isReadOnly && (list.status === 'ACTIVE' || list.status === 'INACTIVE') && (
                          <button
                            title={list.status === 'ACTIVE' ? 'Ngưng áp dụng' : 'Kích hoạt'}
                            onClick={(e) => { e.stopPropagation(); handleToggleActive(list) }}
                            className={`p-2 rounded-lg transition-colors ${list.status === 'ACTIVE' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          >
                            {list.status === 'ACTIVE' ? <PowerOff size={16} /> : <Power size={16} />}
                          </button>
                        )}
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
          unitLabel="bảng giá"
          goPrev={() => setPage(p => Math.max(1, p - 1))}
          goNext={() => setPage(p => Math.min(totalPages, p + 1))}
          setPage={setPage}
        />
      </div>

      <DetailModal open={selectedList !== null} onClose={() => setSelectedList(null)}>
        {selectedList ? (
          <>
            <div className="p-4 bg-surface-container-low border-b border-outline-variant flex justify-between items-center rounded-t-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-on-surface">{selectedList.name}</h3>
                  {selectedList.status === 'ACTIVE' && <StatusBadge label="Đang áp dụng" className="bg-emerald-100 text-emerald-800" />}
                </div>
                <div className="text-xs text-on-surface-variant font-mono mt-1">Mã: {selectedList.code}</div>
              </div>
            </div>
            
            <div className="p-4 bg-surface-container-lowest max-h-[60vh] overflow-y-auto">
              {isItemsLoading ? (
                <div className="py-10 text-center animate-pulse text-on-surface-variant">Đang tải danh sách giá...</div>
              ) : items.length === 0 ? (
                <div className="py-10 text-center text-on-surface-variant">Chưa có sản phẩm nào trong bảng giá này.</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider">
                    <tr>
                      <th className="p-3 font-medium">Sản phẩm</th>
                      <th className="p-3 font-medium text-right text-primary">Giá bán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-sm text-on-surface">{item.productName}</div>
                          <div className="text-xs text-on-surface-variant mt-0.5">{item.packagingName}</div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-primary">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.sellingPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 bg-surface-container-low border-t border-outline-variant rounded-b-xl flex gap-3 justify-end">
              <button
                className="px-6 py-2 bg-surface-container-high hover:bg-surface-container-highest font-bold rounded-xl transition-colors text-on-surface"
                onClick={() => setSelectedList(null)}
              >
                ĐÓNG
              </button>
            </div>
          </>
        ) : null}
      </DetailModal>
    </div>
  )
}
