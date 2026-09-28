import type { RowAction } from '../components/ui/RowActionsMenu'

export interface AdminUser {
  name: string
  /** Which of the 3 AgriSage roles this account is — drives permission lookups via
   * PermissionContext. Every admin_agrisage login is 'Quản trị viên' today, but the
   * type stays a real AccountRole (not a free string) so a future internal persona
   * with a different role/permission set works without touching the auth shape. */
  role: AccountRole
  roleLabel: string
  initials: string
  email: string
}

export interface NavItem {
  label: string
  to: string
  icon: string
  badge?: string
  badgeTone?: 'neutral' | 'primary' | 'error' | 'warning'
  iconTone?: 'default' | 'primary'
  /** permissionModules key (mockRoles.ts) this item's page requires "view" on. */
  permissionModule: string
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
  // Detail panel
  addressDetail: string
  joinNote: string
  verified: boolean
  activityLog: AccountActivityEntry[]
}

/** Which actions accountsService.getActionsFor(status) can hand back — dispatched on
 * in AccountsPage by id, not by matching the display label text, so renaming a
 * label in the service can't silently break the handler. */
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
  /** Set of "<moduleKey>:<permissionKey>" strings this role currently has. */
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

// --- Products Management Types ---

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

export type ProductStatus = 'Đang lưu hành' | 'Chờ duyệt' | 'Ngừng kinh doanh'
export interface ProductMaster {
  id: string
  sku: string
  name: string
  imageUrl: string
  categoryId: string
  activeIngredientId: string
  manufacturer: string
  unit: string
  status: ProductStatus
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

// --- AI Management Types ---

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

// --- Content & System Types ---

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
