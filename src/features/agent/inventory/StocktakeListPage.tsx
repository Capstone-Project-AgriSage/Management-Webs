import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, X } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { describeError } from '@/api/client'
import { stocktakeApi, type StocktakeListItem, type StocktakeStatus } from '@/api/stocktakeApi'
import type { Paged } from '@/api/types'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import DetailModal from '@/components/ui/DetailModal'
import { formatDateTime } from '@/utils/units'
import ProductPicker, { type PickedProduct } from './ProductPicker'
import { STOCKTAKE_STATUS_BADGE_CLASS, STOCKTAKE_STATUS_LABEL } from './stockLabels'
import { useStocktakeBase } from './stocktakePaths'

const PAGE_SIZE = 10

export default function StocktakeListPage() {
  usePageHeader({ title: 'Kiểm kê kho', subtitle: 'Đếm hàng thực tế, đối chiếu với sổ kho và ghi nhận chênh lệch' })
  const { showToast } = useToast()
  const navigate = useNavigate()
  const base = useStocktakeBase()

  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<StocktakeListItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const request = useRef(0)

  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    const id = ++request.current
    setLoading(true)
    try {
      const res = await stocktakeApi.list({
        status: (status || undefined) as StocktakeStatus | undefined,
        search: debouncedSearch.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      if (id === request.current) setData(res)
    } catch (err) {
      if (id === request.current) showToast(describeError(err, 'Không tải được danh sách kiểm kê'), 'error')
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [status, debouncedSearch, page, showToast])

  useEffect(() => {
    load()
  }, [load])

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
            placeholder="Tìm theo mã phiếu kiểm kê..."
            className="relative flex-1 min-w-[220px]"
          />
          <FilterSelect
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              ...(Object.keys(STOCKTAKE_STATUS_LABEL) as StocktakeStatus[]).map((s) => ({ value: s, label: STOCKTAKE_STATUS_LABEL[s] })),
            ]}
          />
        </div>
        <PermissionAction codes={["STOCKTAKES.CREATE"]}><button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm"
        >
          <Plus size={16} /> Tạo phiếu kiểm kê
        </button></PermissionAction>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 font-medium">Mã phiếu</th>
                <th className="py-3 px-3 font-medium text-center">Trạng thái</th>
                <th className="py-3 px-3 font-medium text-center">Số lô</th>
                <th className="py-3 px-3 font-medium text-center">Đã đếm</th>
                <th className="py-3 px-3 font-medium text-center">Có chênh lệch</th>
                <th className="py-3 px-3 font-medium">Tạo lúc</th>
                <th className="py-3 px-4 font-medium">Hoàn thành lúc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm">
              {loading && items.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Đang tải..." className="text-slate-500 animate-pulse" />
              ) : items.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Chưa có phiếu kiểm kê nào." />
              ) : (
                items.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => navigate(`${base}/${s.id}`)}>
                    <td className="py-3 px-4 font-mono text-xs font-semibold">{s.stocktakeNumber}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide whitespace-nowrap ${STOCKTAKE_STATUS_BADGE_CLASS[s.status]}`}>
                        {STOCKTAKE_STATUS_LABEL[s.status]}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums">{s.lineCount}</td>
                    <td className="py-3 px-3 text-center tabular-nums">
                      {s.countedCount}/{s.lineCount}
                    </td>
                    <td className={`py-3 px-3 text-center tabular-nums ${s.differenceCount > 0 ? 'text-amber-700 font-semibold' : ''}`}>{s.differenceCount}</td>
                    <td className="py-3 px-3 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{formatDateTime(s.completedAt)}</td>
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
          unitLabel="phiếu kiểm kê"
          goPrev={() => setPage((p) => Math.max(1, p - 1))}
          goNext={() => setPage((p) => Math.min(data?.totalPages ?? 1, p + 1))}
          setPage={setPage}
        />
      </div>

      <p className="text-xs text-slate-500 flex items-start gap-2">
        <ClipboardList size={14} className="mt-0.5 shrink-0" />
        Người đếm và người duyệt hoàn thành phải là hai người khác nhau: nhân viên đếm và lưu số liệu, Chủ cửa hàng (hoặc Admin) kiểm tra rồi hoàn thành.
      </p>

      {createOpen ? (
        <CreateStocktakeModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            navigate(`${base}/${id}`)
          }}
        />
      ) : null}
    </div>
  )
}

function CreateStocktakeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { showToast } = useToast()
  const [scope, setScope] = useState<'ALL' | 'PICK'>('ALL')
  const [picked, setPicked] = useState<PickedProduct[]>([])
  const [pickerKey, setPickerKey] = useState(0)
  const [includeEmpty, setIncludeEmpty] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const canSubmit = !busy && (scope === 'ALL' || picked.length > 0)

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      const created = await stocktakeApi.create({
        storeProductIds: scope === 'PICK' ? picked.map((p) => p.storeProductId) : undefined,
        includeEmptyLots: includeEmpty,
        note: note.trim() || null,
      })
      showToast(`Đã tạo phiếu ${created.stocktakeNumber} với ${created.totals.lines} lô`, 'success')
      onCreated(created.id)
    } catch (err) {
      showToast(describeError(err, 'Không tạo được phiếu kiểm kê'), 'error')
      setBusy(false)
    }
  }

  return (
    <DetailModal open onClose={busy ? () => undefined : onClose} widthClassName="max-w-xl">
      <ModalLayout header={<div>
        <h3 className="text-lg text-slate-900 font-bold">Tạo phiếu kiểm kê</h3>
        <p className="text-sm text-slate-600 mt-1">Hệ thống chụp số tồn hiện tại của từng lô làm số liệu sổ sách để so với số đếm thực tế.</p>
      </div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm shadow-sm disabled:opacity-50" onClick={onClose} disabled={busy}>
          Hủy
        </button>
        <PermissionAction codes={["STOCKTAKES.CREATE"]}><button type="button" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm disabled:opacity-50" onClick={submit} disabled={!canSubmit}>
          {busy ? 'Đang tạo...' : 'Tạo phiếu'}
        </button></PermissionAction>
      </div>} bodyClassName="space-y-4"><div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Phạm vi kiểm kê">
          {(
            [
              ['ALL', 'Toàn bộ sản phẩm'],
              ['PICK', 'Chọn sản phẩm'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={scope === value}
              onClick={() => setScope(value)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${scope === value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              {label}
            </button>
          ))}
        </div>{scope === 'PICK' ? (
          <div className="space-y-2">
            <ProductPicker
              key={pickerKey}
              value={null}
              placeholder="Gõ mã hoặc tên rồi chọn để thêm..."
              onChange={(p) => {
                if (!p) return
                setPicked((prev) => (prev.some((x) => x.storeProductId === p.storeProductId) ? prev : [...prev, p]))
                setPickerKey((k) => k + 1)
              }}
            />
            {picked.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa chọn sản phẩm nào.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {picked.map((p) => (
                  <li key={p.storeProductId} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-slate-100 text-sm text-slate-800">
                    {p.productName}
                    <button
                      type="button"
                      aria-label={`Bỏ ${p.productName}`}
                      className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200"
                      onClick={() => setPicked((prev) => prev.filter((x) => x.storeProductId !== p.storeProductId))}
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}<label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 mt-0.5 accent-emerald-600" checked={includeEmpty} onChange={(e) => setIncludeEmpty(e.target.checked)} />
          <span>
            Gồm cả lô đã hết hàng (tồn 0)
            <span className="block text-xs text-slate-500">Bật khi muốn kiểm tra xem có hàng thực tế mà sổ kho ghi là hết.</span>
          </span>
        </label><div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="st-note">
            Ghi chú
          </label>
          <textarea
            id="st-note"
            className="w-full min-h-[64px] px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: Kiểm kê cuối tháng 10, kho thuốc BVTV"
          />
        </div>
      </ModalLayout>
    </DetailModal>
  )
}
