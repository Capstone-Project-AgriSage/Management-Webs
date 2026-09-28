import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useDeliveries } from '@/context/DeliveryContext'
import { useToast } from '@/context/ToastContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StickyActionBar from '@/components/ui/StickyActionBar'
import DeliverySuccessModal from '@/features/delivery/deliveries/DeliverySuccessModal'
import DeliveryFailureModal from '@/features/delivery/deliveries/DeliveryFailureModal'
import { formatDateLabel, formatDateTimeLabel } from '@/utils/date'
import type { ConfirmDeliveredInput, DeliveryAttempt, ReportFailureInput } from '@/types'

const ATTEMPT_STATUS_LABEL: Record<DeliveryAttempt['status'], string> = {
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Giao thành công',
  FAILED: 'Giao thất bại',
}

const ATTEMPT_DOT_CLASSNAME: Record<DeliveryAttempt['status'], string> = {
  OUT_FOR_DELIVERY: 'bg-secondary',
  DELIVERED: 'bg-primary',
  FAILED: 'bg-error',
}

export default function DeliveryDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { getById, startDelivery, confirmDelivered, reportFailure, startRedelivery } = useDeliveries()
  const { showToast } = useToast()
  const order = getById(id)

  usePageHeader({ title: order ? order.orderCode : 'Chi tiết giao hàng', subtitle: order?.farmerName })

  const [successOpen, setSuccessOpen] = useState(false)
  const [failureOpen, setFailureOpen] = useState(false)

  if (!order) {
    return (
      <Card className="text-center">
        <p className="font-body-md text-body-md text-on-surface-variant">Không tìm thấy đơn giao hàng này.</p>
        <Link to="/deliveries" className="inline-flex items-center gap-1 mt-space-md text-primary font-label-md text-label-md">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Quay lại danh sách
        </Link>
      </Card>
    )
  }

  const handleStartDelivery = () => {
    startDelivery(order.id)
    showToast(`Bắt đầu giao đơn ${order.orderCode}`)
  }

  const handleConfirmDelivered = (input: ConfirmDeliveredInput) => {
    confirmDelivered(order.id, input)
    setSuccessOpen(false)
    showToast(
      order.isCreditPurchase
        ? `Đã xác nhận giao thành công đơn ${order.orderCode}, đã ghi nhận công nợ mua chịu`
        : `Đã xác nhận giao thành công đơn ${order.orderCode}`,
    )
  }

  const handleReportFailure = (input: ReportFailureInput) => {
    reportFailure(order.id, input)
    setFailureOpen(false)
    showToast(input.redeliveryDate ? `Đã ghi nhận giao thất bại, hẹn giao lại ${formatDateLabel(input.redeliveryDate)}` : `Đã hủy đơn ${order.orderCode}`)
  }

  const handleStartRedelivery = () => {
    startRedelivery(order.id)
    showToast(`Bắt đầu giao lại đơn ${order.orderCode}`)
  }

  return (
    <div className="space-y-space-md pb-24">
      <button
        type="button"
        onClick={() => navigate('/deliveries')}
        className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-surface font-label-md text-label-md"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Quay lại danh sách
      </button>

      <Card>
        <div className="flex items-start justify-between gap-space-sm">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">{order.orderCode}</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{order.scheduledWindowLabel}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
        {order.isCreditPurchase ? (
          <span className="inline-flex mt-space-sm px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary-fixed text-on-secondary-fixed-variant">
            Đơn mua chịu — sẽ ghi công nợ khi giao thành công
          </span>
        ) : null}
      </Card>

      <Card className="space-y-space-md">
        <h3 className="font-label-sm text-label-sm uppercase text-on-surface-variant">Thông tin Farmer</h3>
        <div className="flex items-start gap-space-sm">
          <div className="w-10 h-10 rounded-full bg-primary-fixed/50 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">person</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-title-md text-title-md text-on-surface font-bold">{order.farmerName}</span>
              <a href={`tel:${order.farmerPhone.replace(/\./g, '')}`} className="text-primary font-label-md text-label-md hover:underline">
                {order.farmerPhone}
              </a>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              <span className="material-symbols-outlined text-[16px] align-text-bottom mr-1">location_on</span>
              {order.deliveryAddress}
            </p>
            {order.deliveryNote ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 bg-surface-container-low rounded px-space-sm py-space-xs">
                <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1">sticky_note_2</span>
                {order.deliveryNote}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="space-y-space-sm">
        <h3 className="font-label-sm text-label-sm uppercase text-on-surface-variant">Sản phẩm cần giao</h3>
        <div className="divide-y divide-outline-variant/60">
          {order.products.map((p) => (
            <div key={p.name} className="py-space-sm flex items-center justify-between gap-space-sm">
              <span className="font-body-md text-body-md text-on-surface">{p.name}</span>
              <span className="font-label-md text-label-md text-on-surface-variant tabular-nums shrink-0">{p.quantityLabel}</span>
            </div>
          ))}
        </div>
      </Card>

      {order.attempts.length > 0 ? (
        <Card className="space-y-space-sm">
          <h3 className="font-label-sm text-label-sm uppercase text-on-surface-variant">Lịch sử các lần giao</h3>
          <div className="space-y-space-md">
            {order.attempts.map((attempt) => (
              <div key={attempt.id} className="flex items-start gap-space-sm">
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${ATTEMPT_DOT_CLASSNAME[attempt.status]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-space-sm">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      Lần {attempt.attemptNumber}: {ATTEMPT_STATUS_LABEL[attempt.status]}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant shrink-0">
                      {formatDateTimeLabel(attempt.startedAt)}
                    </span>
                  </div>
                  {attempt.failureReasonLabel ? (
                    <p className="font-body-sm text-body-sm text-error mt-0.5">{attempt.failureReasonLabel}</p>
                  ) : null}
                  {attempt.note ? <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{attempt.note}</p> : null}
                  {attempt.proofPhotoUrl ? (
                    <img
                      src={attempt.proofPhotoUrl}
                      alt="Ảnh chứng minh giao hàng"
                      className="mt-space-sm rounded-lg border border-outline-variant max-h-48 object-cover"
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {order.status === 'DELIVERED' ? (
        <div className="p-space-md bg-primary-fixed/40 border border-primary-fixed-dim/60 rounded-lg font-body-sm text-body-sm text-on-primary-fixed-variant">
          Đã ghi nhận hoàn tất giao hàng
          {order.isCreditPurchase ? ' và tạo công nợ mua chịu cho Farmer.' : '.'}
        </div>
      ) : null}

      {order.status === 'CANCELLED' && order.cancelReasonLabel ? (
        <div className="p-space-md bg-surface-container-high border border-outline-variant rounded-lg font-body-sm text-body-sm text-outline">
          Đơn đã bị hủy — lý do: {order.cancelReasonLabel}
        </div>
      ) : null}

      {order.status === 'ASSIGNED' ? (
        <StickyActionBar>
          <Button icon="local_shipping" onClick={handleStartDelivery}>
            Bắt đầu giao
          </Button>
        </StickyActionBar>
      ) : null}

      {order.status === 'OUT_FOR_DELIVERY' ? (
        <StickyActionBar className="flex gap-space-sm">
          <Button variant="outline-danger" icon="error" fullWidth={false} className="flex-1" onClick={() => setFailureOpen(true)}>
            Giao thất bại
          </Button>
          <Button icon="check_circle" fullWidth={false} className="flex-1" onClick={() => setSuccessOpen(true)}>
            Giao thành công
          </Button>
        </StickyActionBar>
      ) : null}

      {order.status === 'FAILED' && order.redeliveryDate ? (
        <StickyActionBar className="space-y-space-sm">
          <p className="font-label-md text-label-md text-on-surface-variant text-center sm:text-left">
            Ngày giao lại dự kiến: <span className="font-bold text-on-surface">{formatDateLabel(order.redeliveryDate)}</span>
          </p>
          <Button icon="replay" onClick={handleStartRedelivery}>
            Bắt đầu giao lại
          </Button>
        </StickyActionBar>
      ) : null}

      <DeliverySuccessModal open={successOpen} onClose={() => setSuccessOpen(false)} onConfirm={handleConfirmDelivered} />
      <DeliveryFailureModal open={failureOpen} onClose={() => setFailureOpen(false)} onConfirm={handleReportFailure} />
    </div>
  )
}
