import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { packagingLabel } from '@/utils/packaging'
import type { CartItem } from './CounterSalesPage'
import { Search } from 'lucide-react'
import { catalogApi } from '@/api/catalogApi'
import type { CatalogProduct, CatalogCategory, CatalogProductDetail, CatalogPackaging } from '@/api/types'
import { formatVnd } from '@/utils/money'
import { useToast } from '@/context/ToastContext'

interface ProductSearchPanelProps {
  onAddToCart: (item: CartItem) => void
}

export default function ProductSearchPanel({ onAddToCart }: ProductSearchPanelProps) {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [catsLoading, setCatsLoading] = useState(false)
  const { showToast } = useToast()
  // Product whose selling packaging the staff must pick (bao, hộp, chai…): price and quantity always belong to a packaging.
  const [choosing, setChoosing] = useState<CatalogProductDetail | null>(null)

  useEffect(() => {
    const fetchCats = async () => {
      setCatsLoading(true)
      try {
        const res = await catalogApi.getCategories()
        // Giả sử API trả về mảng trực tiếp hoặc { items: ... }
        setCategories((res as any).items || res || [])
      } catch (err) {
        console.warn("Lỗi tải danh mục:", err)
      } finally {
        setCatsLoading(false)
      }
    }
    fetchCats()
  }, [])

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      try {
        const params: any = { search, pageSize: 50 }
        if (categoryId) params.categoryId = categoryId
        
        const res = await catalogApi.getProducts(params)
        setProducts(res.items)
      } catch {
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    const timer = setTimeout(fetchProducts, 300)
    return () => clearTimeout(timer)
  }, [search, categoryId])

  const handleSelectProduct = async (product: CatalogProduct) => {
    try {
      const detail = await catalogApi.getProductDetail(product.id)
      if (!detail.packagings || detail.packagings.length === 0) {
        showToast('Sản phẩm chưa có quy cách bán', 'warning')
        return
      }
      
      const priced = detail.packagings.filter(p => p.price !== null)
      if (priced.length === 0) {
        showToast('Sản phẩm chưa có giá bán lẻ nên chưa bán được', 'warning')
        return
      }
      if (detail.packagings.length === 1) addPackaging(detail, priced[0])
      else setChoosing(detail)
    } catch {
      showToast('Không tải được quy cách của sản phẩm', 'error')
    }
  }

  const addPackaging = (detail: CatalogProductDetail, pack: CatalogPackaging) => {
    onAddToCart({
      product: detail,
      packagingId: pack.id,
      packagingName: packagingLabel(pack),
      conversionToBase: pack.conversionToBase,
      quantity: 1,
      price: pack.price ?? 0,
    })
    setChoosing(null)
    showToast(`Đã thêm ${detail.name} · ${packagingLabel(pack)}`, 'success')
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="p-5 border-b border-outline-variant bg-surface-container-lowest sticky top-0 z-10">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Tìm theo mã, tên sản phẩm..." 
            className="w-full pl-12 pr-4 py-3 bg-surface-container/50 rounded-2xl border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
          <button 
            onClick={() => setCategoryId('')}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
              categoryId === '' 
              ? 'bg-primary text-on-primary border-primary shadow-sm scale-105' 
              : 'bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Tất cả
          </button>
          {!catsLoading && categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setCategoryId(cat.id)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                categoryId === cat.id 
                ? 'bg-primary text-on-primary border-primary shadow-sm scale-105' 
                : 'bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 bg-surface-container-lowest min-h-0">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="animate-pulse bg-surface-container border border-outline-variant/30 rounded-2xl h-[180px]"></div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-on-surface-variant/70 space-y-3">
            <span className="material-symbols-outlined text-5xl opacity-20">search_off</span>
            <p className="font-medium">Không tìm thấy sản phẩm</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map(p => (
              <div 
                key={p.id} 
                className="bg-surface border border-outline-variant/50 rounded-2xl p-4 cursor-pointer hover:border-primary/60 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col group overflow-hidden relative"
                onClick={() => handleSelectProduct(p)}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full -z-10 transition-transform group-hover:scale-125"></div>
                <div className="w-12 h-12 bg-surface-container-low rounded-xl mb-3 flex items-center justify-center border border-outline-variant/30 shadow-sm group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary/80 group-hover:text-primary transition-colors text-2xl">eco</span>
                </div>
                <div className="font-bold text-sm mb-1 text-on-surface line-clamp-2 group-hover:text-primary transition-colors">{p.name}</div>
                <div className="text-xs text-on-surface-variant mb-4 font-mono">{p.sku}</div>
                <div className="mt-auto font-bold text-primary text-base">
                  {p.fromPrice ? formatVnd(p.fromPrice) : <span className="text-on-surface-variant font-medium text-xs">Chưa có giá</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={choosing !== null} onClose={() => setChoosing(null)} title="Chọn quy cách bán">
        {choosing && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 mb-3">{choosing.name}</p>
            {choosing.packagings.map((pack) => {
              const label = packagingLabel(pack)
              const baseUnit = (choosing.packagings.find((p) => p.isBaseUnit)?.unitName ?? 'đơn vị cơ sở').toLowerCase()
              return (
                <button
                  key={pack.id}
                  type="button"
                  disabled={pack.price === null}
                  onClick={() => addPackaging(choosing, pack)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 text-left hover:border-emerald-500 hover:bg-emerald-50/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-slate-200 transition-colors"
                >
                  <span>
                    <span className="block font-semibold text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500">
                      {pack.isBaseUnit ? 'Đơn vị cơ sở' : `1 ${label.toLowerCase()} = ${pack.conversionToBase} ${baseUnit}`}
                    </span>
                  </span>
                  <span className="font-bold tabular-nums text-emerald-700">
                    {pack.price !== null ? formatVnd(pack.price) : <span className="text-xs font-medium text-slate-500">Chưa có giá</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
