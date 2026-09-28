import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { debtCollectionData } from '../mockSalesData'

export default function ProposalsSentChart() {
  return (
    <div className="h-20 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={debtCollectionData}>
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Line type="monotone" dataKey="value" stroke="#4caf50" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
