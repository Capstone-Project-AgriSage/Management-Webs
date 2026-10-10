import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useEffect, useMemo, useState } from 'react'
import { describeError } from '@/api/client'
import { goodsReceiptsApi, type GoodsReceipt, type GoodsReceiptItem } from '@/api/goodsReceiptsApi'
import { productLookupApi, type ProductDetail, type StoreProductRef } from '@/api/productLookupApi'
import DetailModal from '@/components/ui/DetailModal'
import { useToast } from '@/context/ToastContext'
import { formatVnd } from '@/utils/money'
import { formatQty, todayInput, unitLabel } from '@/utils/units'
import StoreProductSearch from './StoreProductSearch'

interface ReceiptLineModalProps {
  receiptId: string
  /** The line being edited; null adds a new one (product and packaging are chosen). */
  item: GoodsReceiptItem | null
  onClose: () => void
  onSaved: (receipt: GoodsReceipt) => void
}

const inputClassName =
  'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:bg-slate-50'

export default function ReceiptLineModal({ receiptId, item, onClose, onSaved }: ReceiptLineModalProps) {
  const { showToast } = useToast()
  const editing = item !== null

  const [picked, setPicked] = useState<StoreProductRef | null>(null)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [productLoading, setProductLoading] = useState(false)
  const [packagingId, setPackagingId] = useState(item?.productPackagingId ?? '')
  const [quantity, setQuantity] = useState(item ? String(item.receivedQuantity) : '')
  const [cost, setCost] = useState(item ? String(item.purchaseUnitCost) : '')
  const [lot, setLot] = useState(item?.supplierLotNumber ?? '')
  const [mfg, setMfg] = useState(item?.manufacturingDate ?? '')
  const [expiry, setExpiry] = useState(item?.expiryDate ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  const [busy, setBusy] = useState(false)

  const loadProduct = async (productId: string) => {
    setProductLoading(true)
    try {
      setProduct(await productLookupApi.getProduct(productId))
    } catch (err) {
      showToast(describeError(err, 'Không tải được quy cách của sản phẩm'), 'error')
    } finally {
      setProductLoading(false)
    }
  }

  // Editing: read the product's lot/expiry rules and base unit to show the same hints as when adding.
  useEffect(() => {
    if (!item) return
    let cancelled = false
    productLookupApi
      .getStoreProduct(item.storeProductId)
      .then((sp) => productLookupApi.getProduct(sp.productId))
      .then((p) => {
        if (!cancelled) setProduct(p)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [item])

  const purchasePackagings = useMemo(() => (product?.packagings ?? []).filter((p) => p.isPurchaseUnit && p.status === 'ACTIVE'), [product])
  const chosen = product?.packagings.find((p) => p.id === packagingId) ?? null
  const baseUnit = product?.packagings.find((p) => p.isBaseUnit)?.unitCode ?? null
  const conversion = chosen?.conversionToBase ?? item?.conversionToBaseSnapshot ?? 0

  const qty = Number(quantity)
  const unitCost = Number(cost)
  const qtyOk = Number.isInteger(qty) && qty >= 1
  const costOk = /^\d+(\.\d{1,2})?$/.test(cost.trim())
  const needLot = product?.requiresLotTracking ?? false
  const needExpiry = product?.requiresExpiryDate ?? false

  let problem: string | null = null
  if (!editing && !picked) problem = 'Chọn sản phẩm.'
  else if (!editing && !packagingId) problem = 'Chọn quy cách nhập.'
  else if (quantity !== '' && !qtyOk) problem = 'Số lượng phải là số nguyên từ 1 trở lên.'
  else if (cost.trim() !== '' && !costOk) problem = 'Đơn giá nhập tối đa 2 chữ số thập phân, không âm.'
  else if (needLot && lot.trim() === '') problem = 'Sản phẩm này theo dõi theo lô: cần nhập số lô.'
  else if (needExpiry && expiry === '') problem = 'Sản phẩm này bắt buộc có hạn dùng.'
  else if (expiry !== '' && expiry < todayInput()) problem = 'Hàng đã hết hạn thì không nhập kho được.'
  else if (mfg !== '' && expiry !== '' && mfg > expiry) problem = 'Ngày sản xuất phải trước hạn dùng.'

  const canSubmit = !busy && problem === null && qtyOk && costOk && (editing || (picked !== null && packagingId !== ''))

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    const body = {
      receivedQuantity: qty,
      purchaseUnitCost: unitCost,
      supplierLotNumber: lot.trim() || null,
      manufacturingDate: mfg || null,
      expiryDate: expiry || null,
      note: note.trim() || null,
    }
    try {
      const receipt = item
        ? await goodsReceiptsApi.updateItem(receiptId, item.id, body)
        : await goodsReceiptsApi.addItem(receiptId, { ...body, storeProductId: picked!.id, productPackagingId: packagingId })
      showToast(item ? 'Đã sửa dòng hàng' : 'Đã thêm dòng hàng', 'success')
      onSaved(receipt)
    } catch (err) {
      showToast(describeError(err, 'Không lưu được dòng hàng'), 'error')
      setBusy(false)
    }
  }

  return (
    <DetailModal open onClose={busy ? () => undefined : onClose} widthClassName="max-w-2xl">
      <ModalLayout header={<h3 className="text-lg text-slate-900 font-bold">{editing ? 'Sửa dòng hàng' : 'Thêm dòng hàng'}</h3>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm shadow-sm disabled:opacity-50" onClick={onClose} disabled={busy}>
          Hủy
        </button>
        <PermissionAction codes={[editing ? 'GOODS_RECEIPTS.UPDATE' : 'GOODS_RECEIPTS.ADD_ITEM']}><button type="button" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm disabled:opacity-50" onClick={submit} disabled={!canSubmit}>
          {busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm dòng'}
        </button></PermissionAction>
      </div>} bodyClassName="space-y-4">{editing ? (
        <div className="text-sm">
          <div className="font-medium text-slate-900">{item.productName}</div>
          <div className="font-mono text-xs text-slate-500">
            {item.sku} · {item.packagingName ?? item.unitName}
          </div>
        </div>
      ) : picked ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <div className="text-sm font-medium text-slate-900">{picked.name}</div>
            <div className="font-mono text-xs text-slate-500">{picked.storeSku ?? picked.sku}</div>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            onClick={() => {
              setPicked(null)
              setProduct(null)
              setPackagingId('')
            }}
          >
            Đổi sản phẩm
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Sản phẩm *</label>
          <StoreProductSearch
            onPick={(p) => {
              setPicked(p)
              loadProduct(p.productId)
            }}
          />
        </div>
      )}{!editing && picked ? (
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="rl-pack">
            Quy cách nhập *
          </label>
          <select id="rl-pack" className={inputClassName} value={packagingId} onChange={(e) => setPackagingId(e.target.value)} disabled={productLoading}>
            <option value="">{productLoading ? 'Đang tải...' : purchasePackagings.length === 0 ? 'Sản phẩm chưa có quy cách nhập' : 'Chọn quy cách...'}</option>
            {purchasePackagings.map((p) => (
              <option key={p.id} value={p.id}>
                {p.packagingName ?? p.unitName} (1 = {formatQty(p.conversionToBase)} {unitLabel(baseUnit ?? p.unitCode)})
              </option>
            ))}
          </select>
        </div>
      ) : null}<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rl-qty">
              Số lượng nhận *
            </label>
            <input id="rl-qty" type="number" min={1} className={inputClassName} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Theo quy cách đã chọn" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rl-cost">
              Đơn giá nhập mỗi quy cách (đ) *
            </label>
            <input id="rl-cost" type="number" min={0} step="0.01" className={inputClassName} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Ví dụ 520000" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rl-lot">
              Số lô {needLot ? '*' : ''}
            </label>
            <input id="rl-lot" className={inputClassName} maxLength={100} value={lot} onChange={(e) => setLot(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rl-expiry">
              Hạn dùng {needExpiry ? '*' : ''}
            </label>
            <input id="rl-expiry" type="date" className={inputClassName} value={expiry} min={todayInput()} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rl-mfg">
              Ngày sản xuất
            </label>
            <input id="rl-mfg" type="date" className={inputClassName} value={mfg} onChange={(e) => setMfg(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rl-note">
              Ghi chú
            </label>
            <input id="rl-note" className={inputClassName} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>{qtyOk && costOk && conversion > 0 ? (
          <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Nhập <strong>{formatQty(qty * conversion)}</strong> {unitLabel(baseUnit ?? '')} vào kho
            {' · '}thành tiền <strong>{formatVnd(qty * unitCost)}</strong>
            {' · '}giá vốn <strong>{formatVnd(unitCost / conversion)}</strong>/{unitLabel(baseUnit ?? '') || 'đơn vị cơ sở'}
          </p>
        ) : null}{problem ? (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" role="alert">
            {problem}
          </p>
        ) : null}
      </ModalLayout>
    </DetailModal>
  )
}
