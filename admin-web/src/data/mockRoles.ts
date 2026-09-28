import type { PermissionModule, Role } from '../types'

export const permissionModules: PermissionModule[] = [
  {
    key: 'accounts',
    label: 'User Management',
    icon: 'group',
    permissions: [
      { key: 'view', label: 'Xem' },
      { key: 'create', label: 'Tạo mới' },
      { key: 'edit', label: 'Sửa' },
      { key: 'lock', label: 'Khóa / Mở khóa' },
    ],
  },
  {
    key: 'roles',
    label: 'Role Management',
    icon: 'admin_panel_settings',
    permissions: [
      { key: 'view', label: 'Xem' },
      { key: 'edit', label: 'Chỉnh sửa quyền' },
    ],
  },
  {
    key: 'products',
    label: 'Product Master',
    icon: 'inventory_2',
    permissions: [
      { key: 'view', label: 'Xem' },
      { key: 'create', label: 'Tạo mới' },
      { key: 'edit', label: 'Sửa' },
      { key: 'delete', label: 'Xóa' },
    ],
  },
  {
    key: 'ai-config',
    label: 'AI Model Management',
    icon: 'psychology',
    permissions: [
      { key: 'view', label: 'Xem' },
      { key: 'edit', label: 'Cấu hình model & policy' },
    ],
  },
  {
    key: 'articles',
    label: 'Article Management',
    icon: 'article',
    permissions: [
      { key: 'view', label: 'Xem' },
      { key: 'create', label: 'Tạo mới' },
      { key: 'edit', label: 'Sửa' },
      { key: 'publish', label: 'Publish / Unpublish' },
    ],
  },
  {
    key: 'notifications',
    label: 'System Notifications',
    icon: 'notifications',
    permissions: [
      { key: 'view', label: 'Xem' },
      { key: 'send', label: 'Gửi thông báo' },
    ],
  },
  {
    key: 'audit-logs',
    label: 'Audit Log',
    icon: 'manage_search',
    permissions: [
      { key: 'view', label: 'Xem nhật ký' },
    ],
  },
  {
    key: 'reports',
    label: 'Báo cáo & Tổng quan',
    icon: 'monitoring',
    permissions: [{ key: 'view', label: 'Xem' }],
  },
]

const allKeysFor = (moduleKeys: string[]) =>
  permissionModules
    .filter((m) => moduleKeys.includes(m.key))
    .flatMap((m) => m.permissions.map((p) => `${m.key}:${p.key}`))

export const roles: Role[] = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Quản trị hệ thống, dữ liệu và cấu hình.',
    colorClassName: 'bg-primary/10 text-primary border-primary/30',
    icon: 'shield_person',
    accountCount: 2,
    grantedKeys: allKeysFor(['accounts', 'roles', 'products', 'ai-config', 'articles', 'notifications', 'audit-logs', 'reports']),
    editable: false,
  },
  {
    id: 'store-owner',
    name: 'Store Owner',
    description: 'Chủ cửa hàng/đại lý, quản lý kho hàng và đơn hàng.',
    colorClassName: 'bg-secondary-container/40 text-on-secondary-container border-secondary/30',
    icon: 'storefront',
    accountCount: 4,
    grantedKeys: ['reports:view'], // Mock permissions
    editable: true,
  },
  {
    id: 'sales-staff',
    name: 'Sales Staff',
    description: 'Nhân viên bán hàng tại đại lý.',
    colorClassName: 'bg-tertiary-container/40 text-on-tertiary-container border-tertiary/30',
    icon: 'point_of_sale',
    accountCount: 8,
    grantedKeys: [],
    editable: true,
  },
  {
    id: 'delivery-staff',
    name: 'Delivery Staff',
    description: 'Nhân viên giao hàng, sử dụng ứng dụng di động.',
    colorClassName: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
    icon: 'local_shipping',
    accountCount: 12,
    grantedKeys: [],
    editable: true,
  },
  {
    id: 'farmer',
    name: 'Farmer',
    description: 'Nông dân sử dụng ứng dụng để mua hàng, kiểm tra bệnh.',
    colorClassName: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
    icon: 'agriculture',
    accountCount: 156,
    grantedKeys: [],
    editable: true,
  },
]
