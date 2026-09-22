import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts'
import { ordersByDayData } from '../dashboardData'

export default function OrdersByDayChart() {
  return (
    <div className="h-20 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={ordersByDayData}>
          <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
          <Bar dataKey="value" fill="#4caf50" radius={[4, 4, 4, 4]} barSize={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
