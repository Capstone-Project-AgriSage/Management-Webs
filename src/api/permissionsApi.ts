import { api } from './client'
export interface CurrentPermissions { role: string; storeId: string | null; roleVersion: number; memberVersion: number | null; permissions: string[] }
export interface Permission { id: string; code: string; module: string; name: string; delegable: boolean; defaultRoles: string[]; allowedRoles: string[] }
export interface RolePermissions { id: string; code: string; name: string; description: string | null; version: number; editable: boolean; permissionCodes: string[] }
export interface MemberPermissions { userId: string; fullName: string; role: string; storeId: string; version: number; roleVersion: number; defaultPermissions: string[]; effectivePermissions: string[]; overrides: { code: string; granted: boolean }[]; grantablePermissions: string[] }
export const permissionsApi = {
  current: () => api<CurrentPermissions>('/api/me/permissions'),
  catalog: () => api<Permission[]>('/api/permissions'),
  roles: () => api<RolePermissions[]>('/api/roles'),
  setRole: (role: RolePermissions, permissionCodes: string[], reason: string) => api<RolePermissions>(`/api/roles/${role.id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissionCodes, version: role.version, reason }) }),
  member: (id: string) => api<MemberPermissions>(`/api/staff/${id}/permissions`),
  setMember: (member: MemberPermissions, overrides: { code: string; granted: boolean }[], reason: string) => api<MemberPermissions>(`/api/staff/${member.userId}/permissions`, { method: 'PUT', body: JSON.stringify({ overrides, version: member.version, roleVersion: member.roleVersion, reason }) }),
}
