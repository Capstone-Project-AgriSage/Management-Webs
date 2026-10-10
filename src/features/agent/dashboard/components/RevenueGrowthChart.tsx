import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { revenueGrowthData } from '@/features/agent/dashboard/mockSalesData';

export default function RevenueGrowthChart() {
  return (
    <div className="h-48 w-full min-w-0 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={revenueGrowthData}>
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Line type="monotone" dataKey="value" name="Doanh thu" stroke="#16a34a" strokeWidth={2} dot={{ r: 3, fill: '#16a34a', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#15803d' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
