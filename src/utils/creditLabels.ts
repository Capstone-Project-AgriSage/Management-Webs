import { useAuth } from '@/context/AuthContext'

// Vietnamese labels for FLOW_3 enums. Unknown codes fall back to the raw value.

export const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  LOCKED: 'Bị khóa',
}

export const CREDIT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Đang mở',
  SUSPENDED: 'Tạm dừng',
  BLOCKED: 'Bị khóa',
}

export const DEBT_ENTRY_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Chưa trả',
  PARTIALLY_PAID: 'Trả một phần',
  PAID: 'Đã trả hết',
  DISPUTED: 'Đang tranh chấp',
  CANCELLED: 'Đã hủy',
}

export const DEBT_SOURCE_LABEL: Record<string, string> = {
  DELIVERY: 'Giao hàng',
  PICKUP: 'Nhận tại quầy',
  MANUAL_ADJUSTMENT: 'Ghi nợ thủ công',
}

export const DEBT_TRANSACTION_LABEL: Record<string, string> = {
  CREDIT_SALE: 'Ghi nợ bán chịu',
  PAYMENT: 'Thu nợ',
  ADJUSTMENT_IN: 'Tăng nợ',
  ADJUSTMENT_OUT: 'Giảm nợ',
  RETURN: 'Trả hàng',
}

export const DEBT_ACTION_LABEL: Record<string, string> = {
  DISPUTE: 'Khiếu nại',
  KEEP: 'Giữ nguyên',
  CHANGE_DUE_DATE: 'Đổi hạn trả',
  ADJUST: 'Điều chỉnh giảm',
  CANCEL: 'Hủy khoản nợ',
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  PAID: 'Đã xác nhận',
  FAILED: 'Bị từ chối',
  CANCELLED: 'Đã hủy',
  PARTIALLY_REFUNDED: 'Hoàn một phần',
  REFUNDED: 'Đã hoàn tiền',
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Tiền mặt',
  PAYOS: 'payOS',
  BANK_TRANSFER: 'Chuyển khoản',
}

export const ORDER_PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIALLY_PAID: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
}

export function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '--'
  return map[key] ?? key
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '--'
  // Date-only values ("2026-11-01") are Vietnam days: format without a timezone shift.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDayTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '--'
}

/** Today in Vietnam as yyyy-MM-dd (due dates are Vietnam days). */
export function todayVn(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

/** "Manage" in the API = ADMIN or STORE_OWNER; "Operate" adds SALES_STAFF (FLOW_3 B-D5). */
export function useCanManage(): boolean {
  const { currentRole } = useAuth()
  return currentRole === 'agent' || currentRole === 'admin'
}

/** Base path of the current role's area, e.g. "/agent" or "/sales". */
export function useRoleBase(): string {
  const { currentRole } = useAuth()
  return currentRole === 'sales_staff' ? '/sales' : currentRole === 'admin' ? '/admin' : '/agent'
}
