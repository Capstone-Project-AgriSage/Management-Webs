import type { AppRole } from '@/types'

export interface RoleOption {
  id: AppRole
  label: string
  shortLabel: string
  email: string
  icon: string
}

export const ROLE_OPTIONS: RoleOption[] = [
  { id: 'admin', label: 'Quản trị viên (Admin)', shortLabel: 'Admin', email: 'admin@agrisage.vn', icon: 'shield_person' },
  { id: 'agent', label: 'Đại lý (Agent)', shortLabel: 'Đại lý', email: 'agent@agrisage.vn', icon: 'storefront' },
  { id: 'sales_staff', label: 'Nhân viên bán hàng', shortLabel: 'Bán hàng', email: 'sales@agrisage.vn', icon: 'point_of_sale' },
  { id: 'delivery_staff', label: 'Nhân viên giao hàng', shortLabel: 'Giao hàng', email: 'delivery@agrisage.vn', icon: 'local_shipping' },
]

export const DEFAULT_USERS: Record<AppRole, import('@/types').AppUser> = {
  admin: {
    name: 'Trần Thị Lan Anh',
    role: 'admin',
    roleLabel: 'Quản trị viên hệ thống',
    initials: 'LA',
    email: 'admin@agrisage.vn',
  },
  agent: {
    name: 'Nguyễn Văn Minh',
    role: 'agent',
    roleLabel: 'Đại lý & Thẩm định AI',
    initials: 'NM',
    email: 'agent@agrisage.vn',
    hub: 'Đại lý Vật tư Nông nghiệp Hai Thắng (Thới Lai)',
    can_review_ai: true,
    storeId: 'STORE-HT-01',
  },
  sales_staff: {
    name: 'Trần Thị Hương',
    role: 'sales_staff',
    roleLabel: 'Nhân viên bán hàng',
    initials: 'TH',
    email: 'sales@agrisage.vn',
    storeName: 'Cửa hàng Vật tư Nông nghiệp Hai Thắng (Thới Lai)',
    can_review_ai: true,
    storeId: 'STORE-HT-01',
  },
  delivery_staff: {
    name: 'Lê Văn Phúc',
    role: 'delivery_staff',
    roleLabel: 'Nhân viên giao hàng',
    initials: 'LP',
    email: 'delivery@agrisage.vn',
    hubName: 'Cửa hàng Vật tư Nông nghiệp Hai Thắng (Thới Lai)',
    storeId: 'STORE-HT-01',
  },
}
