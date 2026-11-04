import { usePermission } from '@/context/PermissionContext'
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
  ADJUSTED: 'Đã điều chỉnh',
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

/** Reason codes of debt actions (FE_GUIDE_FLOW_3 §5); the server sends the code, the label is ours. */
export const DEBT_REASON_CODE_LABEL: Record<string, string> = {
  MAT_MUA: 'Mất mùa',
  THIEN_TAI: 'Thiên tai',
  KHO_KHAN: 'Khó khăn gia đình',
  TRI_AN: 'Tri ân',
  SAI_SOT: 'Cửa hàng ghi sai',
  KHONG_THU_HOI: 'Không thu hồi được',
  KHAC: 'Khác',
}

/** The four hardship codes rollover accepts, in display order. One list so the proposed contract can change in one place. */
export const ROLLOVER_REASON_CODES = ['MAT_MUA', 'THIEN_TAI', 'KHO_KHAN', 'KHAC'] as const

export const ROLLOVER_SKIP_LABEL: Record<string, string> = {
  NOT_FOUND: 'Không tìm thấy khoản nợ',
  NOT_IN_SEASON: 'Không còn thu trong vụ này (đã chuyển)',
  NOTHING_OWED: 'Đã trả hết',
  DISPUTED: 'Đang khiếu nại, cần Chủ quyết riêng',
  NOT_LATER: 'Hạn hiện tại không sớm hơn hạn vụ đích',
  NEEDS_OWNER: 'Nhân viên hết lượt gia hạn, cần Chủ',
  EXCEEDS_TOTAL_EXTENSION: 'Vượt tổng thời gian gia hạn tối đa',
}

export const DUE_STATE_LABEL: Record<string, string> = { NOT_DUE: 'Chưa đến hạn', DUE_SOON: 'Sắp đến hạn', OVERDUE: 'Quá hạn' }
export const DUE_STATE_OPTIONS = Object.entries(DUE_STATE_LABEL).map(([value, text]) => ({ value, label: text }))

const ROLE_LABEL: Record<string, string> = { STORE_OWNER: 'Chủ cửa hàng', SALES_STAFF: 'Nhân viên bán hàng', DELIVERY_STAFF: 'Nhân viên giao hàng', ADMIN: 'Quản trị viên', FARMER: 'Nông dân' }
export const roleLabel = (role: string | null | undefined) => (role ? ROLE_LABEL[role] ?? role : '')

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
export function useCanManage(codes: string[]): boolean {
  const { has } = usePermission()
  return codes.some(has)
}

/** Base path of the current role's area, e.g. "/agent" or "/sales". */
export function useRoleBase(): string {
  const { currentRole } = useAuth()
  return currentRole === 'sales_staff' ? '/sales' : currentRole === 'admin' ? '/admin' : '/agent'
}
