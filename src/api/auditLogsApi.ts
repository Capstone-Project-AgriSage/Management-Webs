import { LIST_PAGE_SIZE } from '@/utils/pagination'
import { api, toQuery } from './client'
import type { PagedResult } from './types'

export interface AuditLogResponse {
  id: string
  storeId: string | null
  actorUserId: string | null
  actorName?: string | null
  actorEmail?: string | null
  actorRole?: string | null
  status?: 'SUCCESS' | 'FAILURE'
  action: string
  entityType: string
  entityId: string | null
  oldValues: unknown | null
  newValues: unknown | null
  reason: string | null
  ipAddress: string | null
  userAgent: string | null
  correlationId: string | null
  occurredAt: string
}

export interface AuditLogListParams {
  page?: number
  pageSize?: number
  action?: string
  entityType?: string
  entityId?: string
  actorUserId?: string
  search?: string
  actorRole?: string
  status?: string
  from?: string
  to?: string
}

const base = '/api/audit-logs'
export const auditLogsApi = {
  list: (params: AuditLogListParams = {}, signal?: AbortSignal) =>
    api<PagedResult<AuditLogResponse>>(base + toQuery({ page: 1, pageSize: LIST_PAGE_SIZE, ...params }), { signal }),
  get: (id: string, signal?: AbortSignal) =>
    api<AuditLogResponse>(base + '/' + encodeURIComponent(id), { signal }),
}
