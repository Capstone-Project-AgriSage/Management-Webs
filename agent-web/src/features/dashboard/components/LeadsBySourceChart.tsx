import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ordersBySourceData } from '../mockSalesData'

export default function LeadsBySourceChart() {
  const totalLeads = ordersBySourceData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="flex items-center h-48 w-full gap-8 relative">
      <div className="w-1/2 h-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={ordersBySourceData}
              innerRadius="65%"
              outerRadius="90%"
              paddingAngle={2}
              dataKey="value"
            >
              {ordersBySourceData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-slate-900">{totalLeads}</span>
          <span className="text-xs font-medium text-slate-500">Đơn hàng</span>
        </div>
      </div>
      <div className="w-1/2 flex flex-col justify-center gap-2">
        {ordersBySourceData.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-medium">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
              {item.name}
            </div>
            <span className="font-semibold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
