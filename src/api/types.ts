export type Money = number
export type Uuid = string

export interface Paged<T> { 
  items: T[]; 
  page: number; 
  pageSize: number; 
  totalCount: number; 
  totalPages: number 
}

export type OrderStatus =
  | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_FULFILLMENT'
  | 'PARTIALLY_FULFILLED' | 'COMPLETED' | 'CANCELLED' | 'PARTIALLY_CANCELLED'

export interface OrderItemResponse {
  id: Uuid; storeProductId: Uuid; productPackagingId: Uuid; sku: string; productName: string; packagingName: string
  quantity: number; conversionToBase: number; baseQuantity: number
  suggestedUnitPrice: Money; unitPrice: Money; lineTotalAmount: Money
  priceOverridden: boolean; overrideReason: string | null; overriddenBy: Uuid | null
  fulfilledBaseQuantity: number; cancelledBaseQuantity: number; remainingBaseQuantity: number
  status: 'PENDING' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED' | 'PARTIALLY_CANCELLED'
}

export interface OrderResponse {
  id: Uuid; orderNumber: string; source: 'COUNTER' | 'FARMER_WEB' | 'FARMER_MOBILE'
  customerType: 'REGISTERED' | 'WALK_IN'; farmerProfileId: Uuid | null; customerName: string; customerPhone: string | null
  customerGroupId: Uuid | null; priceListId: Uuid | null
  settlementType: 'FULL_PAYMENT' | 'CREDIT'; creditTermDays: number | null
  fulfillmentType: 'PICKUP' | 'DELIVERY'
  deliveryAddress: { recipientName: string; recipientPhone: string; addressLine: string; ward: string | null; district: string | null
                     province: string; latitude: number | null; longitude: number | null } | null
  status: OrderStatus; subtotalAmount: Money; totalAmount: Money; note: string | null
  createdBy: Uuid; createdAt: string; confirmedBy: Uuid | null; confirmedAt: string | null
  pickupCompletedBy: Uuid | null; pickupCompletedAt: string | null; completedAt: string | null
  cancelledBy: Uuid | null; cancelledAt: string | null; cancelReason: string | null
  version: number; items: OrderItemResponse[]
}

export interface OrderItemRequest {
  storeProductId: Uuid; productPackagingId: Uuid; quantity: number; unitPrice?: Money | null; overrideReason?: string | null
}

export interface FefoLotSuggestion { 
  inventoryLotId: Uuid; 
  lotNumber: string | null; 
  expiryDate: string | null; 
  availableBaseQuantity: number; 
  suggestedBaseQuantity: number 
}

export interface PaymentResponse {
  id: Uuid; paymentNumber: string; paymentContext: 'ORDER_PAYMENT' | 'DEBT_REPAYMENT'; paymentMethod: 'CASH' | 'PAYOS'
  amount: Money; status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'PARTIALLY_REFUNDED' | 'REFUNDED'
  payerName: string | null; confirmedAt: string | null; initiatedAt: string
  currency: string; payerFarmerProfileId: Uuid | null; confirmationSource: 'STAFF' | 'PAYOS_WEBHOOK' | null
  confirmedBy: Uuid | null; checkoutUrl: string | null; providerOrderCode: number | null
  failedAt: string | null; cancelledAt: string | null; note: string | null; unallocatedAmount: Money
  allocations: { id: Uuid; allocationType: 'ORDER' | 'DEBT'; orderId: Uuid | null; orderNumber: string | null
                 debtEntryId: Uuid | null; entryNumber: string | null; allocatedAmount: Money
                 prepaymentConsumedAmount: Money; status: 'ACTIVE' | 'REVERSED'; allocatedAt: string }[]
}

export interface RefundResponse {
  refundId: Uuid
  refundNumber: string
  paymentId: Uuid
  refundMethod: 'CASH' | 'BANK_TRANSFER'
  amount: Money
}

export interface CounterSaleRequest {
  customerType: 'WALK_IN'; customerName?: string | null; customerPhone?: string | null; note?: string | null
  settlementType?: 'FULL_PAYMENT' | 'CREDIT'; fulfillmentType?: 'PICKUP' | 'DELIVERY'
  items: (OrderItemRequest & { lots?: { inventoryLotId: Uuid; baseQuantity: number }[] })[]
}

export interface CounterSalePreviewResponse {
  customerGroupId: Uuid | null; priceListId: Uuid | null; totalAmount: Money
  items: { storeProductId: Uuid; productPackagingId: Uuid; sku: string; productName: string; packagingName: string
           quantity: number; conversionToBase: number; baseQuantity: number; suggestedUnitPrice: Money; unitPrice: Money
           lineTotalAmount: Money; lots: FefoLotSuggestion[]; shortageBaseQuantity: number }[]
}

export interface CounterSaleResponse { 
  order: OrderResponse; 
  payment: PaymentResponse 
}

export interface CatalogCategory {
  id: Uuid
  name: string
}

export interface CatalogProduct {
  id: string // storeProductId
  sku: string
  name: string
  imageUrl: string | null
  categoryId: string
  brandId: string | null
  activeIngredientId: string | null
  fromPrice: number | null
}

export interface CatalogProductDetail extends CatalogProduct {
  description: string | null
  manufacturer: string | null
  packagings: CatalogPackaging[]
}

export interface CatalogPackaging {
  id: string // productPackagingId
  name: string
  conversionToBase: number
  price: number | null // null means not for sale
}

export interface InventoryLot {
  id: Uuid
  storeProductId: Uuid
  productName?: string
  lotNumber: string | null
  expiryDate: string | null
  isExpired: boolean
  status: 'ACTIVE' | 'QUARANTINED' | 'BLOCKED' | 'DEPLETED'
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number
  averageUnitCost: Money | null
}
