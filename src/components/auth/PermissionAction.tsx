import type { ReactNode } from 'react'
import { usePermission } from '@/context/PermissionContext'
export default function PermissionAction({ codes, children }: { codes: string[]; children: ReactNode }) {
  const { has } = usePermission()
  return codes.every(has) ? <>{children}</> : null
}
