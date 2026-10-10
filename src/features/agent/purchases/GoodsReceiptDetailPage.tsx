import PermissionAction from '@/components/auth/PermissionAction'
import ModalLayout from '@/components/ui/ModalLayout'
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { describeError } from '@/api/client';
import { goodsReceiptsApi, type GoodsReceipt, type GoodsReceiptItem } from '@/api/goodsReceiptsApi';
import ConfirmModal from '@/components/ui/ConfirmModal'
import DetailModal from '@/components/ui/DetailModal'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { formatVnd } from '@/utils/money';
import { formatDate, formatDateTime, formatQty } from '@/utils/units';
import ReceiptLineModal from './ReceiptLineModal'
import SupplierSelect from './SupplierSelect'
import { RECEIPTS_BASE, RECEIPT_SOURCE_LABEL, RECEIPT_STATUS_BADGE_CLASS, RECEIPT_STATUS_LABEL, isoToLocalInput, localInputToIso, nowLocalInput } from './receiptLabels';

type Dialog = null | 'confirm' | 'cancel' | 'delete'

const inputClassName =
  'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'

export default function GoodsReceiptDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [receipt, setReceipt] = useState<GoodsReceipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [lineEditor, setLineEditor] = useState<GoodsReceiptItem | 'new' | null>(null)
  const [itemToRemove, setItemToRemove] = useState<GoodsReceiptItem | null>(null)
  const [headerOpen, setHeaderOpen] = useState(false)

  usePageHeader({ title: receipt ? `Phiếu nhập ${receipt.receiptNumber}` : 'Phiếu nhập hàng', subtitle: 'Các dòng hàng, lô và hạn dùng; xác nhận để cộng vào kho' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setReceipt(await goodsReceiptsApi.get(id))
      setLoadError(null)
    } catch (err) {
      setLoadError(describeError(err, 'Không tải được phiếu nhập'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const run = async (action: () => Promise<GoodsReceipt | void>, onOk: (r: GoodsReceipt | void) => void, failure: string) => {
    setBusy(true)
    try {
      onOk(await action())
      setDialog(null)
    } catch (err) {
      showToast(describeError(err, failure), 'error')
    } finally {
      setBusy(false)
    }
  }

  const removeItem = async () => {
    if (!itemToRemove) return
    setBusy(true)
    try {
      setReceipt(await goodsReceiptsApi.removeItem(id, itemToRemove.id))
      showToast('Đã xóa dòng hàng', 'success')
      setItemToRemove(null)
    } catch (err) {
      showToast(describeError(err, 'Không xóa được dòng hàng'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !receipt) return <div className="max-w-[1600px] mx-auto p-space-md text-on-surface-variant animate-pulse">Đang tải phiếu nhập...</div>
  if (!receipt) {
    return (
      <div className="max-w-[1600px] mx-auto p-space-md flex flex-col gap-3">
        <p className="text-rose-700">{loadError ?? 'Không tìm thấy phiếu nhập.'}</p>
        <Link to={RECEIPTS_BASE} className="text-emerald-700 font-medium hover:underline">
          Về danh sách phiếu nhập
        </Link>
      </div>
    )
  }

  const draft = receipt.status === 'DRAFT'
  const cannotConfirm = receipt.items.length === 0 ? 'Thêm ít nhất một dòng hàng để xác nhận.' : null

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={RECEIPTS_BASE} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} /> Danh sách phiếu nhập
          </Link>
          <span className="font-mono font-bold text-slate-900">{receipt.receiptNumber}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${RECEIPT_STATUS_BADGE_CLASS[receipt.status]}`}>{RECEIPT_STATUS_LABEL[receipt.status]}</span>
          <span className="text-xs text-slate-500">{RECEIPT_SOURCE_LABEL[receipt.sourceType] ?? receipt.sourceType}</span>
        </div>
        {draft ? (
          <div className="flex flex-wrap items-center gap-2">
            <PermissionAction codes={["GOODS_RECEIPTS.DELETE"]}><button type="button" onClick={() => setDialog('delete')} className="h-10 px-3 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 text-sm font-medium shadow-sm">
              Xóa phiếu nháp
            </button></PermissionAction>
            <PermissionAction codes={["GOODS_RECEIPTS.CANCEL"]}><button type="button" onClick={() => setDialog('cancel')} className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm">
              Hủy phiếu
            </button></PermissionAction>
            <PermissionAction codes={["GOODS_RECEIPTS.CONFIRM"]}><button
              type="button"
              onClick={() => setDialog('confirm')}
              disabled={cannotConfirm !== null}
              title={cannotConfirm ?? undefined}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 size={16} /> Xác nhận nhập kho
            </button></PermissionAction>
          </div>
        ) : null}
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-3 text-sm flex-1">
            <div>
              <dt className="text-slate-500">Nhà cung cấp</dt>
              <dd className="font-medium">{receipt.supplierName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Số hóa đơn</dt>
              <dd className="font-medium font-mono">{receipt.supplierInvoiceNumber ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ngày hóa đơn</dt>
              <dd className="font-medium">{formatDate(receipt.supplierInvoiceDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Nhận hàng lúc</dt>
              <dd className="font-medium">{formatDateTime(receipt.receivedAt)}</dd>
            </div>
            {receipt.confirmedAt ? (
              <div>
                <dt className="text-slate-500">Xác nhận lúc</dt>
                <dd className="font-medium">{formatDateTime(receipt.confirmedAt)}</dd>
              </div>
            ) : null}
            {receipt.cancelledAt ? (
              <div className="col-span-2">
                <dt className="text-slate-500">Đã hủy lúc {formatDateTime(receipt.cancelledAt)}</dt>
                <dd className="font-medium">{receipt.cancelReason ?? 'Không ghi lý do'}</dd>
              </div>
            ) : null}
            {receipt.note ? (
              <div className="col-span-2 lg:col-span-4">
                <dt className="text-slate-500">Ghi chú</dt>
                <dd className="font-medium whitespace-pre-line">{receipt.note}</dd>
              </div>
            ) : null}
          </dl>
          {draft ? (
            <PermissionAction codes={["GOODS_RECEIPTS.UPDATE"]}><button type="button" onClick={() => setHeaderOpen(true)} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 shrink-0">
              <Pencil size={14} /> Sửa thông tin
            </button></PermissionAction>
          ) : null}
        </div>
      </div>

      {receipt.status === 'CONFIRMED' ? (
        <div className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Phiếu đã nhập kho: các lô được tạo hoặc cộng thêm và một phiếu kho nhập đã ghi sổ. Phiếu đã xác nhận không sửa hay hủy được; nếu nhập sai, dùng{' '}
          <Link to="/agent/inventory" className="font-medium underline">
            điều chỉnh kho
          </Link>{' '}
          ở màn Tồn kho, xem lại ở{' '}
          <Link to="/agent/inventory/movements" className="font-medium underline">
            Biến động kho
          </Link>
          .
        </div>
      ) : null}

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
          <h3 className="font-semibold text-on-surface">Các dòng hàng ({receipt.items.length})</h3>
          {draft ? (
            <PermissionAction codes={["GOODS_RECEIPTS.ADD_ITEM"]}><button type="button" onClick={() => setLineEditor('new')} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm">
              <Plus size={16} /> Thêm dòng hàng
            </button></PermissionAction>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 font-medium">Sản phẩm</th>
                <th className="py-3 px-3 font-medium">Lô / Hạn dùng</th>
                <th className="py-3 px-3 font-medium text-right">Số lượng nhập</th>
                <th className="py-3 px-3 font-medium text-right">Quy ra kho</th>
                <th className="py-3 px-3 font-medium text-right">Đơn giá nhập</th>
                <th className="py-3 px-3 font-medium text-right">Thành tiền</th>
                {draft ? <th className="py-3 px-4 font-medium text-right">Thao tác</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm">
              {receipt.items.length === 0 ? (
                <EmptyTableRow colSpan={draft ? 7 : 6} message={draft ? 'Chưa có dòng hàng. Bấm "Thêm dòng hàng" để nhập sản phẩm.' : 'Phiếu không có dòng hàng.'} />
              ) : (
                <>
                  {receipt.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-4">
                        <div className="font-medium">{it.productName}</div>
                        <div className="font-mono text-xs text-slate-500">{it.sku}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-xs">{it.supplierLotNumber ?? 'Không có số lô'}</div>
                        <div className="text-xs text-slate-500">{it.expiryDate ? `HSD ${formatDate(it.expiryDate)}` : 'Không có hạn'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        {formatQty(it.receivedQuantity)} {it.packagingName ?? it.unitName}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap">{formatQty(it.baseQuantity)} (đơn vị cơ sở)</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(it.purchaseUnitCost)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap font-semibold">{formatVnd(it.lineTotalAmount)}</td>
                      {draft ? (
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <PermissionAction codes={["GOODS_RECEIPTS.UPDATE"]}><button type="button" aria-label={`Sửa dòng ${it.productName}`} className="p-1.5 rounded text-slate-500 hover:text-emerald-700 hover:bg-slate-100" onClick={() => setLineEditor(it)}>
                            <Pencil size={16} />
                          </button></PermissionAction>
                          <PermissionAction codes={["GOODS_RECEIPTS.DELETE"]}><button type="button" aria-label={`Xóa dòng ${it.productName}`} className="p-1.5 rounded text-slate-500 hover:text-rose-700 hover:bg-slate-100" onClick={() => setItemToRemove(it)}>
                            <Trash2 size={16} />
                          </button></PermissionAction>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="py-2.5 px-4" colSpan={5}>
                      Tổng cộng
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(receipt.totalAmount)}</td>
                    {draft ? <td /> : null}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {lineEditor !== null ? (
        <ReceiptLineModal
          receiptId={id}
          item={lineEditor === 'new' ? null : lineEditor}
          onClose={() => setLineEditor(null)}
          onSaved={(r) => {
            setReceipt(r)
            setLineEditor(null)
          }}
        />
      ) : null}

      {headerOpen ? (
        <ReceiptHeaderModal
          receipt={receipt}
          onClose={() => setHeaderOpen(false)}
          onSaved={(r) => {
            setReceipt(r)
            setHeaderOpen(false)
          }}
        />
      ) : null}

      <PermissionAction codes={["GOODS_RECEIPTS.DELETE"]}><ConfirmModal
        open={itemToRemove !== null}
        title="Xóa dòng hàng"
        message={`Xóa dòng "${itemToRemove?.productName ?? ''}" khỏi phiếu nháp?`}
        confirmLabel="Xóa dòng"
        tone="danger"
        busy={busy}
        onConfirm={removeItem}
        onClose={() => setItemToRemove(null)}
      /></PermissionAction>

      <PermissionAction codes={["GOODS_RECEIPTS.CONFIRM"]}><ConfirmModal
        open={dialog === 'confirm'}
        title="Xác nhận nhập kho"
        message={
          <>
            <p>
              Phiếu có <strong>{receipt.items.length} dòng</strong>, tổng <strong>{formatVnd(receipt.totalAmount)}</strong>. Hệ thống kiểm tra từng dòng (số lô, hạn dùng, hàng chưa hết hạn), tạo hoặc cộng vào các lô, tính lại giá vốn bình quân và ghi
              một phiếu nhập kho.
            </p>
            <p className="mt-2 text-slate-500">Sau khi xác nhận, phiếu không sửa hay hủy được; nhập sai thì sửa bằng điều chỉnh kho.</p>
          </>
        }
        confirmLabel="Xác nhận nhập kho"
        busy={busy}
        onConfirm={() =>
          run(
            () => goodsReceiptsApi.confirm(id),
            (r) => {
              if (!r) return
              setReceipt(r)
              showToast('Đã nhập kho thành công', 'success')
            },
            'Không xác nhận được phiếu nhập',
          )
        }
        onClose={() => setDialog(null)}
      /></PermissionAction>

      <ConfirmModal
        open={dialog === 'cancel'}
        title="Hủy phiếu nhập"
        message="Phiếu nháp bị hủy, không có hàng nào được nhập kho."
        confirmLabel="Hủy phiếu"
        tone="danger"
        busy={busy}
        onConfirm={() =>
          run(
            () => goodsReceiptsApi.cancel(id, cancelReason.trim()),
            (r) => r && setReceipt(r),
            'Không hủy được phiếu',
          )
        }
        onClose={() => setDialog(null)}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="gr-cancel">
            Lý do (không bắt buộc)
          </label>
          <textarea id="gr-cancel" className="w-full min-h-[64px] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" maxLength={1000} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </div>
      </ConfirmModal>

      <PermissionAction codes={["GOODS_RECEIPTS.DELETE"]}><ConfirmModal
        open={dialog === 'delete'}
        title="Xóa phiếu nháp"
        message="Phiếu nháp sẽ bị xóa khỏi danh sách."
        confirmLabel="Xóa phiếu"
        tone="danger"
        busy={busy}
        onConfirm={() =>
          run(
            () => goodsReceiptsApi.remove(id),
            () => {
              showToast('Đã xóa phiếu nháp', 'success')
              navigate(RECEIPTS_BASE)
            },
            'Không xóa được phiếu',
          )
        }
        onClose={() => setDialog(null)}
      /></PermissionAction>
    </div>
  )
}

function ReceiptHeaderModal({ receipt, onClose, onSaved }: { receipt: GoodsReceipt; onClose: () => void; onSaved: (r: GoodsReceipt) => void }) {
  const { showToast } = useToast()
  const [supplierId, setSupplierId] = useState(receipt.supplierId)
  const [receivedAt, setReceivedAt] = useState(isoToLocalInput(receipt.receivedAt))
  const [invoiceNumber, setInvoiceNumber] = useState(receipt.supplierInvoiceNumber ?? '')
  const [invoiceDate, setInvoiceDate] = useState(receipt.supplierInvoiceDate ?? '')
  const [note, setNote] = useState(receipt.note ?? '')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const at = localInputToIso(receivedAt)
    if (!supplierId || !at) return
    setBusy(true)
    try {
      onSaved(
        await goodsReceiptsApi.updateHeader(receipt.id, {
          supplierId,
          receivedAt: at,
          supplierInvoiceNumber: invoiceNumber.trim() || null,
          supplierInvoiceDate: invoiceDate || null,
          note: note.trim() || null,
        }),
      )
      showToast('Đã cập nhật thông tin phiếu', 'success')
    } catch (err) {
      showToast(describeError(err, 'Không cập nhật được phiếu'), 'error')
      setBusy(false)
    }
  }

  return (
    <DetailModal open onClose={busy ? () => undefined : onClose} widthClassName="max-w-xl">
      <ModalLayout header={<h3 className="text-lg text-slate-900 font-bold">Sửa thông tin phiếu nhập</h3>} footer={<div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm shadow-sm disabled:opacity-50" onClick={onClose} disabled={busy}>
          Hủy
        </button>
        <PermissionAction codes={["GOODS_RECEIPTS.UPDATE"]}><button type="button" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm disabled:opacity-50" onClick={submit} disabled={busy || !supplierId}>
          {busy ? 'Đang lưu...' : 'Lưu'}
        </button></PermissionAction>
      </div>} bodyClassName="space-y-4"><div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="rh-supplier">
            Nhà cung cấp *
          </label>
          <SupplierSelect id="rh-supplier" value={supplierId} onChange={setSupplierId} />
        </div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rh-at">
              Thời điểm nhận hàng
            </label>
            <input id="rh-at" type="datetime-local" className={inputClassName} value={receivedAt} max={nowLocalInput()} onChange={(e) => setReceivedAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rh-inv">
              Số hóa đơn
            </label>
            <input id="rh-inv" className={inputClassName} maxLength={100} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="rh-invdate">
              Ngày hóa đơn
            </label>
            <input id="rh-invdate" type="date" className={inputClassName} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
        </div><div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="rh-note">
            Ghi chú
          </label>
          <textarea id="rh-note" className="w-full min-h-[64px] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </ModalLayout>
    </DetailModal>
  )
}
