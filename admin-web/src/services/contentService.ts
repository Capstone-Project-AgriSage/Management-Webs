import { mockArticles } from '../data/mockContentAndSystem'
import type { Article, ArticleStatus, ArticleActionId } from '../types'

let articles = [...mockArticles]

export function listArticles(): Article[] {
  return articles
}

export function updateArticleStatus(id: string, status: ArticleStatus): void {
  articles = articles.map(a => a.id === id ? { ...a, status, publishedAt: status === 'Đã xuất bản' ? new Date().toISOString().split('T')[0] : a.publishedAt } : a)
}

export function createArticle(data: Partial<Article>): Article {
  const newId = `ART-${String(articles.length + 1).padStart(3, '0')}`
  const newArticle: Article = {
    id: newId,
    title: data.title || '',
    category: data.category || '',
    author: data.author || 'Admin',
    views: 0,
    status: data.status || 'Bản nháp',
    publishedAt: data.status === 'Đã xuất bản' ? new Date().toISOString().split('T')[0] : '-'
  }
  articles = [newArticle, ...articles]
  return newArticle
}

export function updateArticle(id: string, data: Partial<Article>): void {
  articles = articles.map(a => a.id === id ? { ...a, ...data, publishedAt: data.status === 'Đã xuất bản' ? new Date().toISOString().split('T')[0] : a.publishedAt } : a)
}

export function deleteArticle(id: string): void {
  articles = articles.filter(a => a.id !== id)
}

export function articleActionsFor(status: ArticleStatus): { id: ArticleActionId; label: string; icon: string; danger?: boolean }[] {
  const actions: { id: ArticleActionId; label: string; icon: string; danger?: boolean }[] = [
    { id: 'view', label: 'Xem bài viết', icon: 'visibility' },
    { id: 'edit', label: 'Chỉnh sửa', icon: 'edit' },
  ]
  if (status === 'Chờ duyệt') {
    actions.push({ id: 'approve', label: 'Duyệt bài', icon: 'check_circle' })
  }
  if (status === 'Bản nháp') {
    actions.push({ id: 'publish', label: 'Xuất bản', icon: 'publish' })
  }
  actions.push({ id: 'delete', label: 'Xóa bài viết', icon: 'delete', danger: true })
  return actions
}
