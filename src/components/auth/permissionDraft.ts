import type { MemberPermissions, PermissionOverride } from '@/api/permissionsApi'

export type OverrideState = 'inherit' | 'allow' | 'deny'
export type PermissionDraft = Record<string, OverrideState>
export function memberDraft(member: MemberPermissions): PermissionDraft {
  return Object.fromEntries(member.overrides.filter(p => p.granted !== null).map(p => [p.code, p.granted ? 'allow' : 'deny']))
}
export function memberChanges(member: MemberPermissions, draft: PermissionDraft): PermissionOverride[] {
  const previous = memberDraft(member)
  return member.grantablePermissions.filter(code => (draft[code] ?? 'inherit') !== (previous[code] ?? 'inherit'))
    .map(code => ({ code, granted: draft[code] === 'allow' ? true : draft[code] === 'deny' ? false : null }))
}
export function memberEffective(member: MemberPermissions, draft: PermissionDraft, code: string): boolean {
  const state = draft[code] ?? 'inherit'
  const wanted = state === 'allow' || (state === 'inherit' && member.defaultPermissions.includes(code))
  if (member.permissionCeiling) return wanted && member.permissionCeiling.includes(code)
  if (state === (memberDraft(member)[code] ?? 'inherit')) return member.effectivePermissions.includes(code)
  return wanted && member.grantablePermissions.includes(code)
}
