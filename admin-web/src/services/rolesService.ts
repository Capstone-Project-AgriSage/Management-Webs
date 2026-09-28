import type { AccountRole, Role } from '../types'
import { roles as seedRoles, permissionModules } from '../data/mockRoles'

/** Mock "backend" for roles/permissions. This is also what PermissionContext reads
 * from to decide what the current admin can see — so a permission edit made here
 * is the real source of truth for route/nav gating, not just page-local UI state.
 *
 * Known limitation: this store is a plain module-level array, not a reactive one.
 * Saving a permission change updates it, but components that already rendered
 * from a stale read (e.g. PermissionContext memoized elsewhere) won't
 * automatically re-render — only a fresh read after a navigation/re-render picks
 * it up. That's acceptable today because the only editable roles (Đại lý, Nông
 * dân) don't affect what *this* app's own admin users can access; if a second
 * editable admin-level role is ever added, promote this to real state (context/
 * store) so permission edits propagate live. */

export { permissionModules }

let store: Role[] = seedRoles.map((r) => ({ ...r, grantedKeys: [...r.grantedKeys] }))

export function list(): Role[] {
  return store
}

export function updatePermissions(roleId: string, grantedKeys: string[]): Role | undefined {
  let updated: Role | undefined
  store = store.map((r) => {
    if (r.id !== roleId || !r.editable) return r
    updated = { ...r, grantedKeys }
    return updated
  })
  return updated
}

export function getGrantedKeysForRole(role: AccountRole): string[] {
  return store.find((r) => r.name === role)?.grantedKeys ?? []
}

export function hasPermission(role: AccountRole, moduleKey: string, permKey: string): boolean {
  return getGrantedKeysForRole(role).includes(`${moduleKey}:${permKey}`)
}
