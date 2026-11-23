import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePermission } from '@/context/PermissionContext'
import { customersApi } from '@/api/customersApi'
import { ordersApi } from '@/api/ordersApi'
import { productsApi } from '@/api/productsApi'
import { catalogApi } from '@/api/catalogApi'
import { staffApi } from '@/api/staffApi'
import { deliveriesApi } from '@/api/deliveriesApi'
import { describeError } from '@/api/client'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useReportData } from '@/features/agent/reports/useReportData'
import Modal from '@/components/ui/Modal'

interface SearchItem { id: string; title: string; detail: string; to: string }
interface SearchPage { items: SearchItem[]; totalCount: number }
interface Source { key: string; label: string; load: (query: string, signal: AbortSignal) => Promise<SearchPage> }

/** Search only server-authorized areas for this role, using the same APIs as their lists. */
export default function GlobalSearch() {
  const { currentRole } = useAuth()
  const { has, loading: permissionsLoading } = usePermission()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const keyword = useDebouncedValue(query.trim())
  const sources = useMemo(() => {
    const result: Source[] = []
    const base = currentRole === 'agent' ? '/agent' : '/sales'
    if (currentRole === 'agent' || currentRole === 'sales_staff') {
      if (has('CUSTOMERS.READ')) result.push({ key: 'customers', label: 'Khách hàng', load: async (search, signal) => {
        const page = await customersApi.getCustomers({ search, page: 1, pageSize: 5 }, signal)
        return { totalCount: page.totalCount, items: page.items.map(item => ({ id: item.id, title: item.fullName, detail: [item.customerCode, item.phoneNumber].filter(Boolean).join(' · '), to: `${base}/farmers?customer=${encodeURIComponent(item.id)}` })) }
      } })
      if (has('ORDERS.READ')) result.push({ key: 'orders', label: 'Đơn hàng', load: async (search, signal) => {
        const page = await ordersApi.getOrders({ search, page: 1, pageSize: 5 }, signal)
        return { totalCount: page.totalCount, items: page.items.map(item => ({ id: item.id, title: item.orderNumber, detail: [item.customerName, item.customerPhone].filter(Boolean).join(' · '), to: `${base}/orders?open=${encodeURIComponent(item.id)}` })) }
      } })
    }
    if ((currentRole === 'agent' && has('STORE_PRODUCTS.READ') && has('PRODUCTS.READ')) || (currentRole === 'admin' && has('PRODUCTS.READ'))) {
      const path = currentRole === 'admin' ? '/admin/products/master' : '/agent/products'
      result.push({ key: 'products', label: 'Sản phẩm', load: async (search, signal) => {
        const page = await productsApi.list({ search, page: 1, pageSize: 5 }, signal)
        return { totalCount: page.totalCount, items: page.items.map(item => ({ id: item.id, title: item.name, detail: [item.sku, item.categoryName].filter(Boolean).join(' · '), to: `${path}?search=${encodeURIComponent(item.sku)}` })) }
      } })
    }
    if (currentRole === 'sales_staff' && has('STORE_PRODUCTS.READ')) result.push({ key: 'products', label: 'Sản phẩm', load: async (search, signal) => {
      const page = await catalogApi.getProducts({ search, page: 1, pageSize: 5 }, signal)
      return { totalCount: page.totalCount, items: page.items.map(item => ({ id: item.id, title: item.name, detail: item.sku, to: `/sales/products?search=${encodeURIComponent(item.sku)}` })) }
    } })
    if (currentRole === 'admin' && has('STAFF.READ')) result.push({ key: 'staff', label: 'Tài khoản', load: async (search, signal) => {
      const page = await staffApi.getStaff({ search, page: 1, pageSize: 5 }, signal)
      return { totalCount: page.totalCount, items: page.items.map(item => ({ id: item.id, title: item.fullName, detail: [item.employeeCode, item.phoneNumber, item.email].filter(Boolean).join(' · '), to: `/admin/accounts?search=${encodeURIComponent(item.employeeCode || item.phoneNumber || item.fullName)}` })) }
    } })
    if (currentRole === 'delivery_staff' && has('DELIVERIES.READ')) result.push({ key: 'deliveries', label: 'Chuyến giao được phân công', load: async (search, signal) => {
      const page = await deliveriesApi.getDeliveries({ search, page: 1, pageSize: 5 }, signal)
      return { totalCount: page.totalCount, items: page.items.map(item => ({ id: item.id, title: item.deliveryNumber, detail: [item.orderNumber, item.recipientName].filter(Boolean).join(' · '), to: `/delivery/deliveries/${encodeURIComponent(item.id)}` })) }
    } })
    return result
  }, [currentRole, has])
  const load = useCallback(async (signal: AbortSignal) => Promise.all(sources.map(async source => {
    try { return { key: source.key, label: source.label, ...await source.load(keyword, signal), error: null } }
    catch (error) { return { key: source.key, label: source.label, items: [] as SearchItem[], totalCount: 0, error: describeError(error, 'Không tải được kết quả. Vui lòng thử lại.') } }
  })), [sources, keyword])
  const blocked = !open || keyword.length < 2 || !sources.length || permissionsLoading
  const { data, loading, refresh } = useReportData(load, blocked ? 'Chưa tìm kiếm.' : null)
  // Never allow the previous keyword's results to be opened while the next keyword is being debounced.
  const waiting = !blocked && (loading || query.trim() !== keyword)
  const groups = query.trim() === keyword ? data : null
  const items = groups?.flatMap(group => group.items) ?? []
  const close = () => { setOpen(false); setQuery('') }

  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      if (!shortcut && !slash) return
      if (!open && document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      setOpen(true)
      if (open) { inputRef.current?.focus(); inputRef.current?.select() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const navigateResults = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const links = Array.from(resultsRef.current?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? [])
    if (!links.length) return
    event.preventDefault()
    const index = links.indexOf(document.activeElement as HTMLAnchorElement)
    if (index < 0) links[event.key === 'ArrowDown' ? 0 : links.length - 1]?.focus()
    else if (index === 0 && event.key === 'ArrowUp') inputRef.current?.focus()
    else links[(index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]?.focus()
  }

  const placeholder = currentRole === 'admin' ? 'Tìm tài khoản, sản phẩm...' : currentRole === 'delivery_staff' ? 'Tìm chuyến giao, mã đơn, khách...' : 'Tìm nông dân, đơn hàng, vật tư...'
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Tìm kiếm toàn hệ thống" aria-haspopup="dialog" className="topbar-search relative hidden h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 text-left text-sm text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary lg:flex">
      <Search size={18} aria-hidden="true" className="shrink-0" /><span className="min-w-0 flex-1 truncate">{placeholder}</span><kbd aria-hidden="true" className="shrink-0 rounded border border-outline-variant bg-surface-container-highest px-1.5 py-0.5 text-xs">Ctrl K</kbd>
    </button>
    <button type="button" onClick={() => setOpen(true)} aria-label="Tìm kiếm toàn hệ thống" aria-haspopup="dialog" className="topbar-icon grid shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low lg:hidden"><Search size={18} aria-hidden="true" /></button>
    <Modal open={open} onClose={close} title="Tìm kiếm toàn hệ thống" description={sources.length ? `Tìm trong: ${sources.map(source => source.label.toLowerCase()).join(', ')}.` : 'Tìm kiếm theo quyền truy cập của bạn.'}>
      <div onKeyDown={navigateResults}>
        <form onSubmit={event => { event.preventDefault(); if (!waiting && items[0]) { navigate(items[0].to, { state: { globalSearch: true } }); close() } }}>
          <label htmlFor="global-search-query" className="sr-only">Từ khóa tìm kiếm</label>
          <div className="relative"><Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-slate-500" />
            <input id="global-search-query" ref={inputRef} type="search" autoComplete="off" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder="Nhập tên, mã hoặc số điện thoại..." className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 focus:border-green-700 focus:outline-2 focus:outline-green-700" />
          </div>
        </form>
        <div ref={resultsRef} aria-busy={waiting} className="mt-4 space-y-4">
          {permissionsLoading ? <p role="status" className="text-sm text-slate-500">Đang tải quyền truy cập...</p> : !sources.length ? <p role="status" className="text-sm text-slate-500">Bạn chưa có quyền tìm kiếm trong các mục này.</p> : query.trim().length < 2 ? <p role="status" className="text-sm text-slate-500">Nhập ít nhất 2 ký tự để tìm kiếm.</p> : waiting || !groups ? <p role="status" className="text-sm text-slate-500">Đang tìm kiếm...</p> : <>
            {groups.map(group => <section key={group.key} aria-label={`Kết quả ${group.label.toLowerCase()}`}>
              <h3 className="mb-1 text-xs font-semibold text-slate-600">{group.label}{!group.error && ` · ${group.totalCount.toLocaleString('vi-VN')} kết quả`}</h3>
              {group.error ? <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{group.error} <button type="button" onClick={refresh} className="font-semibold underline">Thử lại</button></div> : !group.items.length ? <p className="py-2 text-sm text-slate-500">Không tìm thấy {group.label.toLowerCase()} phù hợp.</p> : <ul className="divide-y divide-slate-100">
                {group.items.map(item => <li key={item.id}><Link to={item.to} state={{ globalSearch: true }} onClick={close} className="flex min-h-14 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-green-50 focus-visible:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-700"><span className="min-w-0"><span className="block font-medium text-slate-900 [overflow-wrap:anywhere]">{item.title}</span><span className="mt-0.5 block text-xs text-slate-500 [overflow-wrap:anywhere]">{item.detail}</span></span><ArrowUpRight size={16} aria-hidden="true" className="shrink-0 text-slate-400" /></Link></li>)}
              </ul>}
              {group.totalCount > group.items.length && <p className="mt-1 text-xs text-slate-500">Hiện {group.items.length} kết quả đầu tiên. Nhập từ khóa cụ thể hơn để thu hẹp.</p>}
            </section>)}
          </>}
        </div>
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">↑ ↓ chọn kết quả · Enter mở · Esc đóng</p>
      </div>
    </Modal>
  </>
}
