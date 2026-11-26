import { api } from './client'
export type ExchangeStatus = 'REQUESTED' | 'APPROVED' | 'RECEIVED' | 'READY_TO_COMPLETE' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'
export const exchangeStatus: Record<ExchangeStatus, string> = { REQUESTED: 'Chờ duyệt', APPROVED: 'Đã duyệt', RECEIVED: 'Đang kiểm tra', READY_TO_COMPLETE: 'Chờ quyết toán', COMPLETED: 'Hoàn thành', REJECTED: 'Bị từ chối', CANCELLED: 'Đã hủy' }
export interface ReturnSource { deliveryItemLotAllocationId: string | null; originalStockMovementItemId: string | null; inventoryLotId: string; lotNumber: string | null; returnableBaseQuantity: number }
export interface Exchangeable { orderNumber: string; items: { orderItemId: string; productName: string; returnableBaseQuantity: number; alreadyReturnedBaseQuantity: number; fulfilledBaseQuantity: number; unitPrice: number; conversionToBase: number; sources: ReturnSource[] }[] }
export interface ExchangeReturnLine { id: string; orderItemId: string; returnedBaseQuantity: number; returnValue: number; conditionStatus: string; inspectionNote: string | null; inventoryDisposition: string }
export interface ExchangeListItem { id: string; orderId: string; orderNumber: string; returnNumber: string; customerName: string; status: ExchangeStatus; replacementAmount: number; difference: number | null; createdAt: string }
export interface ReplacementLine { id: string; storeProductId: string; productPackagingId: string; productName: string; packagingName: string; quantity: number; baseQuantity: number; unitPrice: number; lineTotal: number }
export interface Exchange { id: string; orderId: string; orderNumber: string; status: ExchangeStatus; reason: string; replacementAmount: number; difference: number | null; replacementOrderId: string | null; replacementOrderNumber: string | null; settlementReference: string | null; createdAt: string; completedAt: string | null; replacements: ReplacementLine[]; originalItems: { orderItemId: string; productName: string; packagingName: string }[]; history: { action: string; occurredAt: string; reason: string | null }[]; return: { id: string; returnNumber: string; customerName: string; totalReturnAmount: number; totalDebtAdjustment: number; totalRefundAmount: number; items: ExchangeReturnLine[]; refunds: { id: string; refundNumber: string; amount: number; refundMethod: string; status: string }[] } }
export interface ExchangeRequest { orderId: string; requestKey: string; reason: string; items: { orderItemId: string; returnedBaseQuantity: number; reasonCode: string; deliveryItemLotAllocationId?: string | null; originalStockMovementItemId?: string | null }[]; replacements: { storeProductId: string; productPackagingId: string; quantity: number }[] }
export interface ExchangeSummary { receivedAmount: number; refundedAmount: number; netReceivedAmount: number }
export interface ExchangePage { items: ExchangeListItem[]; totalCount: number; totalPages: number; page: number; pageSize: number; summary: ExchangeSummary }
const base = '/api/exchanges'
const post = <T,>(url: string, data?: unknown) => api<T>(url, { method: 'POST', ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
export const exchangesApi = {
 list: (params: { page?: number; orderId?: string; status?: string; search?: string } = {}) => api<ExchangePage>(`${base}?${new URLSearchParams(Object.entries(params).filter(([,v]) => v !== undefined && v !== '').map(([k,v]) => [k, String(v)]))}`),
 get: (id: string) => api<Exchange>(`${base}/${id}`),
 exchangeable: (id: string) => api<Exchangeable>(`/api/orders/${id}/exchangeable`),
 create: (data: ExchangeRequest) => post<Exchange>(base, data),
 action: (id: string, action: string, reason?: string) => post<Exchange>(`${base}/${id}/${action}`, reason ? { reason } : undefined),
 inspect: (id: string, itemId: string, conditionStatus: string, inspectionNote: string) => api<Exchange>(`${base}/${id}/items/${itemId}/inspection`, { method: 'PUT', body: JSON.stringify({ conditionStatus, inspectionNote }) }),
 complete: (id: string, data: { confirmedDifference: number; settlementReference: string; lots: { replacementItemId: string; inventoryLotId: string; baseQuantity: number }[] }) => post<Exchange>(`${base}/${id}/complete`, data),
}
