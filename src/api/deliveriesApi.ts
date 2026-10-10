import { api, ApiError } from './client'
import type { Uuid, Paged } from './types'

export interface DeliveryLotRequest {
  inventoryLotId: Uuid
  baseQuantity: number
}

export interface DeliveryItemRequest {
  orderItemId: Uuid
  plannedQuantity: number
}

export interface CreateDeliveryRequest {
  orderId: Uuid
  items: DeliveryItemRequest[]
  /** null = the order's own address. */
  deliveryAddress?: DeliveryAddressResponse | null
  scheduledAt?: string | null
  note?: string | null
}

// Shapes follow docs/FE_GUIDE_FLOW_2.md §10 (docs/swagger.json does not list the delivery schemas yet).
export type DeliveryStatus = 'DRAFT' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'PARTIALLY_DELIVERED' | 'RETRY_PENDING' | 'DELIVERED' | 'CANCELLED'
export type AttemptStatus = 'IN_PROGRESS' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'CANCELLED'
export type FailureReason = 'CUSTOMER_ABSENT' | 'UNREACHABLE' | 'CUSTOMER_REFUSED' | 'DAMAGED' | 'WEATHER' | 'VEHICLE_ISSUE' | 'ADDRESS_ISSUE' | 'OTHER'
export type IncidentType = FailureReason
export type ResolutionType = 'RETRY_DELIVERY' | 'REPLACE_GOODS' | 'RETURN_TO_STORE' | 'WRITE_OFF' | 'CANCEL_REMAINDER' | 'NO_ACTION' | 'OTHER'

export interface StaffRef {
  userId: Uuid
  fullName: string
  phoneNumber: string | null
}

export interface DeliveryAddressResponse {
  recipientName: string | null
  recipientPhone: string | null
  addressLine: string | null
  ward: string | null
  district: string | null
  province: string | null
  latitude: number | null
  longitude: number | null
}

export interface DeliveryAllocation {
  id: Uuid
  inventoryLotId: Uuid
  lotNumber: string | null
  expiryDate: string | null
  allocatedBaseQuantity: number
  deliveredBaseQuantity: number
  releasedBaseQuantity: number
  status: 'ALLOCATED' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'RELEASED' | 'CANCELLED'
}

export interface DeliveryItem {
  id: Uuid
  orderItemId: Uuid
  sku: string
  productName: string
  packagingName: string
  plannedQuantity: number
  plannedBaseQuantity: number
  deliveredBaseQuantity: number
  cancelledBaseQuantity: number
  remainingBaseQuantity: number
  status: 'PENDING' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'CANCELLED' | 'PARTIALLY_CANCELLED'
  allocations: DeliveryAllocation[]
}

export interface DeliveryAttemptItem {
  allocationId: Uuid
  inventoryLotId: Uuid
  lotNumber: string | null
  attemptedBaseQuantity: number
  deliveredBaseQuantity: number
  failedBaseQuantity: number
}

export interface DeliveryAttempt {
  id: Uuid
  attemptNumber: number
  status: AttemptStatus
  attemptedBy: StaffRef
  startedAt: string
  completedAt: string | null
  receiverName: string | null
  proofImageUrl: string | null
  failureReasonCode: FailureReason | null
  note: string | null
  saleStockMovementId: string | null
  items: DeliveryAttemptItem[]
}

/** GET /api/deliveries/{id} — the full delivery with lines, lots and attempts. */
export interface DeliveryResponse {
  id: Uuid
  deliveryNumber: string
  orderId: Uuid
  orderNumber: string
  status: DeliveryStatus
  assignedTo: StaffRef | null
  deliveryAddress: DeliveryAddressResponse
  scheduledAt: string | null
  dispatchedAt: string | null
  completedAt: string | null
  note: string | null
  createdBy: Uuid
  createdAt: string
  cancelledBy: Uuid | null
  cancelledAt: string | null
  cancelReason: string | null
  items: DeliveryItem[]
  attempts: DeliveryAttempt[]
}

/** Row of GET /api/deliveries — summary only; open the detail for lines and address. */
export interface DeliveryListItem {
  id: Uuid
  deliveryNumber: string
  orderId: Uuid
  orderNumber: string
  status: DeliveryStatus
  assignedTo: StaffRef | null
  recipientName: string
  province: string
  scheduledAt: string | null
  dispatchedAt: string | null
  completedAt: string | null
  itemCount: number
  createdAt: string
}

export interface DeliveryIncident {
  id: Uuid
  deliveryId: Uuid
  deliveryAttemptId: Uuid | null
  allocationId: Uuid | null
  incidentType: IncidentType
  affectedBaseQuantity: number | null
  description: string
  status: 'OPEN' | 'RESOLVED'
  resolutionType: ResolutionType | null
  resolutionNote: string | null
  evidenceImageUrl: string | null
  relatedStockMovementId: string | null
  reportedBy: string
  reportedAt: string
  resolvedBy: string | null
  resolvedAt: string | null
}

export interface CompleteAttemptRequest {
  items?: { allocationId: string; deliveredBaseQuantity: number }[]
  receiverName?: string | null
  proofImageUrl?: string | null
  failureReasonCode?: FailureReason | null
  note?: string | null
}

export interface CreateIncidentRequest {
  incidentType: IncidentType
  description: string
  deliveryAttemptId?: string
  allocationId?: string
  affectedBaseQuantity?: number
  evidenceImageUrl?: string
}

export interface ResolveIncidentRequest {
  resolutionType: ResolutionType
  resolutionNote?: string
  relatedStockMovementId?: string | null
}

export const deliveriesApi = {
  create: (data: CreateDeliveryRequest) => {
    return api<DeliveryResponse>('/api/deliveries', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getDeliveries: (params?: { page?: number; pageSize?: number; status?: string; orderId?: string; assignedToUserId?: string; fromDate?: string; toDate?: string; search?: string }, signal?: AbortSignal) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString())
    if (params?.status) searchParams.append('status', params.status)
    if (params?.orderId) searchParams.append('orderId', params.orderId)
    if (params?.assignedToUserId) searchParams.append('assignedToUserId', params.assignedToUserId)
    if (params?.fromDate) searchParams.append('fromDate', params.fromDate)
    if (params?.toDate) searchParams.append('toDate', params.toDate)
    if (params?.search) searchParams.append('search', params.search)
    const qs = searchParams.toString()
    return api<Paged<DeliveryListItem>>(`/api/deliveries${qs ? `?${qs}` : ''}`, { signal })
  },

  /** Q2: summaries of the deliveries of an order (no lines — open the detail for those). */
  getOrderDeliveries: (orderId: string) => {
    return api<DeliveryListItem[]>(`/api/orders/${orderId}/deliveries`)
  },

  getDeliveryDetail: (id: string) => {
    return api<DeliveryResponse>(`/api/deliveries/${id}`)
  },

  cancelDelivery: (id: string, data: { reason: string }) => {
    return api<DeliveryResponse>(`/api/deliveries/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  cancelAttempt: (id: string, attemptId: string, data: { reason: string }) => {
    return api<DeliveryResponse>(`/api/deliveries/${id}/attempts/${attemptId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  assignDriver: (id: string, data: { assignedToUserId: string }) => {
    return api<DeliveryResponse>(`/api/deliveries/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateDeliveryLots: (deliveryId: string, itemId: string, lots: { inventoryLotId: string; baseQuantity: number }[]) => {
    return api<DeliveryResponse>(`/api/deliveries/${deliveryId}/items/${itemId}/lots`, {
      method: 'PUT',
      body: JSON.stringify({ lots }),
    })
  },

  dispatchDelivery: (id: string) => {
    return api<DeliveryResponse>(`/api/deliveries/${id}/dispatch`, {
      method: 'POST',
      body: '{}',
    })
  },

  // ── Attempt lifecycle (tài xế) ─────────────────────────────────────────────
  /** D2: Bắt đầu chuyến giao → tạo Attempt mới, trạng thái chuyển OUT_FOR_DELIVERY */
  startAttempt: (deliveryId: string) => {
    return api<DeliveryAttempt>(`/api/deliveries/${deliveryId}/attempts`, {
      method: 'POST',
      body: '{}',
    })
  },

  /** D2: Hoàn tất attempt — outcome: DELIVERED | PARTIAL | FAILED */
  completeAttempt: (deliveryId: string, attemptId: string, data: CompleteAttemptRequest) => {
    return api<DeliveryResponse>(`/api/deliveries/${deliveryId}/attempts/${attemptId}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // ── Incidents ──────────────────────────────────────────────────────────────
  getIncidents: (id: string) => {
    return api<DeliveryIncident[]>(`/api/deliveries/${id}/incidents`)
  },

  /** D3: Tài xế báo sự cố trên đường (rách bao, tai nạn, khách từ chối...) */
  reportIncident: (deliveryId: string, data: CreateIncidentRequest) => {
    return api<DeliveryIncident>(`/api/deliveries/${deliveryId}/incidents`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /** Agent: xử lý sự cố (RETRY_DELIVERY | RETURN_TO_STORE | CANCEL) */
  resolveIncident: (id: string, incidentId: string, resolution: ResolveIncidentRequest) => {
    return api<DeliveryIncident>(`/api/deliveries/${id}/incidents/${incidentId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(resolution),
    })
  },

  // ── File upload ────────────────────────────────────────────────────────────
  /** Upload ảnh bằng chứng giao hàng (multipart, tối đa 5 MB) */
  uploadProofPhoto: async (file: File): Promise<string> => {
    const token = localStorage.getItem('agrisage_token')
    const baseUrl = import.meta.env.VITE_API_URL || ''
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${baseUrl}/api/files/delivery-proofs`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const message = res.status === 503 ? 'Kho ảnh tạm gián đoạn, vui lòng thử lại sau.' : (err.detail ?? err.title ?? 'Upload ảnh thất bại')
      throw new ApiError(res.status, err.title ?? res.statusText, message, err.errors, err.traceId)
    }
    // 201 { url, storageKey, sizeBytes } — only `url` is sent back in proofImageUrl / evidenceImageUrl.
    const json = await res.json()
    return json.url as string
  },
}
