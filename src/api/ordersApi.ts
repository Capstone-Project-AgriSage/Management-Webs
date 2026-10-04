import { api } from './client'
import type { OrderResponse, OrderItemRequest, Paged, Uuid, FefoLotSuggestion } from './types'

export interface CreateOrderRequest {
  source: 'COUNTER' | 'FARMER_WEB' | 'FARMER_MOBILE'
  customerType: 'REGISTERED' | 'WALK_IN'
  customerName?: string | null
  customerPhone?: string | null
  note?: string | null
  settlementType: 'FULL_PAYMENT' | 'CREDIT'
  fulfillmentType: 'PICKUP' | 'DELIVERY'
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
  refunds: any[] // Mặc dù có type RefundResponse nhưng server trả về list ở đây
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
    getOrders: (params?: { page?: number; pageSize?: number; search?: string; status?: OrderStatus }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString())
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status) searchParams.append('status', params.status)
    const qs = searchParams.toString()
    return api<Paged<OrderResponse>>(`/api/orders${qs ? `?${qs}` : ''}`)
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

  cancelRemainingItem: (orderId: Uuid, itemId: Uuid, data: CancelOrderRequest) => {
    return api<OrderResponse>(`/api/orders/${orderId}/items/${itemId}/cancel-remaining`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}
