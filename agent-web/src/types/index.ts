import type { RowAction } from '../components/ui/RowActionsMenu'

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
}

export interface DebtPaymentRequest {
  id: string
  debtId: string
  orderCode: string
  farmerName: string
  farmerPhone: string
  amount: number
  paymentMethod: 'VIETQR' | 'CASH'
  status: 'PENDING_AGENT_CONFIRMATION' | 'CONFIRMED' | 'REJECTED'
  createdAt: string
  note?: string
}

export interface NavItem {
  label: string
  to: string
  icon: string
  badge?: string
  badgeTone?: 'neutral' | 'primary' | 'error' | 'warning'
  iconTone?: 'default' | 'primary'
}

export interface PageHeaderState {
  title: string
  subtitle?: string
  badge?: string
}

export interface OrderItem {
  name: string
  qtyPrice: string
  total: string
}

/** Order fulfillment status — the underlying value shown by both `statusBadge` and
 * `panelBadge`, which are just two differently-styled renderings of the same status. */
export type OrderStatus = 'Chờ xác nhận' | 'Đã xác nhận' | 'Đang xử lý' | 'Đang giao' | 'Hoàn thành' | 'Đã hủy'

/** How the order is being paid — distinct from OrderStatus (fulfillment progress). */
export type OrderPaymentMethod = 'Tiền mặt tại kho' | 'Tiền mặt (COD)' | 'Chuyển khoản' | 'VietQR (Đã TT)' | 'Cọc 50%' | 'Gối nợ vụ mùa'

export interface Order {
  id: string
  customerName: string
  phone: string
  shortLocation: string
  fullAddress: string
  wardAddress: string
  timeBold?: string
  timeRest: string
  createdAgo: string
  productLine: string
  productTitle: string
  productNote: string
  items: OrderItem[]
  feeLine?: { label: string; value: string }
  total: string
  paymentMethod: OrderPaymentMethod
  paymentBadge: { label: string; className: string }
  status: OrderStatus
  statusBadge: { label: string; className: string; pulse?: boolean }
  shippingIcon: string
  shippingIconClassName: string
  shippingLabel: string
  shippingLabelTitle?: string
  rowAttentionClassName?: string
  idClassName: string
  panelBadge: { label: string; className: string }
  deliveryNote?: string
  paymentFooterNote: string
  paymentFooterClassName: string
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
  activityDate: string
  activityNote: string
  activityNoteClassName: string
  status: FarmerStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  fullAddress: string
  joinDate: string
  tenureNote: string
  managedBy: string
  totalOrdersCount: string
  totalPurchaseValue: string
  lastOrderDateNote: string
  lastOrderValue: string
  paidAmount: string
  paidPercent: string
  debtPercent: string
  debtDetail: {
    totalDebt: string
    dueDate: string
    dueNote: string
    riskLabel: string
  }
  recentOrders: RecentOrder[]
  aiLogs: AiLog[]
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

export type DeliveryStatus =
  | 'Chờ phân công'
  | 'Đã phân công'
  | 'Đang lấy hàng'
  | 'Đang giao'
  | 'Giao thành công'
  | 'Giao thất bại'

/** Cash-on-delivery collection state — a separate concern from DeliveryStatus
 * (a trip can be delivered while COD is still uncollected, or paid up-front). */
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
  status: DeliveryStatus
  statusBadge: StatusBadge
  rowClassName?: string
  failureNote?: string
  actions: RowAction[]
  // Detail panel fields
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
  varietyLabel: string
  varietyNote: string
  sentTime: string
  sentChannel: string
}

export interface ProductSuggestion {
  name: string
  category: string
  activeIngredient: string
  fitTag: string
  price: string
  priceUnit: string
  stockLabel: string
  stockNote: string
  reasoning: string
}

export interface BoundingBox {
  label: string
  confidence: string
  note: string
}

export type AiCaseStatus = 'Chờ duyệt' | 'Đã phê duyệt' | 'Đã từ chối' | 'Chưa đủ chắc chắn'

export interface AiCase {
  id: string
  idClassName: string
  farmerName: string
  farmerLocationLine: string
  imageSrc: string
  imageAlt: string
  imageBorderClassName: string
  imageBlurred?: boolean
  diseaseLabel: string
  diseaseSubLabel: string
  diseaseLabelClassName: string
  confidencePercent: number
  confidenceBarClassName: string
  confidenceTextClassName: string
  confidenceNote: string
  confidenceNoteClassName: string
  productLine?: string
  productSubLine?: string
  stockLabel: string
  stockLabelClassName: string
  status: AiCaseStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  rowClassName?: string
  actionsMode: 'menu' | 'sent' | 'survey'
  actions?: RowAction[]
  // Detail panel
  panelBadge: { label: string; className: string; dotClassName: string }
  field: FieldInfo
  boundingBox?: BoundingBox
  diseaseFullLabel: string
  diseaseLatin?: string
  confidenceFullLabel: string
  confidenceFullClassName: string
  product?: ProductSuggestion
  noProductNote?: string
  defaultAgentNote: string
  agentNote?: string
  rejectReasonLabel?: string
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
  cardClassName: string
  dueNote?: string
  totalNote: string
  remainingLabel: string
  remainingClassName: string
}

export interface DebtPaymentHistoryEntry {
  dotClassName: string
  title: string
  dateNote: string
  amountLabel: string
  amountClassName: string
}

/** Matches farmer_web_agrisage's own DebtStatus union (defined locally in its
 * AccountPage) so debt state means the same thing to a farmer and their agent. */
export type DebtStatus = 'Bình thường' | 'Sắp đến hạn' | 'Đến hạn' | 'Quá hạn' | 'Đã thanh toán'

export interface DebtCustomer {
  id: string
  name: string
  cropBadge?: string
  phone: string
  addressShort: string
  totalPurchase: string
  paidAmount: string
  remaining: string
  remainingCellClassName: string
  dueDate: string
  dueDateClassName: string
  overdueDays: string
  overdueDaysClassName: string
  status: DebtStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  rowAttentionClassName?: string
  actions: RowAction[]
  // Detail panel fields
  customerCode: string
  landNote: string
  fullAddress: string
  remainingSectionClassName: string
  remainingStatusClassName: string
  remainingAmount: string
  totalDebtLabel: string
  paidLabel: string
  paidPercent: string
  progressBarWidth: string
  dueDetailNote: string
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
  addressShort: string
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
  statusBadge: { label: string; className: string; dotClassName: string }
  time: string
  actions: RowAction[]
  // Detail panel
  subtitle: string
  customerNote: string
  goodsNote: string
  collectedLabel: string
  progressWidth: string
  hasRemaining: boolean
  recordedBy: string
  paymentHistory: PaymentHistoryEntry[]
}

/** Discrete availability state — matches farmer_web_agrisage's StockStatus type exactly,
 * so the two apps agree on what "in stock" means. Kept separate from `stockLabel`, which
 * is free-form display copy (may include counts/units) and isn't meant to be machine-compared. */
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
  businessStatus: string
  rowClassName?: string
  actions: RowAction[]
}

export interface InventoryItem {
  id: string
  name: string
  description: string
  sku: string
  categoryLabel: string
  stockQuantity: string
  unit: string
  stockQuantityClassName?: string
  stockBarClassName: string
  stockBarWidth: string
  /** 'Tồn kho tốt' maps to 'Còn hàng' — inventory uses a richer display label than
   * Product's, but the two must agree on the underlying StockStatus. */
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
  // Detail panel
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
}

export interface DebtPaymentRequest {
  id: string
  debtId: string
  orderCode: string
  farmerName: string
  farmerPhone: string
  amount: number
  paymentMethod: 'VIETQR' | 'CASH'
  status: 'PENDING_AGENT_CONFIRMATION' | 'CONFIRMED' | 'REJECTED'
  createdAt: string
  note?: string
  confirmedAt?: string
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
