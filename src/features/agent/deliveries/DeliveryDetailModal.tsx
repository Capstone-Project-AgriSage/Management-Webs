import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useEffect, useState } from 'react'
import { MapPin, Package, Truck, UserCircle, CheckCircle, XCircle, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import DetailModal from '@/components/ui/DetailModal'
import StatusBadge from '@/components/ui/StatusBadge'
import { useToast } from '@/context/ToastContext'
import { ApiError } from '@/api/client'
import {
  deliveriesApi,
  type DeliveryIncident,
  type DeliveryItem,
  type DeliveryResponse,
  type ResolutionType,
} from '@/api/deliveriesApi'
import { ordersApi } from '@/api/ordersApi'
import { staffApi, type StaffResponse } from '@/api/staffApi'
import { formatAddress } from '@/utils/address'
import {
  ATTEMPT_STATUS_LABEL,
  DELIVERY_STATUS_LABEL,
  DISPATCHABLE_DELIVERY_STATUSES,
  EDITABLE_DELIVERY_STATUSES,
  FAILURE_REASON_LABEL,
  RESOLUTION_TYPE_LABEL,
  STOCK_CHANGING_RESOLUTIONS,
  formatDate,
  formatDateTime,
  labelOf,
  openAllocationQuantity,
} from '@/utils/deliveryLabels'
import EditDeliveryLotsModal from './EditDeliveryLotsModal'

interface DeliveryDetailModalProps {
  deliveryId: string | null
  onClose: () => void
  /** Called after any change so the list can refresh its row. */
  onChanged: () => void
}

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback)

// Q4 + Q5 of FE_GUIDE_FLOW_2: assign, swap lots, dispatch, cancel attempt / delivery, resolve incidents.
export default function DeliveryDetailModal({ deliveryId, onClose, onChanged }: DeliveryDetailModalProps) {
  const { showToast } = useToast()
  const [delivery, setDelivery] = useState<DeliveryResponse | null>(null)
  const [incidents, setIncidents] = useState<DeliveryIncident[]>([])
  const [storeProductIds, setStoreProductIds] = useState<Record<string, string>>({})
  const [drivers, setDrivers] = useState<StaffResponse[]>([])
  // GET /api/staff currently answers 403 for SALES_STAFF, so they cannot pick a driver.
  const [driversForbidden, setDriversForbidden] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [editingItem, setEditingItem] = useState<DeliveryItem | null>(null)
  const [cancelTarget, setCancelTarget] = useState<'delivery' | 'attempt' | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [resolvingIncident, setResolvingIncident] = useState<DeliveryIncident | null>(null)
  const [resolutionType, setResolutionType] = useState<ResolutionType>('RETRY_DELIVERY')
  const [resolutionNote, setResolutionNote] = useState('')

  useEffect(() => {
    staffApi
      .getStaff({ role: 'DELIVERY_STAFF', status: 'ACTIVE', pageSize: 100 })
      .then((data) => setDrivers(data.items || []))
      .catch((err) => {
        setDrivers([])
        setDriversForbidden(err instanceof ApiError && err.status === 403)
      })
  }, [])

  const load = async (id: string) => {
    setIsLoading(true)
    try {
      const [data, incidentData] = await Promise.all([
        deliveriesApi.getDeliveryDetail(id),
        deliveriesApi.getIncidents(id).catch((): DeliveryIncident[] => []),
      ])
      setDelivery(data)
      setIncidents(incidentData)
      setSelectedDriverId(data.assignedTo?.userId ?? '')
      // Delivery lines have no storeProductId; the order line has it (needed to list lots for "Đổi lô").
      ordersApi
        .getById(data.orderId)
        .then((order) => setStoreProductIds(Object.fromEntries(order.items.map((i) => [i.id, i.storeProductId]))))
        .catch(() => setStoreProductIds({}))
    } catch (err) {
      showToast(errorText(err, 'Không thể lấy chi tiết phiếu giao'), 'error')
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (deliveryId) {
      setDelivery(null)
      load(deliveryId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryId])

  /** Runs a mutation, then reloads the delivery (or takes the returned one) and notifies the list. */
  const run = async (action: () => Promise<DeliveryResponse | unknown>, success: string, fallback: string) => {
    if (!delivery) return false
    setIsProcessing(true)
    try {
      const result = await action()
      showToast(success, 'success')
      if (result && typeof result === 'object' && 'deliveryNumber' in result) {
        setDelivery(result as DeliveryResponse)
        deliveriesApi.getIncidents(delivery.id).then(setIncidents).catch(() => { })
      } else {
        await load(delivery.id)
      }
      onChanged()
      return true
    } catch (err) {
      showToast(errorText(err, fallback), 'error')
      // 409: someone else changed the delivery meanwhile → show the fresh state.
      if (err instanceof ApiError && (err.status === 409 || err.status === 404)) load(delivery.id)
      return false
    } finally {
      setIsProcessing(false)
    }
  }

  const activeAttempt = delivery?.attempts.find((a) => a.status === 'IN_PROGRESS') ?? null
  const isEditable = delivery ? EDITABLE_DELIVERY_STATUSES.includes(delivery.status) : false
  const canDispatch = delivery ? DISPATCHABLE_DELIVERY_STATUSES.includes(delivery.status) && !!delivery.assignedTo : false
  const canCancelDelivery = delivery ? !['DELIVERED', 'CANCELLED'].includes(delivery.status) && !activeAttempt : false

  const handleAssign = () =>
    run(
      () => deliveriesApi.assignDriver(delivery!.id, { assignedToUserId: selectedDriverId }),
      'Phân công tài xế thành công',
      'Lỗi phân công tài xế',
    )

  const handleDispatch = () =>
    run(() => deliveriesApi.dispatchDelivery(delivery!.id), 'Đã xuất phát — tài xế có thể bắt đầu giao', 'Lỗi xuất phát')

  const handleConfirmCancel = async () => {
    if (!delivery || !cancelReason.trim()) return
    const ok =
      cancelTarget === 'attempt' && activeAttempt
        ? await run(
          () => deliveriesApi.cancelAttempt(delivery.id, activeAttempt.id, { reason: cancelReason.trim() }),
          'Đã hủy lần giao đang chạy',
          'Lỗi hủy lần giao',
        )
        : await run(
          () => deliveriesApi.cancelDelivery(delivery.id, { reason: cancelReason.trim() }),
          'Đã hủy phiếu giao',
          'Lỗi hủy phiếu giao',
        )
    if (ok) {
      setCancelTarget(null)
      setCancelReason('')
    }
  }

  const handleResolve = async () => {
    if (!delivery || !resolvingIncident) return
    const ok = await run(
      () =>
        deliveriesApi.resolveIncident(delivery.id, resolvingIncident.id, {
          resolutionType,
          resolutionNote: resolutionNote.trim() || undefined,
          relatedStockMovementId: null,
        }),
      'Đã xử lý sự cố',
      'Lỗi xử lý sự cố',
    )
    if (ok) {
      setResolvingIncident(null)
      setResolutionNote('')
      setResolutionType('RETRY_DELIVERY')
    }
  }

  return (
    <>
      <DetailModal open={deliveryId !== null} onClose={onClose} widthClassName="max-w-2xl">
        {!delivery ? (
          <ModalLayout bodyClassName="space-y-4">{isLoading ? 'Đang tải chi tiết...' : ''}
          </ModalLayout>
        ) : (
          <ModalLayout header={<div className="">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-sm text-slate-900">{delivery.deliveryNumber}</span>
              <StatusBadge label={labelOf(DELIVERY_STATUS_LABEL, delivery.status)} />
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Đơn gốc: <span className="font-mono font-medium text-slate-700">{delivery.orderNumber}</span>
              {' · '}Tạo lúc {formatDateTime(delivery.createdAt)}
            </div>
            {delivery.cancelReason && (
              <div className="text-xs text-rose-600 mt-1">Lý do hủy: {delivery.cancelReason}</div>
            )}
          </div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
            {isEditable && (
              <div>
                <label htmlFor="driver-select" className="text-xs font-bold text-slate-700 block mb-1">Phân công tài xế</label>
                <div className="flex gap-2">
                  <select
                    id="driver-select"
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    disabled={isProcessing}
                  >
                    <option value="">-- Chọn tài xế --</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.fullName}{d.phoneNumber ? ` · ${d.phoneNumber}` : ''}</option>
                    ))}
                  </select>
                  <PermissionAction codes={["DELIVERIES.ASSIGN"]}><button
                    type="button"
                    className="px-4 h-9 bg-slate-800 text-white hover:bg-slate-900 font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-1"
                    onClick={handleAssign}
                    disabled={!selectedDriverId || isProcessing || delivery.assignedTo?.userId === selectedDriverId}
                  >
                    <UserCircle size={16} />
                    Lưu
                  </button></PermissionAction>
                </div>
                {driversForbidden ? (
                  <p className="text-xs text-amber-700 mt-1">Tài khoản này chưa được cấp quyền xem danh sách tài xế. Nhờ Đại lý phân công.</p>
                ) : drivers.length === 0 ? (
                  <p className="text-xs text-slate-500 mt-1">Chưa có tài xế đang hoạt động.</p>
                ) : null}
              </div>
            )}

            {canDispatch && (
              <PermissionAction codes={["DELIVERIES.DISPATCH"]}><button
                type="button"
                className="w-full h-10 bg-primary text-on-primary hover:bg-primary/90 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={handleDispatch}
                disabled={isProcessing}
              >
                <CheckCircle size={18} />
                {delivery.status === 'ASSIGNED' ? 'Xuất kho & đi giao' : 'Xuất phát lại'}
              </button></PermissionAction>
            )}
            {isEditable && !delivery.assignedTo && (
              <p className="text-xs text-slate-500">Phân công tài xế trước khi xuất phát.</p>
            )}

            {delivery.status === 'OUT_FOR_DELIVERY' && (
              <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-3 text-sm flex items-start gap-2">
                <Truck size={18} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <div className="font-bold">{activeAttempt ? `Đang giao (lần ${activeAttempt.attemptNumber})` : 'Đã xuất phát'}</div>
                  <div className="text-xs mt-0.5 opacity-90">
                    {activeAttempt ? 'Tài xế đang trên đường giao hàng.' : 'Chờ tài xế bấm bắt đầu giao trên ứng dụng.'}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              {activeAttempt && (
                <PermissionAction codes={['DELIVERY_ATTEMPTS.CANCEL']}><button
                  type="button"
                  className="px-3 h-9 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 text-sm font-medium flex items-center gap-1"
                  onClick={() => setCancelTarget('attempt')}
                  disabled={isProcessing}
                >
                  <XCircle size={16} /> Hủy lần giao đang chạy
                </button></PermissionAction>
              )}
              {canCancelDelivery && (
                <PermissionAction codes={['DELIVERIES.CANCEL']}><button
                  type="button"
                  className="px-3 h-9 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-sm font-medium flex items-center gap-1"
                  onClick={() => setCancelTarget('delivery')}
                  disabled={isProcessing}
                >
                  <XCircle size={16} /> Hủy phiếu giao
                </button></PermissionAction>
              )}
            </div>
          </div>} bodyClassName="space-y-4"><div className="p-4 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Người nhận</span>
                <div className="text-sm font-bold text-slate-900 mt-1">{delivery.deliveryAddress?.recipientName || '--'}</div>
                <div className="text-xs text-slate-600 mt-0.5">{delivery.deliveryAddress?.recipientPhone || '--'}</div>
                <div className="text-sm text-slate-700 mt-1 flex items-start gap-1">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>{formatAddress(delivery.deliveryAddress) || '--'}</span>
                </div>
              </div>
              <div className="space-y-1 text-xs text-slate-600">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Lịch trình</span>
                <div className="flex items-center gap-1"><Truck size={14} className="text-slate-400" /> Hẹn giao: {formatDateTime(delivery.scheduledAt)}</div>
                <div>Xuất phát: {formatDateTime(delivery.dispatchedAt)}</div>
                <div>Hoàn tất: {formatDateTime(delivery.completedAt)}</div>
                <div className="flex items-center gap-1 pt-1">
                  <UserCircle size={14} className="text-slate-400" />
                  Tài xế: <strong className="text-slate-800">{delivery.assignedTo?.fullName ?? 'Chưa phân công'}</strong>
                  {delivery.assignedTo?.phoneNumber ? ` · ${delivery.assignedTo.phoneNumber}` : ''}
                </div>
                {delivery.note && <div className="italic">Ghi chú: {delivery.note}</div>}
              </div>
            </div><div className="p-4 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Mặt hàng &amp; lô xuất</span>
              <div className="space-y-3">
                {delivery.items.map((item) => (
                  <div key={item.id} className="text-sm">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-start gap-2">
                        <Package size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium text-slate-900">{item.productName}</div>
                          <div className="text-xs text-slate-500">{item.packagingName} · SKU {item.sku}</div>
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-600 whitespace-nowrap">
                        <div className="font-mono font-medium text-slate-800">x{item.plannedQuantity}</div>
                        <div>Đã giao {item.deliveredBaseQuantity}/{item.plannedBaseQuantity}</div>
                      </div>
                    </div>
                    <ul className="mt-1.5 ml-6 space-y-0.5">
                      {item.allocations.map((a) => (
                        <li
                          key={a.id}
                          className={`text-xs flex justify-between ${a.status === 'RELEASED' || a.status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-600'}`}
                        >
                          <span>Lô {a.lotNumber ?? a.inventoryLotId.slice(0, 8)} · HSD {formatDate(a.expiryDate)}</span>
                          <span className="font-mono">
                            {a.status === 'RELEASED' ? 'đã trả lô' : `${openAllocationQuantity(a)} chờ giao / ${a.allocatedBaseQuantity}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {isEditable && item.remainingBaseQuantity > 0 && (
                      <PermissionAction codes={['DELIVERIES.UPDATE']}><button
                        type="button"
                        className="ml-6 text-xs text-primary font-medium hover:underline mt-1"
                        onClick={() => setEditingItem(item)}
                      >
                        Đổi lô
                      </button></PermissionAction>
                    )}
                  </div>
                ))}
              </div>
            </div>{delivery.attempts.length > 0 && (
              <div className="p-4 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Các lần giao</span>
                <ul className="space-y-2">
                  {delivery.attempts.map((a) => (
                    <li key={a.id} className="text-xs bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-800">
                          Lần {a.attemptNumber} · {labelOf(ATTEMPT_STATUS_LABEL, a.status)}
                        </div>
                        <div className="text-slate-500">
                          {a.attemptedBy?.fullName} · {formatDateTime(a.startedAt)}
                          {a.completedAt ? ` → ${formatDateTime(a.completedAt)}` : ''}
                        </div>
                        {a.receiverName && <div>Người nhận: {a.receiverName}</div>}
                        {a.failureReasonCode && (
                          <div className="text-rose-600">Lý do: {labelOf(FAILURE_REASON_LABEL, a.failureReasonCode)}</div>
                        )}
                        {a.note && <div className="italic text-slate-500">"{a.note}"</div>}
                      </div>
                      {a.proofImageUrl && (
                        <a href={a.proofImageUrl} target="_blank" rel="noreferrer" className="shrink-0 text-primary flex items-center gap-1 hover:underline">
                          <ImageIcon size={14} /> Ảnh
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}{incidents.length > 0 && (
              <div className="p-4 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Sự cố giao hàng</span>
                <div className="space-y-2">
                  {incidents.map((inc) => (
                    <div key={inc.id} className={`border rounded-lg p-3 ${inc.status === 'OPEN' ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-slate-200'}`}>
                      <div className="flex justify-between items-start gap-3">
                        <div className="text-xs space-y-0.5">
                          <div className="font-bold text-rose-700 text-sm">{labelOf(FAILURE_REASON_LABEL, inc.incidentType)}</div>
                          <div className="text-slate-700">{inc.description}</div>
                          {inc.affectedBaseQuantity != null && <div className="text-slate-500">Số lượng ảnh hưởng: {inc.affectedBaseQuantity}</div>}
                          <div className="text-slate-400">Báo lúc {formatDateTime(inc.reportedAt)}</div>
                          {inc.evidenceImageUrl && (
                            <a href={inc.evidenceImageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">Xem ảnh</a>
                          )}
                          {inc.status === 'RESOLVED' ? (
                            <div className="pt-1 font-semibold text-emerald-600">
                              Đã xử lý: {labelOf(RESOLUTION_TYPE_LABEL, inc.resolutionType)}
                              {inc.resolutionNote ? ` — ${inc.resolutionNote}` : ''}
                            </div>
                          ) : (
                            <div className="pt-1 font-semibold text-amber-600">Đang chờ xử lý</div>
                          )}
                        </div>
                        {inc.status === 'OPEN' && (
                          <PermissionAction codes={['DELIVERY_INCIDENTS.RESOLVE']}><button
                            type="button"
                            className="px-2.5 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded text-xs font-medium shrink-0"
                            onClick={() => setResolvingIncident(inc)}
                          >
                            Xử lý
                          </button></PermissionAction>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ModalLayout>
        )}
      </DetailModal>

      {/* Cancel delivery / attempt — reason is mandatory */}
      <DetailModal open={cancelTarget !== null} onClose={() => setCancelTarget(null)}>
        <ModalLayout header={<div className="">
          <h3 className="font-bold text-slate-900">{cancelTarget === 'attempt' ? 'Hủy lần giao đang chạy' : 'Hủy phiếu giao'}</h3>
          {cancelTarget === 'delivery' && delivery?.status === 'PARTIALLY_DELIVERED' && (
            <p className="text-xs text-slate-600 mt-1">Phần đã giao được giữ nguyên; phần chưa giao trả về đơn để lập phiếu mới.</p>
          )}
        </div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg" onClick={() => setCancelTarget(null)}>
            Đóng
          </button>
          <PermissionAction codes={[cancelTarget === 'attempt' ? 'DELIVERY_ATTEMPTS.CANCEL' : 'DELIVERIES.CANCEL']}><button
            type="button"
            className="px-4 py-2 text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-lg disabled:opacity-50"
            onClick={handleConfirmCancel}
            disabled={isProcessing || !cancelReason.trim()}
          >
            {isProcessing ? 'Đang xử lý...' : 'Xác nhận hủy'}
          </button></PermissionAction>
        </div>}><div className="p-4">
            <label htmlFor="cancel-reason" className="text-sm font-medium text-slate-700 block mb-1">Lý do <span className="text-rose-600">*</span></label>
            <textarea
              id="cancel-reason"
              className="w-full p-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Nhập lý do hủy..."
            />
          </div>
        </ModalLayout>
      </DetailModal>

      {/* Resolve incident (Q5) */}
      <DetailModal open={resolvingIncident !== null} onClose={() => setResolvingIncident(null)}>
        <ModalLayout header={<div className="">
          <h3 className="font-bold text-slate-900">Xử lý sự cố</h3>
          {resolvingIncident && <p className="text-xs text-slate-600 mt-1">{resolvingIncident.description}</p>}
        </div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg" onClick={() => setResolvingIncident(null)}>
            Hủy
          </button>
          <PermissionAction codes={["DELIVERY_INCIDENTS.RESOLVE"]}><button
            type="button"
            className="px-4 py-2 text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
            onClick={handleResolve}
            disabled={isProcessing}
          >
            {isProcessing ? 'Đang xử lý...' : 'Xác nhận xử lý'}
          </button></PermissionAction>
        </div>}><div className="p-4 space-y-4">
            <div>
              <label htmlFor="resolution-type" className="text-sm font-medium text-slate-700 block mb-1">Hướng giải quyết</label>
              <select
                id="resolution-type"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={resolutionType}
                onChange={(e) => setResolutionType(e.target.value as ResolutionType)}
              >
                {(Object.keys(RESOLUTION_TYPE_LABEL) as ResolutionType[]).map((t) => (
                  <option key={t} value={t}>{RESOLUTION_TYPE_LABEL[t]}</option>
                ))}
              </select>
              {STOCK_CHANGING_RESOLUTIONS.includes(resolutionType) && (
                <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex gap-1.5">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  Thao tác này không tự trừ kho. Cần lập phiếu điều chỉnh kho riêng nếu hàng bị hư hỏng hoặc mất.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="resolution-note" className="text-sm font-medium text-slate-700 block mb-1">Ghi chú xử lý</label>
              <textarea
                id="resolution-note"
                className="w-full p-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                rows={3}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="VD: Hẹn giao lại sáng mai"
              />
            </div>
          </div>
        </ModalLayout>
      </DetailModal>

      {editingItem && delivery && (
        <EditDeliveryLotsModal
          open
          onClose={() => setEditingItem(null)}
          deliveryId={delivery.id}
          item={editingItem}
          storeProductId={storeProductIds[editingItem.orderItemId] ?? null}
          onSuccess={() => {
            setEditingItem(null)
            load(delivery.id)
            onChanged()
          }}
        />
      )}
    </>
  )
}
