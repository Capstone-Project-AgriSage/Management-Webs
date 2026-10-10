import { usePermission } from '@/context/PermissionContext';
import PermissionAction from '@/components/auth/PermissionAction'
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { describeError } from '@/api/client';
import { returnsApi, type ReturnCondition, type ReturnItem, type SalesReturn } from '@/api/returnsApi';
import { stockApi } from '@/api/stockApi';
import ConfirmModal from '@/components/ui/ConfirmModal'
import { formatVnd } from '@/utils/money';
import { formatDate, formatDateTime, formatQty, unitLabel } from '@/utils/units';
import { CONDITION_LABEL, DISPOSITION_LABEL, RETURN_CONDITIONS, RETURN_REASONS, RETURN_STATUS_BADGE_CLASS, returnStatusText } from './returnLabels';
import RefundsPanel from '../refunds/RefundsPanel'
import { loadOrderInfo, type OrderItemInfo } from './returnContext';
import { useReturnsBase } from './returnPaths';

type Dialog = null | 'approve' | 'reject' | 'cancel' | 'receive' | 'complete'
type Inspectable = Exclude<ReturnCondition, 'PENDING_INSPECTION'>

const STEPS = ['Yêu cầu', 'Duyệt', 'Nhận hàng', 'Kiểm tra', 'Hoàn tiền']
const STEP_DONE: Record<string, number> = { REQUESTED: 0, APPROVED: 1, RECEIVED: 2, INSPECTED: 3, PARTIALLY_RESOLVED: 4, COMPLETED: 5 }

const cellInput =
  'h-9 px-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50'

export default function ReturnDetailPage() {
  const { id = '' } = useParams()
  const base = useReturnsBase()
  const { showToast } = useToast()
  const { has } = usePermission()
  const canManage = ['RETURNS.APPROVE', 'RETURNS.REJECT', 'RETURNS.COMPLETE_INSPECTION', 'REFUNDS.CREATE_RETURN', 'REFUNDS.COMPLETE_RETURN', 'REFUNDS.FAIL_RETURN', 'REFUNDS.CANCEL_RETURN'].some(has)

  const [ret, setRet] = useState<SalesReturn | null>(null)
  const [infos, setInfos] = useState<Map<string, OrderItemInfo>>(new Map())
  const [lots, setLots] = useState<Map<string, { lotNumber: string | null; expiryDate: string | null }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [inspection, setInspection] = useState<Record<string, { condition: Inspectable | ''; note: string }>>({})
  const [savingItem, setSavingItem] = useState<string | null>(null)
  const [toRemove, setToRemove] = useState<ReturnItem | null>(null)

  usePageHeader({ title: ret ? `Trả hàng ${ret.returnNumber}` : 'Trả hàng', subtitle: 'Duyệt, nhận hàng, kiểm tra tình trạng, nhập lại kho và hoàn tiền' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await returnsApi.get(id)
      setRet(r)
      setLoadError(null)
      const [info, returnable] = await Promise.all([loadOrderInfo(r.orderId), returnsApi.getReturnable(r.orderId).catch(() => null)])
      setInfos(info.items)
      const lotMap = new Map<string, { lotNumber: string | null; expiryDate: string | null }>()
      returnable?.items.forEach((i) => i.sources.forEach((s) => lotMap.set(s.inventoryLotId, { lotNumber: s.lotNumber, expiryDate: s.expiryDate })))
      const missing = [...new Set(r.items.map((i) => i.inventoryLotId))].filter((lotId) => !lotMap.has(lotId))
      await Promise.all(
        missing.map(async (lotId) => {
          try {
            const lot = await stockApi.getLot(lotId)
            lotMap.set(lotId, { lotNumber: lot.lotNumber, expiryDate: lot.expiryDate })
          } catch {
            /* the lot number is only a label */
          }
        }),
      )
      setLots(lotMap)
    } catch (err) {
      setLoadError(describeError(err, 'Không tải được phiếu trả hàng'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const apply = (r: SalesReturn) => setRet(r)

  const closeDialog = () => {
    setDialog(null)
    setReason('')
  }

  const run = async (action: () => Promise<SalesReturn>, success: string, failure: string) => {
    setBusy(true)
    try {
      apply(await action())
      showToast(success, 'success')
      setDialog(null)
      setReason('')
    } catch (err) {
      showToast(describeError(err, failure), 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveInspection = async (item: ReturnItem) => {
    const edit = inspection[item.id]
    if (!edit?.condition) return
    setSavingItem(item.id)
    try {
      apply(await returnsApi.inspectItem(id, item.id, { conditionStatus: edit.condition, inspectionNote: edit.note.trim() || null }))
      setInspection((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      showToast('Đã ghi kết quả kiểm tra', 'success')
    } catch (err) {
      showToast(describeError(err, 'Không ghi được kết quả kiểm tra'), 'error')
    } finally {
      setSavingItem(null)
    }
  }

  const removeLine = async () => {
    if (!toRemove) return
    setBusy(true)
    try {
      apply(await returnsApi.removeItem(id, toRemove.id))
      showToast('Đã bỏ dòng khỏi yêu cầu', 'success')
      setToRemove(null)
    } catch (err) {
      showToast(describeError(err, 'Không bỏ được dòng'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const uninspected = useMemo(() => (ret?.items ?? []).filter((i) => i.conditionStatus === 'PENDING_INSPECTION').length, [ret])

  if (loading && !ret) return <div className="max-w-[1600px] mx-auto p-space-md text-on-surface-variant animate-pulse">Đang tải phiếu trả hàng...</div>
  if (!ret) {
    return (
      <div className="max-w-[1600px] mx-auto p-space-md flex flex-col gap-3">
        <p className="text-rose-700">{loadError ?? 'Không tìm thấy phiếu trả hàng.'}</p>
        <Link to={base} className="text-emerald-700 font-medium hover:underline">
          Về danh sách trả hàng
        </Link>
      </div>
    )
  }

  const status = ret.status
  const stepsDone = STEP_DONE[status] ?? 0
  const dead = status === 'REJECTED' || status === 'CANCELLED'
  const inspecting = status === 'RECEIVED'
  const settled = ['INSPECTED', 'PARTIALLY_RESOLVED', 'COMPLETED'].includes(status)
  const restockCount = ret.items.filter((i) => i.conditionStatus === 'RESELLABLE').length

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={base} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} /> Danh sách trả hàng
          </Link>
          <span className="font-mono font-bold text-slate-900">{ret.returnNumber}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded tracking-wide ${RETURN_STATUS_BADGE_CLASS[status]}`}>{returnStatusText(status, ret.refunds)}</span>
          <span className="text-sm text-slate-600">
            Đơn <span className="font-mono">{ret.orderNumber}</span> · {ret.customerName}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(status === 'REQUESTED' || status === 'APPROVED') && (
            <PermissionAction codes={["RETURNS.CANCEL"]}><button type="button" onClick={() => setDialog('cancel')} className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm">
              Hủy yêu cầu
            </button></PermissionAction>
          )}
          {status === 'REQUESTED' && canManage ? (
            <>
              <PermissionAction codes={["RETURNS.REJECT"]}><button type="button" onClick={() => setDialog('reject')} className="h-10 px-3 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 text-sm font-medium shadow-sm">
                Từ chối
              </button></PermissionAction>
              <PermissionAction codes={["RETURNS.APPROVE"]}><button type="button" onClick={() => setDialog('approve')} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm">
                Duyệt yêu cầu
              </button></PermissionAction>
            </>
          ) : null}
          {status === 'APPROVED' ? (
            <PermissionAction codes={["RETURNS.RECEIVE"]}><button type="button" onClick={() => setDialog('receive')} className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm">
              Đã nhận hàng trả về
            </button></PermissionAction>
          ) : null}
          {inspecting && canManage ? (
            <PermissionAction codes={["RETURNS.COMPLETE_INSPECTION"]}><button
              type="button"
              onClick={() => setDialog('complete')}
              disabled={uninspected > 0}
              title={uninspected > 0 ? `Còn ${uninspected} dòng chưa kiểm tra` : undefined}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm disabled:opacity-50"
            >
              <Check size={16} /> Chốt kết quả kiểm tra
            </button></PermissionAction>
          ) : null}
        </div>
      </div>

      {dead ? (
        <p className={`text-sm rounded-lg px-3 py-2 border ${status === 'REJECTED' ? 'text-rose-800 bg-rose-50 border-rose-200' : 'text-slate-700 bg-slate-50 border-slate-200'}`}>
          {status === 'REJECTED' ? 'Yêu cầu đã bị từ chối, không có hàng hay tiền nào thay đổi.' : `Yêu cầu đã hủy${ret.cancelReason ? `: ${ret.cancelReason}` : ''}. Không có hàng hay tiền nào thay đổi.`}
        </p>
      ) : (
        <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Tiến trình trả hàng">
          {STEPS.map((label, i) => {
            const done = i < stepsDone
            const current = i === stepsDone
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${
                    done ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : current ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {done ? <Check size={12} /> : <span className="w-3 text-center">{i + 1}</span>}
                  {label}
                </span>
                {i < STEPS.length - 1 ? <span className="text-slate-300">—</span> : null}
              </li>
            )
          })}
        </ol>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Yêu cầu lúc</dt>
              <dd className="font-medium">{formatDateTime(ret.requestedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Duyệt lúc</dt>
              <dd className="font-medium">{formatDateTime(ret.approvedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Nhận hàng lúc</dt>
              <dd className="font-medium">{formatDateTime(ret.receivedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Kiểm tra xong lúc</dt>
              <dd className="font-medium">{formatDateTime(ret.inspectedAt)}</dd>
            </div>
            {ret.reasonSummary ? (
              <div className="col-span-2">
                <dt className="text-slate-500">Lý do</dt>
                <dd className="font-medium">{ret.reasonSummary}</dd>
              </div>
            ) : null}
            {ret.note ? (
              <div className="col-span-2">
                <dt className="text-slate-500">Ghi chú</dt>
                <dd className="font-medium whitespace-pre-line">{ret.note}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">{settled ? 'Tổng giá trị hàng trả' : 'Giá trị hàng trả (tạm tính)'}</span>
            <strong className="tabular-nums">{formatVnd(ret.totalReturnAmount)}</strong>
          </div>
          {settled ? (
            <>
              <div className="flex justify-between">
                <span className="text-slate-600">Trừ vào công nợ chưa trả của đơn</span>
                <strong className="tabular-nums">{formatVnd(ret.totalDebtAdjustment)}</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100 text-base">
                <span className="font-semibold text-slate-800">Cần hoàn tiền cho khách</span>
                <strong className="tabular-nums text-emerald-700">{formatVnd(ret.totalRefundAmount)}</strong>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant">
          <h3 className="font-semibold text-on-surface">Hàng trả ({ret.items.length} dòng)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 font-medium">Sản phẩm</th>
                <th className="py-3 px-3 font-medium">Lô</th>
                <th className="py-3 px-3 font-medium text-right">Số lượng trả</th>
                <th className="py-3 px-3 font-medium">Lý do trả</th>
                <th className="py-3 px-3 font-medium text-right">Giá trị</th>
                <th className="py-3 px-3 font-medium min-w-[260px]">Kiểm tra tình trạng</th>
                {status === 'REQUESTED' ? <th className="py-3 px-4" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm">
              {ret.items.map((it) => {
                const info = infos.get(it.orderItemId)
                const lot = lots.get(it.inventoryLotId)
                const unit = unitLabel(info?.baseUnit)
                const edit = inspection[it.id]
                const inspected = it.conditionStatus !== 'PENDING_INSPECTION'
                return (
                  <tr key={it.id}>
                    <td className="py-2.5 px-4">
                      <div className="font-medium">{info?.productName ?? 'Sản phẩm của đơn'}</div>
                      <div className="font-mono text-xs text-slate-500">{info?.sku ?? ''}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-xs">{lot?.lotNumber ?? '-'}</div>
                      {lot?.expiryDate ? <div className="text-xs text-slate-500">HSD {formatDate(lot.expiryDate)}</div> : null}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold whitespace-nowrap">
                      {formatQty(it.returnedBaseQuantity)} {unit}
                    </td>
                    <td className="py-2.5 px-3">{RETURN_REASONS.find((r) => r.value === it.reasonCode)?.label ?? it.reasonCode}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatVnd(it.returnValue)}</td>
                    <td className="py-2.5 px-3">
                      {inspecting ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className={`${cellInput} min-w-[150px]`}
                            aria-label="Tình trạng hàng trả"
                            value={edit?.condition ?? (inspected ? (it.conditionStatus as Inspectable) : '')}
                            onChange={(e) => setInspection((prev) => ({ ...prev, [it.id]: { condition: e.target.value as Inspectable | '', note: prev[it.id]?.note ?? it.inspectionNote ?? '' } }))}
                          >
                            <option value="">Chọn tình trạng...</option>
                            {RETURN_CONDITIONS.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label} ({c.hint})
                              </option>
                            ))}
                          </select>
                          <input
                            className={`${cellInput} flex-1 min-w-[120px]`}
                            maxLength={500}
                            placeholder="Ghi chú"
                            aria-label="Ghi chú kiểm tra"
                            value={edit?.note ?? it.inspectionNote ?? ''}
                            onChange={(e) => setInspection((prev) => ({ ...prev, [it.id]: { condition: prev[it.id]?.condition ?? ((inspected ? it.conditionStatus : '') as Inspectable | ''), note: e.target.value } }))}
                          />
                          <PermissionAction codes={["RETURNS.UPDATE"]}><button
                            type="button"
                            className="h-9 px-3 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium disabled:opacity-50"
                            disabled={!edit?.condition || savingItem === it.id}
                            onClick={() => saveInspection(it)}
                          >
                            {savingItem === it.id ? '...' : 'Lưu'}
                          </button></PermissionAction>
                          {inspected && !edit ? <span className="text-xs text-emerald-700 font-medium">Đã kiểm tra</span> : null}
                        </div>
                      ) : inspected ? (
                        <div>
                          <div className="font-medium">{CONDITION_LABEL[it.conditionStatus]}</div>
                          <div className="text-xs text-slate-500">
                            {DISPOSITION_LABEL[it.inventoryDisposition] ?? it.inventoryDisposition}
                            {it.inspectionNote ? ` · ${it.inspectionNote}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">{dead ? '-' : 'Chưa kiểm tra'}</span>
                      )}
                    </td>
                    {status === 'REQUESTED' ? (
                      <td className="py-2.5 px-4 text-right">
                        {ret.items.length > 1 ? (
                          <button type="button" aria-label="Bỏ dòng này" className="p-1.5 rounded text-slate-500 hover:text-rose-700 hover:bg-slate-100" onClick={() => setToRemove(it)}>
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {ret.totalRefundAmount > 0 || ret.refunds.length > 0 ? (
        <RefundsPanel
          scope={{ kind: 'return', returnId: ret.id, orderId: ret.orderId }}
          refunds={ret.refunds}
          refundable={ret.totalRefundAmount}
          canManage={canManage}
          onChanged={load}
        />
      ) : null}

      <PermissionAction codes={["RETURNS.APPROVE"]}><ConfirmModal
        open={dialog === 'approve'}
        title="Duyệt yêu cầu trả hàng"
        message="Sau khi duyệt, khách mang hàng về cửa hàng; nhân viên bấm “Đã nhận hàng trả về” rồi kiểm tra từng dòng. Chưa có hàng hay tiền nào thay đổi."
        confirmLabel="Duyệt"
        busy={busy}
        onConfirm={() => run(() => returnsApi.approve(id), 'Đã duyệt yêu cầu trả hàng', 'Không duyệt được yêu cầu')}
        onClose={closeDialog}
      /></PermissionAction>
      <ConfirmModal
        open={dialog === 'reject'}
        title="Từ chối yêu cầu trả hàng"
        message="Yêu cầu bị từ chối và đóng lại, lý do được ghi vào nhật ký."
        confirmLabel="Từ chối"
        tone="danger"
        busy={busy}
        confirmDisabled={reason.trim() === ''}
        onConfirm={() => run(() => returnsApi.reject(id, reason.trim()), 'Đã từ chối yêu cầu', 'Không từ chối được yêu cầu')}
        onClose={closeDialog}
      >
        <ReasonField value={reason} onChange={setReason} id="rt-reject" label="Lý do từ chối (bắt buộc)" />
      </ConfirmModal>
      <ConfirmModal
        open={dialog === 'cancel'}
        title="Hủy yêu cầu trả hàng"
        message="Yêu cầu bị hủy, hàng và tiền không thay đổi."
        confirmLabel="Hủy yêu cầu"
        tone="danger"
        busy={busy}
        confirmDisabled={reason.trim() === ''}
        onConfirm={() => run(() => returnsApi.cancel(id, reason.trim()), 'Đã hủy yêu cầu', 'Không hủy được yêu cầu')}
        onClose={closeDialog}
      >
        <ReasonField value={reason} onChange={setReason} id="rt-cancel" label="Lý do hủy (bắt buộc)" />
      </ConfirmModal>
      <PermissionAction codes={["RETURNS.RECEIVE"]}><ConfirmModal
        open={dialog === 'receive'}
        title="Xác nhận đã nhận hàng trả về"
        message="Hàng khách trả đã thực sự về cửa hàng. Bước tiếp theo là kiểm tra tình trạng từng dòng."
        confirmLabel="Đã nhận hàng"
        busy={busy}
        onConfirm={() => run(() => returnsApi.receive(id), 'Đã ghi nhận hàng trả về', 'Không ghi nhận được')}
        onClose={closeDialog}
      /></PermissionAction>
      <PermissionAction codes={["RETURNS.COMPLETE_INSPECTION"]}><ConfirmModal
        open={dialog === 'complete'}
        title="Chốt kết quả kiểm tra"
        message={
          <>
            <p>
              Hệ thống sẽ nhập lại kho <strong>{restockCount} dòng “Còn bán được”</strong> vào đúng lô cũ (giá vốn cũ), các dòng còn lại không nhập lại kho. Sau đó trừ vào công nợ chưa trả của đơn trước, phần còn lại là số tiền cần hoàn cho khách.
            </p>
            <p className="mt-2 text-slate-500">Bước này không hoàn tác được.</p>
          </>
        }
        confirmLabel="Chốt kiểm tra"
        busy={busy}
        onConfirm={() => run(() => returnsApi.completeInspection(id), 'Đã chốt kiểm tra và nhập lại kho các dòng còn bán được', 'Không chốt được kết quả kiểm tra')}
        onClose={closeDialog}
      /></PermissionAction>
      <PermissionAction codes={["RETURNS.DELETE"]}><ConfirmModal
        open={toRemove !== null}
        title="Bỏ dòng khỏi yêu cầu"
        message="Dòng này sẽ không còn trong yêu cầu trả hàng."
        confirmLabel="Bỏ dòng"
        tone="danger"
        busy={busy}
        onConfirm={removeLine}
        onClose={() => setToRemove(null)}
      /></PermissionAction>
    </div>
  )
}

function ReasonField({ value, onChange, id, label }: { value: string; onChange: (v: string) => void; id: string; label: string }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className="w-full min-h-[64px] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" maxLength={1000} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
