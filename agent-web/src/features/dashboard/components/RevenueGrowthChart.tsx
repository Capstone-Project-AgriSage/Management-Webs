import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { revenueGrowthData } from '../mockSalesData'

export default function RevenueGrowthChart() {
  return (
    <div className="h-32 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={revenueGrowthData}>
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Line type="monotone" dataKey="value" stroke="#4caf50" strokeWidth={2} dot={{ r: 3, fill: '#4caf50', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#2e7d32' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
