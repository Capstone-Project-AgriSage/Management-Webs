import ModalLayout from '@/components/ui/ModalLayout'
import { useState, useEffect } from 'react'
import DetailModal from '@/components/ui/DetailModal'
import { useToast } from '@/context/ToastContext'
import { ApiError } from '@/api/client'
import { deliveriesApi, type DeliveryItem } from '@/api/deliveriesApi'
import { inventoryApi } from '@/api/inventoryApi'
import type { InventoryLot } from '@/api/types'
import { formatDate, openAllocationQuantity } from '@/utils/deliveryLabels'

interface EditDeliveryLotsModalProps {
  open: boolean
  onClose: () => void
  deliveryId: string
  item: DeliveryItem
  /** Delivery lines don't carry it; the parent resolves it from the order line. */
  storeProductId: string | null
  onSuccess: () => void
}

interface LotPick {
  inventoryLotId: string
  baseQuantity: number
}

// §Q4: the new lots must add up to exactly the undelivered part of the line, same product, still sellable.
export default function EditDeliveryLotsModal({ open, onClose, deliveryId, item, storeProductId, onSuccess }: EditDeliveryLotsModalProps) {
  const { showToast } = useToast()
  const [lots, setLots] = useState<InventoryLot[]>([])
  const [loading, setLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedLots, setSelectedLots] = useState<LotPick[]>([])

  const required = item.remainingBaseQuantity
  const currentAllocations = item.allocations.filter((a) => a.status !== 'RELEASED' && a.status !== 'CANCELLED')

  useEffect(() => {
    if (!open) return
    setSelectedLots(
      currentAllocations
        .map((a) => ({ inventoryLotId: a.inventoryLotId, baseQuantity: openAllocationQuantity(a) }))
        .filter((l) => l.baseQuantity > 0),
    )
    if (storeProductId) fetchAvailableLots(storeProductId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item.id, storeProductId])

  const fetchAvailableLots = async (productId: string) => {
    try {
      setLoading(true)
      const data = await inventoryApi.getLots({ storeProductId: productId, hasStock: true, pageSize: 100 })
      const usable = (data.items || []).filter((l) => !l.isExpired && l.status === 'ACTIVE')
      // Lots already on this trip are reserved for it, so they may not come back with hasStock=true.
      const missing = currentAllocations
        .filter((a) => !usable.some((l) => l.id === a.inventoryLotId))
        .map<InventoryLot>((a) => ({
          id: a.inventoryLotId,
          storeProductId: productId,
          lotNumber: a.lotNumber,
          expiryDate: a.expiryDate,
          isExpired: false,
          status: 'ACTIVE',
          quantityOnHand: 0,
          quantityReserved: openAllocationQuantity(a),
          quantityAvailable: 0,
          averageUnitCost: null,
        }))
      setLots([...missing, ...usable])
    } catch {
      showToast('Lỗi tải danh sách lô', 'error')
    } finally {
      setLoading(false)
    }
  }

  /** What this trip may take from a lot: free stock plus what it already holds there. */
  const maxForLot = (lot: InventoryLot) => {
    const held = currentAllocations.filter((a) => a.inventoryLotId === lot.id).reduce((s, a) => s + openAllocationQuantity(a), 0)
    return lot.quantityAvailable + held
  }

  const handleQuantityChange = (lot: InventoryLot, qty: number) => {
    const next = Math.max(0, Math.min(maxForLot(lot), Number.isFinite(qty) ? Math.floor(qty) : 0))
    setSelectedLots((prev) => {
      const rest = prev.filter((l) => l.inventoryLotId !== lot.id)
      return next > 0 ? [...rest, { inventoryLotId: lot.id, baseQuantity: next }] : rest
    })
  }

  const totalSelected = selectedLots.reduce((sum, l) => sum + l.baseQuantity, 0)

  const handleSave = async () => {
    if (totalSelected !== required) {
      showToast(`Tổng số lượng các lô (${totalSelected}) phải bằng đúng phần chưa giao (${required})`, 'error')
      return
    }
    try {
      setIsProcessing(true)
      await deliveriesApi.updateDeliveryLots(deliveryId, item.id, selectedLots)
      showToast('Cập nhật lô hàng thành công', 'success')
      onSuccess()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Lỗi cập nhật lô hàng', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <DetailModal open={open} onClose={onClose}>
      <ModalLayout header={<div className="">
        <h3 className="font-bold text-slate-900">Đổi lô hàng xuất kho</h3>
        <p className="text-sm text-slate-600 mt-1">
          {item.productName} ({item.packagingName}) · Cần phân bổ: <strong>{required}</strong> đơn vị gốc
        </p>
      </div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          onClick={onClose}
        >
          Hủy
        </button>
        <button
          type="button"
          className="px-4 py-2 text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
          onClick={handleSave}
          disabled={isProcessing || loading || !storeProductId || totalSelected !== required}
        >
          {isProcessing ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>}><div className="p-4 max-h-[60vh] overflow-y-auto">
          {!storeProductId ? (
            <div className="text-sm text-rose-600 text-center py-4">Không xác định được sản phẩm của dòng hàng này.</div>
          ) : loading ? (
            <div className="text-sm text-slate-500 text-center py-4">Đang tải lô hàng...</div>
          ) : lots.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-4">Không tìm thấy lô hàng khả dụng nào.</div>
          ) : (
            <div className="space-y-3">
              {lots.map((lot) => {
                const selectedQty = selectedLots.find((l) => l.inventoryLotId === lot.id)?.baseQuantity || 0
                const isCurrent = currentAllocations.some((a) => a.inventoryLotId === lot.id)
                return (
                  <div key={lot.id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {lot.lotNumber || 'Không có mã lô'}
                        {isCurrent && <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Đang dùng</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        HSD: {formatDate(lot.expiryDate)} · Có thể lấy: {maxForLot(lot)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Giảm"
                        className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
                        onClick={() => handleQuantityChange(lot, selectedQty - 1)}
                      >-</button>
                      <input
                        type="number"
                        min={0}
                        aria-label={`Số lượng lấy từ lô ${lot.lotNumber ?? ''}`}
                        className="w-20 h-8 text-center border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary"
                        value={selectedQty}
                        onChange={(e) => handleQuantityChange(lot, parseInt(e.target.value, 10))}
                      />
                      <button
                        type="button"
                        aria-label="Tăng"
                        className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
                        onClick={() => handleQuantityChange(lot, selectedQty + 1)}
                      >+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && lots.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm flex justify-between font-medium">
              <span>Tổng đã chọn:</span>
              <span className={totalSelected === required ? 'text-emerald-600' : 'text-rose-600'}>
                {totalSelected} / {required}
              </span>
            </div>
          )}
        </div>
      </ModalLayout>
    </DetailModal>
  )
}
