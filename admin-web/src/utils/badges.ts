import type { AccountStatus, Badge } from '../types'

/** Single source of truth for status -> badge styling. Data/services store only the
 * raw status string; pages derive the badge here instead of carrying a duplicated
 * `statusBadge` object that can drift out of sync with `status`. */

const ACCOUNT_STATUS_BADGES: Record<AccountStatus, Badge> = {
  'Đang hoạt động': { label: 'Đang hoạt động', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  'Bị khóa': { label: 'Bị khóa', className: 'bg-slate-200 text-slate-700 border-slate-300' },
  'Chờ duyệt': { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-800 border-amber-300' },
}

export function getAccountStatusBadge(status: AccountStatus): Badge {
  return ACCOUNT_STATUS_BADGES[status]
}
