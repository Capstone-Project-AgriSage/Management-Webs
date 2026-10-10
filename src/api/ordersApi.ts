import { api } from './client'
import type { OrderResponse, OrderItemRequest, OrderStatus, Paged, Uuid, FefoLotSuggestion, OrderCancellationRefund } from './types'

export interface DeliveryAddressRequest {
  recipientName: string
  recipientPhone: string
  addressLine: string
  ward?: string | null
  district?: string | null
  province: string
}

/**
 * POST /api/orders (CreateCounterOrderRequest) — FE_GUIDE_FLOW_1 §M3. The server sets the source (COUNTER) and the
 * prices; unitPrice is sent only for an overridden line, with its reason. A registered customer may buy on credit
 * (FLOW_3 §5: checked when the order is created and again on confirm). Delivery needs addressId or deliveryAddress.
 */
export interface CreateOrderRequest {
  customerType: 'REGISTERED' | 'WALK_IN'
  farmerProfileId?: Uuid | null
  customerName?: string | null
  customerPhone?: string | null
  note?: string | null
  settlementType: 'FULL_PAYMENT' | 'CREDIT'
  fulfillmentType: 'PICKUP' | 'DELIVERY'
  addressId?: Uuid | null
  deliveryAddress?: DeliveryAddressRequest | null
  items: OrderItemRequest[]
}

export interface PickupLotRequest {
  inventoryLotId: Uuid
  baseQuantity: number
}

export interface PickupItemRequest {
  orderItemId: Uuid
  lots: PickupLotRequest[]
}

export interface PickupRequest {
  items: PickupItemRequest[]
  note?: string | null
}

export interface CancelOrderRequest {
  reason: string
}

export interface CancelOrderResponse {
  order: OrderResponse
  refunds: OrderCancellationRefund[]
}

export interface FefoSuggestionItem {
  orderItemId: Uuid
  baseQuantity: number
  remainingBaseQuantity: number
  shortageBaseQuantity: number
  lots: FefoLotSuggestion[]
}

export interface FefoSuggestionResponse {
  orderId: Uuid
  items: FefoSuggestionItem[]
}

export const ordersApi = {
  create: (data: CreateOrderRequest) => {
    return api<OrderResponse>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  /** fromDate/toDate are Vietnam days (yyyy-MM-dd) on the creation date (FE_GUIDE_FLOW_1 §0.9). */
  getOrders: (params?: { page?: number; pageSize?: number; search?: string; status?: OrderStatus; source?: string; fromDate?: string; toDate?: string }, signal?: AbortSignal) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString())
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status) searchParams.append('status', params.status)
    if (params?.source) searchParams.append('source', params.source)
    if (params?.fromDate) searchParams.append('fromDate', params.fromDate)
    if (params?.toDate) searchParams.append('toDate', params.toDate)
    const qs = searchParams.toString()
    return api<Paged<OrderResponse>>(`/api/orders${qs ? `?${qs}` : ''}`, { signal })
  },

  // Optional tracking steps after confirmation (FE_GUIDE_FLOW_1 §M5); skipping them does not block the hand-over.
  startPreparing: (orderId: Uuid) => api<OrderResponse>(`/api/orders/${orderId}/start-preparing`, { method: 'POST' }),

  markReady: (orderId: Uuid) => api<OrderResponse>(`/api/orders/${orderId}/mark-ready`, { method: 'POST' }),

  // The list returns summaries without the order lines; the lines only come with the single-order call.
  getById: (orderId: Uuid) => {
    return api<OrderResponse>(`/api/orders/${orderId}`)
  },

  getFefoSuggestions: (orderId: Uuid) => {
    return api<FefoSuggestionResponse>(`/api/orders/${orderId}/fefo-suggestions`)
  },

  confirm: (orderId: Uuid) => {
    return api<OrderResponse>(`/api/orders/${orderId}/confirm`, {
      method: 'POST'
    })
  },

  pickup: (orderId: Uuid, data: PickupRequest) => {
    return api<OrderResponse>(`/api/orders/${orderId}/pickup`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  cancel: (orderId: Uuid, data: CancelOrderRequest) => {
    return api<CancelOrderResponse>(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // Editing while PENDING_CONFIRMATION (FE_GUIDE_FLOW_1 §M3). Each call returns the whole updated order.
  updateNote: (orderId: Uuid, note: string) =>
    api<OrderResponse>(`/api/orders/${orderId}`, { method: 'PUT', body: JSON.stringify({ note }) }),

  /** New lines use the price list the order locked in; adding a product + packaging already on the order is a 422. */
  addItem: (orderId: Uuid, item: OrderItemRequest) =>
    api<OrderResponse>(`/api/orders/${orderId}/items`, { method: 'POST', body: JSON.stringify(item) }),

  changeQuantity: (orderId: Uuid, itemId: Uuid, quantity: number) =>
    api<OrderResponse>(`/api/orders/${orderId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) }),

  removeItem: (orderId: Uuid, itemId: Uuid) =>
    api<OrderResponse>(`/api/orders/${orderId}/items/${itemId}`, { method: 'DELETE' }),

  overridePrice: (orderId: Uuid, itemId: Uuid, unitPrice: number, reason: string) =>
    api<OrderResponse>(`/api/orders/${orderId}/items/${itemId}/price`, { method: 'PUT', body: JSON.stringify({ unitPrice, reason }) }),

  /** Back to the suggested price. */
  resetPrice: (orderId: Uuid, itemId: Uuid) =>
    api<OrderResponse>(`/api/orders/${orderId}/items/${itemId}/price`, { method: 'DELETE' }),

  cancelRemainingItem: (orderId: Uuid, itemId: Uuid, data: CancelOrderRequest) => {
    return api<OrderResponse>(`/api/orders/${orderId}/items/${itemId}/cancel-remaining`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}
