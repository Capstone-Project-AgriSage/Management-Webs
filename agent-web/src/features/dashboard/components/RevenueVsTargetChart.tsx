import { productRevenueVsTargetData } from '../mockSalesData'

export default function RevenueVsTargetChart() {
  const maxVal = Math.max(...productRevenueVsTargetData.map(d => d.actual + d.target))

  return (
    <div className="w-full flex flex-col gap-3 mt-4">
      {productRevenueVsTargetData.map((item) => {
        const actualWidth = (item.actual / maxVal) * 100
        const targetWidth = (item.target / maxVal) * 100

        return (
          <div key={item.name} className="flex flex-col gap-1">
            <div className="text-xs font-semibold text-slate-500">{item.name}</div>
            <div className="flex w-full h-4 relative bg-slate-100 rounded-sm overflow-hidden">
              <div 
                className="h-full bg-emerald-300 relative"
                style={{ width: `${actualWidth}%` }}
              >
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">{item.actual}</span>
              </div>
              <div 
                className="h-full bg-emerald-600 relative"
                style={{ width: `${targetWidth}%` }}
              >
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">{item.target}</span>
              </div>
            </div>
          </div>
        )
      })}
      <div className="text-[11px] text-slate-500 font-medium mt-2">
        Tiến độ: 78% - 2 nhóm vượt chỉ tiêu
      </div>
    </div>
  )
}
