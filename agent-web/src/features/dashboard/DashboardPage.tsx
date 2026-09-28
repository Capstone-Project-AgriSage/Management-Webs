import { useState } from 'react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import { Calendar, DollarSign, Briefcase, Download, ChevronDown, MoreVertical, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import NewLeadsChart from './components/NewLeadsChart'
import ProposalsSentChart from './components/ProposalsSentChart'
import RevenueGrowthChart from './components/RevenueGrowthChart'
import LeadsBySourceChart from './components/LeadsBySourceChart'
import RevenueVsTargetChart from './components/RevenueVsTargetChart'
import SalesPipelineChart from './components/SalesPipelineChart'
import { revenueByRegionData, actionItemsData } from './mockSalesData'
import DetailModal from '../../components/ui/DetailModal'

import { orders as ALL_ORDERS } from '../../data/mockOrders'
import { debtCustomers as ALL_DEBT_CUSTOMERS } from '../../data/mockDebts'
import { parseVnd, formatVnd } from '../../utils/money'

export default function DashboardPage() {
  usePageHeader({
    title: 'Tổng Quan Bán Hàng',
  })
  
  const { showToast } = useToast()
  
  const [isLeadDetailOpen, setIsLeadDetailOpen] = useState(false)
  const [viewModeOpen, setViewModeOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [optionsMenuOpenId, setOptionsMenuOpenId] = useState<string | null>(null)

  const handleDownloadLeadCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + "Nguồn,Số lượng,Tỷ lệ chuyển đổi\n"
      + "Mua trực tiếp,65,70%\n"
      + "Gọi điện,45,60%\n"
      + "Zalo/FB,35,40%\n"
      + "Nông dân giới thiệu,25,85%";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "nguon_khach_hang.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Tải xuống CSV thành công!');
  }

  const handleExportRecentOrders = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + "Mã Đơn,Khách Hàng,Sản Phẩm,Trạng Thái,Tổng Tiền\n"
      + ALL_ORDERS.slice(0, 10).map(o => `${o.id},${o.customer},"${o.items.map(i => i.name).join(', ')}",${o.status.label},${o.total}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "don_hang_gan_day.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Xuất danh sách đơn hàng thành công!');
  }

  // KPI Calculations
  const totalRevenue = ALL_ORDERS.reduce((sum, o) => sum + parseVnd(o.total), 0)
  const debtHouseholds = ALL_DEBT_CUSTOMERS.filter((c) => parseVnd(c.remaining) > 0)
  const totalDebtRemaining = debtHouseholds.reduce((sum, c) => sum + parseVnd(c.remaining), 0)
  const todayOrders = ALL_ORDERS.filter(o => o.timeRest === 'Hôm nay')
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  
  const totalPages = Math.ceil(ALL_ORDERS.length / pageSize)
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }
  
  // New KPIs for Phase 3
  const pendingOrdersCount = ALL_ORDERS.filter(o => o.statusBadge.label === 'Đang xử lý').length
  const pendingVietQrCount = 2 // Mock value for PENDING_VERIFICATION
  const pendingAiReviewsCount = 5 // Mock value for AI cases
  const lowStockCount = 8 // Mock value for Low Stock products
  const activeDeliveriesCount = 3 // Mock value for delivering trips


  return (
    <div className="space-y-4 pb-12">
      {/* 1. TOP METRICS ROW */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: New Leads -> Đơn hàng hôm nay */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Đơn Hàng Hôm Nay</h3>
            <p className="text-xs text-slate-500">Toàn bộ chi nhánh</p>
          </div>
          <NewLeadsChart />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
            <span className="text-xl font-bold text-slate-900">{todayOrders.length}</span>
            <span className="text-xs font-semibold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">+15.2%</span>
          </div>
        </div>

        {/* Card 2: Proposals Sent -> Công Nợ Thu Hồi */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Tiến Độ Thu Nợ</h3>
            <p className="text-xs text-slate-500">Trong tháng</p>
          </div>
          <ProposalsSentChart />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
            <span className="text-xl font-bold text-transparent">0</span>
            <span className="text-xs font-semibold text-transparent">0</span>
          </div>
        </div>

        {/* Card 3: Revenue -> Doanh Thu */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
           <div className="absolute top-4 right-4 w-8 h-8 bg-emerald-50 text-emerald-500 rounded-md flex items-center justify-center">
             <DollarSign size={18} />
           </div>
           <div>
            <h3 className="text-sm font-semibold text-slate-900 mt-8">Tổng Doanh Thu</h3>
            <p className="text-xs text-slate-500">Tất cả đơn hàng</p>
           </div>
           <div className="mt-4">
             <span className="text-2xl font-bold text-slate-900">{formatVnd(totalRevenue)}</span>
           </div>
           <div className="mt-auto pt-4">
             <span className="text-xs font-semibold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">+12.5%</span>
           </div>
        </div>

        {/* Card 4: Projects Won -> Khách Hàng Nợ */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
           <div className="absolute top-4 right-4 w-8 h-8 bg-rose-50 text-rose-500 rounded-md flex items-center justify-center">
             <Briefcase size={18} />
           </div>
           <div>
            <h3 className="text-sm font-semibold text-slate-900 mt-8">Công Nợ Tồn Đọng</h3>
            <p className="text-xs text-slate-500">{debtHouseholds.length} hộ chưa thanh toán</p>
           </div>
           <div className="mt-4">
             <span className="text-2xl font-bold text-slate-900">{formatVnd(totalDebtRemaining)}</span>
           </div>
           <div className="mt-auto pt-4">
             <span className="text-xs font-semibold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">-5.2%</span>
           </div>
        </div>

        {/* Card 5: Revenue Growth */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between lg:col-span-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Biểu Đồ Doanh Thu</h3>
            <p className="text-xs text-slate-500">Theo các tháng trong năm</p>
          </div>
          <RevenueGrowthChart />
          <div className="mt-2 text-xs font-medium text-slate-500">
            Tăng trưởng +35% so với năm ngoái
          </div>
        </div>
      </section>

      {/* NEW SECTION: Alerts & Pending Actions */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4">Cần Xử Lý & Cảnh Báo</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
            <div className="text-xs font-semibold text-amber-700">Đơn chờ xử lý</div>
            <div className="text-2xl font-bold text-amber-900 mt-1">{pendingOrdersCount}</div>
          </div>
          <div className="p-3 border border-indigo-200 bg-indigo-50 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors">
            <div className="text-xs font-semibold text-indigo-700">Thanh toán VietQR chờ</div>
            <div className="text-2xl font-bold text-indigo-900 mt-1">{pendingVietQrCount}</div>
          </div>
          <div className="p-3 border border-purple-200 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors">
            <div className="text-xs font-semibold text-purple-700">Ca AI chờ review</div>
            <div className="text-2xl font-bold text-purple-900 mt-1">{pendingAiReviewsCount}</div>
          </div>
          <div className="p-3 border border-rose-200 bg-rose-50 rounded-lg cursor-pointer hover:bg-rose-100 transition-colors">
            <div className="text-xs font-semibold text-rose-700">Sản phẩm sắp hết hàng</div>
            <div className="text-2xl font-bold text-rose-900 mt-1">{lowStockCount}</div>
          </div>
          <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
            <div className="text-xs font-semibold text-blue-700">Đang giao hàng</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">{activeDeliveriesCount}</div>
          </div>
        </div>
      </section>

      {/* 2. CHARTS ROW 1 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leads by Source -> Nguồn Đơn Hàng */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Nguồn Khách Hàng</h3>
          <LeadsBySourceChart />
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
             <button onClick={() => setIsLeadDetailOpen(true)} className="flex-1 py-1.5 text-xs font-semibold border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50/50">Xem Chi Tiết</button>
             <button onClick={handleDownloadLeadCSV} className="flex-1 py-1.5 text-xs font-semibold border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50/50">Tải CSV</button>
          </div>
        </div>

        {/* Project Revenue vs Target -> Doanh thu theo SP */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Doanh Thu Sản Phẩm vs Chỉ Tiêu</h3>
          <RevenueVsTargetChart />
        </div>
      </section>

      {/* 3. CHARTS ROW 2 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sales Pipeline -> Phễu đơn hàng */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Tiến Trình Xử Lý Đơn</h3>
          <SalesPipelineChart />
        </div>

        {/* Sales by Region -> Doanh Thu Khu Vực */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Doanh Thu Theo Khu Vực</h3>
          <p className="text-xs text-slate-500 mt-1">Tổng cộng 823,500,000 ₫</p>
          
          <div className="flex flex-col gap-4 mt-6">
            {revenueByRegionData.map(region => (
              <div key={region.name} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-end text-xs">
                  <span className="font-semibold text-slate-900">{region.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{formatVnd(region.revenue)}</span>
                    <span className={`font-semibold ${region.growth > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {region.growth > 0 ? '+' : ''}{region.growth}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${region.percentage}%` }}></div>
                  </div>
                  <span className="text-[10px] text-slate-500 w-6 text-right">{region.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            Theo dõi 5 quận/huyện - 3 khu vực tăng trưởng
          </div>
        </div>

        {/* Action Items -> Công việc cần làm */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Công Việc Cần Xử Lý</h3>
          <div className="flex flex-col gap-3">
            {actionItemsData.map(item => (
              <div key={item.id} className="border border-slate-100 rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <input type="checkbox" defaultChecked={item.completed} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${item.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{item.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        item.priority === 'High' ? 'bg-rose-50 text-rose-600' : 
                        item.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 
                        'bg-emerald-50 text-emerald-600'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400">
                      <Calendar size={12} />
                      {item.due}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. DATA TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Đơn Hàng Gần Đây</h2>
            <p className="text-xs text-slate-500 mt-0.5">Theo dõi và quản lý các đơn hàng nông nghiệp mới nhất.</p>
          </div>
          <div className="flex gap-2">
             <div className="relative">
               <button onClick={() => setViewModeOpen(!viewModeOpen)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50/50">
                 <ChevronDown size={14} /> Chế Độ Xem
               </button>
               {viewModeOpen && (
                 <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 text-left">
                   <button onClick={() => { setViewMode('table'); setViewModeOpen(false); }} className={`w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50/50 text-left font-semibold ${viewMode === 'table' ? 'text-emerald-600' : ''}`}>Mặc định (Bảng)</button>
                   <button onClick={() => { setViewMode('grid'); setViewModeOpen(false); }} className={`w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50/50 text-left font-semibold ${viewMode === 'grid' ? 'text-emerald-600' : ''}`}>Dạng Lưới</button>
                 </div>
               )}
             </div>
             <button onClick={handleExportRecentOrders} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50/50">
               <Download size={14} /> Xuất File
             </button>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500">
                  <th className="py-4 px-4 w-10">
                    <input type="checkbox" className="rounded border-slate-300" />
                  </th>
                  <th className="py-4 px-4 whitespace-nowrap">Mã Đơn</th>
                  <th className="py-4 px-4 whitespace-nowrap">Khách Hàng</th>
                  <th className="py-4 px-4 min-w-[200px]">Sản Phẩm</th>
                  <th className="py-4 px-4 text-center whitespace-nowrap">Trạng Thái</th>
                  <th className="py-4 px-4 text-center whitespace-nowrap">Tổng Tiền</th>
                  <th className="py-4 px-4 text-center whitespace-nowrap">Thanh Toán</th>
                  <th className="py-4 px-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {ALL_ORDERS.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <input type="checkbox" className="rounded border-slate-300" />
                    </td>
                    <td className="py-4 px-4 font-mono font-medium text-slate-500 whitespace-nowrap">{order.id}</td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{order.customerName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{order.shortLocation}</div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 line-clamp-2">{order.productLine}</td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-semibold border ${
                        order.statusBadge.label === 'Hoàn thành' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                        order.statusBadge.label === 'Đang giao' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                        order.statusBadge.label === 'Đang xử lý' ? 'border-indigo-200 text-indigo-700 bg-indigo-50' :
                        'border-amber-200 text-amber-700 bg-amber-50'
                      }`}>
                        {order.statusBadge.label}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-slate-900 text-center whitespace-nowrap">
                      {order.total}
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${
                        order.paymentBadge.label.includes('Gối nợ') ? 'border-red-200 text-red-700 bg-white' :
                        order.paymentBadge.label.includes('Cọc') ? 'border-amber-200 text-amber-700 bg-white' :
                        'border-slate-200 text-slate-600 bg-white'
                      }`}>
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right relative">
                      <button onClick={() => setOptionsMenuOpenId(optionsMenuOpenId === order.id ? null : order.id)} className="text-slate-400 hover:text-slate-600 p-1">
                        <MoreVertical size={16} />
                      </button>
                      {optionsMenuOpenId === order.id && (
                        <div className="absolute right-10 top-2 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 text-left">
                          <button onClick={() => { showToast('Đang tải chi tiết đơn hàng...'); setOptionsMenuOpenId(null); }} className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50/50 text-left">Xem chi tiết</button>
                          <button onClick={() => { showToast('Đang in hóa đơn...'); setOptionsMenuOpenId(null); }} className="w-full px-3 py-1.5 text-slate-700 hover:bg-slate-50/50 text-left">In hóa đơn</button>
                          <button onClick={() => { showToast('Đã thêm đơn hàng vào danh sách Hủy'); setOptionsMenuOpenId(null); }} className="w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 text-left">Hủy đơn</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50">
             {ALL_ORDERS.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((order) => (
                <div key={order.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:border-emerald-300 transition-colors shadow-sm relative">
                   <div className="flex justify-between items-start mb-3">
                     <div>
                       <div className="font-mono font-bold text-slate-500 text-[11px] mb-1">{order.id}</div>
                       <div className="font-bold text-slate-900">{order.customerName}</div>
                       <div className="text-[11px] text-slate-500 mt-0.5">{order.shortLocation}</div>
                     </div>
                     <div className="relative">
                       <button onClick={() => setOptionsMenuOpenId(optionsMenuOpenId === order.id ? null : order.id)} className="text-slate-400 hover:text-slate-600 p-1 -mr-1">
                         <MoreVertical size={16} />
                       </button>
                       {optionsMenuOpenId === order.id && (
                         <div className="absolute right-0 top-6 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 text-left">
                           <button onClick={() => { showToast('Đang tải chi tiết đơn hàng...'); setOptionsMenuOpenId(null); }} className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50/50 text-left">Xem chi tiết</button>
                           <button onClick={() => { showToast('Đang in hóa đơn...'); setOptionsMenuOpenId(null); }} className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50/50 text-left">In hóa đơn</button>
                           <button onClick={() => { showToast('Đã thêm đơn hàng vào danh sách Hủy'); setOptionsMenuOpenId(null); }} className="w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 text-left">Hủy đơn</button>
                         </div>
                       )}
                     </div>
                   </div>
                   <div className="text-xs text-slate-600 line-clamp-2 mb-4 h-8 bg-slate-50 rounded p-1.5 border border-slate-100">{order.productLine}</div>
                   <div className="flex justify-between items-end mt-2 pt-3 border-t border-slate-100 border-dashed">
                     <div className="flex flex-col gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border text-center w-max ${
                          order.statusBadge.label === 'Hoàn thành' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                          order.statusBadge.label === 'Đang giao' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                          order.statusBadge.label === 'Đang xử lý' ? 'border-indigo-200 text-indigo-700 bg-indigo-50' :
                          'border-amber-200 text-amber-700 bg-amber-50'
                        }`}>
                          {order.statusBadge.label}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">{order.paymentMethod}</span>
                     </div>
                     <div className="font-mono font-black text-slate-900 text-right">{order.total}</div>
                   </div>
                </div>
             ))}
          </div>
        )}
        
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
           <span>0 trong {ALL_ORDERS.length} dòng được chọn.</span>
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <span>Số dòng mỗi trang</span>
               <select 
                 className="border border-slate-200 rounded px-1 py-0.5 bg-white text-xs"
                 value={pageSize}
                 onChange={(e) => {
                   setPageSize(Number(e.target.value));
                   setCurrentPage(1);
                 }}
               >
                 <option value={10}>10</option>
                 <option value={20}>20</option>
               </select>
             </div>
             <span>Trang {currentPage} / {totalPages}</span>
             <div className="flex gap-1">
               <button 
                 onClick={() => handlePageChange(1)}
                 disabled={currentPage === 1}
                 className={`p-1 border border-slate-200 rounded bg-white ${currentPage === 1 ? 'text-slate-300' : 'text-slate-600 hover:text-slate-900'}`}
               >
                 <ChevronsLeft size={16} />
               </button>
               <button 
                 onClick={() => handlePageChange(currentPage - 1)}
                 disabled={currentPage === 1}
                 className={`p-1 border border-slate-200 rounded bg-white ${currentPage === 1 ? 'text-slate-300' : 'text-slate-600 hover:text-slate-900'}`}
               >
                 <ChevronLeft size={16} />
               </button>
               <button 
                 onClick={() => handlePageChange(currentPage + 1)}
                 disabled={currentPage === totalPages}
                 className={`p-1 border border-slate-200 rounded bg-white ${currentPage === totalPages ? 'text-slate-300' : 'text-slate-600 hover:text-slate-900'}`}
               >
                 <ChevronRight size={16} />
               </button>
               <button 
                 onClick={() => handlePageChange(totalPages)}
                 disabled={currentPage === totalPages}
                 className={`p-1 border border-slate-200 rounded bg-white ${currentPage === totalPages ? 'text-slate-300' : 'text-slate-600 hover:text-slate-900'}`}
               >
                 <ChevronsRight size={16} />
               </button>
             </div>
           </div>
        </div>
      </div>
      {/* Lead Detail Modal */}
      <DetailModal open={isLeadDetailOpen} onClose={() => setIsLeadDetailOpen(false)} widthClassName="max-w-md">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">Chi tiết nguồn khách hàng</h3>
          <p className="text-sm text-slate-500 mt-1">Phân tích chuyên sâu về các kênh tiếp cận trong tháng</p>
        </div>
        <div className="p-4 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                <th className="py-4 px-3">Nguồn</th>
                <th className="py-4 px-3 text-center">Số lượng</th>
                <th className="py-4 px-3 text-right">Tỷ lệ chuyển đổi</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="py-4 px-3 font-medium text-slate-900">Mua trực tiếp</td>
                <td className="py-4 px-3 text-center">65</td>
                <td className="py-4 px-3 text-right text-emerald-600 font-semibold">70%</td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="py-4 px-3 font-medium text-slate-900">Gọi điện</td>
                <td className="py-4 px-3 text-center">45</td>
                <td className="py-4 px-3 text-right text-emerald-600 font-semibold">60%</td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="py-4 px-3 font-medium text-slate-900">Zalo/FB</td>
                <td className="py-4 px-3 text-center">35</td>
                <td className="py-4 px-3 text-right text-amber-600 font-semibold">40%</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-4 px-3 font-medium text-slate-900">Nông dân giới thiệu</td>
                <td className="py-4 px-3 text-center">25</td>
                <td className="py-4 px-3 text-right text-emerald-600 font-semibold">85%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button onClick={() => setIsLeadDetailOpen(false)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50/50 shadow-sm">
            Đóng
          </button>
        </div>
      </DetailModal>
    </div>
  )
}
