import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { ApiError, describeError } from '@/api/client'
import { suppliersApi, type Supplier, type SupplierInput } from '@/api/suppliersApi'
import type { Paged } from '@/api/types'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import DetailModal from '@/components/ui/DetailModal'
import ConfirmModal from '@/components/ui/ConfirmModal'

const PAGE_SIZE = 10

const inputClassName =
  'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'

const EMPTY: SupplierInput = {
  code: '',
  name: '',
  taxCode: '',
  phoneNumber: '',
  email: '',
  contactPerson: '',
  addressLine: '',
  ward: '',
  district: '',
  province: '',
  note: '',
}

const clean = (v: string | null | undefined) => (v && v.trim() !== '' ? v.trim() : null)

export default function SuppliersPage() {
  usePageHeader({ title: 'Nhà cung cấp', subtitle: 'Danh sách nơi nhập hàng; nhà cung cấp đã có phiếu nhập chỉ ngừng hợp tác, không xóa được' })
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [activeFilter, setActiveFilter] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<Supplier> | null>(null)
  const [loading, setLoading] = useState(false)
  const request = useRef(0)

  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Supplier | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const id = ++request.current
    setLoading(true)
    try {
      const res = await suppliersApi.list({
        search: debouncedSearch.trim() || undefined,
        isActive: activeFilter === '' ? undefined : activeFilter === 'true',
        page,
        pageSize: PAGE_SIZE,
      })
      if (id === request.current) setData(res)
    } catch (err) {
      if (id === request.current) showToast(describeError(err, 'Không tải được danh sách nhà cung cấp'), 'error')
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [debouncedSearch, activeFilter, page, showToast])

  useEffect(() => {
    load()
  }, [load])

  const toggleActive = async (s: Supplier) => {
    try {
      if (s.isActive) await suppliersApi.deactivate(s.id)
      else await suppliersApi.activate(s.id)
      showToast(s.isActive ? `Đã ngừng hợp tác với ${s.name}` : `Đã kích hoạt lại ${s.name}`, 'success')
      load()
    } catch (err) {
      showToast(describeError(err, 'Không đổi được trạng thái'), 'error')
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setBusy(true)
    try {
      await suppliersApi.remove(toDelete.id)
      showToast(`Đã xóa ${toDelete.name}`, 'success')
      setToDelete(null)
      load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        showToast('Nhà cung cấp này đã có phiếu nhập hàng nên không xóa được. Hãy chọn "Ngừng hợp tác".', 'warning')
        setToDelete(null)
      } else {
        showToast(describeError(err, 'Không xóa được nhà cung cấp'), 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  const items = data?.items ?? []

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm flex flex-wrap items-center gap-3 flex-1">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Tìm theo mã hoặc tên nhà cung cấp..."
            className="relative flex-1 min-w-[220px]"
          />
          <FilterSelect
            value={activeFilter}
            onChange={(v) => {
              setActiveFilter(v)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'true', label: 'Đang hợp tác' },
              { value: 'false', label: 'Ngừng hợp tác' },
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm"
        >
          <Plus size={16} /> Thêm nhà cung cấp
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 font-medium">Nhà cung cấp</th>
                <th className="py-3 px-3 font-medium">Liên hệ</th>
                <th className="py-3 px-3 font-medium">Địa chỉ</th>
                <th className="py-3 px-3 font-medium text-center">Trạng thái</th>
                <th className="py-3 px-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm">
              {loading && items.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Đang tải..." className="text-slate-500 animate-pulse" />
              ) : items.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Chưa có nhà cung cấp nào." />
              ) : (
                items.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-on-surface">{s.name}</div>
                      <div className="text-xs text-on-surface-variant">
                        <span className="font-mono">{s.code ?? 'Chưa có mã'}</span>
                        {s.taxCode ? ` · MST ${s.taxCode}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div>{s.contactPerson ?? '-'}</div>
                      <div className="text-xs text-on-surface-variant">{[s.phoneNumber, s.email].filter(Boolean).join(' · ') || ''}</div>
                    </td>
                    <td className="py-3 px-3 text-on-surface-variant">{[s.addressLine, s.ward, s.district, s.province].filter(Boolean).join(', ') || '-'}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide whitespace-nowrap ${s.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                      >
                        {s.isActive ? 'Đang hợp tác' : 'Ngừng hợp tác'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <PermissionAction codes={["SUPPLIERS.UPDATE"]}><button type="button" className="text-sm font-medium text-emerald-700 hover:text-emerald-800 mr-3" onClick={() => setEditing(s)}>
                        Sửa
                      </button></PermissionAction>
                      <PermissionAction codes={[s.isActive ? 'SUPPLIERS.DEACTIVATE' : 'SUPPLIERS.ACTIVATE']}><button type="button" className="text-sm font-medium text-slate-700 hover:text-slate-900 mr-3" onClick={() => toggleActive(s)}>
                        {s.isActive ? 'Ngừng hợp tác' : 'Kích hoạt lại'}
                      </button></PermissionAction>
                      <PermissionAction codes={["SUPPLIERS.DELETE"]}><button type="button" className="text-sm font-medium text-rose-700 hover:text-rose-800" onClick={() => setToDelete(s)}>
                        Xóa
                      </button></PermissionAction>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={data?.totalPages ?? 1}
          startIndex={(page - 1) * PAGE_SIZE}
          endIndex={Math.min(page * PAGE_SIZE, data?.totalCount ?? 0)}
          totalCount={data?.totalCount ?? 0}
          unitLabel="nhà cung cấp"
          goPrev={() => setPage((p) => Math.max(1, p - 1))}
          goNext={() => setPage((p) => Math.min(data?.totalPages ?? 1, p + 1))}
          setPage={setPage}
        />
      </div>

      {editing !== null ? (
        <SupplierFormModal
          supplier={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      ) : null}

      <PermissionAction codes={["SUPPLIERS.DELETE"]}><ConfirmModal
        open={toDelete !== null}
        title="Xóa nhà cung cấp"
        message={`Xóa "${toDelete?.name ?? ''}"? Nếu đã có phiếu nhập hàng từ nhà cung cấp này thì hệ thống sẽ từ chối, khi đó hãy chọn Ngừng hợp tác.`}
        confirmLabel="Xóa"
        tone="danger"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      /></PermissionAction>
    </div>
  )
}

function SupplierFormModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast()
  const [values, setValues] = useState<SupplierInput>(supplier ? { ...EMPTY, ...supplier } : EMPTY)
  const [busy, setBusy] = useState(false)

  const set = (key: keyof SupplierInput, value: string) => setValues((prev) => ({ ...prev, [key]: value }))
  const canSubmit = !busy && (values.name ?? '').trim().length > 0

  const submit = async () => {
    if (!canSubmit) return
    const body: SupplierInput = {
      code: clean(values.code),
      name: values.name.trim(),
      taxCode: clean(values.taxCode),
      phoneNumber: clean(values.phoneNumber),
      email: clean(values.email),
      contactPerson: clean(values.contactPerson),
      addressLine: clean(values.addressLine),
      ward: clean(values.ward),
      district: clean(values.district),
      province: clean(values.province),
      note: clean(values.note),
    }
    setBusy(true)
    try {
      if (supplier) await suppliersApi.update(supplier.id, body)
      else await suppliersApi.create(body)
      showToast(supplier ? 'Đã cập nhật nhà cung cấp' : 'Đã thêm nhà cung cấp', 'success')
      onSaved()
    } catch (err) {
      showToast(describeError(err, 'Không lưu được nhà cung cấp'), 'error')
      setBusy(false)
    }
  }

  const field = (key: keyof SupplierInput, label: string, props: { placeholder?: string; type?: string; maxLength?: number } = {}) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700" htmlFor={`sp-${key}`}>
        {label}
      </label>
      <input id={`sp-${key}`} className={inputClassName} value={values[key] ?? ''} onChange={(e) => set(key, e.target.value)} {...props} />
    </div>
  )

  return (
    <DetailModal open onClose={busy ? () => undefined : onClose} widthClassName="max-w-2xl">
      <ModalLayout header={<h3 className="text-lg text-slate-900 font-bold">{supplier ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}</h3>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm shadow-sm disabled:opacity-50" onClick={onClose} disabled={busy}>
          Hủy
        </button>
        <PermissionAction codes={[supplier ? 'SUPPLIERS.UPDATE' : 'SUPPLIERS.CREATE']}><button type="button" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm disabled:opacity-50" onClick={submit} disabled={!canSubmit}>
          {busy ? 'Đang lưu...' : 'Lưu'}
        </button></PermissionAction>
      </div>} bodyClassName="space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('name', 'Tên nhà cung cấp *', { maxLength: 255, placeholder: 'Ví dụ: Công ty Vật tư Nông nghiệp Miền Tây' })}
          {field('code', 'Mã nhà cung cấp', { maxLength: 50, placeholder: 'Bỏ trống nếu chưa có' })}
          {field('taxCode', 'Mã số thuế', { maxLength: 50 })}
          {field('contactPerson', 'Người liên hệ', { maxLength: 150 })}
          {field('phoneNumber', 'Số điện thoại', { maxLength: 20 })}
          {field('email', 'Email', { type: 'email' })}
        </div>{field('addressLine', 'Địa chỉ', { maxLength: 500 })}<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {field('ward', 'Phường/Xã', { maxLength: 150 })}
          {field('district', 'Quận/Huyện', { maxLength: 150 })}
          {field('province', 'Tỉnh/Thành phố', { maxLength: 150 })}
        </div><div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="sp-note">
            Ghi chú
          </label>
          <textarea
            id="sp-note"
            className="w-full min-h-[64px] px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            maxLength={1000}
            value={values.note ?? ''}
            onChange={(e) => set('note', e.target.value)}
          />
        </div>
      </ModalLayout>
    </DetailModal>
  )
}
