import ListToolbar from '@/components/ui/ListToolbar'
import { LIST_PAGE_SIZE } from '@/utils/pagination';
import { usePermission } from '@/context/PermissionContext';
import PermissionAction from '@/components/auth/PermissionAction'
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { useToast } from '@/context/ToastContext';
import { describeError } from '@/api/client';
import { productsApi, type BrandOption, type CategoryOption, type ProductListItem, type ProductResponse, type ProductStatus, type StoreProductRow, type UnitOption } from '@/api/productsApi';
import type { Paged } from '@/api/types';

import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import RowActionsMenu, { type RowAction } from '@/components/ui/RowActionsMenu';
import ConfirmModal from '@/components/ui/ConfirmModal'
import ProductThumb from '@/components/ui/ProductThumb'
import ProductFormModal from './ProductFormModal'
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'

const PAGE_SIZE = LIST_PAGE_SIZE

const STATUS_LABEL: Record<ProductStatus, string> = {
  ACTIVE: 'Đang kinh doanh',
  INACTIVE: 'Tạm ngưng',
  DISCONTINUED: 'Ngừng kinh doanh',
}

const STATUS_TONE: Record<ProductStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-amber-50 text-amber-700 border-amber-200',
  DISCONTINUED: 'bg-slate-100 text-slate-600 border-slate-200',
}

type StoreState = 'ON_SALE' | 'NOT_SELLING' | 'NOT_IN_STORE'

const storeStateOf = (row?: StoreProductRow): StoreState => (!row ? 'NOT_IN_STORE' : row.isActive && row.isSellable ? 'ON_SALE' : 'NOT_SELLING')

const STORE_LABEL: Record<StoreState, string> = {
  ON_SALE: 'Đang bán',
  NOT_SELLING: 'Chưa bán',
  NOT_IN_STORE: 'Chưa thêm vào cửa hàng',
}

const STORE_TONE: Record<StoreState, string> = {
  ON_SALE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  NOT_SELLING: 'bg-amber-50 text-amber-700 border-amber-200',
  NOT_IN_STORE: 'bg-slate-100 text-slate-600 border-slate-200',
}

const Pill = ({ tone, children }: { tone: string; children: React.ReactNode }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap ${tone}`}>{children}</span>
)

const selectedStatuses: { value: string; label: string }[] = [
  { value: '', label: 'Mọi trạng thái' },
  ...(Object.keys(STATUS_LABEL) as ProductStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
]

/**
 * Real product management, shared by the store owner and the admin (both may write, per the API): the catalogue with
 * its pictures, adding and editing a product, its status and whether the store sells it.
 */
export default function ProductManagementPage() {
  usePageHeader({ title: 'Sản phẩm', subtitle: 'Danh mục, quy cách, ảnh và trạng thái bán' })
  const { showToast } = useToast()

  const [data, setData] = useState<Paged<ProductListItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState('')

  const [stores, setStores] = useState<StoreProductRow[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])

  const [form, setForm] = useState<{ product: ProductResponse | null } | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [discontinuing, setDiscontinuing] = useState<ProductListItem | null>(null)
  const [busy, setBusy] = useState(false)

  const storeByProduct = useMemo(() => new Map(stores.map((s) => [s.productId, s])), [stores])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    Promise.all([productsApi.categories(), productsApi.brands(), productsApi.units()])
      .then(([c, b, u]) => {
        setCategories(c.items)
        setBrands(b.items)
        setUnits(u.items)
      })
      .catch((err) => showToast(describeError(err, 'Không tải được danh mục, thương hiệu, đơn vị'), 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadStores = useCallback(async () => {
    try {
      setStores(await productsApi.storeProducts())
    } catch {
      // The list still works without it; the "bán tại cửa hàng" column then shows "chưa thêm".
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      setData(
        await productsApi.list({
          search: debouncedSearch || undefined,
          categoryId: categoryId || undefined,
          status: (status || undefined) as ProductStatus | undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
      )
    } catch (err) {
      showToast(describeError(err, 'Không tải được danh sách sản phẩm'), 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, categoryId, status, page])

  useEffect(() => {
    void loadStores()
  }, [loadStores])

  useEffect(() => {
    void loadList()
  }, [loadList])

  // Any filter change goes back to the first page.
  useEffect(() => setPage(1), [debouncedSearch, categoryId, status])

  const refresh = () => Promise.all([loadList(), loadStores()])

  const { has } = usePermission()
  const openEdit = async (row: ProductListItem) => {
    if (!has('PRODUCTS.UPDATE')) return
    setOpening(row.id)
    try {
      setForm({ product: await productsApi.get(row.id) })
    } catch (err) {
      showToast(describeError(err, 'Không mở được sản phẩm'), 'error')
    } finally {
      setOpening(null)
    }
  }

  /** Runs one change, reports it and reloads the list. */
  const run = async (task: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await task()
      showToast(done, 'success')
      await refresh()
    } catch (err) {
      showToast(describeError(err, 'Không thực hiện được'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const putOnSale = (row: ProductListItem) =>
    run(async () => {
      const current = storeByProduct.get(row.id)
      const storeProduct = current ?? (await productsApi.addToStore(row.id))
      if (!storeProduct.isActive) await productsApi.setStoreActive(storeProduct.id, true)
      await productsApi.setSellable(storeProduct.id, true)
    }, `Đã đưa ${row.name} vào bán`)

  const buildActions = (row: ProductListItem): RowAction[] => {
    const state = storeStateOf(storeByProduct.get(row.id))
    const actions: RowAction[] = [{ permissionCodes: ['PRODUCTS.UPDATE'], label: 'Sửa sản phẩm và ảnh', icon: 'edit', onClick: () => void openEdit(row) }]
    if (state === 'ON_SALE') {
      actions.push({
        permissionCodes: ['STORE_PRODUCTS.MARK_NOT_SELLABLE'],
        label: 'Ngừng bán',
        icon: 'block',
        onClick: () => void run(() => productsApi.setSellable(storeByProduct.get(row.id)!.id, false), `Đã ngừng bán ${row.name}`),
      })
    } else if (row.status === 'ACTIVE') {
      actions.push({ permissionCodes: ['STORE_PRODUCTS.MARK_SELLABLE', ...(storeByProduct.has(row.id) ? [] : ['STORE_PRODUCTS.CREATE']), ...(storeByProduct.get(row.id)?.isActive ? [] : ['STORE_PRODUCTS.ACTIVATE'])], label: 'Đưa vào bán', icon: 'storefront', tone: 'primary', onClick: () => void putOnSale(row) })
    }
    if (row.status === 'ACTIVE') {
      actions.push({ permissionCodes: ["PRODUCTS.CHANGE_STATUS"], label: 'Tạm ngưng kinh doanh', icon: 'pause_circle', onClick: () => void run(() => productsApi.changeStatus(row.id, 'INACTIVE'), `Đã tạm ngưng ${row.name}`) })
    } else {
      actions.push({ permissionCodes: ["PRODUCTS.CHANGE_STATUS"], label: 'Kinh doanh lại', icon: 'play_circle', tone: 'primary', onClick: () => void run(() => productsApi.changeStatus(row.id, 'ACTIVE'), `${row.name} đã kinh doanh lại`) })
    }
    if (row.status !== 'DISCONTINUED') {
      actions.push({ permissionCodes: ['PRODUCTS.DELETE'], label: 'Ngừng kinh doanh', icon: 'delete', tone: 'danger', onClick: () => setDiscontinuing(row) })
    }
    return actions
  }

  const resetFilters = () => {
    setSearch('')
    setCategoryId('')
    setStatus('')
  }

  const items = data?.items ?? []
  const categoryOptions = [{ value: '', label: 'Mọi danh mục' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <BusinessReportCards kind="valuation" searchResult={{ count: data?.totalCount ?? 0, unit: 'sản phẩm' }} />
      <ListToolbar search={{ value: search, onChange: value => { setSearch(value); setPage(1) }, placeholder: "Tìm theo tên hoặc mã SKU..." }} onClear={resetFilters} actions={<><PermissionAction codes={["PRODUCTS.CREATE"]}><button type="button" className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center gap-1.5" onClick={() => setForm({ product: null })}>
            <PackagePlus size={16} /> Thêm sản phẩm
          </button></PermissionAction></>}>
<FilterSelect value={categoryId} onChange={setCategoryId} options={categoryOptions} className="relative min-w-[170px]" />
<FilterSelect value={status} onChange={setStatus} options={selectedStatuses} className="relative min-w-[170px]" />
      </ListToolbar>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Sản phẩm</th>
                <th className="py-3 px-3" scope="col">Danh mục</th>
                <th className="py-3 px-3" scope="col">Thương hiệu</th>
                <th className="py-3 px-3" scope="col">Trạng thái</th>
                <th className="py-3 px-3" scope="col">Bán tại cửa hàng</th>
                <th className="py-3 px-3 w-12" scope="col"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {loading && !data ? (
                <EmptyTableRow colSpan={6} message="Đang tải dữ liệu..." />
              ) : items.length === 0 ? (
                <EmptyTableRow colSpan={6} message="Không tìm thấy sản phẩm nào." />
              ) : (
                items.map((p) => {
                  const state = storeStateOf(storeByProduct.get(p.id))
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${opening === p.id ? 'opacity-60' : ''}`} onClick={() => void openEdit(p)}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <ProductThumb src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-lg border border-slate-200" iconSize={22} />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate max-w-[340px]">{p.name}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700">{p.categoryName}</td>
                      <td className="py-3 px-3 text-slate-700">{p.brandName ?? '--'}</td>
                      <td className="py-3 px-3"><Pill tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Pill></td>
                      <td className="py-3 px-3"><Pill tone={STORE_TONE[state]}>{STORE_LABEL[state]}</Pill></td>
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        {!busy && <RowActionsMenu actions={buildActions(p)} triggerLabel={`Thao tác ${p.name}`} />}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {data && <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={data.totalCount} totalPages={data.totalPages} unitLabel="sản phẩm" onPageChange={setPage} />}
      </div>

      <ProductFormModal
        open={form !== null}
        product={form?.product ?? null}
        categories={categories}
        brands={brands}
        units={units}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null)
          void refresh()
        }}
      />

      <PermissionAction codes={["PRODUCTS.DELETE"]}><ConfirmModal
        open={discontinuing !== null}
        title={`Ngừng kinh doanh ${discontinuing?.name ?? ''}?`}
        message="Sản phẩm chuyển sang 'Ngừng kinh doanh' và ngừng bán tại cửa hàng. Lịch sử đơn hàng, tồn kho vẫn giữ nguyên. Có thể kinh doanh lại sau."
        confirmLabel="Ngừng kinh doanh"
        tone="danger"
        busy={busy}
        onClose={() => setDiscontinuing(null)}
        onConfirm={async () => {
          const target = discontinuing
          if (!target) return
          await run(() => productsApi.discontinue(target.id), `Đã ngừng kinh doanh ${target.name}`)
          setDiscontinuing(null)
        }}
      /></PermissionAction>
    </div>
  )
}
