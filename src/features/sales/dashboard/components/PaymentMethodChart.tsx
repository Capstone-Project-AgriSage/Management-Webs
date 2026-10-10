import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ordersByPaymentMethodData } from '@/features/sales/dashboard/dashboardData';

export default function PaymentMethodChart() {
  const total = ordersByPaymentMethodData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="flex flex-col items-center w-full gap-5 mt-4 relative min-w-0">
      <div className="w-full h-48 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={ordersByPaymentMethodData} innerRadius="65%" outerRadius="90%" paddingAngle={2} dataKey="value">
              {ordersByPaymentMethodData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-slate-900">{total}</span>
          <span className="text-xs font-medium text-slate-500">Đơn hàng</span>
        </div>
      </div>
      <div className="w-full flex flex-col justify-center gap-3">
        {ordersByPaymentMethodData.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-medium min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
              {item.name}
            </div>
            <span className="font-semibold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
