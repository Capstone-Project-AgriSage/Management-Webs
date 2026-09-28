import { debtByStatusData } from '../dashboardData'
import { formatVnd } from '../../../utils/money'

export default function DebtByStatusChart() {
  const maxVal = Math.max(1, ...debtByStatusData.map((d) => d.value))

  return (
    <div className="w-full flex flex-col gap-3 mt-4">
      {debtByStatusData.map((item) => {
        const width = (item.value / maxVal) * 100
        return (
          <div key={item.name} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{item.name}</span>
              <span className="text-slate-900">{formatVnd(item.value)}</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-sm overflow-hidden">
              <div className="h-full rounded-sm transition-all duration-300" style={{ width: `${Math.max(width, 4)}%`, backgroundColor: item.color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
