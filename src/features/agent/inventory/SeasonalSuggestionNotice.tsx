import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, ClipboardPlus } from 'lucide-react'
import { describeError } from '@/api/client'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import StatusBadge from '@/components/ui/StatusBadge'
import {
  CONFIDENCE_LABEL, GROUP_LABEL, seasonalSuggestionsApi, type SeasonalRuleDraft, type SeasonalSuggestion, type SuggestionItem,
} from '@/api/seasonalSuggestionsApi'
import { usePermission } from '@/context/PermissionContext'
import { useToast } from '@/context/ToastContext'
import { todayVn } from '@/utils/creditLabels'
import { formatDate, formatQtyUnit } from '@/utils/units'
import SeasonalRuleFormModal from './SeasonalRuleFormModal'

const SEASONS = 3
const PREVIEW = 4
const NOTE = 'Hệ thống tự tính từ bán hàng cùng kỳ năm trước, liên kết bệnh – sản phẩm đã duyệt và quy tắc mùa vụ. Chỉ để tham khảo: không tự tạo phiếu nhập hay đổi tồn kho.'

const CONFIDENCE_TONE: Record<SuggestionItem['confidence'], string> = {
  HIGH: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
  LOW: '',
}

/**
 * `productsPath`: a link to the product page (the dashboard shows one; the product page itself does not).
 * `variant`: "card" lists the products (product page); "banner" is one line per season with the list in a dialog, so the
 * dashboard keeps its management figures at the top; "row" is the same lines without a box of their own, for the bottom of
 * the owner's "needs doing now" card.
 */
interface Props { productsPath?: string; variant?: 'card' | 'banner' | 'row' }

/** Opens the seasonal-rule form filled in from one season's suggestion; null without SEASONAL_RULES.MANAGE. */
type CreateRule = ((suggestion: SeasonalSuggestion) => void) | null

/** The earliest day to order for a season, from its products. */
const orderByOf = (suggestion: SeasonalSuggestion) => suggestion.items.map(i => i.orderByDate).filter((d): d is string => !!d).sort()[0]

function Row({ item }: { item: SuggestionItem }) {
  return <li className="py-2.5 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-center gap-2">
      <strong className="text-sm text-zinc-900">{item.productName}</strong>
      <span className="text-xs text-zinc-500">{item.sku}</span>
      <span className="rounded px-2 py-0.5 text-[11px] bg-zinc-100 text-zinc-700">{GROUP_LABEL[item.group]}</span>
      <StatusBadge size="xs" label={CONFIDENCE_LABEL[item.confidence]} className={CONFIDENCE_TONE[item.confidence]} />
      {!item.inStore && <StatusBadge size="xs" label="Chưa có trong cửa hàng" className="bg-amber-50 text-amber-800 border-amber-200" />}
    </div>
    <p className="mt-1 text-sm text-zinc-700">{item.reason}</p>
    {item.inStore && item.suggestedTargetBase !== null && <p className="mt-0.5 text-xs text-zinc-500">
      Mục tiêu tồn gợi ý {formatQtyUnit(item.suggestedTargetBase, item.baseUnit)}
      {item.sellableBase !== null && <> · tồn có thể bán {formatQtyUnit(item.sellableBase, item.baseUnit)}</>}
    </p>}
    {item.evidence.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-zinc-500 space-y-0.5" aria-label={`Căn cứ dữ liệu của ${item.productName}`}>
      {item.evidence.map(e => <li key={e.kind + e.text}>{e.text}</li>)}
    </ul>}
  </li>
}

/** The owner's way from a suggestion to a seasonal rule: the form opens filled in, nothing is saved before "Lưu". */
function CreateRuleButton({ suggestion, onCreate, busy, primary = false }: { suggestion: SeasonalSuggestion; onCreate: (s: SeasonalSuggestion) => void; busy: boolean; primary?: boolean }) {
  const tone = primary
    ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
    : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
  return <button type="button" disabled={busy} onClick={() => onCreate(suggestion)} aria-label={`Tạo quy tắc mùa vụ cho vụ ${suggestion.cropName}`}
    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium disabled:opacity-60 ${tone}`}>
    <ClipboardPlus size={15} aria-hidden="true" />{busy ? 'Đang mở…' : 'Tạo quy tắc mùa vụ'}
  </button>
}

/** One season and its products; `preview` products first with a toggle for the rest (all of them when not given). */
function Season({ suggestion, preview, action }: { suggestion: SeasonalSuggestion; preview?: number; action?: ReactNode }) {
  const [all, setAll] = useState(false)
  const limit = preview ?? suggestion.items.length
  const items = all ? suggestion.items : suggestion.items.slice(0, limit)
  const orderBy = orderByOf(suggestion)
  const today = todayVn()
  return <section className="space-y-3" aria-label={`Gợi ý nhập hàng vụ ${suggestion.cropName}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-zinc-900">Vụ {suggestion.cropName}: {formatDate(suggestion.startsOn)} – {formatDate(suggestion.endsOn)}</h4>
        {orderBy && <p className="text-xs text-zinc-500">
          Nên đặt hàng trước {formatDate(orderBy)}{orderBy <= today && <span className="text-amber-700"> · nên đặt ngay</span>}
          {' '}· so với cùng kỳ {formatDate(suggestion.comparedFrom)} – {formatDate(suggestion.comparedTo)}
        </p>}
      </div>
      {action}
    </div>
    {suggestion.items.length === 0
      ? <p className="text-sm text-zinc-600">Chưa đủ dữ liệu để gợi ý mặt hàng cho vụ này. Hãy kiểm tra danh mục sản phẩm và quy tắc mùa vụ.</p>
      : <ul className="divide-y divide-zinc-100">{items.map(item => <Row key={item.id} item={item} />)}</ul>}
    {suggestion.items.length > limit && <button type="button" className="text-sm font-medium text-green-800 hover:underline" onClick={() => setAll(v => !v)}>
      {all ? 'Thu gọn' : `Xem tất cả ${suggestion.items.length} mặt hàng`}
    </button>}
  </section>
}

/** The dashboard's reminder: one line per season (what, how many products, by when), the full list in a dialog. */
function Banner({ seasons, productsPath, createRule, creating, embedded = false }: { seasons: SeasonalSuggestion[]; productsPath?: string; createRule: CreateRule; creating: string | null; embedded?: boolean }) {
  const [open, setOpen] = useState<SeasonalSuggestion | null>(null)
  const today = todayVn()
  const footer = open && (productsPath || createRule)
    ? <div className="flex flex-wrap justify-end gap-2">
      {productsPath && <Link to={productsPath} className="inline-flex h-9 items-center rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50">Quản lý sản phẩm</Link>}
      {/* The dialog closes first, so the rule form never opens on top of it. */}
      {createRule && <CreateRuleButton primary suggestion={open} busy={creating === open.id} onCreate={s => { setOpen(null); createRule(s) }} />}
    </div>
    : undefined
  return <section aria-label="Sắp tới mùa vụ" className={embedded ? 'border-t border-amber-100 bg-amber-50/50' : 'rounded-xl border border-amber-200 bg-amber-50/60'}>
    <ul className="divide-y divide-amber-100">
      {seasons.map(season => {
        const orderBy = orderByOf(season)
        const urgent = !!orderBy && orderBy <= today
        return <li key={season.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:flex-nowrap ${embedded ? 'py-2 sm:px-5' : 'py-2.5'}`}>
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white text-amber-700 ring-1 ring-amber-200"><CalendarClock size={16} /></span>
          <p className="min-w-0 flex-1 text-sm leading-5 text-zinc-700">
            <strong className="font-medium text-zinc-900">Sắp tới vụ {season.cropName}</strong> ({formatDate(season.startsOn)} – {formatDate(season.endsOn)})
            {season.items.length > 0 ? <> · {season.items.length} mặt hàng nên chuẩn bị</> : <> · chưa đủ dữ liệu để gợi ý</>}
            {orderBy && <> · đặt hàng trước {formatDate(orderBy)}</>}
            {urgent && <span className="font-medium text-amber-800"> · nên đặt ngay</span>}
          </p>
          <button type="button" onClick={() => setOpen(season)} aria-label={`Xem gợi ý nhập hàng vụ ${season.cropName}`}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-amber-50">
            Xem gợi ý<ChevronRight size={15} aria-hidden="true" />
          </button>
        </li>
      })}
    </ul>
    {open && <DetailModal open onClose={() => setOpen(null)} widthClassName="max-w-3xl">
      <ModalLayout header={<h3 className="text-lg font-semibold">Gợi ý nhập hàng vụ {open.cropName}</h3>} footer={footer}>
        <p className="text-xs text-zinc-500">{NOTE}</p>
        <Season suggestion={open} />
      </ModalLayout>
    </DetailModal>}
  </section>
}

/**
 * Seasons that start soon, have no seasonal rule yet, and the products worth stocking for them (F4.7). The server
 * prepares and notifies; an owner with SEASONAL_RULES.MANAGE can open the seasonal-rule form filled in from a season and
 * save it, which plans the season and drops it from this notice. Nothing else is written here. Hidden without
 * SEASONAL_RULES.READ, while loading, when nothing is upcoming and when the list cannot be read, so it never blocks the
 * page it sits on.
 */
export default function SeasonalSuggestionNotice({ productsPath, variant = 'card' }: Props) {
  const { has } = usePermission()
  const { showToast } = useToast()
  const allowed = has('SEASONAL_RULES.READ')
  const canManage = has('SEASONAL_RULES.MANAGE')
  const [seasons, setSeasons] = useState<SeasonalSuggestion[]>([])
  const [reload, setReload] = useState(0)
  const [creating, setCreating] = useState<string | null>(null)
  const [draft, setDraft] = useState<SeasonalRuleDraft | null>(null)

  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    const today = todayVn()
    void (async () => {
      try {
        const page = await seasonalSuggestionsApi.list({ fromDate: today, page: 1, pageSize: 10 }, controller.signal)
        // A season a rule already covers is planned: the reminder stops, and so does the notice.
        const upcoming = page.items.filter(row => row.startsOn >= today && !row.coveringRule).slice(0, SEASONS)
        const loaded = await Promise.all(upcoming.map(row => seasonalSuggestionsApi.get(row.id, controller.signal)))
        if (!controller.signal.aborted) setSeasons(loaded)
      } catch {
        if (!controller.signal.aborted) setSeasons([])
      }
    })()
    return () => controller.abort()
  }, [allowed, reload])

  const createRule: CreateRule = canManage ? async suggestion => {
    if (creating) return
    setCreating(suggestion.id)
    try {
      const next = await seasonalSuggestionsApi.ruleDraft(suggestion.id)
      if (next.coveringRule) {
        showToast(`Vụ ${next.cropName} đã có quy tắc mùa vụ "${next.coveringRule.name}".`, 'info')
        setReload(v => v + 1)
      } else setDraft(next)
    } catch (err) {
      showToast(describeError(err, 'Không mở được quy tắc điền sẵn từ gợi ý.'), 'error')
    } finally {
      setCreating(null)
    }
  } : null

  const form = draft && <SeasonalRuleFormModal rule={null} draft={draft} onClose={() => setDraft(null)} onSaved={() => {
    showToast(`Đã tạo quy tắc mùa vụ cho vụ ${draft.cropName}.`, 'success')
    setDraft(null)
    setReload(v => v + 1)
  }} />

  if (!allowed || seasons.length === 0) return form || null
  if (variant !== 'card') return <>
    <Banner seasons={seasons} productsPath={productsPath} createRule={createRule} creating={creating} embedded={variant === 'row'} />
    {form}
  </>
  return <>
    <section aria-label="Sắp tới mùa vụ" className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5 text-base font-medium text-zinc-900">
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-md bg-amber-50 text-amber-700"><CalendarClock size={16} /></span>Sắp tới mùa vụ: gợi ý nhập hàng
        </h3>
        {productsPath && <Link to={productsPath} className="text-sm font-medium text-green-800 hover:underline">Quản lý sản phẩm</Link>}
      </div>
      <p className="text-xs text-zinc-500">{NOTE}</p>
      <div className="space-y-5 divide-y divide-zinc-100 [&>section:not(:first-child)]:pt-5">
        {seasons.map(s => <Season key={s.id} suggestion={s} preview={PREVIEW}
          action={createRule && <CreateRuleButton suggestion={s} busy={creating === s.id} onCreate={createRule} />} />)}
      </div>
    </section>
    {form}
  </>
}
