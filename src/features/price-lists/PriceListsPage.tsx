import ListToolbar from '@/components/ui/ListToolbar'
import { LIST_PAGE_SIZE } from '@/utils/pagination';
import PermissionAction from '@/components/auth/PermissionAction'
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { priceListsApi, type PriceList, type PriceListStatus } from '@/api/priceListsApi';
import type { Paged } from '@/api/types';

import EmptyTableRow from '@/components/ui/EmptyTableRow'
import StatusBadge from '@/components/ui/StatusBadge'
import ServerPagination from '@/components/ui/ServerPagination'
import PromptModal, { type PromptField } from '@/components/ui/PromptModal';
import { describeApiError } from '@/utils/apiError';
import { formatDay, todayVn, useCanManage } from '@/utils/creditLabels';
import PriceListItemsModal from './PriceListItemsModal'
import ListReportCards from '@/features/agent/reports/ListReportCards'

const PAGE_SIZE = LIST_PAGE_SIZE

const STATUS: Record<PriceListStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'bg-amber-50 text-amber-800 border border-amber-200' },
  ACTIVE: { label: 'Đang áp dụng', className: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  INACTIVE: { label: 'Ngưng áp dụng', className: 'bg-slate-100 text-slate-600 border border-slate-200' },
}


const iconButton = 'w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors'

type FormState = { list: PriceList | null } | null

// FE_GUIDE_FLOW_1 §M12 — the store owner (and admin) maintain price lists; sales staff only look prices up.
export default function PriceListsPage() {
  const canManage = useCanManage(["PRICING.CREATE", "PRICING.UPDATE", "PRICING.DELETE", "PRICING.ACTIVATE", "PRICING.DEACTIVATE"])
  usePageHeader({
    title: 'Bảng giá',
    subtitle: canManage ? 'Tạo bảng giá, nhập giá theo quy cách và chọn bảng giá khách lẻ' : 'Tra cứu giá bán theo quy cách',
  })
  const { showToast } = useToast()

  const [data, setData] = useState<Paged<PriceList> | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [hasWalkInDefault, setHasWalkInDefault] = useState(true)

  const [form, setForm] = useState<FormState>(null)
  const [saving, setSaving] = useState(false)
  const [itemsOf, setItemsOf] = useState<PriceList | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = async () => {
    setLoading(true)
    setListError(false)
    try {
      const [lists, walkIn] = await Promise.all([
        priceListsApi.getPriceLists({ search: debouncedSearch || undefined, status: status || undefined, page, pageSize: PAGE_SIZE }),
        priceListsApi.getPriceLists({ isWalkInDefault: true, status: 'ACTIVE', pageSize: 1 }),
      ])
      setData(lists)
      setHasWalkInDefault(walkIn.totalCount > 0)
    } catch (err) {
      showToast(describeApiError(err, 'Không tải được danh sách bảng giá'), 'error')
      setListError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, status])

  const changeFilter = (apply: () => void) => {
    apply()
    setPage(1)
  }

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action()
      showToast(success, 'success')
      await load()
    } catch (err) {
      showToast(describeApiError(err), 'error')
    }
  }

  const submitForm = async (values: Record<string, string>) => {
    if (!form) return
    if (values.effectiveTo && values.effectiveTo < values.effectiveFrom) {
      showToast('Ngày kết thúc phải sau ngày bắt đầu', 'error')
      return
    }
    const body = {
      name: values.name.trim(),
      effectiveFrom: values.effectiveFrom,
      effectiveTo: values.effectiveTo || null,
      isWalkInDefault: values.isWalkInDefault === 'true',
      description: values.description.trim() || null,
    }
    setSaving(true)
    try {
      if (form.list) {
        await priceListsApi.update(form.list.id, body)
        showToast('Đã cập nhật bảng giá', 'success')
      } else {
        const created = await priceListsApi.create({ ...body, code: values.code.trim() })
        showToast('Đã tạo bảng giá nháp. Hãy nhập giá rồi kích hoạt.', 'success')
        setItemsOf(created)
      }
      setForm(null)
      await load()
    } catch (err) {
      showToast(describeApiError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const formFields: PromptField[] = [
    ...(form?.list ? [] : [{ key: 'code', label: 'Mã bảng giá', required: true, placeholder: 'VD: BG-LE-2026', hint: 'Không đổi được sau khi tạo.' } as PromptField]),
    { key: 'name', label: 'Tên bảng giá', required: true, placeholder: 'VD: Giá bán lẻ vụ Đông Xuân' },
    { key: 'effectiveFrom', label: 'Áp dụng từ ngày', type: 'date', required: true },
    { key: 'effectiveTo', label: 'Đến ngày', type: 'date', hint: 'Để trống nếu không giới hạn.' },
    {
      key: 'isWalkInDefault',
      label: 'Dùng cho khách lẻ',
      type: 'select',
      required: true,
      options: [
        { value: 'false', label: 'Không — dùng cho nhóm khách' },
        { value: 'true', label: 'Có — bảng giá mặc định cho khách lẻ' },
      ],
      hint: 'Chỉ một bảng giá khách lẻ được áp dụng cùng lúc.',
    },
    { key: 'description', label: 'Mô tả', type: 'textarea' },
  ]

  const items = data?.items ?? []

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <ListReportCards title="Tổng hợp bảng giá" totalCount={data?.totalCount ?? null} unit="bảng giá" loading={loading} error={listError} metrics={[
        { label: 'Bảng giá nháp', value: items.filter(item => item.status === 'DRAFT').length },
        { label: 'Đang áp dụng', value: items.filter(item => item.status === 'ACTIVE').length },
        { label: 'Ngưng áp dụng', value: items.filter(item => item.status === 'INACTIVE').length },
      ]} />
      {!loading && !hasWalkInDefault && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Chưa có bảng giá khách lẻ đang áp dụng</p>
            <p className="mt-0.5">
              Mọi đơn bán tại quầy sẽ bị từ chối cho tới khi có một bảng giá khách lẻ được kích hoạt.
              {!canManage && ' Hãy báo chủ cửa hàng.'}
            </p>
          </div>
        </div>
      )}

      <ListToolbar search={{ value: search, onChange: (v) => changeFilter(() => setSearch(v)), placeholder: "Tìm theo mã hoặc tên bảng giá..." }} onClear={() => { setSearch(''); setStatus(''); setPage(1) }} actions={<>{canManage && (
            <PermissionAction codes={["PRICING.CREATE"]}><button type="button" className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center gap-1.5" onClick={() => setForm({ list: null })}>
              <Plus size={16} /> Tạo bảng giá
            </button></PermissionAction>
          )}</>}>
<select aria-label="Lọc trạng thái" className="h-10 px-3 rounded-[10px] border border-slate-200 bg-white text-sm text-slate-700" value={status} onChange={(e) => changeFilter(() => setStatus(e.target.value))}>
            <option value="">Mọi trạng thái</option>
            {Object.entries(STATUS).map(([value, s]) => (
              <option key={value} value={value}>{s.label}</option>
            ))}
          </select>
      </ListToolbar>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Bảng giá</th>
                <th className="py-3 px-3" scope="col">Hiệu lực</th>
                <th className="py-3 px-3" scope="col">Áp dụng cho</th>
                <th className="py-3 px-3 text-right" scope="col">Số giá</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                {canManage && <th className="py-3 px-4 text-right" scope="col">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {loading && !data ? (
                <EmptyTableRow colSpan={canManage ? 6 : 5} message="Đang tải dữ liệu..." />
              ) : items.length === 0 ? (
                <EmptyTableRow colSpan={canManage ? 6 : 5} message="Không tìm thấy bảng giá nào." />
              ) : (
                items.map((list) => (
                  <tr key={list.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setItemsOf(list)}>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{list.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">{list.code}</div>
                      {list.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{list.description}</div>}
                    </td>
                    <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap">
                      {formatDay(list.effectiveFrom)} → {list.effectiveTo ? formatDay(list.effectiveTo) : 'không giới hạn'}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {list.isWalkInDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-medium">
                            <CheckCircle2 size={12} /> Khách lẻ
                          </span>
                        )}
                        {list.groups?.map((g) => (
                          <span key={g.id} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">{g.name}</span>
                        ))}
                        {!list.isWalkInDefault && !list.groups?.length && <span className="text-xs text-slate-400">Chưa gắn nhóm</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums">{list.itemCount}</td>
                    <td className="py-3.5 px-3 text-center">
                      <StatusBadge label={STATUS[list.status]?.label ?? list.status} className={STATUS[list.status]?.className} />
                    </td>
                    {canManage && (
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <PermissionAction codes={["PRICING.UPDATE"]}><button type="button" title="Sửa thông tin" aria-label="Sửa thông tin" className={`${iconButton} text-slate-500 hover:bg-slate-100 hover:text-slate-900`} onClick={() => setForm({ list })}>
                          <Pencil size={15} />
                        </button></PermissionAction>
                        {list.status === 'ACTIVE' ? (
                          <PermissionAction codes={["PRICING.DEACTIVATE"]}><button
                            type="button"
                            title="Ngưng áp dụng"
                            aria-label="Ngưng áp dụng"
                            className={`${iconButton} text-rose-600 hover:bg-rose-50`}
                            onClick={() => {
                              const warn = list.isWalkInDefault ? '\nĐây là bảng giá khách lẻ: bán tại quầy sẽ bị từ chối cho tới khi kích hoạt bảng khác.' : ''
                              if (window.confirm(`Ngưng áp dụng bảng giá ${list.code}?${warn}`)) run(() => priceListsApi.deactivate(list.id), 'Đã ngưng áp dụng bảng giá')
                            }}
                          >
                            <PowerOff size={15} />
                          </button></PermissionAction>
                        ) : (
                          <PermissionAction codes={["PRICING.ACTIVATE"]}><button
                            type="button"
                            title="Kích hoạt"
                            aria-label="Kích hoạt"
                            className={`${iconButton} text-emerald-600 hover:bg-emerald-50`}
                            onClick={() => {
                              if (list.itemCount === 0 && !window.confirm('Bảng giá chưa có giá nào. Vẫn kích hoạt?')) return
                              run(() => priceListsApi.activate(list.id), 'Đã kích hoạt bảng giá')
                            }}
                          >
                            <Power size={15} />
                          </button></PermissionAction>
                        )}
                        {list.status === 'DRAFT' && (
                          <PermissionAction codes={["PRICING.DELETE"]}><button
                            type="button"
                            title="Xóa bảng giá nháp"
                            aria-label="Xóa bảng giá nháp"
                            className={`${iconButton} text-rose-500 hover:bg-rose-50`}
                            onClick={() => {
                              if (window.confirm(`Xóa bảng giá nháp ${list.code}?`)) run(() => priceListsApi.delete(list.id), 'Đã xóa bảng giá')
                            }}
                          >
                            <Trash2 size={15} />
                          </button></PermissionAction>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && (
          <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={data.totalCount} totalPages={data.totalPages} unitLabel="bảng giá" onPageChange={setPage} />
        )}
      </div>

      <PromptModal
        open={form !== null}
        title={form?.list ? `Sửa bảng giá ${form.list.code}` : 'Tạo bảng giá'}
        description={form?.list ? undefined : 'Bảng giá mới ở trạng thái nháp: nhập giá cho các quy cách rồi kích hoạt.'}
        fields={formFields}
        initialValues={
          form?.list
            ? {
                name: form.list.name,
                effectiveFrom: form.list.effectiveFrom.slice(0, 10),
                effectiveTo: form.list.effectiveTo?.slice(0, 10) ?? '',
                isWalkInDefault: String(form.list.isWalkInDefault),
                description: form.list.description ?? '',
              }
            : { effectiveFrom: todayVn(), isWalkInDefault: 'false' }
        }
        submitLabel={form?.list ? 'Lưu' : 'Tạo bảng giá'}
        loading={saving}
        onClose={() => setForm(null)}
        onSubmit={submitForm}
      />

      <PriceListItemsModal list={itemsOf} canEdit={canManage} onClose={() => setItemsOf(null)} onChanged={load} />
    </div>
  )
}
