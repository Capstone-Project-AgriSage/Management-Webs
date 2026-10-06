import { Loader2 } from 'lucide-react'
import { formatVnd } from '@/utils/money'
import type { CounterSalePreviewResponse } from '@/api/types'

interface QuickSaleReviewProps {
  preview: CounterSalePreviewResponse
  selling: boolean
  onBack: () => void
  onSell: () => void
}

/** FE_GUIDE_FLOW_1 §M7: before a quick sale the staff sees each line, its price and the lots that will leave stock. */
export default function QuickSaleReview({ preview, selling, onBack, onSell }: QuickSaleReviewProps) {
  const short = preview.items.some((i) => i.shortageBaseQuantity > 0)
  return (
    <div className="flex flex-col h-full bg-surface shadow-lg z-10">
      <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">receipt_long</span>
          Xác nhận thanh toán
        </h2>
        <button type="button" onClick={onBack} className="text-on-surface-variant hover:text-on-surface text-sm font-medium">
          Sửa đơn hàng
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {preview.items.map((i) => (
          <div key={`${i.storeProductId}-${i.productPackagingId}`} className={`p-4 rounded-xl border ${i.shortageBaseQuantity > 0 ? 'bg-error-container/20 border-error' : 'bg-surface-container-lowest border-outline-variant'}`}>
            <div className="font-bold text-base mb-1">{i.productName}</div>
            <div className="text-sm text-on-surface-variant flex justify-between mb-3">
              <span>
                {i.packagingName ?? 'Đơn vị cơ sở'} × {i.quantity}
                {i.unitPrice !== i.suggestedUnitPrice && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">đã sửa giá</span>}
              </span>
              <span className="font-bold text-on-surface tabular-nums">{formatVnd(i.lineTotalAmount)}</span>
            </div>
            {i.shortageBaseQuantity > 0 ? (
              <div className="text-error font-bold text-sm bg-error-container p-2 rounded-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                Thiếu {i.shortageBaseQuantity} đơn vị cơ sở
                {i.conversionToBase > 1 && ` (≈ ${Math.ceil(i.shortageBaseQuantity / i.conversionToBase)} ${(i.packagingName ?? 'quy cách').toLowerCase()})`} — không đủ tồn kho khả dụng
              </div>
            ) : (
              <div className="space-y-1 mt-2 pt-2 border-t border-outline-variant">
                <div className="text-xs font-bold text-on-surface-variant mb-1 uppercase">Lô xuất (đơn vị cơ sở):</div>
                {i.lots.map((l) => (
                  <div key={l.inventoryLotId} className="text-xs flex justify-between items-center bg-surface-container-low p-2 rounded">
                    <span className="font-medium text-on-surface-variant">
                      Lô: {l.lotNumber || 'N/A'} {l.expiryDate ? `(HSD: ${l.expiryDate})` : ''}
                    </span>
                    <span className="font-bold text-primary px-2 py-0.5 bg-primary-container rounded">SL: {l.suggestedBaseQuantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-6 border-t border-outline-variant/30 bg-surface z-20">
        <div className="flex justify-between items-end mb-6">
          <span className="font-bold text-on-surface-variant uppercase text-sm tracking-wider">Khách phải trả</span>
          <span className="font-bold text-4xl text-emerald-600 tracking-tight tabular-nums">{formatVnd(preview.totalAmount)}</span>
        </div>
        <button
          type="button"
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg flex items-center justify-center gap-2"
          disabled={short || selling}
          onClick={onSell}
        >
          {selling ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> ĐANG XỬ LÝ...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-2xl">payments</span> XÁC NHẬN & THU TIỀN
            </>
          )}
        </button>
      </div>
    </div>
  )
}
