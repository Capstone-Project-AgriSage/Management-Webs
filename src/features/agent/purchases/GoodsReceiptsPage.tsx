import PermissionAction from '@/components/auth/PermissionAction'
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import ModalLayout from '@/components/ui/ModalLayout'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Plus } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { describeError } from '@/api/client'
import { goodsReceiptsApi, type GoodsReceiptListItem, type ReceiptStatus } from '@/api/goodsReceiptsApi'
import type { Paged } from '@/api/types'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import DetailModal from '@/components/ui/DetailModal'
import { formatVnd } from '@/utils/money'
import { formatDateTime } from '@/utils/units'
import SupplierSelect from './SupplierSelect'
import { RECEIPTS_BASE, RECEIPT_STATUS_BADGE_CLASS, RECEIPT_STATUS_LABEL, localInputToIso, nowLocalInput } from './receiptLabels'

const PAGE_SIZE = 10

const inputClassName =
  'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'

export default function GoodsReceiptsPage() {
  usePageHeader({ title: 'Phiếu nhập hàng', subtitle: 'Nhập hàng từ nhà cung cấp: tạo nháp, kiểm tra rồi xác nhận để cộng vào kho' })
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [status, setStatus] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<GoodsReceiptListItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const request = useRef(0)

  const load = useCallback(async () => {
    const id = ++request.current
    setLoading(true)
    try {
      const res = await goodsReceiptsApi.list({
        status: (status || undefined) as ReceiptStatus | undefined,
        supplierId: supplierId || undefined,
        search: debouncedSearch.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      if (id === request.current) setData(res)
    } catch (err) {
      if (id === request.current) showToast(describeError(err, 'Không tải được danh sách phiếu nhập'), 'error')
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [status, supplierId, debouncedSearch, page, showToast])

  useEffect(() => {
    load()
  }, [load])

  const items = data?.items ?? []

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <BusinessReportCards kind="purchases" searchResult={{ count: data?.totalCount ?? 0, unit: 'phiếu nhập' }} />
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm flex flex-wrap items-center gap-3 flex-1">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Tìm theo mã phiếu hoặc số hóa đơn..."
            className="relative flex-1 min-w-[220px]"
          />
          <FilterSelect
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={[{ value: '', label: 'Tất cả trạng thái' }, ...(Object.keys(RECEIPT_STATUS_LABEL) as ReceiptStatus[]).map((s) => ({ value: s, label: RECEIPT_STATUS_LABEL[s] }))]}
          />
          <div className="min-w-[220px]">
            <SupplierSelect
              value={supplierId}
              onChange={(v) => {
                setSupplierId(v)
                setPage(1)
              }}
              activeOnly={false}
              emptyLabel="Tất cả nhà cung cấp"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`${RECEIPTS_BASE}/import`}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm"
          >
            <FileSpreadsheet size={16} /> Nhập từ Excel
          </Link>
          <PermissionAction codes={["GOODS_RECEIPTS.CREATE"]}><button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm"
          >
            <Plus size={16} /> Tạo phiếu nhập
          </button></PermissionAction>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 font-medium">Mã phiếu</th>
                <th className="py-3 px-3 font-medium">Nhà cung cấp</th>
                <th className="py-3 px-3 font-medium">Số hóa đơn</th>
                <th className="py-3 px-3 font-medium">Ngày nhập</th>
                <th className="py-3 px-3 font-medium text-center">Số dòng</th>
                <th className="py-3 px-3 font-medium text-right">Tổng tiền</th>
                <th className="py-3 px-4 font-medium text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm">
              {loading && items.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Đang tải..." className="text-slate-500 animate-pulse" />
              ) : items.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Chưa có phiếu nhập nào." />
              ) : (
                items.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => navigate(`${RECEIPTS_BASE}/${r.id}`)}>
                    <td className="py-3 px-4 font-mono text-xs font-semibold">{r.receiptNumber}</td>
                    <td className="py-3 px-3">{r.supplierName}</td>
                    <td className="py-3 px-3 font-mono text-xs">{r.supplierInvoiceNumber ?? '-'}</td>
                    <td className="py-3 px-3 whitespace-nowrap">{formatDateTime(r.receivedAt)}</td>
                    <td className="py-3 px-3 text-center tabular-nums">{r.itemCount}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(r.totalAmount)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide whitespace-nowrap ${RECEIPT_STATUS_BADGE_CLASS[r.status]}`}>
                        {RECEIPT_STATUS_LABEL[r.status]}
                      </span>
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
          unitLabel="phiếu nhập"
          goPrev={() => setPage((p) => Math.max(1, p - 1))}
          goNext={() => setPage((p) => Math.min(data?.totalPages ?? 1, p + 1))}
          setPage={setPage}
        />
      </div>

      {createOpen ? (
        <CreateReceiptModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            navigate(`${RECEIPTS_BASE}/${id}`)
          }}
        />
      ) : null}
    </div>
  )
}

function CreateReceiptModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { showToast } = useToast()
  const [supplierId, setSupplierId] = useState('')
  const [receivedAt, setReceivedAt] = useState(nowLocalInput())
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const canSubmit = !busy && supplierId !== ''

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      const created = await goodsReceiptsApi.create({
        supplierId,
        receivedAt: localInputToIso(receivedAt),
        supplierInvoiceNumber: invoiceNumber.trim() || null,
        supplierInvoiceDate: invoiceDate || null,
        note: note.trim() || null,
      })
      showToast(`Đã tạo phiếu nháp ${created.receiptNumber}, hãy thêm các dòng hàng`, 'success')
      onCreated(created.id)
    } catch (err) {
      showToast(describeError(err, 'Không tạo được phiếu nhập'), 'error')
      setBusy(false)
    }
  }

  return (
    <DetailModal open onClose={busy ? () => undefined : onClose} widthClassName="max-w-xl">
      <ModalLayout header={<div>
        <h3 className="text-lg text-slate-900 font-bold">Tạo phiếu nhập hàng</h3>
        <p className="text-sm text-slate-600 mt-1">Phiếu tạo ở dạng nháp; bạn thêm các dòng hàng ở bước sau rồi mới xác nhận để cộng kho.</p>
      </div>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm shadow-sm disabled:opacity-50" onClick={onClose} disabled={busy}>
          Hủy
        </button>
        <PermissionAction codes={["GOODS_RECEIPTS.CREATE"]}><button type="button" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm disabled:opacity-50" onClick={submit} disabled={!canSubmit}>
          {busy ? 'Đang tạo...' : 'Tạo phiếu nháp'}
        </button></PermissionAction>
      </div>} bodyClassName="space-y-4"><div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="gr-supplier">
            Nhà cung cấp *
          </label>
          <SupplierSelect id="gr-supplier" value={supplierId} onChange={setSupplierId} />
        </div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="gr-received">
              Thời điểm nhận hàng
            </label>
            <input id="gr-received" type="datetime-local" className={inputClassName} value={receivedAt} max={nowLocalInput()} onChange={(e) => setReceivedAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="gr-inv">
              Số hóa đơn của nhà cung cấp
            </label>
            <input id="gr-inv" className={inputClassName} maxLength={100} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="gr-invdate">
              Ngày hóa đơn
            </label>
            <input id="gr-invdate" type="date" className={inputClassName} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
        </div><div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="gr-note">
            Ghi chú
          </label>
          <textarea id="gr-note" className="w-full min-h-[64px] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </ModalLayout>
    </DetailModal>
  )
}
