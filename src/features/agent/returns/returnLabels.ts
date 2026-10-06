import type { ReturnCondition, ReturnReason, ReturnStatus } from '@/api/returnsApi'
import type { RefundMethod, RefundStatus } from '@/api/refundsApi'

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt, chờ nhận hàng',
  REJECTED: 'Đã từ chối',
  RECEIVED: 'Đã nhận hàng, chờ kiểm tra',
  INSPECTED: 'Đã kiểm tra',
  // After the inspection is closed the stock (and debt) side is settled; this status then waits for the refunds.
  PARTIALLY_RESOLVED: 'Chờ hoàn tiền',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
}

export const RETURN_STATUS_BADGE_CLASS: Record<ReturnStatus, string> = {
  REQUESTED: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-sky-100 text-sky-800',
  REJECTED: 'bg-rose-100 text-rose-700',
  RECEIVED: 'bg-indigo-100 text-indigo-800',
  INSPECTED: 'bg-violet-100 text-violet-800',
  PARTIALLY_RESOLVED: 'bg-teal-100 text-teal-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-slate-200 text-slate-600',
}

export const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'WRONG_PRODUCT', label: 'Giao nhầm sản phẩm' },
  { value: 'DAMAGED_PRODUCT', label: 'Sản phẩm hư hỏng' },
  { value: 'QUALITY_ISSUE', label: 'Lỗi chất lượng' },
  { value: 'EXPIRED_PRODUCT', label: 'Hết hạn dùng' },
  { value: 'DELIVERY_DAMAGE', label: 'Hỏng khi vận chuyển' },
  { value: 'CUSTOMER_REJECTION', label: 'Khách không muốn lấy nữa' },
  { value: 'OTHER', label: 'Lý do khác' },
]

export const RETURN_CONDITIONS: { value: Exclude<ReturnCondition, 'PENDING_INSPECTION'>; label: string; hint: string }[] = [
  { value: 'RESELLABLE', label: 'Còn bán được', hint: 'nhập lại vào đúng lô cũ' },
  { value: 'DAMAGED', label: 'Hư hỏng', hint: 'không nhập lại kho' },
  { value: 'EXPIRED', label: 'Hết hạn', hint: 'không nhập lại kho' },
  { value: 'UNUSABLE', label: 'Không dùng được', hint: 'không nhập lại kho' },
]

export const CONDITION_LABEL: Record<ReturnCondition, string> = {
  PENDING_INSPECTION: 'Chưa kiểm tra',
  RESELLABLE: 'Còn bán được',
  DAMAGED: 'Hư hỏng',
  EXPIRED: 'Hết hạn',
  UNUSABLE: 'Không dùng được',
}

export const DISPOSITION_LABEL: Record<string, string> = {
  NONE: '-',
  RESTOCK: 'Nhập lại kho',
  WRITE_OFF: 'Không nhập lại (hủy)',
}

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  PENDING: 'Chờ hoàn tiền',
  COMPLETED: 'Đã hoàn tiền',
  FAILED: 'Hoàn thất bại',
  CANCELLED: 'Đã hủy',
}

export const REFUND_STATUS_BADGE_CLASS: Record<RefundStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate-200 text-slate-600',
}

export const REFUND_METHOD_LABEL: Record<RefundMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  OTHER_EXTERNAL: 'Hình thức khác',
}

/** Status text of a return: while waiting for refunds it says whether some refund is already paid. */
export function returnStatusText(status: ReturnStatus, refunds: { status: RefundStatus }[] = []): string {
  if (status === 'PARTIALLY_RESOLVED' && refunds.some((r) => r.status === 'COMPLETED')) return 'Đã hoàn tiền một phần'
  return RETURN_STATUS_LABEL[status]
}
