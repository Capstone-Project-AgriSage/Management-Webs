import type { AuditLogResponse } from '@/api/auditLogsApi'

export const roleLabels: Record<string, string> = {
  ADMIN: 'Admin', STORE_OWNER: 'Owner', SALES_STAFF: 'Sale', FARMER: 'Farmer', DELIVERY_STAFF: 'Giao hàng',
}

export const entityLabels: Record<string, string> = {
  USER: 'Tài khoản', AUTH_SESSION: 'Phiên đăng nhập', ORDER: 'Đơn hàng', ORDER_ITEM: 'Dòng đơn hàng',
  PAYMENT: 'Thanh toán', PAYMENT_ALLOCATION: 'Phân bổ thanh toán', DEBT_ENTRY: 'Khoản nợ',
  DEBT_TRANSACTION: 'Giao dịch công nợ', CREDIT_PROFILE: 'Hồ sơ tín dụng', CREDIT_TIER: 'Hạn mức tín dụng',
  CUSTOMER_GROUP: 'Nhóm khách hàng', FARMER_PROFILE: 'Khách hàng', PRODUCT: 'Sản phẩm',
  PRODUCT_PACKAGING: 'Quy cách sản phẩm', STORE_PRODUCT: 'Sản phẩm đại lý', INVENTORY_LOT: 'Lô hàng',
  STOCK_MOVEMENT: 'Biến động kho', STOCKTAKE: 'Phiếu kiểm kê', GOODS_RECEIPT: 'Phiếu nhập kho',
  DELIVERY: 'Phiếu giao hàng', DELIVERY_NOTE: 'Phiếu giao hàng', SALES_RETURN: 'Phiếu trả hàng',
  REFUND: 'Hoàn tiền', PRICE_LIST: 'Bảng giá', DIAGNOSIS_CASE: 'Ca chẩn đoán',
}

export const actionLabels: Record<string, string> = {
  AUTH_LOGIN: 'Đăng nhập', AUTH_REGISTERED: 'Đăng ký tài khoản', AUTH_LOGIN_FAILED: 'Đăng nhập thất bại',
  AUTH_SESSION_REVOKED: 'Đăng xuất phiên', AUTH_LOGOUT_ALL: 'Đăng xuất tất cả thiết bị',
  AUTH_REFRESH_REUSE: 'Phát hiện sử dụng lại mã làm mới', AUTH_MESSAGE_DELIVERY_FAILED: 'Gửi mã xác thực thất bại',
  PASSWORD_CHANGED: 'Đổi mật khẩu', PASSWORD_RESET: 'Đặt lại mật khẩu', EMAIL_VERIFIED: 'Xác minh email',
  PHONE_VERIFIED: 'Xác minh số điện thoại', STAFF_CREATED: 'Thêm nhân viên', STAFF_UPDATED: 'Cập nhật nhân viên',
  STAFF_LOCKED: 'Khóa nhân viên', STAFF_UNLOCKED: 'Mở khóa nhân viên', STAFF_REMOVED: 'Xóa nhân viên',
  ROLE_PERMISSIONS_CHANGED: 'Thay đổi quyền vai trò', STAFF_PERMISSIONS_CHANGED: 'Thay đổi quyền nhân viên',
  STAFF_PASSWORD_RESET: 'Đặt lại mật khẩu nhân viên', USER_CREATED: 'Tạo tài khoản', USER_UPDATED: 'Cập nhật tài khoản',
  USER_SUSPENDED: 'Tạm ngừng tài khoản', CUSTOMER_CREATED: 'Thêm khách hàng', CUSTOMER_UPDATED: 'Cập nhật khách hàng',
  ORDER_PLACED: 'Đặt đơn hàng', ORDER_CREATED: 'Tạo đơn hàng', ORDER_UPDATED: 'Cập nhật đơn hàng',
  ORDER_CONFIRMED: 'Xác nhận đơn hàng', ORDER_CANCELLED: 'Hủy đơn hàng', ORDER_COMPLETED: 'Hoàn tất đơn hàng',
  ORDER_PREPARING_STARTED: 'Bắt đầu chuẩn bị đơn hàng', ORDER_MARKED_READY: 'Đánh dấu đơn hàng sẵn sàng',
  ORDER_PICKUP_COMPLETED: 'Bàn giao đơn hàng tại quầy', COUNTER_SALE_COMPLETED: 'Hoàn tất bán tại quầy',
  PRICE_OVERRIDE: 'Điều chỉnh giá bán', PRICE_OVERRIDE_REMOVED: 'Bỏ điều chỉnh giá',
  PAYMENT_CREATED: 'Tạo thanh toán', CASH_PAYMENT_CONFIRMED: 'Xác nhận thu tiền mặt', PAYMENT_RECEIVED: 'Nhận thanh toán',
  PAYMENT_CANCELLED: 'Hủy thanh toán', PAYMENT_FAILED: 'Thanh toán thất bại', PAYMENT_REVERSED: 'Đảo thanh toán',
  PAYMENT_LINK_REQUESTED: 'Tạo liên kết thanh toán', DEBT_ADJUSTED: 'Điều chỉnh công nợ', DEBT_CANCELLED: 'Hủy công nợ',
  DEBT_PAYMENT_COLLECTED: 'Thu tiền công nợ', CREDIT_LIMIT_CHANGED: 'Thay đổi hạn mức tín dụng',
  CREDIT_PROFILE_SUSPENDED: 'Tạm ngừng tín dụng', CREDIT_PROFILE_UPDATED: 'Cập nhật hồ sơ tín dụng',
  CREDIT_PROFILE_CREATED: 'Tạo hồ sơ tín dụng', CREDIT_TIER_CREATED: 'Thêm hạn mức tín dụng',
  CREDIT_TIER_UPDATED: 'Cập nhật hạn mức tín dụng', CUSTOMER_GROUP_CHANGED: 'Đổi nhóm khách hàng',
  CUSTOMER_CREDIT_CREATED: 'Tạo hồ sơ tín dụng khách hàng', CUSTOMER_CREDIT_LIMIT_CHANGED: 'Đổi hạn mức tín dụng khách hàng',
  CUSTOMER_CREDIT_STATUS_CHANGED: 'Đổi trạng thái tín dụng khách hàng', CUSTOMER_GROUP_ASSIGNED: 'Gán nhóm khách hàng',
  CUSTOMER_GROUP_CREATED: 'Tạo nhóm khách hàng', CUSTOMER_GROUP_DEFAULT_CHANGED: 'Đổi nhóm khách hàng mặc định',
  CUSTOMER_GROUP_DELETED: 'Xóa nhóm khách hàng', CUSTOMER_STATUS_CHANGED: 'Đổi trạng thái khách hàng',
  DEBT_CREATED: 'Ghi nhận công nợ', DEBT_MANUAL_ENTRY: 'Điều chỉnh công nợ thủ công',
  DEBT_PAYMENT_RECORDED: 'Ghi nhận thanh toán công nợ', DEBT_RETURN_APPLIED: 'Giảm công nợ do trả hàng',
  GOODS_RECEIPT_CONFIRMED: 'Xác nhận nhập kho', INVENTORY_ADJUSTED: 'Điều chỉnh tồn kho',
  INVENTORY_LOT_STATUS_CHANGED: 'Thay đổi trạng thái lô hàng', STOCKTAKE_COMPLETED: 'Hoàn tất kiểm kê',
  INVENTORY_SETTINGS_UPDATED: 'Cập nhật cấu hình tồn kho', PRODUCT_CREATED: 'Thêm sản phẩm',
  INVENTORY_LOTS_EXPIRED: 'Đánh dấu lô hàng hết hạn', STOCKTAKE_CANCELLED: 'Hủy phiếu kiểm kê',
  STOCKTAKE_DELETED: 'Xóa phiếu kiểm kê',
  PRODUCT_UPDATED: 'Cập nhật sản phẩm', PRODUCT_STATUS_CHANGED: 'Đổi trạng thái sản phẩm',
  PRODUCT_DISCONTINUED: 'Ngừng kinh doanh sản phẩm', PRODUCT_PACKAGING_CREATED: 'Thêm quy cách sản phẩm',
  PRODUCT_PACKAGING_UPDATED: 'Cập nhật quy cách sản phẩm', PRODUCT_PACKAGING_REMOVED: 'Xóa quy cách sản phẩm',
  PRODUCT_INGREDIENTS_UPDATED: 'Cập nhật hoạt chất sản phẩm', STORE_PRODUCT_CREATED: 'Thêm sản phẩm vào đại lý',
  STORE_PRODUCT_UPDATED: 'Cập nhật sản phẩm đại lý', STORE_PRODUCT_ACTIVATED: 'Kích hoạt sản phẩm đại lý',
  STORE_PRODUCT_DEACTIVATED: 'Ngừng sản phẩm đại lý', PRICE_LIST_CREATED: 'Tạo bảng giá',
  PRICE_LIST_UPDATED: 'Cập nhật bảng giá', PRICE_LIST_ACTIVATED: 'Kích hoạt bảng giá',
  PRICE_LIST_DEACTIVATED: 'Ngừng bảng giá', DELIVERY_COMPLETED: 'Hoàn tất giao hàng',
  PRICE_LIST_DELETED: 'Xóa bảng giá', PRICE_LIST_ITEMS_CHANGED: 'Đổi giá trong bảng giá',
  DELIVERY_ASSIGNED: 'Phân công giao hàng', DELIVERY_ATTEMPT_CANCELLED: 'Hủy lần giao hàng',
  DELIVERY_ATTEMPT_COMPLETED: 'Kết thúc lần giao hàng', DELIVERY_ATTEMPT_STARTED: 'Bắt đầu lần giao hàng',
  DELIVERY_CANCELLED: 'Hủy giao hàng', DELIVERY_CREATED: 'Tạo phiếu giao hàng', DELIVERY_DISPATCHED: 'Xuất hàng giao',
  DELIVERY_INCIDENT_REPORTED: 'Ghi nhận sự cố giao hàng', DELIVERY_LOTS_CHANGED: 'Đổi lô giao hàng',
  DELIVERY_INCIDENT_RESOLVED: 'Xử lý sự cố giao hàng', RETURN_REQUESTED: 'Yêu cầu trả hàng',
  RETURN_APPROVED: 'Duyệt trả hàng', RETURN_REJECTED: 'Từ chối trả hàng', RETURN_CANCELLED: 'Hủy yêu cầu trả hàng',
  RETURN_INSPECTION_COMPLETED: 'Hoàn tất kiểm tra hàng trả', REFUND_COMPLETED: 'Hoàn tất hoàn tiền',
  REFUND_PENDING: 'Chờ hoàn tiền', AI_REVIEW_CONFIRMED: 'Duyệt kết quả AI', AI_REVIEW_CORRECTED: 'Sửa kết quả AI',
  REFUND_FAILED: 'Hoàn tiền thất bại', REFUND_CANCELLED: 'Hủy hoàn tiền',
}

const fieldLabels: Record<string, string> = {
  fullName: 'Họ tên', email: 'Email', phoneNumber: 'Số điện thoại', role: 'Vai trò', status: 'Trạng thái',
  creditLimit: 'Hạn mức tín dụng', personalLimit: 'Hạn mức cá nhân', outstandingAmount: 'Dư nợ',
  amount: 'Số tiền', totalAmount: 'Tổng tiền', quantity: 'Số lượng', baseQuantity: 'Số lượng đơn vị cơ sở',
  unitPrice: 'Đơn giá', price: 'Giá', oldLimit: 'Hạn mức cũ', newLimit: 'Hạn mức mới',
  name: 'Tên', sku: 'Mã sản phẩm', isActive: 'Đang hoạt động', isSellable: 'Được bán',
  customerGroupId: 'Nhóm khách hàng', creditTierId: 'Hạn mức tín dụng', reason: 'Lý do',
  orderNumber: 'Mã đơn hàng', paymentNumber: 'Mã thanh toán', stocktakeNumber: 'Mã kiểm kê',
  receiptNumber: 'Mã nhập kho', requiresLotTracking: 'Theo dõi lô', requiresExpiryDate: 'Theo dõi hạn sử dụng',
  reorderPoint: 'Ngưỡng nhập hàng', lowStockThreshold: 'Ngưỡng tồn kho thấp',
  quantityOnHand: 'Số lượng tồn kho', quantityReserved: 'Số lượng giữ chỗ', totalCostValue: 'Giá trị tồn kho',
  minStockLevelBase: 'Mức tồn kho tối thiểu', storeSku: 'Mã sản phẩm đại lý', lots: 'Các lô hàng',
  quantities: 'Số lượng các lô', packagings: 'Quy cách đóng gói', ingredients: 'Hoạt chất',
}

export function actorLabel(log: AuditLogResponse): string {
  return log.actorName || log.actorEmail || (log.actorUserId ? 'Tài khoản chưa có thông tin'
    : log.action.startsWith('AUTH_') ? 'Không xác định' : 'Hệ thống')
}

export function actionLabel(log: AuditLogResponse): string {
  return actionLabels[log.action] ?? log.action
}

export function eventStatus(log: AuditLogResponse): 'SUCCESS' | 'FAILURE' {
  return log.status ?? (log.action.endsWith('_FAILED') || log.action === 'AUTH_REFRESH_REUSE' ? 'FAILURE' : 'SUCCESS')
}

export function resourceLabel(log: AuditLogResponse): string {
  const keys = ['orderNumber', 'paymentNumber', 'stocktakeNumber', 'receiptNumber', 'movementNumber',
    'deliveryNumber', 'returnNumber', 'refundNumber', 'sku', 'name', 'fullName']
  for (const values of [log.newValues, log.oldValues]) {
    if (values && typeof values === 'object' && !Array.isArray(values)) {
      for (const key of keys) {
        const value = (values as Record<string, unknown>)[key]
        if (typeof value === 'string' && value.trim()) return value
      }
    }
  }
  return log.entityId ?? 'Không có mã đối tượng'
}

export function browserLabel(agent: string | null): string {
  if (!agent) return 'Không ghi nhận'
  const browsers: [RegExp, string][] = [[/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Edge'], [/OPR\/([\d.]+)/, 'Opera'],
    [/Firefox\/([\d.]+)/, 'Firefox'], [/CriOS\/([\d.]+)/, 'Chrome'], [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari\//, 'Safari']]
  const browser = browsers.find(([pattern]) => pattern.test(agent))
  const name = browser ? `${browser[1]} ${agent.match(browser[0])?.[1]}` : 'Trình duyệt/ứng dụng khác'
  const os = /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS' : /Windows/.test(agent)
    ? 'Windows' : /Mac OS/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : ''
  return os ? `${name} · ${os}` : name
}

function flatten(value: unknown, path = '', result: Record<string, unknown> = Object.create(null)): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
    for (const [key, entry] of Object.entries(value)) flatten(entry, path ? `${path}.${key}` : key, result)
  } else if (path || value != null) result[path || 'value'] = value
  return result
}

export function changeRows(log: AuditLogResponse) {
  const before = flatten(log.oldValues)
  const after = flatten(log.newValues)
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].map(path => ({
    path, label: path.split('.').map(key => Object.hasOwn(fieldLabels, key) ? fieldLabels[key] : key).join(' › '),
    before: before[path], after: after[path], changed: JSON.stringify(before[path]) !== JSON.stringify(after[path]),
  }))
}

export function valueLabel(value: unknown): string {
  if (value === undefined) return 'Chưa có'
  if (value === null) return 'Trống'
  if (value === '[REDACTED]') return 'Đã ẩn thông tin nhạy cảm'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
