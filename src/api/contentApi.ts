import { api, toQuery } from './client'
import type { PagedResult } from './types'
import type { UploadedImage } from './productsApi'

export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export interface Article {
  id: string; title: string; slug: string; summary: string | null; content: string; thumbnailUrl: string | null
  status: ArticleStatus; authorId: string; authorName: string; publishedAt: string | null; createdAt: string; updatedAt: string
}
export interface ArticleInput { title: string; slug: string; summary: string | null; content: string; thumbnailUrl: string | null }
export type ContactStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export interface ContactRequest {
  id: string; requestNumber: string; contactName: string; contactPhone: string | null; contactEmail: string | null
  subject: string; message: string; status: ContactStatus; resolvedAt: string | null; resolutionNote: string | null
  createdAt: string; updatedAt: string
}
export const articleLabels: Record<ArticleStatus, string> = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã xuất bản', ARCHIVED: 'Đã lưu trữ' }
export const contactLabels: Record<ContactStatus, string> = { OPEN: 'Mới', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã giải quyết', CLOSED: 'Đã đóng' }
export interface ContentListParams { page?: number; pageSize?: number; search?: string; status?: string }
const articles = '/api/admin/articles'
const contacts = '/api/contact-requests'
export const contentApi = {
  uploadArticleImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api<UploadedImage>('/api/files/article-images', { method: 'POST', body: form })
  },
  articles: (params: ContentListParams, signal?: AbortSignal) => api<PagedResult<Article>>(articles + toQuery({ ...params }), { signal, cache: 'no-store' }),
  createArticle: (data: ArticleInput) => api<Article>(articles, { method: 'POST', body: JSON.stringify(data) }),
  updateArticle: (id: string, data: ArticleInput) => api<Article>(`${articles}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  articleStatus: (id: string, status: ArticleStatus) => api<Article>(`${articles}/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  deleteArticle: (id: string) => api<void>(`${articles}/${id}`, { method: 'DELETE' }),
  contacts: (params: ContentListParams, signal?: AbortSignal) => api<PagedResult<ContactRequest>>(contacts + toQuery({ ...params }), { signal, cache: 'no-store' }),
  updateContact: (id: string, status: ContactStatus, resolutionNote: string | null) =>
    api<ContactRequest>(`${contacts}/${id}`, { method: 'PUT', body: JSON.stringify({ status, resolutionNote }) }),
}
