import { api } from './client'
import { buildQuery } from './stockApi'
import type { Refund } from './refundsApi'
import type { Paged, Uuid } from './types'

/** Sales returns (flow L4, F4.4). Request / receive / inspect / cancel need Operate; approve / reject / complete-inspection need Manage. */

export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'INSPECTED' | 'PARTIALLY_RESOLVED' | 'COMPLETED' | 'CANCELLED'

export type ReturnReason = 'WRONG_PRODUCT' | 'DAMAGED_PRODUCT' | 'QUALITY_ISSUE' | 'EXPIRED_PRODUCT' | 'DELIVERY_DAMAGE' | 'CUSTOMER_REJECTION' | 'OTHER'

export type ReturnCondition = 'PENDING_INSPECTION' | 'RESELLABLE' | 'DAMAGED' | 'EXPIRED' | 'UNUSABLE'

export interface ReturnListItem {
  id: Uuid
  returnNumber: string
  orderId: Uuid
  orderNumber: string
  farmerProfileId: Uuid | null
  customerName: string
  status: ReturnStatus
  totalReturnAmount: number
  totalRefundAmount: number
  requestedAt: string
}

export interface ReturnItem {
  id: Uuid
  orderItemId: Uuid
  deliveryItemId: Uuid | null
  deliveryItemLotAllocationId: Uuid | null
  originalStockMovementItemId: Uuid | null
  inventoryLotId: Uuid
  returnedBaseQuantity: number
  sellingUnitPriceSnapshot: number
  conversionToBaseSnapshot: number
  returnValue: number
  originalCogsUnitCost: number | null
  returnInventoryCostValue: number | null
  reasonCode: ReturnReason
  conditionStatus: ReturnCondition
  /** NONE until inspected, then RESTOCK (resellable, back into the original lot) or WRITE_OFF. */
  inventoryDisposition: 'NONE' | 'RESTOCK' | 'WRITE_OFF'
  inspectionNote: string | null
  returnStockMovementId: Uuid | null
  debtAdjustmentTransactionId: Uuid | null
}

export interface SalesReturn {
  id: Uuid
  storeId: Uuid
  returnNumber: string
  orderId: Uuid
  orderNumber: string
  farmerProfileId: Uuid | null
  customerName: string
  status: ReturnStatus
  requestedBy: Uuid
  requestedAt: string
  approvedBy: Uuid | null
  approvedAt: string | null
  receivedBy: Uuid | null
  receivedAt: string | null
  inspectedBy: Uuid | null
  inspectedAt: string | null
  completedAt: string | null
  cancelledBy: Uuid | null
  cancelledAt: string | null
  cancelReason: string | null
  reasonSummary: string | null
  note: string | null
  totalReturnAmount: number
  /** Unpaid debt of the order reduced first. */
  totalDebtAdjustment: number
  /** What is left to pay back: return value minus the debt adjustment. */
  totalRefundAmount: number
  items: ReturnItem[]
  refunds: Refund[]
}

/** One place the goods of an order item left the store from (a pickup sale line or a delivery lot allocation). */
export interface ReturnableSource {
  deliveryItemId: Uuid | null
  deliveryItemLotAllocationId: Uuid | null
  originalStockMovementItemId: Uuid | null
  inventoryLotId: Uuid
  lotNumber: string | null
  expiryDate: string | null
  fulfilledBaseQuantity: number
  alreadyReturnedBaseQuantity: number
  returnableBaseQuantity: number
  unitPrice: number
  conversionToBase: number
  originalCogsUnitCost: number | null
}

export interface ReturnableItem {
  orderItemId: Uuid
  sku: string
  productName: string
  fulfilledBaseQuantity: number
  alreadyReturnedBaseQuantity: number
  returnableBaseQuantity: number
  unitPrice: number
  conversionToBase: number
  sources: ReturnableSource[]
}

export interface Returnable {
  orderId: Uuid
  orderNumber: string
  fulfillmentType: 'PICKUP' | 'DELIVERY'
  items: ReturnableItem[]
}

export interface OrderSearchItem {
  id: Uuid
  orderNumber: string
  status: string
  customerName: string
  customerType: string
  totalAmount: number
  itemCount: number
  createdAt: string
}

export interface CreateReturnItem {
  orderItemId: Uuid
  returnedBaseQuantity: number
  reasonCode: ReturnReason
  deliveryItemLotAllocationId?: Uuid | null
  originalStockMovementItemId?: Uuid | null
}

export const returnsApi = {
  list: (params: { status?: ReturnStatus; orderId?: Uuid; fromDate?: string; toDate?: string; search?: string; page?: number; pageSize?: number }) =>
    api<Paged<ReturnListItem>>(`/api/returns${buildQuery(params)}`),

  get: (id: Uuid) => api<SalesReturn>(`/api/returns/${id}`),

  /** Orders to pick from when starting a return (any order; the returnable call says what can come back). */
  searchOrders: (params: { search?: string; page?: number; pageSize?: number }) => api<Paged<OrderSearchItem>>(`/api/orders${buildQuery(params)}`),

  getReturnable: (orderId: Uuid) => api<Returnable>(`/api/orders/${orderId}/returnable`),

  create: (data: { orderId: Uuid; reasonSummary?: string | null; note?: string | null; items: CreateReturnItem[] }) =>
    api<SalesReturn>('/api/returns', { method: 'POST', body: JSON.stringify(data) }),

  removeItem: (id: Uuid, itemId: Uuid) => api<SalesReturn>(`/api/returns/${id}/items/${itemId}`, { method: 'DELETE' }),

  /** Manage. */
  approve: (id: Uuid) => api<SalesReturn>(`/api/returns/${id}/approve`, { method: 'POST' }),

  /** Manage; the reason is kept in the audit log. */
  reject: (id: Uuid, reason: string) => api<SalesReturn>(`/api/returns/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  /** REQUESTED or APPROVED only. */
  cancel: (id: Uuid, reason: string) => api<SalesReturn>(`/api/returns/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

  /** The goods are physically back in the store. */
  receive: (id: Uuid) => api<SalesReturn>(`/api/returns/${id}/receive`, { method: 'POST' }),

  inspectItem: (id: Uuid, itemId: Uuid, data: { conditionStatus: Exclude<ReturnCondition, 'PENDING_INSPECTION'>; inspectionNote?: string | null }) =>
    api<SalesReturn>(`/api/returns/${id}/items/${itemId}/inspection`, { method: 'PUT', body: JSON.stringify(data) }),

  /** Manage. Restocks the RESELLABLE lines into their original lot, reduces unpaid debt first and fixes the refund amount. */
  completeInspection: (id: Uuid) => api<SalesReturn>(`/api/returns/${id}/complete-inspection`, { method: 'POST' }),
}
