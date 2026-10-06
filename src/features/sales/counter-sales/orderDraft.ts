import type { CatalogProductDetail, OrderItemRequest } from '@/api/types'
import type { CustomerResponse, AddressResponse } from '@/api/customersApi'
import type { CreditSummary } from '@/api/customerCreditApi'
import type { CreateOrderRequest, DeliveryAddressRequest } from '@/api/ordersApi'
import { ApiError } from '@/api/client'

// The order being put together at the counter (FE_GUIDE_FLOW_1 §M3/§M7, FLOW_3 §5).

export interface CartItem {
  product: CatalogProductDetail
  packagingId: string
  packagingName: string
  /** Base units in one pack (lots and stock are counted in base units). */
  conversionToBase: number
  quantity: number
  /** Walk-in catalogue price, shown until the server preview answers. */
  price: number
  /** Staff price with its mandatory reason; the server records the suggested price next to it. */
  override?: { unitPrice: number; reason: string }
}

export type DraftCustomer =
  | { kind: 'WALK_IN'; name: string; phone: string }
  /** customer is null until the staff picks someone. */
  | { kind: 'REGISTERED'; customer: CustomerResponse | null; credit: CreditSummary | null; addresses: AddressResponse[] }

export interface DraftAddress {
  /** A saved address of the registered customer, or null to type one. */
  addressId: string | null
  recipientName: string
  recipientPhone: string
  addressLine: string
  ward: string
  district: string
  province: string
}

export interface OrderDraft {
  customer: DraftCustomer
  settlementType: 'FULL_PAYMENT' | 'CREDIT'
  fulfillmentType: 'PICKUP' | 'DELIVERY'
  address: DraftAddress
  note: string
}

export const EMPTY_ADDRESS: DraftAddress = { addressId: null, recipientName: '', recipientPhone: '', addressLine: '', ward: '', district: '', province: '' }

export const newDraft = (): OrderDraft => ({
  customer: { kind: 'WALK_IN', name: '', phone: '' },
  settlementType: 'FULL_PAYMENT',
  fulfillmentType: 'PICKUP',
  address: EMPTY_ADDRESS,
  note: '',
})

export const MAX_LINES = 100
export const MAX_NOTE = 1000

export function toItemRequests(items: CartItem[]): OrderItemRequest[] {
  return items.map((i) => ({
    storeProductId: i.product.id,
    productPackagingId: i.packagingId,
    quantity: i.quantity,
    ...(i.override ? { unitPrice: i.override.unitPrice, overrideReason: i.override.reason } : {}),
  }))
}

/** Customer fields shared by the preview, the quick sale and the order. */
export function customerFields(customer: DraftCustomer) {
  return customer.kind === 'REGISTERED'
    ? { customerType: 'REGISTERED' as const, farmerProfileId: customer.customer?.id ?? null }
    : { customerType: 'WALK_IN' as const, customerName: customer.name.trim() || null, customerPhone: customer.phone.trim() || null }
}

/** Credit can be offered only to a registered customer whose credit profile is active. */
export function creditUsable(customer: DraftCustomer): boolean {
  return customer.kind === 'REGISTERED' && customer.credit?.status === 'ACTIVE'
}

/** Field errors of the order options; empty when the draft can be sent. */
export function validateDraft(draft: OrderDraft): Record<string, string> {
  const e: Record<string, string> = {}
  if (draft.customer.kind === 'REGISTERED' && !draft.customer.customer) e.customer = 'Chọn khách quen.'
  if (draft.settlementType === 'CREDIT' && !creditUsable(draft.customer)) e.settlementType = 'Khách này chưa được mua chịu.'
  if (draft.note.length > MAX_NOTE) e.note = `Ghi chú tối đa ${MAX_NOTE} ký tự.`
  if (draft.fulfillmentType === 'DELIVERY' && !draft.address.addressId) {
    const a = draft.address
    if (!a.recipientName.trim()) e.recipientName = 'Nhập tên người nhận.'
    if (!a.recipientPhone.trim()) e.recipientPhone = 'Nhập số điện thoại người nhận.'
    if (!a.addressLine.trim()) e.addressLine = 'Nhập địa chỉ.'
    if (!a.province.trim()) e.province = 'Nhập tỉnh/thành phố.'
  }
  return e
}

export function toCreateRequest(draft: OrderDraft, items: CartItem[]): CreateOrderRequest {
  const delivery = draft.fulfillmentType === 'DELIVERY'
  const a = draft.address
  const typed: DeliveryAddressRequest = {
    recipientName: a.recipientName.trim(),
    recipientPhone: a.recipientPhone.trim(),
    addressLine: a.addressLine.trim(),
    ward: a.ward.trim() || null,
    district: a.district.trim() || null,
    province: a.province.trim(),
  }
  return {
    ...customerFields(draft.customer),
    settlementType: draft.settlementType,
    fulfillmentType: draft.fulfillmentType,
    note: draft.note.trim() || null,
    ...(delivery ? (a.addressId ? { addressId: a.addressId } : { deliveryAddress: typed }) : {}),
    items: toItemRequests(items),
  }
}

const CREDIT_REASON: Record<string, string> = {
  INSUFFICIENT_CREDIT: 'Vượt hạn mức mua chịu còn lại của khách.',
  CREDIT_DISABLED: 'Khách chưa được mở mua chịu, hoặc tín dụng đang tạm dừng / bị khoá.',
  NO_CREDIT_LIMIT: 'Hạn mức mua chịu của khách đang là 0.',
  NO_CREDIT_TERM: 'Khách chưa có hạng tín dụng (kỳ hạn trả).',
  OVERDUE_DEBT: 'Khách đang có nợ quá hạn nên chưa được mua chịu thêm.',
}

/** A readable reason for a refused credit order ("Credit refused: INSUFFICIENT_CREDIT"), or null for other errors. */
export function creditRefusal(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null
  const code = err.errors?.credit?.[0] ?? /Credit refused: (\w+)/.exec(err.detail ?? '')?.[1]
  return code ? CREDIT_REASON[code] ?? `Không được mua chịu (${code}).` : null
}
