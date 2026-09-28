import { useState } from 'react'

import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import Pagination from '../../components/ui/Pagination'
import FormModal from '../../components/ui/FormModal'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { useFormValues } from '../../hooks/useFormValues'
import * as contentService from '../../services/contentService'
import type { Article, ArticleStatus, ArticleActionId } from '../../types'

export default function ArticlesPage() {
  usePageHeader({ title: 'Bài viết & Tin tức', subtitle: 'Quản lý nội dung truyền thông và kỹ thuật' })

  const [articleList, setArticleList] = useState<Article[]>(() => contentService.listArticles())
  const { showToast } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const createForm = useFormValues({ title: '', category: 'Cẩm nang Agrisage', author: 'Admin', status: 'Bản nháp', content: '' }) // content is fake

  const [editTarget, setEditTarget] = useState<Article | null>(null)
  const editForm = useFormValues({ title: '', category: '', author: '', status: 'Bản nháp', content: '' }) // content is fake

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredArticles,
  } = useFilteredList(
    articleList,
    '',
    (item, keyword, status) =>
      (!keyword ||
        item.title.toLowerCase().includes(keyword.toLowerCase()) ||
        item.author.toLowerCase().includes(keyword.toLowerCase())) &&
      (!status || item.status === (status as ArticleStatus)),
    '',
  )

  const {
    page,
    totalPages,
    paginated: paginatedArticles,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredArticles, 12)

  const handleAction = (article: Article, actionId: ArticleActionId) => {
    switch (actionId) {
      case 'view':
      case 'edit':
        editForm.reset({ title: article.title, category: article.category, author: article.author, status: article.status, content: 'Nội dung bài viết...' })
        setEditTarget(article)
        break
      case 'approve':
      case 'publish':
        contentService.updateArticleStatus(article.id, 'Đã xuất bản')
        setArticleList(contentService.listArticles())
        showToast(`Đã duyệt và xuất bản bài viết: ${article.title}`)
        break
      case 'delete':
        contentService.deleteArticle(article.id)
        setArticleList(contentService.listArticles())
        showToast(`Đã xóa bài viết`)
        break
    }
  }

  const handleCreate = () => {
    const { title, category, author, status } = createForm.values
    contentService.createArticle({ title, category, author, status: status as ArticleStatus })
    setArticleList(contentService.listArticles())
    showToast(`Đã tạo bài viết: ${title}`)
    setCreateOpen(false)
    createForm.reset({ title: '', category: 'Cẩm nang Agrisage', author: 'Admin', status: 'Bản nháp', content: '' })
  }

  const handleEdit = () => {
    if (!editTarget) return
    const { title, category, author, status } = editForm.values
    contentService.updateArticle(editTarget.id, { title, category, author, status: status as ArticleStatus })
    setArticleList(contentService.listArticles())
    showToast(`Đã cập nhật bài viết: ${title}`)
    setEditTarget(null)
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8 w-full px-2">
      <div className="flex items-start justify-between mt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold text-on-surface">Quản lý Bài viết</h1>
          <p className="text-on-surface-variant text-sm">Hệ thống CMS quản lý cẩm nang, tin tức và cảnh báo cho người dùng.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#171833] hover:bg-black text-white rounded font-medium text-sm shadow-sm transition-colors"
            onClick={() => setCreateOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">edit_document</span>
            Viết bài mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Tổng bài viết</span>
          <div className="text-3xl font-medium text-on-surface">{articleList.length}</div>
        </div>
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-emerald-700 font-medium">Đã xuất bản</span>
          <div className="text-3xl font-medium text-emerald-700">{articleList.filter(a => a.status === 'Đã xuất bản').length}</div>
        </div>
        <div className="p-4 rounded-xl border-2 border-amber-400/80 bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-amber-700 font-medium">Chờ duyệt</span>
          <div className="text-3xl font-medium text-amber-700">{articleList.filter(a => a.status === 'Chờ duyệt').length}</div>
        </div>
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Tổng lượt xem</span>
          <div className="text-3xl font-medium text-on-surface">{articleList.reduce((acc, curr) => acc + curr.views, 0)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="relative w-[320px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input 
            type="text" 
            placeholder="Tìm kiếm tiêu đề hoặc tác giả..." 
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-on-surface">
            <span className="text-on-surface-variant font-medium">Trạng thái:</span>
            <select className="bg-transparent font-medium outline-none cursor-pointer border-b border-dashed border-outline-variant pb-0.5" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="Đã xuất bản">Đã xuất bản</option>
              <option value="Chờ duyệt">Chờ duyệt</option>
              <option value="Bản nháp">Bản nháp</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border border-outline-variant/60 rounded-xl overflow-hidden bg-white shadow-sm mt-2 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container-lowest border-b border-outline-variant/60">
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[35%] uppercase tracking-wider">Tiêu đề</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[15%] uppercase tracking-wider">Tác giả</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[15%] uppercase tracking-wider text-center">Ngày xuất bản</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[10%] uppercase tracking-wider">Lượt xem</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Trạng thái</th>
                <th className="py-3 px-2 w-[5%]"></th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/60">
              {filteredArticles.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant">Không tìm thấy bài viết phù hợp.</td>
                </tr>
              )}
              {paginatedArticles.map((article) => {
                return (
                  <tr key={article.id} className="transition-colors group hover:bg-surface-container-low">
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0 overflow-hidden">
                          <span className="material-symbols-outlined text-[24px]">image</span>
                        </div>
                        <div className="min-w-0">
                          <div 
                            className="font-medium text-on-surface text-sm truncate hover:underline cursor-pointer"
                            onClick={() => handleAction(article, 'edit')}
                          >
                            {article.title}
                          </div>
                          <div className="text-[11px] text-primary mt-0.5 truncate">{article.category}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                          {article.author.charAt(0)}
                        </div>
                        <span className="truncate">{article.author}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center text-on-surface-variant">
                      {article.publishedAt}
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center font-mono text-on-surface-variant">
                      {article.views.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className={`px-2.5 py-1 rounded-md border text-[11px] tracking-wider font-semibold shadow-sm whitespace-nowrap uppercase
                        ${article.status === 'Đã xuất bản' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 
                          article.status === 'Chờ duyệt' ? 'border-amber-400 text-amber-700 bg-amber-50' : 
                          'border-outline-variant/60 text-on-surface-variant bg-surface-container-lowest'
                        }
                      `}>
                        {article.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowActionsMenu
                          triggerLabel="Thao tác"
                          actions={contentService.articleActionsFor(article.status).map(a => ({ ...a, onClick: () => handleAction(article, a.id) }))}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        <div className="px-4 py-3 bg-white flex items-center justify-between text-sm text-on-surface-variant border-t border-outline-variant/40">
          <div>Hiển thị {startIndex + 1} đến {endIndex} của {totalCount} bài viết</div>
          <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="" goPrev={goPrev} goNext={goNext} setPage={setPage} />
        </div>
      </div>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Viết bài mới"
        values={createForm.values}
        onChange={createForm.update}
        onSubmit={handleCreate}
        submitLabel="Lưu bài viết"
        fields={[
          { key: 'title', label: 'Tiêu đề bài viết', placeholder: 'Nhập tiêu đề...', required: true },
          { key: 'category', label: 'Chuyên mục', type: 'select', options: ['Kỹ thuật canh tác', 'Tin tức thị trường', 'Cảnh báo thời tiết', 'Cẩm nang Agrisage'] },
          { key: 'author', label: 'Tác giả', placeholder: 'Tên tác giả...' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ['Bản nháp', 'Chờ duyệt', 'Đã xuất bản'] },
          { key: 'content', label: 'Nội dung (Rich Text Editor giả lập)', type: 'text', placeholder: 'Soạn thảo nội dung ở đây...' },
        ]}
      />

      <FormModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `Sửa bài viết: ${editTarget.title}` : 'Sửa bài viết'}
        values={editForm.values}
        onChange={editForm.update}
        onSubmit={handleEdit}
        submitLabel="Lưu thay đổi"
        fields={[
          { key: 'title', label: 'Tiêu đề bài viết', placeholder: 'Nhập tiêu đề...', required: true },
          { key: 'category', label: 'Chuyên mục', type: 'select', options: ['Kỹ thuật canh tác', 'Tin tức thị trường', 'Cảnh báo thời tiết', 'Cẩm nang Agrisage'] },
          { key: 'author', label: 'Tác giả', placeholder: 'Tên tác giả...' },
          { key: 'status', label: 'Trạng thái', type: 'select', options: ['Bản nháp', 'Chờ duyệt', 'Đã xuất bản'] },
          { key: 'content', label: 'Nội dung (Rich Text Editor giả lập)', type: 'text', placeholder: 'Soạn thảo nội dung ở đây...' },
        ]}
      />
    </div>
  )
}
