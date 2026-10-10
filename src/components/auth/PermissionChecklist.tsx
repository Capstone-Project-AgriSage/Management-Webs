import { useState } from 'react'
import type { Permission } from '@/api/permissionsApi'
const modules: Record<string, string> = { ORDERS: 'Đơn hàng', PRODUCTS: 'Sản phẩm gốc', STORE_PRODUCTS: 'Sản phẩm đại lý', CUSTOMERS: 'Khách hàng', INVENTORY: 'Kho', CREDIT: 'Tín dụng', DEBT: 'Công nợ', REPORTS: 'Báo cáo', PAYMENTS: 'Thanh toán', RETURNS: 'Trả hàng', REFUNDS: 'Hoàn tiền', STAFF: 'Nhân viên', PERMISSIONS: 'Phân quyền', PRICING: 'Bảng giá', STOCKTAKES: 'Kiểm kê', STOCK_ADJUSTMENTS: 'Điều chỉnh kho', GOODS_RECEIPTS: 'Nhập hàng', SUPPLIERS: 'Nhà cung cấp', DELIVERIES: 'Giao hàng', COUNTER_SALES: 'Bán tại quầy', AUDIT: 'Nhật ký', CUSTOMER_GROUPS: 'Nhóm khách hàng', CREDIT_TIERS: 'Hạng tín dụng', CATEGORIES: 'Danh mục', BRANDS: 'Thương hiệu', INGREDIENTS: 'Hoạt chất', UNITS: 'Đơn vị' }
export default function PermissionChecklist({ catalog, selected, editable, onToggle }: { catalog: Permission[]; selected: string[]; editable: (permission: Permission) => boolean; onToggle: (code: string, checked: boolean) => void }) {
  const [search, setSearch] = useState('')
  const visible = catalog.filter(p => `${p.name} ${p.code} ${modules[p.module] ?? p.module}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const groups = [...new Set(visible.map(p => p.module))]
  return <div>
    <input aria-label="Tìm quyền" placeholder="Tìm quyền hoặc module…" value={search} onChange={e => setSearch(e.target.value)} className="w-full border rounded-lg p-2 mb-4" />
    <div className="max-h-[55vh] overflow-auto space-y-4">
      {groups.map(module => <fieldset key={module} className="border rounded-lg p-3"><legend className="font-semibold px-2">{modules[module] ?? module}</legend><div className="grid sm:grid-cols-2 gap-3">
        {visible.filter(p => p.module === module).map(p => <label key={p.code} className={`flex items-start gap-2 text-sm ${editable(p) ? '' : 'text-slate-500'}`}>
          <input type="checkbox" className="mt-1 accent-emerald-600" checked={selected.includes(p.code)} disabled={!editable(p)} onChange={e => onToggle(p.code, e.target.checked)} />
          <span>{p.name}<span className="block text-xs text-slate-500">{p.code}</span></span>
        </label>)}
      </div></fieldset>)}
      {!visible.length && <p>Không tìm thấy quyền.</p>}
    </div>
  </div>
}
