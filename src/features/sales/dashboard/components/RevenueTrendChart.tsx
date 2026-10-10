import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { revenueByDayData } from '@/features/sales/dashboard/dashboardData';
import { formatVnd } from '@/utils/money';

export default function RevenueTrendChart() {
  return (
    <div className="h-64 w-full min-w-0 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={revenueByDayData}>
          <Tooltip
            formatter={(value) => formatVnd(Number(value))}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Line type="monotone" dataKey="value" name="Doanh thu" stroke="#16a34a" strokeWidth={2} dot={{ r: 3, fill: '#16a34a', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#15803d' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
