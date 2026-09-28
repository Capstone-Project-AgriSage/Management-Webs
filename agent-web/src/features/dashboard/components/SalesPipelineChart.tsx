import { orderPipelineData } from '../mockSalesData'

export default function SalesPipelineChart() {
  const maxVal = orderPipelineData[0].value

  return (
    <div className="w-full flex flex-col items-center pt-8 pb-4 relative h-[250px]">
      <div className="absolute top-0 left-0 text-xs font-bold text-slate-500">{orderPipelineData[0].value}</div>
      <div className="absolute top-0 right-0 text-xs font-bold text-slate-500">{orderPipelineData[0].name}</div>
      
      {orderPipelineData.map((item, idx) => {
        const width = (item.value / maxVal) * 100
        const isLast = idx === orderPipelineData.length - 1
        
        return (
          <div key={item.name} className="flex flex-col items-center w-full group relative" style={{ height: '40px' }}>
             {/* Simple bar to represent funnel step */}
             <div 
               className="h-full transition-all duration-300"
               style={{ 
                 width: `${Math.max(width, 2)}%`, 
                 backgroundColor: item.color,
                 clipPath: isLast ? 'none' : 'polygon(0% 0%, 100% 0%, 90% 100%, 10% 100%)',
                 borderBottom: isLast ? 'none' : '1px solid white'
               }}
             />
             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600 bg-white/70 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
               {item.value}
             </span>
             <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-600 bg-white/70 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
               {item.name}
             </span>
          </div>
        )
      })}
      
      <div className="absolute bottom-0 left-0 text-[11px] text-slate-500 font-medium">
        Đơn hàng tăng 18.2% so với tháng trước.
      </div>
    </div>
  )
}
