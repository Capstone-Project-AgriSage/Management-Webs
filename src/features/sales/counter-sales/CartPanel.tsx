import { useState } from 'react'
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight, Loader2 } from 'lucide-react'
import { formatVnd } from '@/utils/money'
import { counterSalesApi } from '@/api/counterSalesApi'
import { useToast } from '@/context/ToastContext'
import type { CartItem } from './CounterSalesPage'
import type { CounterSalePreviewResponse } from '@/api/types'

interface CartPanelProps {
  items: CartItem[]
  onUpdateQuantity: (index: number, q: number) => void
  onRemoveItem: (index: number) => void
  onClearCart: () => void
}

export default function CartPanel({ items, onUpdateQuantity, onRemoveItem, onClearCart }: CartPanelProps) {
  const { showToast } = useToast()
  const [previewing, setPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState<CounterSalePreviewResponse | null>(null)
  const [selling, setSelling] = useState(false)

  const total = Math.round(items.reduce((sum, item) => sum + (item.price * item.quantity), 0))

  const handlePreview = async () => {
    if (items.length === 0) return
    setPreviewing(true)
    try {
      const res = await counterSalesApi.preview({
        customerType: 'WALK_IN',
        settlementType: 'FULL_PAYMENT',
        fulfillmentType: 'PICKUP',
        items: items.map(i => ({
          storeProductId: i.product.id,
          productPackagingId: i.packagingId,
          quantity: i.quantity
        }))
      })
      setPreviewData(res)
    } catch (err: any) {
      if (err.errors) {
        showToast(Object.values(err.errors).flat().join(', '), 'error')
      } else {
        showToast(err.detail || err.title || 'Lỗi kết nối khi xem trước đơn', 'error')
      }
    } finally {
      setPreviewing(false)
    }
  }

  const handleSell = async () => {
    if (!previewData) return
    if (previewData.items.some(i => i.shortageBaseQuantity > 0)) {
      showToast('Có sản phẩm không đủ hàng trong kho', 'error')
      return
    }
    
    setSelling(true)
    try {
      const res = await counterSalesApi.sell({
        customerType: 'WALK_IN',
        settlementType: 'FULL_PAYMENT',
        fulfillmentType: 'PICKUP',
        items: previewData.items.map(i => ({
          storeProductId: i.storeProductId,
          productPackagingId: i.productPackagingId,
          quantity: i.quantity,
          lots: i.lots.map(l => ({
            inventoryLotId: l.inventoryLotId,
            baseQuantity: l.suggestedBaseQuantity
          }))
        }))
      })
      showToast(`Thu tiền thành công! Mã đơn: ${res.order.orderNumber}`, 'success')
      setPreviewData(null)
      onClearCart()
    } catch (err: any) {
      if (err.errors) {
        showToast(Object.values(err.errors).flat().join(', '), 'error')
      } else {
        showToast(err.detail || err.title || 'Lỗi khi thanh toán', 'error')
      }
    } finally {
      setSelling(false)
    }
  }

  if (previewData) {
    return (
      <div className="flex flex-col h-full bg-surface shadow-lg z-10">
        <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">receipt_long</span>
            Xác nhận thanh toán
          </h2>
          <button 
            onClick={() => setPreviewData(null)} 
            className="text-on-surface-variant hover:text-on-surface text-sm font-medium"
          >
            Sửa đơn hàng
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {previewData.items.map((i, idx) => (
            <div key={idx} className={`p-4 rounded-xl border ${i.shortageBaseQuantity > 0 ? 'bg-error-container/20 border-error' : 'bg-surface-container-lowest border-outline-variant'}`}>
              <div className="font-bold text-base mb-1">{i.productName}</div>
              <div className="text-sm text-on-surface-variant flex justify-between mb-3">
                <span>{i.packagingName ?? 'Đơn vị cơ sở'} × {i.quantity}</span>
                <span className="font-bold text-on-surface">{formatVnd(i.lineTotalAmount)}</span>
              </div>
              
              {i.shortageBaseQuantity > 0 ? (
                <div className="text-error font-bold text-sm bg-error-container p-2 rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  {/* Shortage and lots are in base units; show the pack equivalent too when the pack holds several. */}
                  Thiếu {i.shortageBaseQuantity} đơn vị cơ sở
                  {i.conversionToBase > 1 && ` (≈ ${Math.ceil(i.shortageBaseQuantity / i.conversionToBase)} ${(i.packagingName ?? 'quy cách').toLowerCase()})`}
                  {' '}— không đủ tồn kho khả dụng
                </div>
              ) : (
                <div className="space-y-1 mt-2 pt-2 border-t border-outline-variant">
                  <div className="text-xs font-bold text-on-surface-variant mb-1 uppercase">Lô xuất (đơn vị cơ sở):</div>
                  {i.lots.map((l, lIdx) => (
                    <div key={lIdx} className="text-xs flex justify-between items-center bg-surface-container-low p-2 rounded">
                      <span className="font-medium text-on-surface-variant">
                        Lô: {l.lotNumber || 'N/A'} {l.expiryDate ? `(HSD: ${l.expiryDate})` : ''}
                      </span>
                      <span className="font-bold text-primary px-2 py-0.5 bg-primary-container rounded">
                        SL: {l.suggestedBaseQuantity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="p-6 border-t border-outline-variant/30 bg-surface shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] z-20">
          <div className="flex justify-between items-end mb-6">
            <span className="font-bold text-on-surface-variant uppercase text-sm tracking-wider">Khách phải trả</span>
            <span className="font-bold text-4xl text-emerald-600 tracking-tight">{formatVnd(previewData.totalAmount)}</span>
          </div>
          <button 
            className="w-full h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2"
            disabled={previewData.items.some(i => i.shortageBaseQuantity > 0) || selling}
            onClick={handleSell}
          >
            {selling ? (
              <span className="animate-pulse flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                ĐANG XỬ LÝ...
              </span>
            ) : (
              <>
                <span className="material-symbols-outlined text-2xl">payments</span>
                XÁC NHẬN & THU TIỀN
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest border-l border-outline-variant/30 z-10 relative">
      <div className="p-5 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest sticky top-0">
        <h2 className="font-bold text-xl flex items-center gap-3 text-on-surface">
          <ShoppingCart className="w-6 h-6 text-emerald-600" />
          Giỏ hàng 
          <span className="bg-emerald-100 text-emerald-700 text-sm font-bold px-3 py-0.5 rounded-full shadow-sm">{items.length}</span>
        </h2>
        {items.length > 0 && (
          <button onClick={onClearCart} className="text-rose-500 text-sm font-bold hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
            <Trash2 className="w-4 h-4" />
            Xóa hết
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-5">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-80">
            <div className="w-24 h-24 bg-surface-container rounded-full flex items-center justify-center mb-6 shadow-inner">
              <ShoppingCart className="w-10 h-10 text-on-surface-variant/50" />
            </div>
            <p className="font-bold text-xl text-on-surface mb-2">Giỏ hàng trống</p>
            <p className="text-sm text-center max-w-[200px]">Hãy chọn sản phẩm từ danh sách bên trái để bắt đầu</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="bg-surface border border-outline-variant/50 p-4 rounded-2xl flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all group">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-base leading-snug line-clamp-2 text-on-surface group-hover:text-emerald-700 transition-colors">{item.product.name}</div>
                  <button onClick={() => onRemoveItem(idx)} className="text-on-surface-variant hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-end mt-2">
                  <div>
                    <div className="text-xs text-on-surface-variant mb-1">{item.packagingName}</div>
                    <div className="text-emerald-600 font-bold text-lg">{formatVnd(item.price)}</div>
                  </div>
                  <div className="flex items-center gap-1 bg-surface-container-lowest rounded-xl p-1 border border-outline-variant/50 shadow-sm">
                    <button onClick={() => onUpdateQuantity(idx, Math.max(1, item.quantity - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-surface-container hover:text-rose-600 rounded-lg transition-colors text-on-surface-variant">
                      <Minus className="w-4 h-4" />
                    </button>
                    <QuantityInput
                      label={`Số lượng ${item.product.name}`}
                      value={item.quantity}
                      onChange={(q) => onUpdateQuantity(idx, q)}
                    />
                    <button onClick={() => onUpdateQuantity(idx, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-surface-container hover:text-emerald-600 rounded-lg transition-colors text-on-surface-variant">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-6 border-t border-outline-variant/30 bg-surface-container-lowest shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.03)] z-20">
        <div className="flex justify-between items-end mb-5">
          <span className="font-bold text-on-surface-variant uppercase text-sm tracking-wider">Tổng cộng</span>
          <span className="font-bold text-3xl text-emerald-600 tracking-tight">{formatVnd(total)}</span>
        </div>
        <div className="flex flex-col gap-3">
          <button
            className="w-full h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl font-bold flex justify-center items-center gap-2 disabled:opacity-50 transition-all shadow-md hover:shadow-emerald-500/25 text-base"
            disabled={items.length === 0 || previewing}
            onClick={handlePreview}
          >
            {previewing ? (
              <span className="flex items-center gap-2 animate-pulse"><Loader2 className="w-5 h-5 animate-spin" /> ĐANG TÍNH TOÁN...</span>
            ) : (
              <>
                BÁN NHANH (THU TIỀN NGAY) <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Pack count typed by hand: keeps the text while the field is being edited (so clearing it to type "15" works)
 * and commits a number between 1 and 100,000,000 (FE_GUIDE_FLOW_1 §M3).
 */
function QuantityInput({ label, value, onChange }: { label: string; value: number; onChange: (q: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (text: string) => {
    const q = Number(text)
    onChange(Number.isFinite(q) && q >= 1 ? Math.min(100_000_000, Math.floor(q)) : value)
    setDraft(null)
  }
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      className="w-14 h-8 text-center font-bold text-base bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 rounded-lg"
      value={draft ?? String(value)}
      onChange={(e) => {
        const text = e.target.value.replace(/[^\d]/g, '')
        setDraft(text)
        if (Number(text) >= 1) onChange(Math.min(100_000_000, Number(text)))
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}
