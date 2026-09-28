import { orderStatusFunnelData } from '../dashboardData'

export default function OrderStatusFunnelChart() {
  const maxVal = Math.max(1, ...orderStatusFunnelData.map((d) => d.value))

  return (
    <div className="w-full flex flex-col gap-3 mt-4">
      {orderStatusFunnelData.map((item) => {
        const width = (item.value / maxVal) * 100
        return (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-semibold text-slate-600">{item.name}</span>
            <div className="flex-1 h-4 bg-slate-100 rounded-sm overflow-hidden">
              <div className="h-full rounded-sm transition-all duration-300" style={{ width: `${Math.max(width, 4)}%`, backgroundColor: item.color }} />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-bold text-slate-900">{item.value}</span>
          </div>
        )
      })}
    </div>
  )
}
