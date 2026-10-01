const fs = require('fs');
const path = require('path');

const creditRequestsContent = `import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { mockCreditRequests as INITIAL_REQUESTS } from '@/features/agent/data/mockDebts'
import { formatVndShort } from '@/utils/money'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

export default function CreditRequestsPage() {
  usePageHeader({ title: 'Yêu cầu mua chịu', subtitle: 'Theo dõi yêu cầu mua chịu của nông dân' })
  const [requests] = useState(INITIAL_REQUESTS)
  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(requests, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/sales">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Mua chịu mùa vụ</span>
      </nav>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-3 text-right">Số tiền yêu cầu</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="py-4 px-4 font-medium">{r.farmerName}</td>
                  <td className="py-4 px-3 text-right font-mono font-semibold">{formatVndShort(r.requestedAmount)}</td>
                  <td className="py-4 px-3 text-center text-xs font-bold">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="yêu cầu" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
`

const inventoryContent = `import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, PackageSearch } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { inventoryItems as INITIAL_INVENTORY } from '@/features/agent/data/mockInventory'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

export default function InventoryPage() {
  usePageHeader({ title: 'Tra cứu tồn kho', subtitle: 'Kiểm tra hàng hóa tại kho đại lý' })
  const [items] = useState(INITIAL_INVENTORY)
  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(items, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/sales">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Tồn kho</span>
      </nav>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4">Tên sản phẩm</th>
                <th className="py-3 px-3 text-right">Tồn kho</th>
                <th className="py-3 px-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-4 px-4 font-medium">{item.name}</td>
                  <td className="py-4 px-3 text-right font-mono font-semibold">{item.stockQuantity}</td>
                  <td className="py-4 px-3">
                    <span className={\`text-xs font-bold \${item.stockLabel === 'Tồn kho tốt' ? 'text-emerald-600' : 'text-rose-600'}\`}>
                      {item.stockLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="sản phẩm" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
`

const aiReviewContent = `import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, BrainCircuit } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { aiCases as INITIAL_CASES } from '@/features/agent/data/mockAiRecommendations'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

export default function AiReviewPage() {
  usePageHeader({ title: 'AI Review', subtitle: 'Phê duyệt gợi ý bán hàng từ AI' })
  const [cases] = useState(INITIAL_CASES)
  const { page, totalPages, paginated, startIndex, endIndex, totalCount, goPrev, goNext, setPage } = usePagination(cases, 10)

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/sales">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Đánh giá AI</span>
      </nav>

      <div className="bg-white rounded-xl flex flex-col pt-2 shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4">Gợi ý AI</th>
                <th className="py-3 px-3">Nông dân</th>
                <th className="py-3 px-3">Độ tin cậy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {paginated.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/50">
                  <td className="py-4 px-4 font-medium">{c.recommendedProducts.join(', ')}</td>
                  <td className="py-4 px-3">{c.farmerName}</td>
                  <td className="py-4 px-3 text-xs font-bold text-emerald-600">{c.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} startIndex={startIndex} endIndex={endIndex} totalCount={totalCount} unitLabel="gợi ý" goPrev={goPrev} goNext={goNext} setPage={setPage} />
      </div>
    </div>
  )
}
`

const settingsContent = `import { Link } from 'react-router-dom'
import { ChevronRight, Settings } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'

export default function SettingsPage() {
  usePageHeader({ title: 'Cài đặt cá nhân', subtitle: 'Tùy chỉnh tài khoản Sales' })

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link className="hover:text-slate-900 transition-colors" to="/sales">Bảng điều khiển</Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 font-medium">Cài đặt</span>
      </nav>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <p className="text-sm text-slate-700">Trang cấu hình tài khoản nhân viên Sales.</p>
      </div>
    </div>
  )
}
`

const dirsToMake = [
  'src/features/sales/credit-requests',
  'src/features/sales/inventory',
  'src/features/sales/ai-review',
  'src/features/sales/settings'
];

dirsToMake.forEach(d => fs.mkdirSync(path.join(__dirname, d), { recursive: true }));

fs.writeFileSync(path.join(__dirname, 'src/features/sales/credit-requests/CreditRequestsPage.tsx'), creditRequestsContent);
fs.writeFileSync(path.join(__dirname, 'src/features/sales/inventory/InventoryPage.tsx'), inventoryContent);
fs.writeFileSync(path.join(__dirname, 'src/features/sales/ai-review/AiReviewPage.tsx'), aiReviewContent);
fs.writeFileSync(path.join(__dirname, 'src/features/sales/settings/SettingsPage.tsx'), settingsContent);

let routerContent = fs.readFileSync(path.join(__dirname, 'src/router.tsx'), 'utf8');

routerContent = routerContent.replace(
  "import SalesDebtsPage from '@/features/sales/debts/DebtsPage'",
  `import SalesDebtsPage from '@/features/sales/debts/DebtsPage'
import SalesCreditRequestsPage from '@/features/sales/credit-requests/CreditRequestsPage'
import SalesInventoryPage from '@/features/sales/inventory/InventoryPage'
import SalesAiReviewPage from '@/features/sales/ai-review/AiReviewPage'
import SalesSettingsPage from '@/features/sales/settings/SettingsPage'`
);

routerContent = routerContent.replace(
  '<PlaceholderPage title="Yêu cầu mua chịu" />',
  '<SalesCreditRequestsPage />'
).replace(
  '<PlaceholderPage title="Xem tồn kho" />',
  '<SalesInventoryPage />'
).replace(
  '<PlaceholderPage title="Đánh giá AI" />',
  '<SalesAiReviewPage />'
).replace(
  '<PlaceholderPage title="Cài đặt" />',
  '<SalesSettingsPage />'
);

fs.writeFileSync(path.join(__dirname, 'src/router.tsx'), routerContent);
console.log('Successfully added the remaining 4 UI pages for Sales role and updated router.tsx.');
