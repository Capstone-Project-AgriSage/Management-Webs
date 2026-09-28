import type { Account, AccountAction, AccountRole, AccountStatus } from '../types'
import { accounts as seedAccounts } from '../data/mockAccounts'

/**
 * Mock "backend" for accounts: owns the in-memory list and every mutation
 * (status/role changes, creation). Pages call these functions instead of
 * reaching into mock data directly, so swapping this file's internals for real
 * HTTP calls later doesn't touch AccountsPage at all — only this module changes
 * (and its exports would become async, which is the one contained follow-up).
 */

let store: Account[] = seedAccounts.map((a) => ({ ...a }))
let nextSeq = 200

function idPrefixFor(role: AccountRole) {
  if (role === 'Store Owner') return 'AG'
  if (role === 'Farmer') return 'FM'
  return 'ADM'
}

function initialsFor(fullName: string) {
  return fullName
    .split(' ')
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** Which actions are valid for an account depends on both its status and its role
 * (e.g. only Store Owner accounts get "Reset mật khẩu" here; Admin accounts
 * manage their own password through IT, not this menu). Centralizing this beats
 * baking a slightly different action list into every mock record by hand. */
export function actionsFor(status: AccountStatus, role: AccountRole): AccountAction[] {
  if (status === 'Bị khóa') {
    return [
      { id: 'view', label: 'Xem chi tiết', icon: 'visibility' },
      { id: 'unlock', label: 'Mở khóa tài khoản', icon: 'lock_open', tone: 'primary' },
    ]
  }
  if (status === 'Chờ duyệt') {
    return [
      { id: 'view', label: 'Xem chi tiết', icon: 'visibility' },
      { id: 'approve', label: 'Phê duyệt tài khoản', icon: 'check_circle', tone: 'primary' },
      { id: 'reject', label: 'Từ chối đăng ký', icon: 'cancel', tone: 'danger' },
    ]
  }
  // 'Đang hoạt động'
  if (role === 'Store Owner') {
    return [
      { id: 'view', label: 'Xem chi tiết', icon: 'visibility' },
      { id: 'change-role', label: 'Đổi vai trò', icon: 'admin_panel_settings' },
      { id: 'reset-password', label: 'Reset mật khẩu', icon: 'key' },
      { id: 'lock', label: 'Khóa tài khoản', icon: 'lock', tone: 'danger' },
    ]
  }
  if (role === 'Admin') {
    return [
      { id: 'view', label: 'Xem chi tiết', icon: 'visibility' },
      { id: 'change-role', label: 'Đổi vai trò', icon: 'admin_panel_settings' },
      { id: 'lock', label: 'Khóa tài khoản', icon: 'lock', tone: 'danger' },
    ]
  }
  return [
    { id: 'view', label: 'Xem chi tiết', icon: 'visibility' },
    { id: 'lock', label: 'Khóa tài khoản', icon: 'lock', tone: 'danger' },
  ]
}

export function list(): Account[] {
  return store
}

export interface CreateAccountInput {
  fullName: string
  email: string
  phone: string
  role: AccountRole
  region: string
}

export function create(input: CreateAccountInput): Account {
  const id = `${idPrefixFor(input.role)}-${nextSeq++}`
  const account: Account = {
    id,
    fullName: input.fullName,
    initials: initialsFor(input.fullName),
    email: input.email,
    phone: input.phone || '—',
    role: input.role,
    region: input.region || '—',
    status: 'Đang hoạt động',
    createdAt: new Date().toLocaleDateString('vi-VN'),
    lastActiveAgo: 'Chưa đăng nhập',
    ordersOrCases: '0 đơn',
    addressDetail: input.region || '—',
    joinNote: 'Tài khoản được tạo thủ công bởi quản trị viên.',
    verified: true,
    activityLog: [{ time: new Date().toLocaleString('vi-VN'), action: 'Tạo tài khoản', note: 'Tạo bởi quản trị viên' }],
  }
  store = [account, ...store]
  return account
}

function update(id: string, mutate: (account: Account) => Account): Account | undefined {
  let updated: Account | undefined
  store = store.map((a) => {
    if (a.id !== id) return a
    updated = mutate(a)
    return updated
  })
  return updated
}

export function setStatus(id: string, status: AccountStatus, logNote: string): Account | undefined {
  return update(id, (a) => ({
    ...a,
    status,
    activityLog: [{ time: new Date().toLocaleString('vi-VN'), action: logNote, note: `Trạng thái: ${status}` }, ...a.activityLog],
  }))
}

export function setRole(id: string, role: AccountRole): Account | undefined {
  return update(id, (a) => ({
    ...a,
    role,
    activityLog: [
      { time: new Date().toLocaleString('vi-VN'), action: 'Đổi vai trò', note: `Từ "${a.role}" sang "${role}"` },
      ...a.activityLog,
    ],
  }))
}

export function resetPassword(id: string): Account | undefined {
  return update(id, (a) => ({
    ...a,
    activityLog: [
      { time: new Date().toLocaleString('vi-VN'), action: 'Yêu cầu đặt lại mật khẩu', note: `Đã gửi email đến ${a.email}` },
      ...a.activityLog,
    ],
  }))
}
