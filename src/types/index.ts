import type { RowAction } from '@/components/ui/RowActionsMenu'

// ============================================================
// Unified User type — covers all 4 roles
// ============================================================

export type AppRole = 'admin' | 'agent' | 'sales_staff' | 'delivery_staff'

export interface AppUser {
  name: string
  role: AppRole
  roleLabel: string
  initials: string
  email: string
  /** Agent/Sales/Delivery — the store/hub this user belongs to */
  hub?: string
  storeName?: string
  hubName?: string
  storeId?: string
  can_review_ai?: boolean
}

// ============================================================
// Shared Navigation & Layout
// ============================================================

export interface NavItem {
  label: string
  to: string
  icon: string
  badge?: string
  badgeTone?: 'neutral' | 'primary' | 'error' | 'warning'
  iconTone?: 'default' | 'primary'
  /** permissionModules key (mockRoles.ts) this item's page requires "view" on. Admin only. */
  permissionModule?: string
}

export interface PageHeaderState {
  title: string
  subtitle?: string
  badge?: string
}

export interface Badge {
  label: string
  className: string
}

// ============================================================
// Admin-specific types
// ============================================================

/** Legacy user type alias for admin features that reference AdminUser */
export interface AdminUser {
  name: string
  role: AccountRole
  roleLabel: string
  initials: string
  email: string
}

/** The roles that exist across the AgriSage product suite today. */
export type AccountRole = 'Admin' | 'Store Owner' | 'Sales Staff' | 'Delivery Staff' | 'Farmer'

export type AccountStatus = 'Đang hoạt động' | 'Bị khóa' | 'Chờ duyệt'

export interface AccountActivityEntry {
  time: string
  action: string
  note: string
}

export interface Account {
  id: string
  fullName: string
  initials: string
  email: string
  phone: string
  role: AccountRole
  region: string
  status: AccountStatus
  createdAt: string
  lastActiveAgo: string
  ordersOrCases: string
  addressDetail: string
  joinNote: string
  verified: boolean
  activityLog: AccountActivityEntry[]
}

export type AccountActionId = 'view' | 'change-role' | 'reset-password' | 'lock' | 'unlock' | 'approve' | 'reject'

export interface AccountAction extends RowAction {
  id: AccountActionId
}

export interface Permission {
  key: string
  label: string
}

export interface PermissionModule {
  key: string
  label: string
  icon: string
  permissions: Permission[]
}

export interface Role {
  id: string
  name: AccountRole
  description: string
  colorClassName: string
  icon: string
  accountCount: number
  grantedKeys: string[]
  editable: boolean
}

export interface DashboardAlert {
  icon: string
  iconClassName: string
  title: string
  note: string
  timeAgo: string
}

export interface RecentActivityEntry {
  actorInitials: string
  actorAvatarClassName: string
  actorName: string
  actorRole: string
  action: string
  target: string
  time: string
  resultClassName: string
}

// --- Products Management Types (Admin) ---

export type CategoryStatus = 'Hoạt động' | 'Đang ẩn'
export interface ProductCategory {
  id: string
  name: string
  parentId: string | null
  description: string
  status: CategoryStatus
  createdAt: string
  productCount: number
}
export type CategoryActionId = 'edit' | 'delete' | 'toggle-status'

export type AdminProductStatus = 'Đang lưu hành' | 'Chờ duyệt' | 'Ngừng kinh doanh'
export interface ProductMaster {
  id: string
  sku: string
  name: string
  imageUrl: string
  categoryId: string
  activeIngredientId: string
  manufacturer: string
  unit: string
  status: AdminProductStatus
  createdAt: string
}
export type ProductActionId = 'view' | 'edit' | 'delete' | 'approve' | 'reject'

export type ToxicityClass = 'Nhóm I' | 'Nhóm II' | 'Nhóm III' | 'Nhóm IV'
export interface ActiveIngredient {
  id: string
  name: string
  chemicalName: string
  type: string
  toxicityClass: ToxicityClass
  description: string
  productCount: number
}
export type IngredientActionId = 'edit' | 'delete' | 'view-products'

// --- AI Management Types (Admin) ---

export type AiModelStatus = 'Đang chạy' | 'Đang huấn luyện' | 'Đã dừng'
export type AiModelType = 'Computer Vision' | 'NLP/Chatbot' | 'Dự báo (Prediction)'
export interface AiModel {
  id: string
  name: string
  version: string
  type: AiModelType
  accuracy: number
  status: AiModelStatus
  lastUpdated: string
  description: string
}
export type AiModelActionId = 'deploy' | 'pause' | 'view-metrics'

export type AiPolicyType = 'Danh sách đen (Blocklist)' | 'System Prompt' | 'Luật Fallback'
export type AiPolicyPriority = 'Cao' | 'Trung bình' | 'Thấp'
export interface AiPolicy {
  id: string
  name: string
  type: AiPolicyType
  priority: AiPolicyPriority
  content: string
  isActive: boolean
  lastUpdated: string
}
export type AiPolicyActionId = 'edit' | 'delete' | 'toggle-active'

// --- Content & System Types (Admin) ---

export type ArticleStatus = 'Đã xuất bản' | 'Bản nháp' | 'Chờ duyệt'
export interface Article {
  id: string
  title: string
  category: string
  author: string
  views: number
  status: ArticleStatus
  publishedAt: string
}
export type ArticleActionId = 'view' | 'edit' | 'delete' | 'approve' | 'publish'

export type NotificationTarget = 'Tất cả' | 'Nông dân' | 'Đại lý' | 'Chuyên gia'
export type NotificationStatus = 'Đã gửi' | 'Lên lịch' | 'Bản nháp'
export interface SystemNotification {
  id: string
  title: string
  content: string
  target: NotificationTarget
  type: 'Hệ thống' | 'Cảnh báo' | 'Khuyến mãi'
  status: NotificationStatus
  scheduledFor: string
  sentCount: number
}
export type NotificationActionId = 'view' | 'edit' | 'delete' | 'send-now'

export type AuditLogLevel = 'Info' | 'Warning' | 'Error'
export interface AuditLog {
  id: string
  timestamp: string
  actor: string
  action: string
  targetResource: string
  level: AuditLogLevel
  ipAddress: string
}
export type AuditLogActionId = 'view-details'

// ============================================================
// Agent-specific types
// ============================================================

/** Legacy user type alias for agent features */
export interface AgentUser {
  name: string
  role: string
  initials: string
  hub: string
  can_review_ai: boolean
  storeId?: string
}

export interface AiPolicyConfig {
  modelVersion: string
  confidenceHigh: number
  confidenceMed: number
  rejectionThreshold: number
  requiresHumanReview: boolean
}

export type StockAdjustmentReason = 'DAMAGED' | 'EXPIRED' | 'LOST' | 'MANUAL_CORRECTION'

export interface StockMovement {
  id: string
  productId: string
  productName: string
  sku: string
  movementType: 'STOCK_IN' | 'SALE' | 'ADJUSTMENT'
  quantityChange: number
  balanceAfter: number
  unit: string
  reason?: StockAdjustmentReason
  referenceId?: string
  createdAt: string
  createdBy: string
  note?: string
}

export interface CreditRequest {
  id: string
  orderId: string
  orderCode: string
  farmerId: string
  farmerName: string
  farmerPhone: string
  requestedAmount: number
  seasonalLimit: number
  usedLimit: number
  remainingLimit: number
  cropSeason: string
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  createdAt: string
  reviewerNote?: string
  reviewedAt?: string
  reviewedBy?: string
}

export interface DebtPaymentRequest {
  id: string
  debtId: string
  orderCode: string
  farmerName: string
  farmerPhone: string
  amount: number
  paymentMethod: 'VIETQR' | 'CASH'
  status: 'PENDING_AGENT_CONFIRMATION' | 'PENDING_STAFF_CONFIRMATION' | 'CONFIRMED' | 'REJECTED'
  createdAt: string
  note?: string
  confirmedAt?: string
  confirmedBy?: string
}

export interface OrderItem {
  productId?: string
  name: string
  qtyPrice: string
  total: string
}

export type OrderStatus = 'Chờ xác nhận' | 'Đã xác nhận' | 'Đang xử lý' | 'Đang chuẩn bị' | 'Đang giao' | 'Đang giao hàng' | 'Chờ giao lại' | 'Giao thất bại' | 'Hoàn thành' | 'Đã hủy'

export type OrderPaymentMethod = 'Tiền mặt tại kho' | 'Tiền mặt (COD)' | 'Tiền mặt tại quầy' | 'Chuyển khoản' | 'VietQR' | 'VietQR (Đã TT)' | 'Cọc 50%' | 'Gối nợ vụ mùa'

export interface Order {
  id: string
  farmerId?: string
  customerName: string
  phone: string
  shortLocation?: string
  fullAddress?: string
  wardAddress?: string
  timeBold?: string
  timeRest?: string
  createdAgo: string
  createdAt?: string
  productLine?: string
  productTitle?: string
  productNote?: string
  items: OrderItem[]
  feeLine?: { label: string; value: string }
  total: string
  paymentMethod: OrderPaymentMethod
  paymentBadge: { label: string; className: string }
  status: OrderStatus
  statusBadge: { label: string; className: string; pulse?: boolean; dotClassName?: string }
  shippingIcon?: string
  shippingIconClassName?: string
  shippingLabel?: string
  shippingLabelTitle?: string
  rowAttentionClassName?: string
  rowClassName?: string
  idClassName?: string
  panelBadge?: { label: string; className: string }
  deliveryNote?: string
  note?: string
  paymentFooterNote?: string
  paymentFooterClassName?: string
  createdBy?: string
  actions: RowAction[]
}

export interface RecentOrder {
  id: string
  date: string
  note: string
  amount: string
  statusLabel: string
  statusClassName: string
}

export interface AiLog {
  disease: string
  diseaseClassName: string
  confidenceLabel: string
  confidenceBadgeClassName: string
  cardClassName: string
  date: string
  note: string
  noteClassName: string
  dotClassName: string
}

export type FarmerStatus = 'Đang hoạt động' | 'Ít hoạt động' | 'Quá hạn nợ'

export interface Farmer {
  id: string
  name: string
  initials: string
  verified: boolean
  phone: string
  areaShort: string
  areaTitle: string
  lastOrderId: string
  lastOrderAgo: string
  totalPurchaseLabel: string
  hasDebt: boolean
  debtLabel: string
  debtNote?: string
  debtNoteClassName?: string
  debtOverdue?: boolean
  activityDate?: string
  activityNote?: string
  activityNoteClassName?: string
  status: FarmerStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  fullAddress: string
  joinDate: string
  tenureNote?: string
  managedBy?: string
  totalOrdersCount: string
  totalPurchaseValue: string
  lastOrderDateNote: string
  lastOrderValue: string
  paidAmount: string
  paidPercent: string
  debtPercent: string
  debtDetail?: {
    totalDebt: string
    dueDate: string
    dueNote: string
    riskLabel: string
  }
  recentOrders: RecentOrder[]
  aiLogs?: AiLog[]
}

export interface TripItem {
  name: string
  qtyPrice: string
  total: string
}

export interface TripTimelineStep {
  label: string
  time: string
  note: string
  state: 'done' | 'current' | 'pending' | 'failed'
  icon?: string
}

export interface StatusBadge {
  label: string
  className: string
  dotClassName: string
  dotPulseClassName?: string
}

export type AgentDeliveryStatus =
  | 'Chờ phân công'
  | 'Đã phân công'
  | 'Đang lấy hàng'
  | 'Đang giao'
  | 'Giao thành công'
  | 'Giao thất bại'

export type CodStatus = 'Chờ thu COD' | 'Đã thu COD' | 'Đã CK / 0 COD' | 'Tiền mặt tại kho' | 'Chưa thu được'

export interface Trip {
  id: string
  orderId: string
  customerName: string
  addressShort: string
  addressTitle: string
  driverName: string
  driverIcon: string
  vehicleLabel: string
  etaLabel: string
  etaClassName: string
  codAmountLabel: string
  codAmountClassName: string
  codStatus: CodStatus
  codBadge: { label: string; className: string }
  status: AgentDeliveryStatus
  statusBadge: StatusBadge
  rowClassName?: string
  failureNote?: string
  actions: RowAction[]
  customerPhone: string
  customerAddressDetail: string
  customerNote?: { icon: string; text: string; className: string }
  driverInitial: string
  driverPhone: string
  driverRoleLabel: string
  scheduledWindow: string
  timeline: TripTimelineStep[]
  items: TripItem[]
  shippingFeeNote?: { label: string; value: string; valueClassName: string }
  orderTotalLabel: string
  codToCollectLabel: string
  codNote: string
}

export interface FieldInfo {
  farmerName: string
  farmerPhone: string
  plotLabel: string
  plotLocation: string
  varietyLabel?: string
  varietyNote?: string
  sentTime: string
  sentChannel?: string
}

export interface ProductSuggestion {
  name: string
  category: string
  activeIngredient?: string
  fitTag?: string
  price: string
  priceUnit?: string
  stockLabel: string
  stockNote?: string
  reasoning: string
}

export interface BoundingBox {
  label: string
  confidence: string
  note: string
}

export type AiCaseStatus = 'Chờ duyệt' | 'Đang chờ đại lý thẩm định' | 'Đã phê duyệt' | 'Đã từ chối' | 'Chưa đủ chắc chắn'

export type AiReviewDecision = 'CONFIRM' | 'CORRECT' | 'INCONCLUSIVE'

export interface AiCase {
  id: string
  idClassName?: string
  farmerName: string
  farmerLocationLine: string
  imageSrc: string
  imageAlt: string
  imageBorderClassName?: string
  imageBlurred?: boolean
  diseaseLabel: string
  diseaseSubLabel: string
  diseaseLabelClassName?: string
  confidencePercent: number
  confidenceBarClassName?: string
  confidenceTextClassName?: string
  confidenceNote: string
  confidenceNoteClassName?: string
  productLine?: string
  productSubLine?: string
  stockLabel?: string
  stockLabelClassName?: string
  status: AiCaseStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  rowClassName?: string
  actionsMode?: 'menu' | 'sent' | 'survey'
  actions?: RowAction[]
  panelBadge?: { label: string; className: string; dotClassName: string }
  field: FieldInfo
  boundingBox?: BoundingBox
  diseaseFullLabel?: string
  diseaseLatin?: string
  confidenceFullLabel?: string
  confidenceFullClassName?: string
  product?: ProductSuggestion
  noProductNote?: string
  defaultAgentNote?: string
  agentNote?: string
  rejectReasonLabel?: string
  reviewedBy?: string
  reviewNote?: string
}

export interface RelatedObjectField {
  label: string
  value: string
  sub?: string
}

export interface RelatedLink {
  icon: string
  label: string
  badgeLabel?: string
  badgeClassName?: string
}

export interface RelatedOrder {
  id: string
  dateNote: string
  status: string
  statusClassName: string
  cardClassName?: string
  dueNote?: string
  totalNote: string
  remainingLabel: string
  remainingClassName: string
}

export interface DebtPaymentHistoryEntry {
  dotClassName?: string
  title: string
  dateNote: string
  amountLabel: string
  amountClassName: string
}

export type DebtStatus = 'Bình thường' | 'Sắp đến hạn' | 'Đến hạn' | 'Quá hạn' | 'Đã thanh toán'

export type DisputeAction = 'KEEP' | 'ADJUST' | 'CANCEL'

export interface DebtCustomer {
  id: string
  name: string
  cropBadge?: string
  phone: string
  addressShort: string
  totalPurchase: string
  paidAmount: string
  remaining: string
  remainingCellClassName?: string
  dueDate: string
  dueDateClassName?: string
  overdueDays: string
  overdueDaysClassName?: string
  status: DebtStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  rowAttentionClassName?: string
  isDisputed?: boolean
  disputeNote?: string
  actions: RowAction[]
  customerCode?: string
  landNote?: string
  fullAddress?: string
  remainingSectionClassName?: string
  remainingStatusClassName?: string
  remainingAmount?: string
  totalDebtLabel?: string
  paidLabel?: string
  paidPercent?: string
  progressBarWidth?: string
  dueDetailNote?: string
  relatedOrders: RelatedOrder[]
  paymentHistory: DebtPaymentHistoryEntry[]
}

export interface PaymentHistoryEntry {
  icon?: string
  iconClassName?: string
  title: string
  note: string
  amountLabel: string
  amountClassName: string
  cardClassName: string
}

export type PaymentStatus = 'Chưa thanh toán' | 'Thanh toán 1 phần' | 'Đã thanh toán' | 'Chờ đối soát' | 'Đã đối soát' | 'Hoàn tiền'

export interface Payment {
  id: string
  orderId: string
  customerName: string
  customerPhone: string
  addressShort?: string
  totalAmount: string
  paidAmount: string
  paidAmountClassName: string
  remainingAmount: string
  remainingAmountClassName: string
  methodLabel: string
  methodIcon?: string
  methodIconClassName?: string
  methodClassName: string
  status: PaymentStatus
  statusBadge: { label: string; className: string; dotClassName?: string }
  time: string
  actions: RowAction[]
  subtitle?: string
  customerNote?: string
  goodsNote?: string
  collectedLabel?: string
  progressWidth?: string
  hasRemaining?: boolean
  recordedBy?: string
  paymentHistory: PaymentHistoryEntry[]
}

export type StockStatus = 'Còn hàng' | 'Sắp hết' | 'Hết hàng'

export interface Product {
  id: string
  name: string
  discontinued?: boolean
  description: string
  categoryLabel: string
  categoryClassName: string
  price: string
  priceClassName?: string
  stockStatus: StockStatus
  stockLabel: string
  stockClassName: string
  stockDotClassName: string
  stockQuantity: string
  unit: string
  businessStatus?: string
  rowClassName?: string
  actions: RowAction[]
}

export interface InventoryItem {
  id: string
  name: string
  description?: string
  sku: string
  categoryLabel: string
  stockQuantity: string
  unit: string
  stockQuantityClassName?: string
  stockBarClassName?: string
  stockBarWidth?: string
  stockStatus: StockStatus
  stockLabel: string
  stockClassName: string
  stockDotClassName: string
  updatedAgo: string
  updatedBy: string
  rowClassName?: string
  nameClassName?: string
  actions: RowAction[]
}

export type LogResult = 'Thành công' | 'Chờ xử lý' | 'Bị từ chối'

export interface LogEntry {
  id: string
  time: string
  timeNote?: string
  actorInitials: string
  actorAvatarClassName: string
  actorName: string
  actorRole: string
  moduleLabel: string
  moduleClassName: string
  actionLabel: string
  actionClassName: string
  objectId: string
  description: string
  descriptionNote: string
  result: LogResult
  resultLabel: string
  resultClassName: string
  resultDotClassName: string
  actionTypeLabel: string
  ipDevice: string
  relatedObjects: RelatedObjectField[]
  operationContentHtml: string
  beforeStateLabel: string
  beforeStateClassName: string
  afterStateLabel: string
  afterStateClassName: string
  technicalNote?: string
  relatedLinks: RelatedLink[]
}

export type ContactRequestStatus = 'Chưa xử lý' | 'Đang xử lý' | 'Đã xử lý'

export interface ContactRequest {
  id: string
  senderName: string
  senderPhone: string
  senderArea: string
  channel: string
  channelIcon: string
  requestType: string
  message: string
  submittedAgo: string
  status: ContactRequestStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  assignedTo?: string
  actions: RowAction[]
}

export type StaffRole = 'Store Owner' | 'Sales Staff' | 'Delivery Staff'
export type StaffStatus = 'Đang làm việc' | 'Đã khóa'
export interface StaffMember {
  id: string
  name: string
  phone: string
  role: StaffRole
  status: StaffStatus
  can_review_ai: boolean
  joinedAt: string
  actions: RowAction[]
}

// ============================================================
// Sales-specific types
// ============================================================

/** Legacy user type alias for sales features */
export interface SalesStaffUser {
  name: string
  role: string
  initials: string
  storeName: string
  can_review_ai: boolean
  storeId?: string
}

export type CreditRequestStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'

export type DebtPaymentRequestStatus = 'PENDING_STAFF_CONFIRMATION' | 'CONFIRMED' | 'REJECTED'

// ============================================================
// Delivery-specific types
// ============================================================

/** Legacy user type alias for delivery features */
export interface DeliveryStaffUser {
  name: string
  role: string
  initials: string
  hubName: string
  storeId?: string
}

export type DeliveryStatus = 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'CANCELLED'

export type DeliveryFailureReasonCode =
  | 'CUSTOMER_ABSENT'
  | 'CUSTOMER_UNREACHABLE'
  | 'BAD_WEATHER'
  | 'VEHICLE_BREAKDOWN'
  | 'DAMAGED_REPLACEABLE'
  | 'CUSTOMER_REFUSED'
  | 'CUSTOMER_NO_LONGER_NEEDS'
  | 'DAMAGED_NOT_REPLACEABLE_AGREED_CANCEL'

export interface DeliveryFailureReasonOption {
  code: DeliveryFailureReasonCode
  label: string
  outcome: 'RETRY' | 'CANCEL'
}

export interface DeliveryProduct {
  name: string
  quantityLabel: string
}

export interface DeliveryAttempt {
  id: string
  attemptNumber: number
  status: 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED'
  startedAt: string
  completedAt?: string
  failureReasonCode?: DeliveryFailureReasonCode
  failureReasonLabel?: string
  note?: string
  proofPhotoUrl?: string
}

export interface DeliveryOrder {
  id: string
  orderCode: string
  farmerName: string
  farmerPhone: string
  deliveryAddress: string
  deliveryNote?: string
  isCreditPurchase: boolean
  scheduledDate: string
  scheduledWindowLabel: string
  status: DeliveryStatus
  cancelReasonLabel?: string
  redeliveryDate?: string
  products: DeliveryProduct[]
  attempts: DeliveryAttempt[]
}

export interface ConfirmDeliveredInput {
  proofPhotoUrl: string
  note?: string
}

export interface ReportFailureInput {
  reasonCode: DeliveryFailureReasonCode
  note?: string
  redeliveryDate?: string
}
