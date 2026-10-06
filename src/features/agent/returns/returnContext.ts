import { ordersApi } from '@/api/ordersApi'
import { productLookupApi } from '@/api/productLookupApi'
import type { OrderResponse } from '@/api/types'

/** What the return screens show about an order line: its name and the base unit its quantities are counted in. */
export interface OrderItemInfo {
  orderItemId: string
  storeProductId: string
  productName: string
  sku: string
  packagingName: string
  conversionToBase: number
  /** Unit code of the product's base unit (KG, BOTTLE...), null when it could not be read. */
  baseUnit: string | null
}

const baseUnitCache = new Map<string, string | null>()

async function baseUnitOf(storeProductId: string): Promise<string | null> {
  if (baseUnitCache.has(storeProductId)) return baseUnitCache.get(storeProductId) ?? null
  try {
    const storeProduct = await productLookupApi.getStoreProduct(storeProductId)
    const product = await productLookupApi.getProduct(storeProduct.productId)
    const unit = product.packagings.find((p) => p.isBaseUnit)?.unitCode ?? null
    baseUnitCache.set(storeProductId, unit)
    return unit
  } catch {
    return null
  }
}

/** The order (header data) and a map orderItemId -> name, packaging and base unit. */
export async function loadOrderInfo(orderId: string): Promise<{ order: OrderResponse; items: Map<string, OrderItemInfo> }> {
  const order = await ordersApi.getById(orderId)
  const units = await Promise.all([...new Set(order.items.map((i) => i.storeProductId))].map(async (id) => [id, await baseUnitOf(id)] as const))
  const unitByProduct = new Map(units)
  const items = new Map<string, OrderItemInfo>()
  for (const item of order.items) {
    items.set(item.id, {
      orderItemId: item.id,
      storeProductId: item.storeProductId,
      productName: item.productName,
      sku: item.sku,
      packagingName: item.packagingName,
      conversionToBase: item.conversionToBase,
      baseUnit: unitByProduct.get(item.storeProductId) ?? null,
    })
  }
  return { order, items }
}
