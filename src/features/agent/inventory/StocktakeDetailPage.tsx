import PermissionAction from '@/components/auth/PermissionAction'
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Layers, RefreshCw, Scale, Search, Sigma } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/context/PermissionContext';
import { describeError } from '@/api/client';
import { stocktakeApi, type Stocktake, type StocktakeCount, type StocktakeItem, type StocktakeReason } from '@/api/stocktakeApi';
import KpiCard from '@/components/ui/KpiCard'
import FilterSelect from '@/components/ui/FilterSelect'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { formatVnd } from '@/utils/money';
import { formatDate, formatDateTime, formatQty } from '@/utils/units';
import { STOCKTAKE_REASONS, STOCKTAKE_STATUS_BADGE_CLASS, STOCKTAKE_STATUS_LABEL } from './stockLabels';
import { useStocktakeBase } from './stocktakePaths';

interface LineEdit {
  counted: string
  reason: string
  note: string
  unitCost: string
}

type LineFilter = 'all' | 'uncounted' | 'differences' | 'stale'
type Dialog = null | 'start' | 'complete' | 'cancel' | 'delete' | 'refresh'

const cellInput =
  'h-9 px-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400'

const baseEdit = (it: StocktakeItem): LineEdit => ({
  counted: it.countedQuantity === null ? '' : String(it.countedQuantity),
  reason: it.reasonCode ?? '',
  note: it.note ?? '',
  unitCost: '',
})

export default function StocktakeDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const base = useStocktakeBase()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { has } = usePermission()
  const canComplete = has('STOCKTAKES.COMPLETE')

  const [st, setSt] = useState<Stocktake | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, LineEdit>>({})
  const [filter, setFilter] = useState<LineFilter>('all')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [busy, setBusy] = useState(false)

  usePageHeader({ title: st ? `Kiểm kê ${st.stocktakeNumber}` : 'Kiểm kê kho', subtitle: 'Đếm từng lô, đối chiếu sổ sách rồi hoàn thành để ghi nhận chênh lệch' })

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      try {
        setSt(await stocktakeApi.get(id))
        setLoadError(null)
      } catch (err) {
        if (!quiet) setLoadError(describeError(err, 'Không tải được phiếu kiểm kê'))
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    load()
  }, [load])

  const inProgress = st?.status === 'IN_PROGRESS'

  // A sale or receipt can happen while counting: re-read the sheet when the tab gets focus so stale lines show up.
  useEffect(() => {
    if (!inProgress) return
    const onFocus = () => {
      if (!saving && dialog === null) load(true)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [inProgress, saving, dialog, load])

  const valueOf = useCallback((it: StocktakeItem): LineEdit => edits[it.id] ?? baseEdit(it), [edits])

  const isDirty = useCallback(
    (it: StocktakeItem) => {
      const e = edits[it.id]
      if (!e) return false
      const b = baseEdit(it)
      return e.counted !== b.counted || e.reason !== b.reason || e.note !== b.note || e.unitCost !== b.unitCost
    },
    [edits],
  )

  /** What the line would be after the typed values: the live difference and what is still missing. */
  const analyse = useCallback(
    (it: StocktakeItem) => {
      const v = valueOf(it)
      if (v.counted.trim() === '') return { counted: null as number | null, diff: null as number | null, needsCost: false, problem: null as string | null }
      const n = Number(v.counted)
      if (!Number.isInteger(n) || n < 0) return { counted: null, diff: null, needsCost: false, problem: 'Số đếm phải là số nguyên từ 0 trở lên' }
      const diff = n - it.systemQuantitySnapshot
      const needsCost = diff > 0 && it.unitCostSnapshot === null
      let problem: string | null = null
      if (diff !== 0 && !v.reason) problem = 'Chọn lý do chênh lệch'
      else if (needsCost && (v.unitCost.trim() === '' || !(Number(v.unitCost) >= 0))) problem = 'Nhập giá vốn cho số lượng tăng thêm'
      return { counted: n, diff, needsCost, problem }
    },
    [valueOf],
  )

  const items = st?.items ?? []
  const dirtyItems = useMemo(() => items.filter(isDirty), [items, isDirty])
  const staleItems = useMemo(() => items.filter((i) => i.isStale), [items])
  const uncounted = useMemo(() => items.filter((i) => i.countedQuantity === null).length, [items])
  const countedByMe = !!user?.id && items.some((i) => i.countedBy === user.id)

  useEffect(() => {
    if (dirtyItems.length === 0) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirtyItems.length])

  const visible = useMemo(() => {
    const q = text.trim().toLowerCase()
    return items.filter((it) => {
      if (q && !(`${it.productName} ${it.sku} ${it.lotNumber ?? ''}`.toLowerCase().includes(q))) return false
      if (filter === 'uncounted') return it.countedQuantity === null && !isDirty(it)
      if (filter === 'stale') return it.isStale
      if (filter === 'differences') {
        const a = analyse(it)
        return a.diff !== null ? a.diff !== 0 : (it.differenceQuantity ?? 0) !== 0
      }
      return true
    })
  }, [items, text, filter, analyse, isDirty])

  const setEdit = (it: StocktakeItem, patch: Partial<LineEdit>) => setEdits((prev) => ({ ...prev, [it.id]: { ...(prev[it.id] ?? baseEdit(it)), ...patch } }))

  const focusNext = (el: HTMLInputElement) => {
    const all = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-count-input]:not(:disabled)'))
    all[all.indexOf(el) + 1]?.focus()
  }

  const run = async (action: () => Promise<Stocktake | void>, onOk: (res: Stocktake | void) => void, failure: string) => {
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

  const saveCounts = async () => {
    const rows = dirtyItems.map((it) => ({ it, a: analyse(it), v: valueOf(it) })).filter((r) => r.a.counted !== null || r.a.problem)
    const invalid = rows.filter((r) => r.a.problem)
    if (invalid.length > 0) {
      setShowErrors(true)
      showToast(`${invalid.length} dòng chưa hợp lệ, xem chú thích màu đỏ ở từng dòng`, 'warning')
      return
    }
    const counts: StocktakeCount[] = rows.map((r) => ({
      itemId: r.it.id,
      countedQuantity: r.a.counted as number,
      unitCost: r.a.needsCost ? Number(r.v.unitCost) : undefined,
      reasonCode: (r.v.reason || undefined) as StocktakeReason | undefined,
      note: r.v.note.trim() || null,
    }))
    if (counts.length === 0) {
      setEdits({})
      return
    }
    setSaving(true)
    try {
      const res = await stocktakeApi.saveCounts(id, counts)
      setSt(res)
      setEdits({})
      setShowErrors(false)
      showToast(`Đã lưu số đếm của ${counts.length} lô`, 'success')
    } catch (err) {
      showToast(describeError(err, 'Không lưu được số đếm'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !st) {
    return <div className="max-w-[1600px] mx-auto p-space-md text-on-surface-variant animate-pulse">Đang tải phiếu kiểm kê...</div>
  }
  if (!st) {
    return (
      <div className="max-w-[1600px] mx-auto p-space-md flex flex-col gap-3">
        <p className="text-rose-700">{loadError ?? 'Không tìm thấy phiếu kiểm kê.'}</p>
        <Link to={base} className="text-emerald-700 font-medium hover:underline">
          Về danh sách kiểm kê
        </Link>
      </div>
    )
  }

  const editable = inProgress
  const blockers: string[] = []
  if (editable) {
    if (dirtyItems.length > 0) blockers.push(`${dirtyItems.length} dòng đã sửa chưa lưu`)
    if (staleItems.length > 0) blockers.push(`${staleItems.length} dòng bị cũ cần làm mới và đếm lại`)
    if (uncounted > 0) blockers.push(`${uncounted} lô chưa đếm`)
    if (countedByMe) blockers.push('bạn là người đã đếm phiếu này, cần một người khác duyệt hoàn thành')
  }
  const canPressComplete = editable && canComplete && blockers.length === 0

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={base} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} /> Danh sách kiểm kê
          </Link>
          <span className="font-mono font-bold text-slate-900">{st.stocktakeNumber}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${STOCKTAKE_STATUS_BADGE_CLASS[st.status]}`}>{STOCKTAKE_STATUS_LABEL[st.status]}</span>
          <span className="text-xs text-slate-500">Tạo {formatDateTime(st.createdAt)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => load(true)} className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm" title="Tải lại để thấy phiếu kho mới phát sinh">
            <RefreshCw size={16} /> Tải lại
          </button>
          {st.status === 'DRAFT' ? (
            <>
              <PermissionAction codes={["STOCKTAKES.DELETE"]}><button type="button" onClick={() => setDialog('delete')} className="h-10 px-3 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 text-sm font-medium shadow-sm">
                Xóa phiếu nháp
              </button></PermissionAction>
              <PermissionAction codes={["STOCKTAKES.START"]}><button type="button" onClick={() => setDialog('start')} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm">
                Bắt đầu kiểm kê
              </button></PermissionAction>
            </>
          ) : null}
          {editable ? (
            <>
              <PermissionAction codes={["STOCKTAKES.CANCEL"]}><button type="button" onClick={() => setDialog('cancel')} className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm">
                Hủy phiếu
              </button></PermissionAction>
              <PermissionAction codes={["STOCKTAKES.UPDATE"]}><button
                type="button"
                onClick={saveCounts}
                disabled={saving || dirtyItems.length === 0}
                className="h-10 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium shadow-sm disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : dirtyItems.length > 0 ? `Lưu số đếm (${dirtyItems.length})` : 'Lưu số đếm'}
              </button></PermissionAction>
              {canComplete ? (
                <PermissionAction codes={["STOCKTAKES.COMPLETE"]}><button
                  type="button"
                  onClick={() => setDialog('complete')}
                  disabled={!canPressComplete}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 size={16} /> Hoàn thành kiểm kê
                </button></PermissionAction>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {st.note ? <p className="text-sm text-slate-600 -mt-2">Ghi chú: {st.note}</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={Layers} iconClassName="bg-slate-100 text-slate-600" title="Số lô cần đếm" layout="side" value={st.totals.lines} />
        <KpiCard
          icon={ClipboardCheck}
          iconClassName="bg-sky-50 text-sky-600"
          title="Đã đếm"
          layout="side"
          value={`${st.totals.counted}/${st.totals.lines}`}
          subtitle={uncounted > 0 ? `Còn ${uncounted} lô chưa đếm` : st.totals.lines > 0 ? 'Đã đếm hết' : undefined}
        />
        <KpiCard icon={Scale} iconClassName="bg-amber-50 text-amber-600" title="Lô có chênh lệch" layout="side" value={st.totals.withDifference} valueClassName={st.totals.withDifference > 0 ? 'text-amber-700' : 'text-slate-900'} />
        <KpiCard
          icon={Sigma}
          iconClassName="bg-rose-50 text-rose-600"
          title="Giá trị chênh lệch"
          layout="side"
          value={`${st.totals.differenceCostValue > 0 ? '+' : ''}${formatVnd(st.totals.differenceCostValue)}`}
          valueClassName={st.totals.differenceCostValue < 0 ? 'text-rose-600' : st.totals.differenceCostValue > 0 ? 'text-emerald-700' : 'text-slate-900'}
          subtitle="Theo giá vốn, so với sổ sách"
        />
      </div>

      {st.status === 'DRAFT' ? (
        <p className="text-sm text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
          Phiếu đang ở dạng nháp. Bấm <strong>Bắt đầu kiểm kê</strong> để cho phép nhập số đếm. Số sổ sách được chụp lúc tạo phiếu.
        </p>
      ) : null}

      {editable && staleItems.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2" role="alert">
          <span className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>{staleItems.length} lô bị cũ:</strong> có phiếu kho (bán, nhập, điều chỉnh...) phát sinh quanh lúc bạn đếm nên số sổ sách không còn đúng. Làm mới rồi đếm lại đúng những lô này (các lô khác giữ nguyên).
              <span className="block mt-1 text-amber-800">
                Lưu ý: phiếu kho phát sinh trong vòng 5 phút trước lúc chụp vẫn được tính là xen vào, nên nếu vừa có giao dịch thì dòng có thể còn bị đánh dấu cũ cho tới khi qua 5 phút. Khi đó hãy đợi rồi đếm lại.
              </span>
            </span>
          </span>
          <PermissionAction codes={["STOCKTAKES.REFRESH_STALE"]}><button type="button" onClick={() => setDialog('refresh')} className="h-9 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium shadow-sm shrink-0">
            Làm mới các dòng bị cũ
          </button></PermissionAction>
        </div>
      ) : null}

      {editable && !canComplete ? (
        <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Đếm và bấm <strong>Lưu số đếm</strong>. Khi đếm xong, báo Chủ cửa hàng kiểm tra và hoàn thành phiếu (người đếm không tự hoàn thành được).
        </p>
      ) : null}

      {editable && canComplete && blockers.length > 0 ? (
        <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Chưa thể hoàn thành: {blockers.join('; ')}.
        </p>
      ) : null}

      {st.status === 'COMPLETED' ? (
        <div className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Hoàn thành lúc {formatDateTime(st.completedAt)}.{' '}
          {st.movements.length > 0 ? (
            <>
              Phiếu kho đã ghi để điều chỉnh chênh lệch:{' '}
              {st.movements.map((m) => (
                <span key={m.id} className="inline-block font-mono text-xs bg-white border border-emerald-200 rounded px-2 py-0.5 mr-1">
                  {m.movementNumber}
                </span>
              ))}
              (xem ở{' '}
              <Link to="/agent/inventory/movements" className="font-medium underline">
                Biến động kho
              </Link>
              )
            </>
          ) : (
            'Không có chênh lệch nên không phát sinh phiếu kho.'
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
            placeholder="Lọc theo sản phẩm, mã hoặc số lô..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <FilterSelect
          value={filter}
          onChange={(v) => setFilter(v as LineFilter)}
          options={[
            { value: 'all', label: 'Tất cả các dòng' },
            { value: 'uncounted', label: 'Chỉ lô chưa đếm' },
            { value: 'differences', label: 'Chỉ lô có chênh lệch' },
            { value: 'stale', label: 'Chỉ lô bị cũ' },
          ]}
        />
        <span className="text-xs text-slate-500">
          Hiện {visible.length}/{items.length} dòng
        </span>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 font-medium">Sản phẩm</th>
                <th className="py-3 px-3 font-medium">Lô</th>
                <th className="py-3 px-3 font-medium text-right">Sổ sách</th>
                <th className="py-3 px-3 font-medium text-right">Số đếm</th>
                <th className="py-3 px-3 font-medium text-right">Chênh lệch</th>
                <th className="py-3 px-3 font-medium text-right">Giá trị</th>
                <th className="py-3 px-3 font-medium">Lý do</th>
                <th className="py-3 px-4 font-medium">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm">
              {visible.length === 0 ? (
                <EmptyTableRow colSpan={8} message={items.length === 0 ? 'Phiếu không có lô nào.' : 'Không có dòng nào phù hợp bộ lọc.'} />
              ) : (
                visible.map((it) => {
                  const v = valueOf(it)
                  const a = analyse(it)
                  const dirty = isDirty(it)
                  const diff = a.diff ?? it.differenceQuantity
                  const value = dirty && a.diff !== null && it.unitCostSnapshot !== null ? a.diff * it.unitCostSnapshot : it.differenceCostValue
                  const rowProblem = showErrors && dirty ? a.problem : null
                  const reasonLabel = STOCKTAKE_REASONS.find((r) => r.value === it.reasonCode)?.label ?? it.reasonCode
                  return (
                    <tr key={it.id} className={it.isStale ? 'bg-amber-50' : dirty ? 'bg-sky-50/50' : ''}>
                      <td className="py-2.5 px-4">
                        <div className="font-medium">{it.productName}</div>
                        <div className="font-mono text-xs text-slate-500">{it.sku}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-xs">{it.lotNumber ?? 'Không có số lô'}</div>
                        {it.expiryDate ? <div className="text-xs text-slate-500">HSD {formatDate(it.expiryDate)}</div> : null}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatQty(it.systemQuantitySnapshot)}</td>
                      <td className="py-2.5 px-3 text-right">
                        {editable ? (
                          <>
                            <input
                              data-count-input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              aria-label={`Số đếm lô ${it.lotNumber ?? ''} ${it.productName}`}
                              className={`${cellInput} w-24 text-right tabular-nums`}
                              value={v.counted}
                              disabled={it.isStale || saving}
                              onChange={(e) => setEdit(it, { counted: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  focusNext(e.currentTarget)
                                }
                              }}
                            />
                            {it.isStale ? <div className="text-[11px] font-medium text-amber-700 mt-1">Cần đếm lại</div> : null}
                          </>
                        ) : it.countedQuantity === null ? (
                          <span className="text-slate-400">Chưa đếm</span>
                        ) : (
                          <span className="tabular-nums font-medium">{formatQty(it.countedQuantity)}</span>
                        )}
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${diff === null || diff === 0 ? 'text-slate-400' : diff < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {diff === null ? '-' : diff === 0 ? '0' : `${diff > 0 ? '+' : ''}${formatQty(diff)}`}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        {value === null || value === undefined || value === 0 ? <span className="text-slate-400">-</span> : formatVnd(value)}
                      </td>
                      <td className="py-2.5 px-3 min-w-[180px]">
                        {editable ? (
                          <>
                            <select className={`${cellInput} w-full`} value={v.reason} disabled={it.isStale || saving} onChange={(e) => setEdit(it, { reason: e.target.value })} aria-label="Lý do chênh lệch">
                              <option value="">{a.diff !== null && a.diff !== 0 ? 'Chọn lý do...' : '-'}</option>
                              {STOCKTAKE_REASONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                            {a.needsCost ? (
                              <input
                                type="number"
                                min={0}
                                className={`${cellInput} w-full mt-1`}
                                placeholder="Giá vốn mỗi đơn vị (đ)"
                                value={v.unitCost}
                                disabled={saving}
                                onChange={(e) => setEdit(it, { unitCost: e.target.value })}
                                aria-label="Giá vốn cho số lượng tăng thêm"
                              />
                            ) : null}
                            {rowProblem ? <div className="text-[11px] text-rose-600 mt-1">{rowProblem}</div> : null}
                          </>
                        ) : (
                          <span>{reasonLabel ?? '-'}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 min-w-[160px]">
                        {editable ? (
                          <input className={`${cellInput} w-full`} maxLength={500} placeholder="Ghi chú" value={v.note} disabled={it.isStale || saving} onChange={(e) => setEdit(it, { note: e.target.value })} aria-label="Ghi chú" />
                        ) : (
                          <span className="text-slate-600">{it.note ?? ''}</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PermissionAction codes={["STOCKTAKES.START"]}><ConfirmModal
        open={dialog === 'start'}
        title="Bắt đầu kiểm kê"
        message="Phiếu chuyển sang trạng thái Đang kiểm kê và cho phép nhập số đếm. Việc bán hàng vẫn diễn ra bình thường; lô nào có phiếu kho phát sinh trong lúc đếm sẽ bị đánh dấu cần đếm lại."
        confirmLabel="Bắt đầu"
        busy={busy}
        onConfirm={() => run(() => stocktakeApi.start(id), (r) => r && setSt(r), 'Không bắt đầu được phiếu')}
        onClose={() => setDialog(null)}
      /></PermissionAction>
      <PermissionAction codes={["STOCKTAKES.REFRESH_STALE"]}><ConfirmModal
        open={dialog === 'refresh'}
        title="Làm mới các dòng bị cũ"
        message={`${staleItems.length} lô sẽ được chụp lại số sổ sách mới nhất và xóa số đếm đã nhập của chúng, bạn cần đếm lại đúng những lô này. Các lô khác không đổi.`}
        confirmLabel="Làm mới"
        busy={busy}
        onConfirm={() =>
          run(
            () => stocktakeApi.refreshStale(id),
            (r) => {
              if (!r) return
              const stale = new Set(staleItems.map((i) => i.id))
              setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !stale.has(key))))
              setSt(r)
              showToast('Đã làm mới, hãy đếm lại các lô vừa được làm mới', 'info')
            },
            'Không làm mới được các dòng bị cũ',
          )
        }
        onClose={() => setDialog(null)}
      /></PermissionAction>
      <PermissionAction codes={["STOCKTAKES.COMPLETE"]}><ConfirmModal
        open={dialog === 'complete'}
        title="Hoàn thành kiểm kê"
        message={
          <>
            <p>
              {st.totals.withDifference > 0 ? (
                <>
                  Có <strong>{st.totals.withDifference} lô chênh lệch</strong>, tổng giá trị{' '}
                  <strong className={st.totals.differenceCostValue < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                    {st.totals.differenceCostValue > 0 ? '+' : ''}
                    {formatVnd(st.totals.differenceCostValue)}
                  </strong>
                  . Hệ thống sẽ ghi phiếu điều chỉnh tăng và giảm kho tương ứng.
                </>
              ) : (
                <>Không có chênh lệch, số sổ sách khớp số đếm. Phiếu được chốt mà không phát sinh phiếu kho.</>
              )}
            </p>
            <p className="mt-2 text-slate-500">Sau khi hoàn thành, phiếu và các phiếu điều chỉnh không sửa hay xóa được.</p>
          </>
        }
        confirmLabel="Hoàn thành kiểm kê"
        tone={st.totals.withDifference > 0 ? 'danger' : 'primary'}
        busy={busy}
        onConfirm={() =>
          run(
            () => stocktakeApi.complete(id),
            (r) => {
              if (!r) return
              setSt(r)
              setEdits({})
              showToast(r.movements.length > 0 ? `Đã hoàn thành, ghi ${r.movements.length} phiếu điều chỉnh kho` : 'Đã hoàn thành kiểm kê, không có chênh lệch', 'success')
            },
            'Không hoàn thành được kiểm kê',
          )
        }
        onClose={() => setDialog(null)}
      /></PermissionAction>
      <ConfirmModal
        open={dialog === 'cancel'}
        title="Hủy phiếu kiểm kê"
        message="Phiếu bị hủy, số đã đếm không được ghi vào kho. Có thể tạo phiếu mới sau."
        confirmLabel="Hủy phiếu"
        tone="danger"
        busy={busy}
        onConfirm={() => run(() => stocktakeApi.cancel(id, cancelReason.trim()), (r) => r && setSt(r), 'Không hủy được phiếu')}
        onClose={() => setDialog(null)}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="st-cancel-reason">
            Lý do (không bắt buộc)
          </label>
          <textarea
            id="st-cancel-reason"
            className="w-full min-h-[64px] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            maxLength={1000}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
      </ConfirmModal>
      <PermissionAction codes={["STOCKTAKES.DELETE"]}><ConfirmModal
        open={dialog === 'delete'}
        title="Xóa phiếu nháp"
        message="Phiếu nháp chưa bắt đầu đếm sẽ bị xóa."
        confirmLabel="Xóa phiếu"
        tone="danger"
        busy={busy}
        onConfirm={() =>
          run(
            () => stocktakeApi.remove(id),
            () => {
              showToast('Đã xóa phiếu nháp', 'success')
              navigate(base)
            },
            'Không xóa được phiếu',
          )
        }
        onClose={() => setDialog(null)}
      /></PermissionAction>
    </div>
  )
}
