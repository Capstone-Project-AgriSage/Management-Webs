import { useState } from 'react'

import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import RowActionsMenu from '../../components/ui/RowActionsMenu'
import FormModal from '../../components/ui/FormModal'
import DetailModal from '../../components/ui/DetailModal'
import Pagination from '../../components/ui/Pagination'
import { useFilteredList } from '../../hooks/useFilteredList'
import { usePagination } from '../../hooks/usePagination'
import { useFormValues } from '../../hooks/useFormValues'
import * as aiService from '../../services/aiService'
import type { AiModel, AiModelStatus, AiModelType, AiModelActionId } from '../../types'

export default function AiModelsPage() {
  usePageHeader({ title: 'AI Models', subtitle: 'Quản lý các mô hình Trí tuệ nhân tạo' })

  const [modelList, setModelList] = useState<AiModel[]>(() => aiService.listModels())
  const { showToast } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const createForm = useFormValues({ name: '', version: 'v1.0.0', type: 'Computer Vision', description: '' })

  const [metricsTarget, setMetricsTarget] = useState<AiModel | null>(null)

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered: filteredModels,
  } = useFilteredList(
    modelList,
    '',
    (item, keyword, status) =>
      (!keyword ||
        item.name.toLowerCase().includes(keyword.toLowerCase()) ||
        item.id.toLowerCase().includes(keyword.toLowerCase())) &&
      (!status || item.status === (status as AiModelStatus)),
    '',
  )

  const {
    page,
    totalPages,
    paginated: paginatedModels,
    startIndex,
    endIndex,
    totalCount,
    goPrev,
    goNext,
    setPage,
  } = usePagination(filteredModels, 12)

  const activeCount = modelList.filter(m => m.status === 'Đang chạy').length

  const handleAction = (model: AiModel, actionId: AiModelActionId) => {
    switch (actionId) {
      case 'deploy':
        aiService.updateModelStatus(model.id, 'Đang chạy')
        setModelList(aiService.listModels())
        showToast(`Đã khởi chạy mô hình ${model.name}`)
        break
      case 'pause':
        aiService.updateModelStatus(model.id, 'Đã dừng')
        setModelList(aiService.listModels())
        showToast(`Đã tạm dừng mô hình ${model.name}`)
        break
      case 'view-metrics':
        setMetricsTarget(model)
        break
    }
  }

  const handleCreate = () => {
    const { name, version, type, description } = createForm.values
    // Giả lập model mới luôn bắt đầu với 0% accuracy
    aiService.registerModel({ name, version, type: type as AiModelType, description, accuracy: 0 })
    setModelList(aiService.listModels())
    showToast(`Đã đăng ký huấn luyện mô hình ${name}`)
    setCreateOpen(false)
    createForm.reset({ name: '', version: 'v1.0.0', type: 'Computer Vision', description: '' })
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8 w-full px-2">
      {/* HEADER ROW */}
      <div className="flex items-start justify-between mt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold text-on-surface">Mô hình Trí tuệ Nhân tạo</h1>
          <p className="text-on-surface-variant text-sm">Quản lý, theo dõi hiệu suất và vòng đời của các model AI trong hệ thống.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#171833] hover:bg-black text-white rounded font-medium text-sm shadow-sm transition-colors"
            onClick={() => setCreateOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Đăng ký Model mới
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-on-surface-variant font-medium">Tổng số Models</span>
          <div>
            <div className="text-3xl font-medium text-on-surface">{modelList.length}</div>
            <div className="text-xs text-on-surface-variant mt-1">Đã đăng ký vào hệ thống</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-outline-variant bg-white flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-emerald-700 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">check_circle</span> Đang hoạt động (Active)</span>
          <div>
            <div className="text-3xl font-medium text-emerald-700">{activeCount}</div>
            <div className="text-xs text-emerald-700/80 mt-1">Đang phục vụ người dùng</div>
          </div>
        </div>
        <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 flex flex-col justify-between h-32 shadow-sm">
          <span className="text-sm text-primary font-medium flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">model_training</span> Đang huấn luyện (Training)</span>
          <div>
            <div className="text-3xl font-medium text-primary">{modelList.filter(m => m.status === 'Đang huấn luyện').length}</div>
            <div className="text-xs text-primary/80 mt-1">Jobs đang chạy trên Cluster</div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center justify-between mt-2">
        <div className="relative w-[320px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input 
            type="text" 
            placeholder="Tìm kiếm model theo tên hoặc ID..." 
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
              <option value="Đang chạy">Đang chạy</option>
              <option value="Đang huấn luyện">Đang huấn luyện</option>
              <option value="Đã dừng">Đã dừng</option>
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
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[25%] uppercase tracking-wider">Tên mô hình</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 w-[30%] uppercase tracking-wider">Mô tả & Loại</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Độ chính xác</th>
                <th className="py-3 px-4 font-semibold text-[13px] text-on-surface border-r border-outline-variant/40 text-center w-[15%] uppercase tracking-wider">Trạng thái</th>
                <th className="py-3 px-2 w-[5%]"></th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/60">
              {filteredModels.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-on-surface-variant">Không tìm thấy model phù hợp.</td>
                </tr>
              )}
              {paginatedModels.map((model) => {
                return (
                  <tr key={model.id} className={`transition-colors group hover:bg-surface-container-low`}>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${model.type === 'Computer Vision' ? 'bg-blue-100 text-blue-700' : model.type === 'NLP/Chatbot' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          <span className="material-symbols-outlined text-[20px]">
                            {model.type === 'Computer Vision' ? 'visibility' : model.type === 'NLP/Chatbot' ? 'forum' : 'analytics'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-on-surface text-sm truncate">
                            {model.name}
                            <span className="ml-2 text-xs font-mono text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">{model.version}</span>
                          </div>
                          <div className="text-[11px] text-outline font-mono mt-0.5 truncate">#{model.id} - Cập nhật: {model.lastUpdated}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-primary">{model.type}</span>
                        <span className="text-sm text-on-surface-variant truncate max-w-[300px]">{model.description}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <div className="flex flex-col items-center gap-1 w-full max-w-[120px] mx-auto">
                        <span className="font-medium text-on-surface">{model.accuracy}%</span>
                        <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${model.accuracy > 80 ? 'bg-emerald-500' : model.accuracy > 50 ? 'bg-amber-500' : 'bg-error'}`} style={{ width: `${model.accuracy}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 border-r border-outline-variant/40 text-center">
                      <span className={`px-2.5 py-1 rounded-md border text-[11px] tracking-wider font-semibold shadow-sm whitespace-nowrap uppercase
                        ${model.status === 'Đang chạy' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 
                          model.status === 'Đang huấn luyện' ? 'border-primary/30 text-primary bg-primary/5' : 
                          'border-outline-variant/60 text-on-surface-variant bg-surface-container-lowest'
                        }
                      `}>
                        {model.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowActionsMenu
                          triggerLabel="Thao tác"
                          actions={aiService.modelActionsFor(model.status).map(a => ({ ...a, onClick: () => handleAction(model, a.id) }))}
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
            Hiển thị {startIndex + 1} đến {endIndex} của {totalCount} model
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
        title="Đăng ký Mô hình AI mới"
        values={createForm.values}
        onChange={createForm.update}
        onSubmit={handleCreate}
        submitLabel="Đăng ký & Bắt đầu Huấn luyện"
        fields={[
          { key: 'name', label: 'Tên mô hình', placeholder: 'Ví dụ: Sâu keo mùa mưa', required: true },
          { key: 'version', label: 'Phiên bản (Version)', placeholder: 'v1.0.0', required: true },
          { key: 'type', label: 'Loại mô hình', type: 'select', options: ['Computer Vision', 'NLP/Chatbot', 'Dự báo (Prediction)'] },
          { key: 'description', label: 'Mô tả ngắn', placeholder: 'Mục đích sử dụng của model này...', type: 'text' },
        ]}
      />

      <DetailModal open={metricsTarget !== null} onClose={() => setMetricsTarget(null)} widthClassName="max-w-3xl">
        {metricsTarget && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-on-surface">Hiệu suất: {metricsTarget.name}</h2>
                <div className="text-sm text-outline font-mono mt-1">ID: {metricsTarget.id} | Phiên bản: {metricsTarget.version}</div>
              </div>
              <span className={`px-3 py-1 rounded-full font-semibold text-xs border uppercase
                ${metricsTarget.status === 'Đang chạy' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 
                  metricsTarget.status === 'Đang huấn luyện' ? 'border-primary/30 text-primary bg-primary/5' : 
                  'border-outline-variant/60 text-on-surface-variant bg-surface-container-lowest'
                }`}>{metricsTarget.status}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="border border-outline-variant/40 rounded-lg p-4 bg-surface-container-lowest text-center">
                <div className="text-xs text-on-surface-variant font-medium mb-1">Độ chính xác (Accuracy)</div>
                <div className="text-2xl font-bold text-emerald-600">{metricsTarget.accuracy}%</div>
              </div>
              <div className="border border-outline-variant/40 rounded-lg p-4 bg-surface-container-lowest text-center">
                <div className="text-xs text-on-surface-variant font-medium mb-1">Độ trễ (Latency)</div>
                <div className="text-2xl font-bold text-blue-600">120ms</div>
              </div>
              <div className="border border-outline-variant/40 rounded-lg p-4 bg-surface-container-lowest text-center">
                <div className="text-xs text-on-surface-variant font-medium mb-1">Request / Giây (RPS)</div>
                <div className="text-2xl font-bold text-purple-600">45.2</div>
              </div>
            </div>

            {/* Giả lập biểu đồ */}
            <div className="border border-outline-variant/40 rounded-lg p-4 bg-surface-container-lowest mb-6">
              <div className="text-sm font-semibold text-on-surface mb-4">Lịch sử Độ chính xác qua các Epoch</div>
              <div className="h-48 w-full bg-white border border-outline-variant/20 rounded relative overflow-hidden flex items-end p-2 gap-2">
                {/* Các thanh biểu đồ cứng */}
                {[20, 35, 50, 65, 75, 82, 88, 92, 94, metricsTarget.accuracy].map((val, idx) => (
                  <div key={idx} className="flex-1 bg-primary/20 rounded-t hover:bg-primary/40 transition-colors relative group">
                    <div className="absolute bottom-0 w-full bg-primary rounded-t" style={{ height: `${val}%` }}></div>
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10">Epoch {idx+1}: {val}%</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 bg-surface-container-low text-on-surface rounded font-medium hover:bg-outline-variant/50 transition-colors" onClick={() => setMetricsTarget(null)}>Đóng</button>
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  )
}
