import { api, apiBlob, ApiError, saveBlob, toQuery } from './client'
import type { OrderResponse, PagedResult } from './types'
import type { OrderPaymentsSummary } from './paymentsApi'

export interface InvoiceListItem {
  id: string; invoiceNumber: string; orderId: string; orderNumber: string; customerName: string
  customerEmail: string | null; totalAmount: number; issuedAt: string
  emailStatus: InvoiceEmailStatus
}
export interface InvoiceResponse extends Omit<InvoiceListItem, 'emailStatus'> {
  snapshot: {
    version: number
    store: { name: string; address: string; phone: string | null; email: string | null; taxCode: string | null }
    cashierName: string
    order: OrderResponse
    payments: OrderPaymentsSummary
  }
}
export interface InvoiceEmail {
  id: string; recipient: string; status: 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN'
  createdAt: string; sentAt: string | null; error: string | null
}
export type InvoiceEmailStatus = InvoiceEmail['status'] | 'NOT_SENT'
export const invoiceEmailStatusLabels: Record<InvoiceEmailStatus, string> = {
  NOT_SENT: 'Chưa gửi', SENDING: 'Đang gửi', SENT: 'Đã gửi', FAILED: 'Gửi thất bại', UNKNOWN: 'Chưa xác định kết quả',
}
export type InvoiceListQuery = {
  page?: number; pageSize?: number; search?: string; orderId?: string
  fromDate?: string; toDate?: string; minAmount?: string; maxAmount?: string
  hasCustomerEmail?: boolean; emailStatus?: InvoiceEmailStatus | ''
}
const pendingIssues = new Map<string, Promise<InvoiceResponse>>()
export const invoicesApi = {
  list: (q: InvoiceListQuery = {}, signal?: AbortSignal) =>
    api<PagedResult<InvoiceListItem>>(`/api/invoices${toQuery(q)}`, { signal, cache: 'no-store' }),
  get: (id: string) => api<InvoiceResponse>(`/api/invoices/${encodeURIComponent(id)}`, { cache: 'no-store' }),
  issue: (orderId: string) => api<InvoiceResponse>(`/api/orders/${encodeURIComponent(orderId)}/invoice`, { method: 'POST' }),
  ensureForOrder: (orderId: string, canCreate: boolean): Promise<InvoiceResponse> => {
    const existing = pendingIssues.get(orderId)
    if (existing) return existing
    const request = (async () => {
      const list = await invoicesApi.list({ orderId, pageSize: 1 })
      if (list.items[0]) return invoicesApi.get(list.items[0].id)
      if (!canCreate) throw new Error('Đơn chưa có hóa đơn. Bạn chưa có quyền tạo hóa đơn.')
      try { return await invoicesApi.issue(orderId) }
      catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error
        const issued = await invoicesApi.list({ orderId, pageSize: 1 })
        if (!issued.items[0]) throw error
        return invoicesApi.get(issued.items[0].id)
      }
    })()
    pendingIssues.set(orderId, request)
    void request.finally(() => { if (pendingIssues.get(orderId) === request) pendingIssues.delete(orderId) }).catch(() => {})
    return request
  },
  download: async (id: string, invoiceNumber: string) => {
    const file = await apiBlob(`/api/invoices/${encodeURIComponent(id)}/pdf`)
    saveBlob(file.blob, `${invoiceNumber}.pdf`)
  },
  emails: (id: string, page = 1) => api<PagedResult<InvoiceEmail>>(`/api/invoices/${encodeURIComponent(id)}/emails?page=${page}&pageSize=5`, { cache: 'no-store' }),
  send: (id: string, recipient: string, requestId: string) => api<InvoiceEmail>(`/api/invoices/${encodeURIComponent(id)}/emails`, {
    method: 'POST', body: JSON.stringify({ recipient, requestId }),
  }),
}
