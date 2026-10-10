import { todayVn } from '@/utils/creditLabels'
import { rangeDays } from '@/utils/units'

export const reportInputClass = 'h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500'
export const firstOfMonthVn = () => `${todayVn().slice(0, 8)}01`
export function periodProblem(from: string, to: string): string | null {
  const days = rangeDays(from, to)
  if (!from || !to) return 'Chọn đủ ngày bắt đầu và ngày kết thúc.'
  if (days <= 0) return 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.'
  if (days > 366) return 'Khoảng thời gian tối đa 366 ngày.'
  if (from <= '0001-01-01' || to >= '9999-12-31') return 'Khoảng ngày nằm ngoài phạm vi được hỗ trợ.'
  return null
}
