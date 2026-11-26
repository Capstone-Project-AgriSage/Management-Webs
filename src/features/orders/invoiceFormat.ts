/** Preserve the saved two-decimal amounts, while keeping whole VND amounts compact. */
export function formatInvoiceMoney(value: number): string {
  return `${value.toLocaleString('vi-VN', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} đ`
}
