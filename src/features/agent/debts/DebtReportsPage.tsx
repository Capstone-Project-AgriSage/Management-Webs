import { useState, useEffect } from 'react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { reportsApi, type DebtAgingReport, type DebtCollectionReport, type DebtByGroupReport } from '@/api/reportsApi'
import { formatVnd } from '@/utils/money'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Calendar, RefreshCw } from 'lucide-react'

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#b91c1c']
const GROUP_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6']

export default function DebtReportsPage() {
  usePageHeader({
    title: 'Báo cáo Công Nợ',
    subtitle: 'Thống kê tuổi nợ, hiệu quả thu hồi nợ và nợ theo nhóm'
  })

  const { showToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [agingData, setAgingData] = useState<DebtAgingReport | null>(null)
  const [collectionData, setCollectionData] = useState<DebtCollectionReport | null>(null)
  const [groupData, setGroupData] = useState<DebtByGroupReport[]>([])

  const [dateRange, setDateRange] = useState({
    fromDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [agingRes, collectionRes, groupRes] = await Promise.all([
        reportsApi.getDebtAging(),
        reportsApi.getDebtCollections({ fromDate: dateRange.fromDate, toDate: dateRange.toDate }),
        reportsApi.getDebtByGroup()
      ])
      
      setAgingData(agingRes)
      setCollectionData(collectionRes)
      setGroupData(groupRes)
    } catch (err: any) {
      showToast(err.message || 'Lỗi tải báo cáo công nợ', 'error')
    } finally {
      setLoading(false)
    }
  }

  const formatPieData = (aging: DebtAgingReport | null) => {
    if (!aging) return []
    return [
      { name: 'Trong hạn', value: aging.notYetDue },
      { name: 'Quá hạn 1-30 ngày', value: aging.overdue1_30 },
      { name: 'Quá hạn 31-60 ngày', value: aging.overdue31_60 },
      { name: 'Quá hạn 61-90 ngày', value: aging.overdue61_90 },
      { name: 'Quá hạn >90 ngày', value: aging.overdue91Plus },
    ].filter(d => d.value > 0)
  }

  const formatGroupChartData = (groups: DebtByGroupReport[]) => {
    return groups.map(g => ({
      name: g.groupName,
      'Tổng nợ': g.totalDebt,
      'Quá hạn': g.totalOverdue
    }))
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg pb-10">
      
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Calendar size={20} className="text-slate-500" />
          Kỳ báo cáo
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              className="border-slate-300 rounded-md text-sm shadow-sm focus:ring-primary focus:border-primary"
              value={dateRange.fromDate}
              onChange={e => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
            />
            <span className="text-slate-500">đến</span>
            <input 
              type="date" 
              className="border-slate-300 rounded-md text-sm shadow-sm focus:ring-primary focus:border-primary"
              value={dateRange.toDate}
              onChange={e => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
            />
          </div>
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
        
        {/* Tuổi Nợ */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Báo cáo Tuổi nợ (Aging Report)</h3>
          
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-100 mb-6">
            <span className="text-slate-600 font-medium">Tổng dư nợ:</span>
            <span className="text-2xl font-bold text-slate-900">{agingData ? formatVnd(agingData.totalDebt) : '...'}</span>
          </div>

          <div className="flex-1 min-h-[300px]">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Đang tải...</div>
            ) : agingData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={formatPieData(agingData)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {formatPieData(agingData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => formatVnd(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>

        {/* Hiệu quả thu hồi */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Thu hồi nợ trong kỳ</h3>
          
          <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-lg border border-emerald-100 mb-6">
            <span className="text-emerald-700 font-medium">Đã thu hồi:</span>
            <span className="text-2xl font-bold text-emerald-700">{collectionData ? formatVnd(collectionData.totalCollected) : '...'}</span>
          </div>

          <div className="flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-sm">
                  <th className="py-3 px-2 font-medium">Phương thức</th>
                  <th className="py-3 px-2 font-medium text-right">Số tiền</th>
                  <th className="py-3 px-2 font-medium text-right">Tỷ trọng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {collectionData?.byMethod.map((item, i) => (
                  <tr key={i}>
                    <td className="py-4 px-2 text-slate-900 font-medium">{item.method}</td>
                    <td className="py-4 px-2 text-right font-bold text-slate-700">{formatVnd(item.amount)}</td>
                    <td className="py-4 px-2 text-right text-slate-500 text-sm">
                      {collectionData.totalCollected > 0 
                        ? ((item.amount / collectionData.totalCollected) * 100).toFixed(1) + '%' 
                        : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nợ theo nhóm khách hàng */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col lg:col-span-2">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-3 mb-6">Phân tích nợ theo Nhóm khách hàng</h3>
          
          <div className="h-[400px]">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Đang tải...</div>
            ) : groupData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formatGroupChartData(groupData)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                  />
                  <RechartsTooltip formatter={(value: number) => formatVnd(value)} cursor={{fill: '#f1f5f9'}} />
                  <Legend />
                  <Bar dataKey="Tổng nợ" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Quá hạn" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500">Chưa có dữ liệu.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
