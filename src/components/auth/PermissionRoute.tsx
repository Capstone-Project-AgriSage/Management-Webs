import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { usePermission } from '@/context/PermissionContext'
const routes: [RegExp, string[]][] = [
  [/^\/$|^\/(agent|sales|delivery)$|^\/notifications$|\/(settings|ai-review|ai-recommendations)$/, []],
  [/^\/admin\/roles/, ['PERMISSIONS.MANAGE_ROLES']],
  [/^\/admin\/accounts/, ['STAFF.READ']],
  [/^\/admin\/products\/categories/, ['CATEGORIES.READ']],
  [/^\/admin\/products\/ingredients/, ['INGREDIENTS.READ']],
  [/^\/admin\/products\/master/, ['PRODUCTS.READ']],
  [/^\/admin\/audit-logs|\/activity-log$/, ['AUDIT.READ']],
  [/^\/admin\/credit-config/, ['CUSTOMER_GROUPS.READ', 'CREDIT_TIERS.READ']],
  [/^\/admin\/(ai|articles)/, ['PERMISSIONS.MANAGE_ROLES']],
  [/\/reports(?:\/|$)/, ['REPORTS.READ']],
  [/\/(agent|sales)\/staff/, ['STAFF.READ_GET']],
  [/\/counter-sales/, ['COUNTER_SALES.SELL']],
  [/\/returns\/new$/, ['RETURNS.CREATE']],
  [/\/returns/, ['RETURNS.READ']],
  [/\/refunds/, ['REFUNDS.READ']],
  [/\/orders/, ['ORDERS.READ']],
  [/\/payments/, ['PAYMENTS.READ']],
  [/\/products\/reviews/, ['STORE_PRODUCTS.READ']],
  [/\/products/, ['STORE_PRODUCTS.READ']],
  [/\/inventory\/stocktake/, ['STOCKTAKES.READ']],
  [/\/inventory/, ['INVENTORY.READ']],
  [/\/deliveries/, ['DELIVERIES.READ']],
  [/\/purchases\/suppliers/, ['SUPPLIERS.READ']],
  [/\/purchases\/receipts/, ['GOODS_RECEIPTS.READ']],
  [/\/debts/, ['DEBT.READ']],
  [/\/farmers/, ['CUSTOMERS.READ']],
  [/\/price-lists/, ['PRICING.READ']],
  [/\/credit-config/, ['CUSTOMER_GROUPS.READ', 'CREDIT_TIERS.READ']],
  [/^\/admin\/notifications/, []],
]
export function routePermissions(path: string): string[] | null { return routes.find(([pattern]) => pattern.test(path))?.[1] ?? null }
export function canAccessRoute(path: string, has: (code: string) => boolean): boolean {
  const codes = routePermissions(path)
  if (codes === null) return false
  // Groups and tiers are independent tabs; either permitted tab can open this page.
  return /\/credit-config\/?$/.test(path) ? codes.some(has) : codes.every(has)
}
export function PermissionRoute({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { has, loading, error, refresh } = usePermission()
  useEffect(() => { void refresh() }, [pathname, refresh])
  if (loading) return <p role="status">Đang tải quyền truy cập…</p>
  if (error) return <div role="alert">{error} <button onClick={() => void refresh()}>Thử lại</button></div>
  if (!canAccessRoute(pathname, has)) return <div className="rounded-xl bg-white p-10 text-center" role="alert">Không có quyền truy cập chức năng này. Liên hệ Owner hoặc Admin để được cấp quyền.</div>
  return <>{children}</>
}
