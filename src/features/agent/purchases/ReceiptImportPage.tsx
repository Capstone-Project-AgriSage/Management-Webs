import PermissionAction from '@/components/auth/PermissionAction'
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileUp, ListChecks } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { ApiError, describeError, saveBlob } from '@/api/client';
import { goodsReceiptsApi, type ReceiptHeaderInput, type ReceiptImportPreview } from '@/api/goodsReceiptsApi';
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { formatVnd } from '@/utils/money';
import { formatDate, formatQty } from '@/utils/units';
import SupplierSelect from './SupplierSelect'
import { RECEIPTS_BASE, importColumnLabel, localInputToIso, nowLocalInput, translateImportMessage } from './receiptLabels';

const MAX_BYTES = 2 * 1024 * 1024

const inputClassName =
  'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'

export default function ReceiptImportPage() {
  usePageHeader({ title: 'Nhập hàng từ Excel', subtitle: 'Tải mẫu, điền, kiểm tra từng dòng rồi tạo phiếu nháp' })
  const { showToast } = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [supplierId, setSupplierId] = useState('')
  const [receivedAt, setReceivedAt] = useState(nowLocalInput())
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ReceiptImportPreview | null>(null)
  const [fileProblem, setFileProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'template' | 'preview' | 'import'>(null)

  const header = (): ReceiptHeaderInput => ({
    supplierId,
    receivedAt: localInputToIso(receivedAt),
    supplierInvoiceNumber: invoiceNumber.trim() || null,
    supplierInvoiceDate: invoiceDate || null,
    note: note.trim() || null,
  })

  // Any change invalidates the checked preview: it must be checked again before importing.
  const changed = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPreview(null)
    setFileProblem(null)
  }

  const downloadTemplate = async () => {
    setBusy('template')
    try {
      const { blob, fileName } = await goodsReceiptsApi.downloadTemplate()
      saveBlob(blob, fileName ?? 'AgriSage-goods-receipt-template.xlsx')
    } catch (err) {
      showToast(describeError(err, 'Không tải được file mẫu'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const pickFile = (f: File | null) => {
    setPreview(null)
    setFileProblem(null)
    if (f && !f.name.toLowerCase().endsWith('.xlsx')) {
      setFile(null)
      setFileProblem('Chỉ nhận file Excel .xlsx.')
      return
    }
    if (f && f.size > MAX_BYTES) {
      setFile(null)
      setFileProblem('File quá lớn (tối đa 2 MB).')
      return
    }
    setFile(f)
  }

  const failure = (err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.errors?.file) {
      setFileProblem(err.errors.file.join(' '))
    } else if (err instanceof ApiError && err.status === 422 && err.errors) {
      const lines = Object.entries(err.errors).flatMap(([row, msgs]) => msgs.map((m) => `${row}: ${m}`))
      setFileProblem(`${err.detail ?? 'File có dòng không hợp lệ.'} ${lines.slice(0, 5).join(' | ')}`)
    } else {
      showToast(describeError(err, fallback), 'error')
    }
  }

  const check = async () => {
    if (!file || !supplierId) return
    setBusy('preview')
    setFileProblem(null)
    try {
      setPreview(await goodsReceiptsApi.previewImport(header(), file))
    } catch (err) {
      setPreview(null)
      failure(err, 'Không kiểm tra được file')
    } finally {
      setBusy(null)
    }
  }

  const create = async () => {
    if (!file || !supplierId || !preview) return
    setBusy('import')
    try {
      const receipt = await goodsReceiptsApi.importFile(header(), file)
      showToast(`Đã tạo phiếu nháp ${receipt.receiptNumber} với ${receipt.items.length} dòng, hãy kiểm tra rồi xác nhận`, 'success')
      navigate(`${RECEIPTS_BASE}/${receipt.id}`)
    } catch (err) {
      failure(err, 'Không tạo được phiếu từ file')
      setBusy(null)
    }
  }

  const allValid = preview !== null && preview.rowCount > 0 && preview.validRowCount === preview.rowCount
  const badRows = preview ? preview.rowCount - preview.validRowCount : 0

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <Link to={RECEIPTS_BASE} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 w-fit">
        <ArrowLeft size={16} /> Danh sách phiếu nhập
      </Link>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-on-surface">1. Tải file mẫu</h3>
            <p className="text-sm text-on-surface-variant">Mẫu có sẵn danh sách sản phẩm và quy cách nhập của cửa hàng, kèm hướng dẫn điền. Mỗi file tối đa 500 dòng, 2 MB.</p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm disabled:opacity-50"
          >
            <Download size={16} /> {busy === 'template' ? 'Đang tải...' : 'Tải file mẫu (.xlsx)'}
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-4">
        <h3 className="font-semibold text-on-surface">2. Thông tin phiếu và file đã điền</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="im-supplier">
              Nhà cung cấp *
            </label>
            <SupplierSelect id="im-supplier" value={supplierId} onChange={changed(setSupplierId)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="im-at">
              Thời điểm nhận hàng
            </label>
            <input id="im-at" type="datetime-local" className={inputClassName} value={receivedAt} max={nowLocalInput()} onChange={(e) => changed(setReceivedAt)(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="im-inv">
              Số hóa đơn
            </label>
            <input id="im-inv" className={inputClassName} maxLength={100} value={invoiceNumber} onChange={(e) => changed(setInvoiceNumber)(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="im-invdate">
              Ngày hóa đơn
            </label>
            <input id="im-invdate" type="date" className={inputClassName} value={invoiceDate} onChange={(e) => changed(setInvoiceDate)(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="im-note">
            Ghi chú
          </label>
          <input id="im-note" className={inputClassName} maxLength={1000} value={note} onChange={(e) => changed(setNote)(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInput} id="im-file" type="file" accept=".xlsx" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm">
            <FileUp size={16} /> Chọn file Excel
          </button>
          <span className="text-sm text-slate-600">{file ? `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)` : 'Chưa chọn file'}</span>
          <PermissionAction codes={["GOODS_RECEIPTS.PREVIEW_IMPORT"]}><button
            type="button"
            onClick={check}
            disabled={!file || !supplierId || busy !== null}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium shadow-sm disabled:opacity-50 ml-auto"
          >
            <ListChecks size={16} /> {busy === 'preview' ? 'Đang kiểm tra...' : 'Kiểm tra file'}
          </button></PermissionAction>
        </div>
        {fileProblem ? (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" role="alert">
            {fileProblem}
          </p>
        ) : null}
      </div>

      {preview ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant">
            <div>
              <h3 className="font-semibold text-on-surface">3. Kết quả kiểm tra: {preview.fileName ?? 'file'}</h3>
              <p className={`text-sm ${allValid ? 'text-emerald-700' : 'text-rose-700'}`}>
                {allValid
                  ? `Cả ${preview.rowCount} dòng đều hợp lệ, tổng ${formatVnd(preview.subtotalAmount)}.`
                  : `${badRows} trên ${preview.rowCount} dòng có lỗi. Sửa trong file Excel rồi chọn lại file để kiểm tra; chưa tạo phiếu được.`}
              </p>
            </div>
            <PermissionAction codes={["GOODS_RECEIPTS.IMPORT"]}><button
              type="button"
              onClick={create}
              disabled={!allValid || busy !== null}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm disabled:opacity-50"
            >
              {busy === 'import' ? 'Đang tạo...' : 'Tạo phiếu nhập nháp'}
            </button></PermissionAction>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
                <tr>
                  <th className="py-3 px-4 font-medium">Dòng</th>
                  <th className="py-3 px-3 font-medium">Sản phẩm</th>
                  <th className="py-3 px-3 font-medium">Quy cách</th>
                  <th className="py-3 px-3 font-medium text-right">Số lượng</th>
                  <th className="py-3 px-3 font-medium text-right">Đơn giá</th>
                  <th className="py-3 px-3 font-medium">Số lô</th>
                  <th className="py-3 px-3 font-medium">Hạn dùng</th>
                  <th className="py-3 px-3 font-medium text-right">Thành tiền</th>
                  <th className="py-3 px-4 font-medium">Lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50 text-sm">
                {preview.rows.length === 0 ? (
                  <EmptyTableRow colSpan={9} message="File không có dòng dữ liệu." />
                ) : (
                  preview.rows.map((r) => (
                    <tr key={r.rowNumber} className={r.errors.length > 0 ? 'bg-rose-50' : ''}>
                      <td className="py-2.5 px-4 tabular-nums">{r.rowNumber}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium">{r.productName ?? <span className="text-slate-400">Không nhận ra</span>}</div>
                        <div className="font-mono text-xs text-slate-500">{r.sku ?? ''}</div>
                      </td>
                      <td className="py-2.5 px-3">{r.packaging ?? '-'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{r.quantity === null ? '-' : formatQty(r.quantity)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{r.unitCost === null ? '-' : formatVnd(r.unitCost)}</td>
                      <td className="py-2.5 px-3 font-mono text-xs">{r.lotNumber ?? '-'}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{r.expiryDate ? formatDate(r.expiryDate) : '-'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{r.lineTotalAmount === null ? '-' : formatVnd(r.lineTotalAmount)}</td>
                      <td className="py-2.5 px-4 text-xs text-rose-700 min-w-[240px]">
                        {r.errors.map((e, i) => (
                          <div key={i}>
                            <strong>{importColumnLabel(e.column)}</strong>: {translateImportMessage(e.message)}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
