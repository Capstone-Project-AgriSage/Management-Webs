import type { RowAction } from '../components/ui/RowActionsMenu'

export interface SalesStaffUser {
  name: string
  role: string
  initials: string
  storeName: string
  /** Gates the AI Review menu item and page — only staff granted this flag review AI diagnosis cases. */
  can_review_ai: boolean
  storeId?: string
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

export type CreditRequestStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'

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
  status: CreditRequestStatus
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewerNote?: string
}

export type DebtPaymentRequestStatus = 'PENDING_STAFF_CONFIRMATION' | 'CONFIRMED' | 'REJECTED'

export interface DebtPaymentRequest {
  id: string
  debtId: string
  orderCode: string
  farmerName: string
  farmerPhone: string
  amount: number
  paymentMethod: 'VIETQR' | 'CASH'
  status: DebtPaymentRequestStatus
  createdAt: string
  confirmedBy?: string
  confirmedAt?: string
  note?: string
}

/** Order fulfillment status — the underlying value shown by both `statusBadge` and
 * `panelBadge`, which are just two differently-styled renderings of the same status. */
export type OrderStatus = 'Chờ xác nhận' | 'Đã xác nhận' | 'Đang chuẩn bị' | 'Hoàn thành' | 'Đã hủy'

/** How the order is being paid — distinct from OrderStatus (fulfillment progress). */
export type OrderPaymentMethod = 'Tiền mặt tại quầy' | 'VietQR' | 'Cọc 50%' | 'Gối nợ vụ mùa'

export interface OrderItem {
  productId: string
  name: string
  qtyPrice: string
  total: string
}

export interface Order {
  id: string
  farmerId?: string
  customerName: string
  phone: string
  createdAgo: string
  createdAt: string
  items: OrderItem[]
  total: string
  paymentMethod: OrderPaymentMethod
  paymentBadge: { label: string; className: string }
  status: OrderStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  note?: string
  rowClassName?: string
  createdBy: string
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
  /** Drives "overdue" styling on the debt note — a semantic flag instead of comparing debtNoteClassName by string. */
  debtOverdue?: boolean
  status: FarmerStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  fullAddress: string
  joinDate: string
  totalOrdersCount: string
  totalPurchaseValue: string
  lastOrderDateNote: string
  lastOrderValue: string
  paidAmount: string
  paidPercent: string
  debtPercent: string
  recentOrders: RecentOrder[]
}

export type PaymentStatus = 'Chưa thanh toán' | 'Thanh toán 1 phần' | 'Đã thanh toán'

export interface PaymentHistoryEntry {
  title: string
  note: string
  amountLabel: string
  amountClassName: string
  cardClassName: string
}

export interface Payment {
  id: string
  orderId: string
  customerName: string
  customerPhone: string
  totalAmount: string
  paidAmount: string
  paidAmountClassName: string
  remainingAmount: string
  remainingAmountClassName: string
  methodLabel: OrderPaymentMethod
  methodIcon: string
  methodClassName: string
  status: PaymentStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  time: string
  recordedBy: string
  paymentHistory: PaymentHistoryEntry[]
  actions: RowAction[]
}

/** Discrete availability state — matches farmer_web_agrisage's StockStatus type exactly,
 * so all AgriSage apps agree on what "in stock" means. */
export type StockStatus = 'Còn hàng' | 'Sắp hết' | 'Hết hàng'

export interface Product {
  id: string
  name: string
  description: string
  categoryLabel: string
  categoryClassName: string
  price: string
  stockStatus: StockStatus
  stockLabel: string
  stockClassName: string
  stockDotClassName: string
  stockQuantity: string
  unit: string
  actions: RowAction[]
}

export interface InventoryItem {
  id: string
  name: string
  sku: string
  categoryLabel: string
  stockQuantity: string
  unit: string
  stockStatus: StockStatus
  stockLabel: string
  stockClassName: string
  stockDotClassName: string
  updatedAgo: string
  updatedBy: string
  actions: RowAction[]
}

export interface RelatedOrder {
  id: string
  dateNote: string
  status: string
  statusClassName: string
  totalNote: string
  remainingLabel: string
  remainingClassName: string
}

export interface DebtPaymentHistoryEntry {
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
  phone: string
  addressShort: string
  cropBadge?: string
  totalPurchase: string
  paidAmount: string
  remaining: string
  dueDate: string
  overdueDays: string
  status: DebtStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  isDisputed: boolean
  disputeNote?: string
  relatedOrders: RelatedOrder[]
  paymentHistory: DebtPaymentHistoryEntry[]
  actions: RowAction[]
}

export interface FieldInfo {
  farmerName: string
  farmerPhone: string
  plotLabel: string
  plotLocation: string
  sentTime: string
}

export interface ProductSuggestion {
  name: string
  category: string
  price: string
  stockLabel: string
  reasoning: string
}

export type AiCaseStatus = 'Chờ duyệt' | 'Đã phê duyệt' | 'Đã từ chối' | 'Chưa đủ chắc chắn'

export type AiReviewDecision = 'CONFIRM' | 'CORRECT' | 'INCONCLUSIVE'

export interface AiCase {
  id: string
  farmerName: string
  farmerLocationLine: string
  imageSrc: string
  imageAlt: string
  diseaseLabel: string
  diseaseSubLabel: string
  confidencePercent: number
  confidenceNote: string
  status: AiCaseStatus
  statusBadge: { label: string; className: string; dotClassName: string }
  field: FieldInfo
  product?: ProductSuggestion
  reviewedBy?: string
  reviewNote?: string
  actions: RowAction[]
}
