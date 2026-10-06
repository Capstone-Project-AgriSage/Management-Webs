import { useState, useEffect, useMemo } from 'react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { reportsApi, type DeliveryReportResponse } from '@/api/reportsApi'
import { useToast } from '@/context/ToastContext'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie } from 'recharts'
import { isoDateOffsetFromToday } from '@/utils/date'
import { FAILURE_REASON_LABEL, labelOf } from '@/utils/deliveryLabels'

const INCIDENT_LABELS: Record<string, string> = {
  GOODS_DAMAGED: 'Hàng bị hư hỏng',
  VEHICLE_ACCIDENT: 'Tai nạn / xe hỏng',
  CUSTOMER_REFUSED_AT_DOOR: 'Khách từ chối ngay tại cửa',
  ADDRESS_NOT_FOUND: 'Không tìm thấy địa chỉ',
  OTHER: 'Khác',
}

const COLORS = ['#22c55e', '#eab308', '#ef4444', '#3b82f6', '#a855f7', '#f97316', '#64748b']

export default function DeliveryReportsPage() {
  usePageHeader({ title: 'Báo cáo giao hàng', subtitle: 'Thống kê hiệu quả giao hàng của tài xế' })
  const { showToast } = useToast()

  const [fromDate, setFromDate] = useState(isoDateOffsetFromToday(-30))
  const [toDate, setToDate] = useState(isoDateOffsetFromToday(0))
  const [groupBy, setGroupBy] = useState<'STAFF' | 'DAY'>('STAFF')

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DeliveryReportResponse | null>(null)

  const fetchReport = async () => {
    try {
      setLoading(true)
      const res = await reportsApi.getDeliveryReports({ fromDate, toDate, groupBy })
      setData(res)
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tải báo cáo', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const failurePieData = useMemo(() => {
    if (!data) return []
    return data.failureReasons.map((f) => ({
      name: labelOf(FAILURE_REASON_LABEL, f.code),
      value: f.count,
    }))
  }, [data])

  const incidentPieData = useMemo(() => {
    if (!data) return []
    return data.incidents.map((i) => ({
      name: INCIDENT_LABELS[i.incidentType] || i.incidentType,
      value: i.open + i.resolved,
    }))
  }, [data])

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg pb-10">
      <div className="flex flex-wrap items-end gap-space-md bg-surface-container-low border-none">
        <label className="block flex-1 min-w-[200px]">
          <span className="font-label-md text-label-md text-on-surface-variant block mb-1">Từ ngày</span>
          <input
            type="date"
            className="w-full h-10 px-3 bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-sm"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="block flex-1 min-w-[200px]">
          <span className="font-label-md text-label-md text-on-surface-variant block mb-1">Đến ngày</span>
          <input
            type="date"
            className="w-full h-10 px-3 bg-white border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-sm"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <div className="flex-1 min-w-[200px]">
          <span className="font-label-md text-label-md text-on-surface-variant block mb-1">Gộp theo</span>
          <div className="flex bg-white border border-outline-variant rounded h-10 overflow-hidden">
            <button
              type="button"
              className={`flex-1 text-sm font-medium transition-colors ${groupBy === 'STAFF' ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-low'}`}
              onClick={() => setGroupBy('STAFF')}
            >
              Tài xế
            </button>
            <button
              type="button"
              className={`flex-1 text-sm font-medium transition-colors border-l border-outline-variant ${groupBy === 'DAY' ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-low'}`}
              onClick={() => setGroupBy('DAY')}
            >
              Theo Ngày
            </button>
          </div>
        </div>
        <Button icon="search" onClick={fetchReport} disabled={loading} className="h-10">
          Xem báo cáo
        </Button>
      </div>

      {loading && !data && (
        <div className="py-20 text-center text-on-surface-variant">Đang phân tích dữ liệu...</div>
      )}

      {data && (
        <>
          {/* Tổng quan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
            <div className="text-center bg-primary-fixed/30 border-primary-fixed-dim">
              <span className="material-symbols-outlined text-[32px] text-primary mb-2">local_shipping</span>
              <p className="font-label-md text-label-md text-on-surface-variant">Tổng số chuyến</p>
              <p className="font-headline-lg text-headline-lg font-bold text-on-surface mt-1">{data.totals.deliveries}</p>
            </div>
            <div className="text-center bg-secondary-fixed/30 border-secondary-fixed-dim">
              <span className="material-symbols-outlined text-[32px] text-secondary mb-2">replay</span>
              <p className="font-label-md text-label-md text-on-surface-variant">Tổng lần chạy (Attempts)</p>
              <p className="font-headline-lg text-headline-lg font-bold text-on-surface mt-1">{data.totals.attempts}</p>
            </div>
            <div className="text-center bg-green-50 border-green-200">
              <span className="material-symbols-outlined text-[32px] text-green-600 mb-2">check_circle</span>
              <p className="font-label-md text-label-md text-green-800">Giao thành công</p>
              <p className="font-headline-lg text-headline-lg font-bold text-green-700 mt-1">
                {data.totals.successful} <span className="text-sm font-normal">({(data.totals.successRate * 100).toFixed(0)}%)</span>
              </p>
            </div>
            <div className="text-center bg-error-container/40 border-error/20">
              <span className="material-symbols-outlined text-[32px] text-error mb-2">cancel</span>
              <p className="font-label-md text-label-md text-on-error-container">Giao thất bại</p>
              <p className="font-headline-lg text-headline-lg font-bold text-error mt-1">{data.totals.failed}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
            {/* Chart: Hiệu suất theo tài xế / ngày */}
            <div className="lg:col-span-2 flex flex-col">
              <h3 className="font-title-md text-title-md font-bold text-on-surface mb-space-lg">
                {groupBy === 'STAFF' ? 'Kết quả giao hàng theo Tài xế' : 'Tiến độ giao hàng theo Ngày'}
              </h3>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.rows} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="successful" name="Thành công" stackId="a" fill="#22c55e" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="partial" name="Giao 1 phần" stackId="a" fill="#eab308" />
                    <Bar dataKey="failed" name="Thất bại" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Phân tích lý do */}
            <div className="flex flex-col gap-space-md">
              <div className="flex-1 flex flex-col">
                <h3 className="font-title-md text-title-md font-bold text-on-surface mb-space-md">Lý do thất bại</h3>
                {failurePieData.length > 0 ? (
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={failurePieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                          {failurePieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant bg-surface-container-low rounded">
                    Không có dữ liệu
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col">
                <h3 className="font-title-md text-title-md font-bold text-on-surface mb-space-md">Sự cố trên đường</h3>
                {incidentPieData.length > 0 ? (
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={incidentPieData} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                          {incidentPieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant bg-surface-container-low rounded">
                    Không có dữ liệu
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}



