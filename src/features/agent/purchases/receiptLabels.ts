import type { ReceiptStatus } from '@/api/goodsReceiptsApi'

export const RECEIPT_STATUS_LABEL: Record<ReceiptStatus, string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã nhập kho',
  CANCELLED: 'Đã hủy',
}

export const RECEIPT_STATUS_BADGE_CLASS: Record<ReceiptStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-slate-200 text-slate-600',
}

export const RECEIPT_SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Nhập tay',
  EXCEL_TEMPLATE: 'Nhập từ Excel',
}

export const RECEIPTS_BASE = '/agent/purchases/receipts'

/** Value of an <input type="datetime-local"> for "now" (local time, minute precision). */
export function nowLocalInput(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local value (local) -> ISO string the API expects; undefined when empty. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** ISO date-time -> datetime-local value in local time. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const IMPORT_COLUMN_LABEL: Record<string, string> = {
  Row: 'Dòng',
  SKU: 'Mã sản phẩm',
  Packaging: 'Quy cách',
  Quantity: 'Số lượng',
  UnitCost: 'Đơn giá',
  LotNumber: 'Số lô',
  ExpiryDate: 'Hạn dùng',
  ManufactureDate: 'Ngày sản xuất',
}

/** Known server messages of the Excel check (and of manual receiving) in Vietnamese; unknown ones stay as the server wrote them. */
const IMPORT_MESSAGES: [RegExp, string][] = [
  [/No product of this store has this SKU/i, 'Không có sản phẩm nào của cửa hàng mang mã này (xem sheet Products trong file mẫu).'],
  [/Must be a whole number of packages, at least 1/i, 'Số lượng phải là số nguyên từ 1 trở lên.'],
  [/lot number is required/i, 'Sản phẩm này bắt buộc có số lô.'],
  [/expiry date is required/i, 'Sản phẩm này bắt buộc có hạn dùng.'],
  [/already expired/i, 'Hàng đã hết hạn nên không nhập kho được.'],
  [/DISCONTINUED/i, 'Sản phẩm đã ngừng kinh doanh nên không nhập được.'],
  [/not a purchase unit/i, 'Quy cách này không phải quy cách dùng để nhập hàng.'],
  [/packaging is not ACTIVE/i, 'Quy cách này đang bị ngừng sử dụng.'],
]

export function importColumnLabel(column: string): string {
  return IMPORT_COLUMN_LABEL[column] ?? column
}

export function translateImportMessage(message: string): string {
  return IMPORT_MESSAGES.find(([re]) => re.test(message))?.[1] ?? message
}
