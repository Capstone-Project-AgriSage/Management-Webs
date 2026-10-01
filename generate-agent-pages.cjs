const fs = require('fs');
const path = require('path');

const pages = [
  {
    path: 'agent/inventory/InventoryMovementsPage.tsx',
    name: 'InventoryMovementsPage',
    title: 'Biến động kho',
    subtitle: 'Lịch sử nhập/xuất và thay đổi số lượng',
    icon: 'sync_alt'
  },
  {
    path: 'agent/inventory/StocktakePage.tsx',
    name: 'StocktakePage',
    title: 'Kiểm kê kho',
    subtitle: 'Kỳ kiểm kê và cân bằng số liệu',
    icon: 'inventory_2'
  },
  {
    path: 'agent/deliveries/DeliveriesPage.tsx',
    name: 'DeliveriesPage',
    title: 'Quản lý giao hàng',
    subtitle: 'Theo dõi tiến độ vận chuyển đơn',
    icon: 'local_shipping'
  },
  {
    path: 'agent/purchases/SuppliersPage.tsx',
    name: 'SuppliersPage',
    title: 'Nhà cung cấp',
    subtitle: 'Danh sách và đánh giá đối tác',
    icon: 'apartment'
  },
  {
    path: 'agent/purchases/PurchaseOrdersPage.tsx',
    name: 'PurchaseOrdersPage',
    title: 'Phiếu nhập hàng',
    subtitle: 'Theo dõi quá trình nhập kho',
    icon: 'receipt_long'
  },
  {
    path: 'agent/debts/SeasonalCreditPage.tsx',
    name: 'SeasonalCreditPage',
    title: 'Mua chịu (Seasonal)',
    subtitle: 'Công nợ nông dân theo mùa vụ',
    icon: 'account_balance_wallet'
  },
  {
    path: 'agent/products/ProductReviewsPage.tsx',
    name: 'ProductReviewsPage',
    title: 'Đánh giá sản phẩm',
    subtitle: 'Phản hồi từ khách hàng',
    icon: 'star_rate'
  },
  {
    path: 'agent/staff/StaffPage.tsx',
    name: 'StaffPage',
    title: 'Quản lý nhân sự',
    subtitle: 'Danh sách và phân quyền nhân viên',
    icon: 'badge'
  },
  {
    path: 'agent/system/ActivityLogPage.tsx',
    name: 'ActivityLogPage',
    title: 'Nhật ký hoạt động',
    subtitle: 'Lịch sử thao tác trên hệ thống',
    icon: 'history'
  },
  {
    path: 'agent/system/SettingsPage.tsx',
    name: 'SettingsPage',
    title: 'Cài đặt hệ thống',
    subtitle: 'Cấu hình thông số ứng dụng',
    icon: 'settings'
  }
];

const template = `import { useEffect } from 'react'
import { usePageHeader } from '@/context/PageHeaderContext'

export default function {{NAME}}() {
  const { setHeader } = usePageHeader()

  useEffect(() => {
    setHeader({
      title: '{{TITLE}}',
      subtitle: '{{SUBTITLE}}',
      badge: 'Agent'
    })
  }, [setHeader])

  return (
    <div className="p-layout-margin-desktop">
      <div className="bg-surface rounded-xl border border-outline-variant/60 shadow-sm overflow-hidden flex flex-col min-h-[500px] h-[calc(100vh-theme(spacing.header-height)-2*theme(spacing.layout-margin-desktop))]">
        <div className="p-4 border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-lowest">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
              <input 
                type="text" 
                placeholder="Tìm kiếm..." 
                className="pl-9 pr-4 py-1.5 text-label-md bg-surface-container-low border border-outline-variant/60 rounded-md focus:border-primary focus:ring-1 focus:ring-primary focus:bg-white text-on-surface transition-all w-64"
              />
            </div>
            <button className="px-3 py-1.5 text-label-md border border-outline-variant/60 rounded-md hover:bg-surface-container-low flex items-center gap-1.5 text-on-surface font-medium transition-colors">
              <span className="material-symbols-outlined text-[16px]">filter_list</span>
              Lọc
            </button>
          </div>
          <button className="px-4 py-1.5 text-label-md bg-primary text-on-primary rounded-md font-medium shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Thêm mới
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center bg-surface-container-lowest">
          <div className="text-center max-w-sm px-4">
            <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4 border border-outline-variant/60">
              <span className="material-symbols-outlined text-[32px] text-outline">{{ICON}}</span>
            </div>
            <h3 className="text-title-md font-semibold text-on-surface mb-2">Chưa có dữ liệu</h3>
            <p className="text-body-sm text-on-surface-variant">
              Hiện tại chưa có dữ liệu cho phần {{TITLE}}. Nhấn "Thêm mới" để tạo bản ghi đầu tiên.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
`;

pages.forEach(page => {
  const fullPath = path.join(__dirname, 'src/features', page.path);
  const dir = path.dirname(fullPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const content = template
    .replace(/\{\{NAME\}\}/g, page.name)
    .replace(/\{\{TITLE\}\}/g, page.title)
    .replace(/\{\{SUBTITLE\}\}/g, page.subtitle)
    .replace(/\{\{ICON\}\}/g, page.icon);
    
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Created: ' + page.path);
});
