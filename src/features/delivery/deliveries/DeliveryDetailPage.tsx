import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { ApiError } from '@/api/client'
import { deliveriesApi, type CompleteAttemptRequest, type CreateIncidentRequest, type DeliveryResponse } from '@/api/deliveriesApi'
import StatusBadge from '@/components/ui/StatusBadge'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StickyActionBar from '@/components/ui/StickyActionBar'
import { formatAddress } from '@/utils/address'
import {
  ATTEMPT_STATUS_LABEL,
  DELIVERY_STATUS_LABEL,
  FAILURE_REASON_LABEL,
  formatDate,
  formatDateTime,
  labelOf,
} from '@/utils/deliveryLabels'
import { prepareProofPhoto } from './proofPhoto'
import { CompleteAttemptModal, ReportIncidentModal, carriedLines, type AttemptOutcome } from './AttemptModals'

const ATTEMPT_DOT: Record<string, string> = {
  IN_PROGRESS: 'bg-secondary',
  SUCCESS: 'bg-primary',
  PARTIAL_SUCCESS: 'bg-amber-500',
  FAILED: 'bg-error',
  CANCELLED: 'bg-slate-400',
}

const LIST_PATH = '/delivery/deliveries'

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

/** Opens Google Maps on the saved coordinates, or searches the address text. */
function mapsUrl(d: DeliveryResponse) {
  const a = d.deliveryAddress
  if (a?.latitude != null && a?.longitude != null) return `https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`
  const text = formatAddress(a)
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null
}

// D2 + D3 of FE_GUIDE_FLOW_2: start attempt → (photo) → complete; incidents any time during the attempt.
export default function DeliveryDetailPage() {
  const { id = '' } = useParams()
  const { showToast } = useToast()

  const [delivery, setDelivery] = useState<DeliveryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null)
  const [incidentOpen, setIncidentOpen] = useState(false)

  const fetchDelivery = async () => {
    try {
      setLoading(true)
      setDelivery(await deliveriesApi.getDeliveryDetail(id))
      setNotFound(false)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDelivery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  usePageHeader({
    title: delivery ? delivery.deliveryNumber : 'Chi tiết giao hàng',
    subtitle: delivery?.deliveryAddress?.recipientName || '',
  })

  const activeAttempt = delivery?.attempts.find((a) => a.status === 'IN_PROGRESS') ?? null
  // Memoised: the modals reset their inputs whenever this array changes.
  const lines = useMemo(() => (delivery && activeAttempt ? carriedLines(delivery.items, activeAttempt) : []), [delivery, activeAttempt])

  const handleApiError = (err: unknown, fallback: string) => {
    showToast(errorText(err, fallback), 'error')
    // Someone else changed the delivery (store cancelled, re-dispatched…) → show what is current.
    if (err instanceof ApiError && [404, 409, 422].includes(err.status)) fetchDelivery()
  }

  const handleStart = async () => {
    if (!delivery) return
    setActionLoading(true)
    try {
      const attempt = await deliveriesApi.startAttempt(delivery.id)
      showToast(`Bắt đầu lần giao #${attempt.attemptNumber}`, 'success')
      await fetchDelivery()
    } catch (err) {
      handleApiError(err, 'Không bắt đầu được lần giao')
    } finally {
      setActionLoading(false)
    }
  }

  const uploadIfAny = async (photo: File | null) => (photo ? deliveriesApi.uploadProofPhoto(await prepareProofPhoto(photo)) : null)

  const handleComplete = async (request: Omit<CompleteAttemptRequest, 'proofImageUrl'>, photo: File | null) => {
    if (!delivery || !activeAttempt) return
    setActionLoading(true)
    try {
      const proofImageUrl = await uploadIfAny(photo)
      const updated = await deliveriesApi.completeAttempt(delivery.id, activeAttempt.id, { ...request, proofImageUrl })
      setDelivery(updated)
      setOutcome(null)
      showToast(
        updated.status === 'DELIVERED'
          ? `Đã giao xong phiếu ${updated.deliveryNumber}.`
          : updated.status === 'PARTIALLY_DELIVERED'
            ? 'Đã ghi nhận giao một phần. Cửa hàng sẽ xuất phát lại phần còn lại.'
            : 'Đã ghi nhận không giao được. Phiếu chờ cửa hàng xuất phát lại.',
        'success',
      )
    } catch (err) {
      handleApiError(err, 'Không ghi nhận được kết quả giao')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReportIncident = async (request: Omit<CreateIncidentRequest, 'evidenceImageUrl' | 'deliveryAttemptId'>, photo: File | null) => {
    if (!delivery) return
    setActionLoading(true)
    try {
      const evidenceImageUrl = (await uploadIfAny(photo)) ?? undefined
      await deliveriesApi.reportIncident(delivery.id, { ...request, evidenceImageUrl, deliveryAttemptId: activeAttempt?.id })
      setIncidentOpen(false)
      showToast('Đã gửi báo cáo sự cố cho cửa hàng.', 'success')
    } catch (err) {
      handleApiError(err, 'Không gửi được sự cố')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading && !delivery) {
    return <Card className="text-center"><p className="text-on-surface-variant font-body-md">Đang tải dữ liệu...</p></Card>
  }

  if (notFound || !delivery) {
    return (
      <Card className="text-center">
        <p className="font-body-md text-body-md text-on-surface-variant">Không tìm thấy phiếu giao này hoặc phiếu không được phân công cho bạn.</p>
        <Link to={LIST_PATH} className="inline-flex items-center gap-1 mt-4 text-primary font-label-md text-label-md">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Quay lại danh sách
        </Link>
      </Card>
    )
  }

  const canStart = delivery.status === 'OUT_FOR_DELIVERY' && !activeAttempt
  const waitingForStore = ['ASSIGNED', 'RETRY_PENDING', 'PARTIALLY_DELIVERED'].includes(delivery.status)
  const map = mapsUrl(delivery)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg pb-32">
      <Link to={LIST_PATH} className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-surface font-label-md text-label-md">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Quay lại danh sách
      </Link>

      <Card>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">{delivery.deliveryNumber}</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Đơn gốc: {delivery.orderNumber} · Hẹn giao: {formatDate(delivery.scheduledAt)}
            </p>
          </div>
          <StatusBadge label={labelOf(DELIVERY_STATUS_LABEL, delivery.status)} />
        </div>
        {waitingForStore && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">hourglass_top</span>
            Chờ cửa hàng bấm xuất phát. Sau đó bạn mới bắt đầu giao được.
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-label-sm text-label-sm uppercase text-on-surface-variant">Người nhận</h3>
        <div className="flex items-start gap-2">
          <div className="w-10 h-10 rounded-full bg-primary-fixed/50 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">person</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-title-md text-title-md text-on-surface font-bold">{delivery.deliveryAddress?.recipientName || '--'}</span>
              {delivery.deliveryAddress?.recipientPhone && (
                <a href={`tel:${delivery.deliveryAddress.recipientPhone}`} className="text-primary font-label-md text-label-md hover:underline">
                  {delivery.deliveryAddress.recipientPhone}
                </a>
              )}
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              <span className="material-symbols-outlined text-[16px] align-text-bottom mr-1">location_on</span>
              {formatAddress(delivery.deliveryAddress) || '--'}
            </p>
            {map && (
              <a href={map} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-primary font-label-md text-label-md hover:underline">
                <span className="material-symbols-outlined text-[16px]">map</span>
                Mở bản đồ
              </a>
            )}
            {delivery.note && (
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 bg-surface-container-low rounded px-2 py-1">
                <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1">sticky_note_2</span>
                {delivery.note}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-2">
        <h3 className="font-label-sm text-label-sm uppercase text-on-surface-variant">Hàng cần giao</h3>
        <div className="divide-y divide-outline-variant/60">
          {delivery.items.map((item) => {
            const conversion = item.plannedQuantity > 0 ? item.plannedBaseQuantity / item.plannedQuantity : 1
            return (
              <div key={item.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-body-md text-body-md text-on-surface">{item.productName}</span>
                  <span className="font-label-md text-label-md text-on-surface-variant tabular-nums shrink-0">
                    {item.plannedQuantity} {item.packagingName}
                  </span>
                </div>
                <div className="text-xs text-on-surface-variant mt-0.5">
                  Còn phải giao: {Math.round(item.remainingBaseQuantity / conversion)} {item.packagingName}
                  {item.allocations.filter((a) => a.status !== 'RELEASED').map((a) => ` · Lô ${a.lotNumber ?? '—'} (HSD ${formatDate(a.expiryDate)})`).join('')}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {delivery.attempts.length > 0 && (
        <Card className="space-y-2">
          <h3 className="font-label-sm text-label-sm uppercase text-on-surface-variant">Lịch sử các lần giao</h3>
          <div className="space-y-3">
            {delivery.attempts.map((attempt) => (
              <div key={attempt.id} className="flex items-start gap-2">
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${ATTEMPT_DOT[attempt.status] ?? 'bg-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      Lần {attempt.attemptNumber}: {labelOf(ATTEMPT_STATUS_LABEL, attempt.status)}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant shrink-0">{formatDateTime(attempt.startedAt)}</span>
                  </div>
                  {attempt.receiverName && <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Người nhận: {attempt.receiverName}</p>}
                  {attempt.failureReasonCode && (
                    <p className="font-body-sm text-body-sm text-error mt-0.5">{labelOf(FAILURE_REASON_LABEL, attempt.failureReasonCode)}</p>
                  )}
                  {attempt.note && <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{attempt.note}</p>}
                  {attempt.proofImageUrl && (
                    <img src={attempt.proofImageUrl} alt={`Ảnh bằng chứng lần giao ${attempt.attemptNumber}`} className="mt-2 rounded-lg border border-outline-variant max-h-48 object-cover" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {delivery.status === 'DELIVERED' && (
        <div className="p-3 bg-primary-fixed/40 border border-primary-fixed-dim/60 rounded-lg font-body-sm text-body-sm text-on-primary-fixed-variant">
          Đã hoàn tất giao hàng cho phiếu này.
        </div>
      )}
      {delivery.status === 'CANCELLED' && (
        <div className="p-3 bg-surface-container-high border border-outline-variant rounded-lg font-body-sm text-body-sm text-outline">
          Phiếu đã bị hủy{delivery.cancelReason ? ` — lý do: ${delivery.cancelReason}` : ''}.
        </div>
      )}

      {canStart && (
        <StickyActionBar>
          <Button fullWidth icon="local_shipping" onClick={handleStart} disabled={actionLoading}>
            {actionLoading ? 'Đang xử lý...' : delivery.attempts.length > 0 ? 'Bắt đầu giao lại' : 'Bắt đầu chuyến giao'}
          </Button>
        </StickyActionBar>
      )}

      {activeAttempt && (
        <StickyActionBar className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setIncidentOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-9 border border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg font-label-md text-label-md transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">warning</span>
            Báo cáo sự cố
          </button>
          <div className="flex gap-2">
            <Button variant="outline-danger" icon="close" className="flex-1" onClick={() => setOutcome('failed')} disabled={actionLoading}>
              Không giao được
            </Button>
            <Button variant="outlined" icon="done_all" className="flex-1" onClick={() => setOutcome('partial')} disabled={actionLoading}>
              Một phần
            </Button>
            <Button icon="check_circle" className="flex-1" onClick={() => setOutcome('full')} disabled={actionLoading}>
              Giao hết
            </Button>
          </div>
        </StickyActionBar>
      )}

      <CompleteAttemptModal outcome={outcome} lines={lines} loading={actionLoading} onClose={() => setOutcome(null)} onSubmit={handleComplete} />
      <ReportIncidentModal open={incidentOpen} lines={lines} loading={actionLoading} onClose={() => setIncidentOpen(false)} onSubmit={handleReportIncident} />
    </div>
  )
}
