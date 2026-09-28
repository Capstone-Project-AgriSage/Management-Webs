import { useState } from 'react'

import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import FormModal from '../../components/ui/FormModal'
import Pagination from '../../components/ui/Pagination'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { useFormValues } from '../../hooks/useFormValues'
import * as aiService from '../../services/aiService'
import type { AiPolicy, AiPolicyType, AiPolicyActionId } from '../../types'

export default function AiPolicyConfigsPage() {
  usePageHeader({ title: 'AI Policy', subtitle: 'Quản lý chính sách và quy tắc ứng xử của AI' })

  const [policyList, setPolicyList] = useState<AiPolicy[]>(() => aiService.listPolicies())
  const { showToast } = useToast()
  
  const [createOpen, setCreateOpen] = useState(false)
  const createForm = useFormValues({ name: '', type: 'System Prompt', priority: 'Trung bình', content: '', isActive: true })

  const [editTarget, setEditTarget] = useState<AiPolicy | null>(null)
  const editForm = useFormValues({ name: '', type: 'System Prompt', priority: 'Trung bình', content: '', isActive: true })

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredPolicies,
  } = useFilteredList(
    policyList,
    '',
    (item, keyword, status) =>
      (!keyword ||
        item.name.toLowerCase().includes(keyword.toLowerCase()) ||
        item.content.toLowerCase().includes(keyword.toLowerCase())) &&
      (!status || item.type === (status as AiPolicyType)),
    '',
  )

  const {
    page,
    totalPages,
    paginated: paginatedPolicies,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredPolicies, 12)

  const activeCount = policyList.filter(p => p.isActive).length
  const inactiveCount = policyList.filter(p => !p.isActive).length

  const handleAction = (policy: AiPolicy, actionId: AiPolicyActionId) => {
    switch (actionId) {
      case 'edit':
        editForm.reset({ name: policy.name, type: policy.type, priority: policy.priority, content: policy.content, isActive: policy.isActive })
        setEditTarget(policy)
        break
      case 'toggle-active':
        aiService.togglePolicyActive(policy.id)
        setPolicyList(aiService.listPolicies())
        showToast(`Đã ${policy.isActive ? 'tắt' : 'bật'} quy tắc ${policy.name}`)
        break
      case 'delete':
        aiService.deletePolicy(policy.id)
        setPolicyList(aiService.listPolicies())
        showToast(`Đã xóa quy tắc ${policy.name}`)
        break
    }
  }

  const handleCreate = () => {
    const { name, type, priority, content, isActive } = createForm.values
    aiService.createPolicy({ 
      name, 
      type: type as AiPolicyType, 
      priority: priority as any, 
      content, 
      isActive: isActive as boolean 
    })
    setPolicyList(aiService.listPolicies())
    showToast(`Đã tạo quy tắc AI mới: ${name}`)
    setCreateOpen(false)
    createForm.reset({ name: '', type: 'System Prompt', priority: 'Trung bình', content: '', isActive: true })
  }

  const handleEdit = () => {
    if (!editTarget) return
    const { name, type, priority, content, isActive } = editForm.values
    aiService.updatePolicy(editTarget.id, { 
      name, 
      type: type as AiPolicyType, 
      priority: priority as any, 
      content, 
      isActive: isActive as boolean 
    })
    setPolicyList(aiService.listPolicies())
    showToast(`Đã cập nhật quy tắc: ${name}`)
    setEditTarget(null)
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8 w-full px-2">
      {/* HEADER ROW */}
      <div className="flex items-start justify-between mt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold text-on-surface">Chính sách & Quy tắc AI</h1>
          <p className="text-on-surface-variant text-sm">Thiết lập giới hạn, danh sách đen và hướng dẫn hành vi (System Prompts) cho Chatbot.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#171833] hover:bg-black text-white rounded font-medium text-sm shadow-sm transition-colors"
            onClick={() => setCreateOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Thêm quy tắc
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Tổng quy tắc</span>
          <div>
            <div className="text-3xl font-medium text-on-surface">{policyList.length}</div>
            <div className="text-xs text-on-surface-variant mt-1">Được định nghĩa trong hệ thống</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border-l-4 border-l-emerald-500 border-y border-r border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-emerald-700 font-medium">Đang áp dụng</span>
          <div>
            <div className="text-3xl font-medium text-emerald-700">{activeCount}</div>
            <div className="text-xs text-emerald-700/80 mt-1">Gửi kèm vào mỗi request của Chatbot</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border-l-4 border-l-outline border-y border-r border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Đang tắt</span>
          <div>
            <div className="text-3xl font-medium text-on-surface-variant">{inactiveCount}</div>
            <div className="text-xs text-on-surface-variant mt-1">Quy tắc tạm thời bị vô hiệu hóa</div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center justify-between mt-2">
        <div className="relative w-[320px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input 
            type="text" 
            placeholder="Tìm kiếm quy tắc hoặc nội dung..." 
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-on-surface">
            <span className="text-on-surface-variant font-medium">Loại quy tắc:</span>
            <select className="bg-transparent font-medium outline-none cursor-pointer border-b border-dashed border-outline-variant pb-0.5" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="System Prompt">System Prompt</option>
              <option value="Danh sách đen (Blocklist)">Danh sách đen (Blocklist)</option>
              <option value="Luật Fallback">Luật Fallback</option>
            </select>
          </div>
        </div>
      </div>

      {/* FLAT DATA TABLE */}
      <div className="border border-outline-variant/60 rounded-xl overflow-hidden bg-white shadow-sm mt-2 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container-lowest border-b border-outline-variant/60">
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[20%] uppercase tracking-wider">Tên quy tắc</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[15%] uppercase tracking-wider text-center">Phân loại</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[40%] uppercase tracking-wider">Nội dung cấu hình</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[10%] uppercase tracking-wider">Ưu tiên</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[10%] uppercase tracking-wider">Trạng thái</th>
                <th className="py-3 px-2 w-[5%]"></th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/60">
              {filteredPolicies.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant">Không tìm thấy quy tắc AI phù hợp.</td>
                </tr>
              )}
              {paginatedPolicies.map((policy) => {
                return (
                  <tr key={policy.id} className={`transition-colors group hover:bg-surface-container-low`}>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-on-surface text-sm truncate">
                            {policy.name}
                          </div>
                          <div className="text-[11px] text-outline font-mono mt-0.5 truncate">{policy.id} - Cập nhật: {policy.lastUpdated}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border 
                        ${policy.type === 'Danh sách đen (Blocklist)' ? 'border-error/40 text-error bg-error/5' : 
                          policy.type === 'System Prompt' ? 'border-blue-300 text-blue-700 bg-blue-50' : 
                          'border-amber-300 text-amber-700 bg-amber-50'}
                      `}>
                        {policy.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="text-sm text-on-surface-variant line-clamp-2 italic font-serif">
                        "{policy.content}"
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className={`text-xs font-medium 
                        ${policy.priority === 'Cao' ? 'text-error' : policy.priority === 'Trung bình' ? 'text-blue-600' : 'text-outline'}
                      `}>
                        {policy.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <button 
                        onClick={() => handleAction(policy, 'toggle-active')}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                          ${policy.isActive ? 'bg-primary' : 'bg-outline-variant'}
                        `}
                      >
                        <span className="sr-only">Toggle</span>
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${policy.isActive ? 'translate-x-2' : '-translate-x-2'}
                          `}
                        />
                      </button>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowActionsMenu
                          triggerLabel="Thao tác"
                          actions={aiService.policyActionsFor(policy.isActive).map(a => ({ ...a, onClick: () => handleAction(policy, a.id) }))}
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
          <div>
            Hiển thị {startIndex + 1} đến {endIndex} của {totalCount} quy tắc
          </div>
          <div className="flex items-center gap-6">
            <Pagination
              page={page}
              totalPages={totalPages}
              startIndex={startIndex}
              endIndex={endIndex}
              totalCount={totalCount}
              unitLabel=""
              goPrev={goPrev}
              goNext={goNext}
              setPage={setPage}
            />
          </div>
        </div>
      </div>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm quy tắc AI mới"
        values={createForm.values}
        onChange={createForm.update}
        onSubmit={handleCreate}
        submitLabel="Tạo quy tắc"
        fields={[
          { key: 'name', label: 'Tên quy tắc', placeholder: 'Ví dụ: Tone of voice', required: true },
          { key: 'type', label: 'Phân loại', type: 'select', options: ['System Prompt', 'Danh sách đen (Blocklist)', 'Luật Fallback'] },
          { key: 'priority', label: 'Mức độ ưu tiên', type: 'select', options: ['Cao', 'Trung bình', 'Thấp'] },
          { key: 'content', label: 'Nội dung chỉ thị (Prompt/Rule)', placeholder: 'Nhập nội dung hệ thống sẽ gửi cho LLM...', type: 'text', required: true },
        ]}
      />

      <FormModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `Sửa quy tắc: ${editTarget.name}` : 'Sửa quy tắc'}
        values={editForm.values}
        onChange={editForm.update}
        onSubmit={handleEdit}
        submitLabel="Lưu thay đổi"
        fields={[
          { key: 'name', label: 'Tên quy tắc', placeholder: 'Ví dụ: Tone of voice', required: true },
          { key: 'type', label: 'Phân loại', type: 'select', options: ['System Prompt', 'Danh sách đen (Blocklist)', 'Luật Fallback'] },
          { key: 'priority', label: 'Mức độ ưu tiên', type: 'select', options: ['Cao', 'Trung bình', 'Thấp'] },
          { key: 'content', label: 'Nội dung chỉ thị (Prompt/Rule)', placeholder: 'Nhập nội dung hệ thống sẽ gửi cho LLM...', type: 'text', required: true },
        ]}
      />
    </div>
  )
}
