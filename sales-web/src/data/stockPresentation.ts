import type { StockStatus } from '../types'

export interface StockPresentation {
  stockStatus: StockStatus
  stockLabel: string
  stockClassName: string
  stockDotClassName: string
}

/**
 * Single source of truth for deriving stock-status color/label presentation from a raw
 * quantity. Both the Inventory page (when writing new state after a Stock Movement) and
 * the mock seed data (for each item's initial values) call this, so the two can never
 * drift out of sync the way hand-copied Tailwind classes previously did.
 */
export function resolveStockPresentation(quantity: number): StockPresentation {
  if (quantity <= 0) {
    return {
      stockStatus: 'Hết hàng',
      stockLabel: 'Hết hàng',
      stockClassName: 'bg-rose-50 text-rose-700 border-rose-200',
      stockDotClassName: 'bg-rose-500',
    }
  }
  if (quantity < 20) {
    return {
      stockStatus: 'Sắp hết',
      stockLabel: 'Sắp hết',
      stockClassName: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
      stockDotClassName: 'bg-[#D97706]',
    }
  }
  return {
    stockStatus: 'Còn hàng',
    stockLabel: 'Còn hàng',
    stockClassName: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]',
    stockDotClassName: 'bg-[#16A34A]',
  }
}
