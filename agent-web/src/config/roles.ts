export type StaffRole = 'agent' | 'sales_staff' | 'delivery_staff'

export interface RoleOption {
  id: StaffRole
  label: string
  shortLabel: string
  email: string
  icon: string
}

/** Shared across agent_agrisage / sales_staff_agrisage / delivery_staff_agrisage's
 * LoginPage — each app is a separate deployment, so this file is duplicated per
 * app rather than imported from a shared package. Keep the three copies in sync
 * by hand when the role list changes. */
export const ROLE_OPTIONS: RoleOption[] = [
  { id: 'agent', label: 'Đại lý (Agent)', shortLabel: 'Đại lý', email: 'agent@agrisage.vn', icon: 'storefront' },
  { id: 'sales_staff', label: 'Nhân viên bán hàng', shortLabel: 'Bán hàng', email: 'sales@agrisage.vn', icon: 'point_of_sale' },
  { id: 'delivery_staff', label: 'Nhân viên giao hàng', shortLabel: 'Giao hàng', email: 'delivery@agrisage.vn', icon: 'local_shipping' },
]

/** The one role this specific app serves. LoginPage lets the person pick any
 * role to auto-fill its email, but only lets the login through when it matches
 * this app's own role — otherwise it points them at the right app instead. */
export const CURRENT_APP_ROLE: StaffRole = 'agent'
