import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import {
  CONFIDENCE_LABEL, GROUP_LABEL, seasonalSuggestionsApi, type SeasonalSuggestion, type SuggestionItem,
} from '@/api/seasonalSuggestionsApi'
import { usePermission } from '@/context/PermissionContext'
import { todayVn } from '@/utils/creditLabels'
import { formatDate, formatQtyUnit } from '@/utils/units'

const SEASONS = 3
const PREVIEW = 4

const CONFIDENCE_TONE: Record<SuggestionItem['confidence'], string> = {
  HIGH: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
  LOW: '',
}

/** `productsPath`: a link to the product page (the dashboard shows one; the product page itself does not). */
interface Props { productsPath?: string }

function Row({ item }: { item: SuggestionItem }) {
  return <li className="py-2.5 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-center gap-2">
      <strong className="text-sm text-slate-900">{item.productName}</strong>
      <span className="text-xs text-slate-500">{item.sku}</span>
      <span className="rounded px-2 py-0.5 text-[11px] bg-slate-100 text-slate-700">{GROUP_LABEL[item.group]}</span>
      <StatusBadge size="xs" label={CONFIDENCE_LABEL[item.confidence]} className={CONFIDENCE_TONE[item.confidence]} />
      {!item.inStore && <StatusBadge size="xs" label="Chưa có trong cửa hàng" className="bg-amber-50 text-amber-800 border-amber-200" />}
    </div>
    <p className="mt-1 text-sm text-slate-700">{item.reason}</p>
    {item.inStore && item.suggestedTargetBase !== null && <p className="mt-0.5 text-xs text-slate-500">
      Mục tiêu tồn gợi ý {formatQtyUnit(item.suggestedTargetBase, item.baseUnit)}
      {item.sellableBase !== null && <> · tồn có thể bán {formatQtyUnit(item.sellableBase, item.baseUnit)}</>}
    </p>}
    {item.evidence.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-slate-500 space-y-0.5" aria-label={`Căn cứ dữ liệu của ${item.productName}`}>
      {item.evidence.map(e => <li key={e.kind + e.text}>{e.text}</li>)}
    </ul>}
  </li>
}

function Season({ suggestion }: { suggestion: SeasonalSuggestion }) {
  const [all, setAll] = useState(false)
  const items = all ? suggestion.items : suggestion.items.slice(0, PREVIEW)
  const orderBy = suggestion.items.map(i => i.orderByDate).filter((d): d is string => !!d).sort()[0]
  const today = todayVn()
  return <section className="space-y-3" aria-label={`Gợi ý nhập hàng vụ ${suggestion.cropName}`}>
    <div>
      <h4 className="text-sm font-semibold text-slate-900">Vụ {suggestion.cropName}: {formatDate(suggestion.startsOn)} – {formatDate(suggestion.endsOn)}</h4>
      {orderBy && <p className="text-xs text-slate-500">
        Nên đặt hàng trước {formatDate(orderBy)}{orderBy <= today && <span className="text-amber-700"> · nên đặt ngay</span>}
        {' '}· so với cùng kỳ {formatDate(suggestion.comparedFrom)} – {formatDate(suggestion.comparedTo)}
      </p>}
    </div>
    {suggestion.items.length === 0
      ? <p className="text-sm text-slate-600">Chưa đủ dữ liệu để gợi ý mặt hàng cho vụ này. Hãy kiểm tra danh mục sản phẩm và quy tắc mùa vụ.</p>
      : <ul className="divide-y divide-slate-100">{items.map(item => <Row key={item.id} item={item} />)}</ul>}
    {suggestion.items.length > PREVIEW && <button type="button" className="text-sm font-medium text-emerald-700 hover:underline" onClick={() => setAll(v => !v)}>
      {all ? 'Thu gọn' : `Xem tất cả ${suggestion.items.length} mặt hàng`}
    </button>}
  </section>
}

/**
 * Seasons that start soon and the products worth stocking for them (F4.7). Read only: the server prepares and
 * notifies, nothing here creates a rule, a receipt or stock. Hidden without SEASONAL_RULES.READ, while loading,
 * when nothing is upcoming and when the list cannot be read, so it never blocks the page it sits on.
 */
export default function SeasonalSuggestionNotice({ productsPath }: Props) {
  const { has } = usePermission()
  const allowed = has('SEASONAL_RULES.READ')
  const [seasons, setSeasons] = useState<SeasonalSuggestion[]>([])

  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    const today = todayVn()
    void (async () => {
      try {
        const page = await seasonalSuggestionsApi.list({ fromDate: today, page: 1, pageSize: 10 }, controller.signal)
        const upcoming = page.items.filter(row => row.startsOn >= today).slice(0, SEASONS)
        const loaded = await Promise.all(upcoming.map(row => seasonalSuggestionsApi.get(row.id, controller.signal)))
        if (!controller.signal.aborted) setSeasons(loaded)
      } catch {
        if (!controller.signal.aborted) setSeasons([])
      }
    })()
    return () => controller.abort()
  }, [allowed])

  if (!allowed || seasons.length === 0) return null
  return <section aria-label="Sắp tới mùa vụ" className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <CalendarClock size={18} aria-hidden="true" className="text-emerald-700" />Sắp tới mùa vụ: gợi ý nhập hàng
      </h3>
      {productsPath && <Link to={productsPath} className="text-sm font-medium text-emerald-700 hover:underline">Quản lý sản phẩm</Link>}
    </div>
    <p className="text-xs text-slate-500">
      Hệ thống tự tính từ bán hàng cùng kỳ năm trước, liên kết bệnh – sản phẩm đã duyệt và quy tắc mùa vụ. Chỉ để tham khảo: không tự tạo phiếu nhập hay đổi tồn kho.
    </p>
    <div className="space-y-5 divide-y divide-emerald-100 [&>section:not(:first-child)]:pt-5">
      {seasons.map(s => <Season key={s.id} suggestion={s} />)}
    </div>
  </section>
}
