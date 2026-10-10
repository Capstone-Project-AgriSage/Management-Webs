import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import ServerPagination from '@/components/ui/ServerPagination'
import { LIST_PAGE_SIZE } from '@/utils/pagination';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import PermissionAction from '@/components/auth/PermissionAction'
import BusinessReportCards from '@/features/agent/reports/BusinessReportCards'
import ModalLayout from '@/components/ui/ModalLayout'
import { useState, useEffect, useRef } from 'react';
import { usePageHeader } from '@/context/PageHeaderContext';
import { creditTiersApi, type CreditTierResponse } from '@/api/creditTiersApi';
import { customerGroupsApi, type CustomerGroupResponse, type GroupPriceListLink } from '@/api/customerGroupsApi';
import { priceListsApi } from '@/api/priceListsApi';
import { useToast } from '@/context/ToastContext';
import { usePermission } from '@/context/PermissionContext';
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import StatusBadge from '@/components/ui/StatusBadge'
import DetailModal from '@/components/ui/DetailModal'
import PromptModal, { type PromptField } from '@/components/ui/PromptModal';
import RowActionsMenu, { type RowAction } from '@/components/ui/RowActionsMenu';
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { formatVnd } from '@/utils/money';
import { formatDay } from '@/utils/creditLabels';

type Tab = 'GROUPS' | 'TIERS'

type Prompt =
  | { kind: 'group-create' }
  | { kind: 'group-edit'; group: CustomerGroupResponse }
  | { kind: 'group-price-list'; group: CustomerGroupResponse }
  | { kind: 'group-tier'; group: CustomerGroupResponse }
  | { kind: 'tier-create' }
  | { kind: 'tier-edit'; tier: CreditTierResponse }

const PROMPT_PERMISSIONS: Record<Prompt['kind'], string> = {
  'group-create': 'CUSTOMER_GROUPS.CREATE',
  'group-edit': 'CUSTOMER_GROUPS.UPDATE',
  'group-price-list': 'CUSTOMER_GROUPS.UPDATE',
  'group-tier': 'CUSTOMER_GROUPS.UPDATE',
  'tier-create': 'CREDIT_TIERS.CREATE',
  'tier-edit': 'CREDIT_TIERS.UPDATE',
}

interface PromptSpec {
  title: string
  description?: string
  fields: PromptField[]
  initialValues?: Record<string, string>
  submitLabel: string
  onSubmit: (values: Record<string, string>) => void
}

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

// FLOW_3 §3–§4.2 (Manage): customer groups → price list + default credit tier; tier term = debt term (decision F-D2).
export default function CreditConfigPage() {
  usePageHeader({ title: 'Nhóm khách hàng & Hạng tín dụng', subtitle: 'Nhóm khách quyết định bảng giá và hạng tín dụng (thời hạn nợ)' })
  const { showToast } = useToast()
  const { has } = usePermission()
  const canReadGroups = has('CUSTOMER_GROUPS.READ')
  const canReadTiers = has('CREDIT_TIERS.READ')
  const canReadPrices = has('PRICING.READ')

  const [activeTab, setActiveTab] = useState<Tab>('GROUPS')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [groupCount, setGroupCount] = useState(0)
  const [nextGroupPriority, setNextGroupPriority] = useState(1)
  const [tierCount, setTierCount] = useState(0)
  const [tierOptions, setTierOptions] = useState<CreditTierResponse[]>([])
  const debouncedSearch = useDebouncedValue(search.trim())
  const requestVersion = useRef(0)
  const [tiers, setTiers] = useState<CreditTierResponse[]>([])
  const [groups, setGroups] = useState<CustomerGroupResponse[]>([])
  const [priceLists, setPriceLists] = useState<{ id: string; code: string; name: string; status: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [history, setHistory] = useState<{ group: CustomerGroupResponse; links: GroupPriceListLink[] } | null>(null)
  const promptPermission = prompt ? PROMPT_PERMISSIONS[prompt.kind] : null

  useEffect(() => {
    if (promptPermission && !has(promptPermission)) setPrompt(null)
    if (!canReadGroups) setHistory(null)
  }, [has, promptPermission, canReadGroups])

  useEffect(() => {
    if (activeTab === 'GROUPS' && !canReadGroups && canReadTiers) setActiveTab('TIERS')
    if (activeTab === 'TIERS' && !canReadTiers && canReadGroups) setActiveTab('GROUPS')
  }, [activeTab, canReadGroups, canReadTiers])

  const load = async () => {
    const request = ++requestVersion.current
    setLoading(true)
    try {
      const [t, g, p] = await Promise.all([
        canReadTiers ? creditTiersApi.getCreditTiers({ page, pageSize: LIST_PAGE_SIZE, search: debouncedSearch || undefined, isActive: activeFilter ? activeFilter === 'true' : undefined }) : Promise.resolve({ items: [], totalCount: 0 }),
        canReadGroups ? customerGroupsApi.getCustomerGroups({ page, pageSize: LIST_PAGE_SIZE, search: debouncedSearch || undefined, isActive: activeFilter ? activeFilter === 'true' : undefined }) : Promise.resolve({ items: [], totalCount: 0 }),
        canReadPrices ? priceListsApi.getPriceLists({ pageSize: 100 }).catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      ])
      if (request !== requestVersion.current) return
      const lastPage = Math.max(1, Math.ceil((activeTab === 'GROUPS' ? g.totalCount : t.totalCount) / LIST_PAGE_SIZE))
      if (page > lastPage) { setPage(lastPage); return }
      setTiers(t.items || []); setTierCount(t.totalCount)
      setGroups((g.items || []).sort((a, b) => a.priority - b.priority)); setGroupCount(g.totalCount)
      setPriceLists(((p.items || []) as { id: string; code: string; name: string; status: string }[]).filter((x) => x.status !== 'INACTIVE'))
    } catch (err) {
      if (request === requestVersion.current) showToast(errorText(err, 'Không tải được cấu hình'), 'error')
    } finally {
      if (request === requestVersion.current) setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadGroups, canReadTiers, canReadPrices, page, debouncedSearch, activeFilter, activeTab])

  useEffect(() => {
    let active = true
    if (canReadTiers) creditTiersApi.getCreditTiers({ pageSize: 100, isActive: true }).then(result => { if (active) setTierOptions(result.items) }).catch(() => {})
    else setTierOptions([])
    return () => { active = false }
  }, [canReadTiers, tiers])

  useEffect(() => {
    let active = true
    if (canReadGroups) customerGroupsApi.getCustomerGroups({ pageSize: 1 }).then(result => { if (active) setNextGroupPriority(result.totalCount + 1) }).catch(() => {})
    return () => { active = false }
  }, [canReadGroups, groupCount])

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await action()
      showToast(success, 'success')
      setPrompt(null)
      await load()
    } catch (err) {
      showToast(errorText(err, 'Thao tác thất bại'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const openHistory = async (group: CustomerGroupResponse) => {
    if (!canReadGroups) return
    try {
      setHistory({ group, links: await customerGroupsApi.getPriceListHistory(group.id) })
    } catch (err) {
      showToast(errorText(err, 'Không tải được lịch sử bảng giá'), 'error')
    }
  }

  const groupActions = (g: CustomerGroupResponse): RowAction[] => [
    { permissionCodes: ['CUSTOMER_GROUPS.UPDATE'], label: 'Sửa thông tin', icon: 'edit', onClick: () => setPrompt({ kind: 'group-edit', group: g }) },
    { permissionCodes: ['CUSTOMER_GROUPS.UPDATE'], label: 'Gắn bảng giá', icon: 'price_change', onClick: () => setPrompt({ kind: 'group-price-list', group: g }) },
    { permissionCodes: ['CUSTOMER_GROUPS.UPDATE'], label: 'Gắn hạng tín dụng', icon: 'credit_score', onClick: () => setPrompt({ kind: 'group-tier', group: g }) },
    { permissionCodes: ['CUSTOMER_GROUPS.READ'], label: 'Lịch sử bảng giá', icon: 'history', onClick: () => openHistory(g) },
    ...(!g.isDefault && g.isActive
      ? [{ permissionCodes: ["CUSTOMER_GROUPS.SET_DEFAULT"], label: 'Đặt làm nhóm mặc định', icon: 'star', onClick: () => run(() => customerGroupsApi.setDefault(g.id), `Đã đặt "${g.name}" làm nhóm mặc định`) }]
      : []),
    ...(g.isDefault
      ? []
      : g.isActive
        ? [{ permissionCodes: ["CUSTOMER_GROUPS.DEACTIVATE"], label: 'Ngừng hoạt động', icon: 'block', tone: 'danger' as const, onClick: () => run(() => customerGroupsApi.deactivate(g.id), 'Đã ngừng nhóm khách') }]
        : [{ permissionCodes: ["CUSTOMER_GROUPS.ACTIVATE"], label: 'Kích hoạt', icon: 'check_circle', onClick: () => run(() => customerGroupsApi.activate(g.id), 'Đã kích hoạt nhóm khách') }]),
    ...(!g.isDefault && g.memberCount === 0
      ? [{ permissionCodes: ["CUSTOMER_GROUPS.DELETE"], label: 'Xóa nhóm', icon: 'delete', tone: 'danger' as const, onClick: () => window.confirm(`Xóa nhóm "${g.name}"?`) && run(() => customerGroupsApi.deleteCustomerGroup(g.id), 'Đã xóa nhóm khách') }]
      : []),
  ]

  const tierActions = (t: CreditTierResponse): RowAction[] => [
    { permissionCodes: ['CREDIT_TIERS.UPDATE'], label: 'Sửa', icon: 'edit', onClick: () => setPrompt({ kind: 'tier-edit', tier: t }) },
    t.isActive
      ? { permissionCodes: ["CREDIT_TIERS.DEACTIVATE"], label: 'Ngừng sử dụng', icon: 'block', tone: 'danger', onClick: () => run(() => creditTiersApi.deactivateCreditTier(t.id), 'Đã ngừng hạng tín dụng') }
      : { permissionCodes: ["CREDIT_TIERS.ACTIVATE"], label: 'Kích hoạt', icon: 'check_circle', onClick: () => run(() => creditTiersApi.activateCreditTier(t.id), 'Đã kích hoạt hạng tín dụng') },
  ]

  // ── Prompt definitions ─────────────────────────────────────────────────────
  const groupFields = (withCode: boolean): PromptField[] => [
    ...(withCode ? [{ key: 'code', label: 'Mã nhóm (không đổi được sau khi tạo)', required: true, placeholder: 'VD: REGULAR' }] : []),
    { key: 'name', label: 'Tên nhóm', required: true, placeholder: 'VD: Khách quen' },
    { key: 'priority', label: 'Thứ tự ưu tiên', type: 'number', required: true, min: '0' },
    { key: 'description', label: 'Mô tả', type: 'textarea' },
  ]
  const tierFields = (withCode: boolean): PromptField[] => [
    ...(withCode ? [{ key: 'code', label: 'Mã hạng (không đổi được sau khi tạo)', required: true, placeholder: 'VD: LOYAL' }] : []),
    { key: 'name', label: 'Tên hạng', required: true },
    { key: 'defaultCreditLimit', label: 'Hạn mức mặc định (đ)', type: 'number', required: true, min: '0' },
    { key: 'defaultPaymentTermDays', label: 'Thời hạn nợ (ngày)', type: 'number', required: true, min: '0', hint: 'Là kỳ hạn của khoản nợ khi bán chịu cho khách thuộc hạng này.' },
    { key: 'description', label: 'Mô tả', type: 'textarea' },
  ]

  const promptProps = ((): PromptSpec | null => {
    if (!prompt) return null
    switch (prompt.kind) {
      case 'group-create':
        return {
          title: 'Thêm nhóm khách hàng',
          fields: groupFields(true),
          initialValues: { priority: String(nextGroupPriority) },
          submitLabel: 'Tạo nhóm',
          onSubmit: (v: Record<string, string>) =>
            run(() => customerGroupsApi.createCustomerGroup({ code: v.code.trim(), name: v.name.trim(), priority: Number(v.priority), description: v.description || null }), 'Đã tạo nhóm khách'),
        }
      case 'group-edit':
        return {
          title: `Sửa nhóm ${prompt.group.code}`,
          fields: groupFields(false),
          initialValues: { name: prompt.group.name, priority: String(prompt.group.priority), description: prompt.group.description ?? '' },
          submitLabel: 'Lưu',
          onSubmit: (v: Record<string, string>) =>
            run(() => customerGroupsApi.updateCustomerGroup(prompt.group.id, { name: v.name.trim(), priority: Number(v.priority), description: v.description || null }), 'Đã cập nhật nhóm'),
        }
      case 'group-price-list':
        return {
          title: `Gắn bảng giá cho "${prompt.group.name}"`,
          description: 'Mỗi nhóm có một bảng giá hiện hành; gắn bảng mới sẽ kết thúc liên kết cũ. Chỉ bảng giá Nháp hoặc Đang áp dụng.',
          fields: [
            { key: 'priceListId', label: 'Bảng giá', type: 'select', required: true, options: priceLists.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })) },
            { key: 'effectiveFrom', label: 'Áp dụng từ (bỏ trống = ngay)', type: 'date' },
          ] as PromptField[],
          initialValues: { priceListId: prompt.group.currentPriceList?.id ?? '' },
          submitLabel: 'Gắn bảng giá',
          onSubmit: (v: Record<string, string>) =>
            run(() => customerGroupsApi.setGroupPriceList(prompt.group.id, v.priceListId, v.effectiveFrom || undefined), 'Đã gắn bảng giá'),
        }
      case 'group-tier':
        return {
          title: `Hạng tín dụng mặc định của "${prompt.group.name}"`,
          description: 'Khách mới chuyển vào nhóm sẽ theo hạng này. Không thay đổi hồ sơ của thành viên hiện tại.',
          fields: [
            {
              key: 'creditTierId',
              label: 'Hạng tín dụng (bỏ trống = gỡ liên kết)',
              type: 'select',
              options: tierOptions.filter((t) => t.isActive).map((t) => ({ value: t.id, label: `${t.name} — ${formatVnd(t.defaultCreditLimit)}, ${t.defaultPaymentTermDays} ngày` })),
            },
          ] as PromptField[],
          initialValues: { creditTierId: prompt.group.defaultCreditTier?.id ?? '' },
          submitLabel: 'Lưu',
          onSubmit: (v: Record<string, string>) =>
            run(() => customerGroupsApi.setGroupCreditTier(prompt.group.id, v.creditTierId || null), 'Đã cập nhật hạng tín dụng của nhóm'),
        }
      case 'tier-create':
        return {
          title: 'Thêm hạng tín dụng',
          fields: tierFields(true),
          initialValues: { defaultPaymentTermDays: '30' },
          submitLabel: 'Tạo hạng',
          onSubmit: (v: Record<string, string>) =>
            run(
              () =>
                creditTiersApi.createCreditTier({
                  code: v.code.trim(),
                  name: v.name.trim(),
                  description: v.description || undefined,
                  defaultCreditLimit: Number(v.defaultCreditLimit),
                  defaultPaymentTermDays: Number(v.defaultPaymentTermDays),
                }),
              'Đã tạo hạng tín dụng',
            ),
        }
      case 'tier-edit':
        return {
          title: `Sửa hạng ${prompt.tier.code}`,
          description: 'Không thay đổi hạn mức của hồ sơ đã mở, cũng không đổi kỳ hạn của đơn đã xác nhận.',
          fields: tierFields(false),
          initialValues: {
            name: prompt.tier.name,
            defaultCreditLimit: String(prompt.tier.defaultCreditLimit),
            defaultPaymentTermDays: String(prompt.tier.defaultPaymentTermDays),
            description: prompt.tier.description ?? '',
          },
          submitLabel: 'Lưu',
          onSubmit: (v: Record<string, string>) =>
            run(
              () =>
                creditTiersApi.updateCreditTier(prompt.tier.id, {
                  name: v.name.trim(),
                  description: v.description || undefined,
                  defaultCreditLimit: Number(v.defaultCreditLimit),
                  defaultPaymentTermDays: Number(v.defaultPaymentTermDays),
                }),
              'Đã cập nhật hạng tín dụng',
            ),
        }
    }
  })()

  const th = 'p-3 text-sm font-semibold text-on-surface'
  const activeCount = activeTab === 'GROUPS' ? groupCount : tierCount
  const unitLabel = activeTab === 'GROUPS' ? 'nhóm khách' : 'hạng tín dụng'

  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-space-lg pb-10">
      <BusinessReportCards kind="credit" />
      <div className="flex bg-surface-container-low p-1 rounded-lg w-fit" role="tablist">
        {(['GROUPS', 'TIERS'] as Tab[]).filter(tab => tab === 'GROUPS' ? canReadGroups : canReadTiers).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`px-6 py-2 rounded-md font-label-md text-label-md transition-colors ${activeTab === tab ? 'bg-white shadow text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            onClick={() => { setActiveTab(tab); setPage(1) }}
          >
            {tab === 'GROUPS' ? 'Nhóm khách hàng' : 'Hạng tín dụng'}
          </button>
        ))}
      </div>

      <ListToolbar search={{ value: search, onChange: value => { setSearch(value); setPage(1) }, placeholder: activeTab === 'GROUPS' ? 'Tìm mã hoặc tên nhóm khách...' : 'Tìm mã hoặc tên hạng tín dụng...' }} onClear={() => { setSearch(''); setActiveFilter(''); setPage(1) }} actions={<>{activeTab === 'GROUPS' ? (<PermissionAction codes={['CUSTOMER_GROUPS.CREATE']}><Button icon="add" onClick={() => setPrompt({ kind: 'group-create' })}>Thêm nhóm</Button></PermissionAction>) : (<PermissionAction codes={['CREDIT_TIERS.CREATE']}><Button icon="add" onClick={() => setPrompt({ kind: 'tier-create' })}>Thêm hạng</Button></PermissionAction>)}</>}>
        <FilterSelect label="Lọc trạng thái" value={activeFilter} onChange={value => { setActiveFilter(value); setPage(1) }} options={[{ value: '', label: 'Mọi trạng thái' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Ngừng hoạt động' }]} />
      </ListToolbar>

      {activeTab === 'GROUPS' && canReadGroups && (
        <Card className="flex flex-col gap-space-md">
          <div className="flex justify-between items-center gap-3">
            <div>
              <h3 className="font-title-md text-title-md font-bold">Nhóm khách hàng</h3>
            </div>

          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-surface-container-low border-y border-outline-variant">
                  <th className={th}>Nhóm</th>
                  <th className={`${th} text-center`}>Ưu tiên</th>
                  <th className={`${th} text-center`}>Thành viên</th>
                  <th className={th}>Bảng giá</th>
                  <th className={th}>Hạng tín dụng</th>
                  <th className={`${th} text-center`}>Trạng thái</th>
                  <th className="p-3 w-10"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <EmptyTableRow colSpan={7} message="Đang tải..." />
                ) : groups.length === 0 ? (
                  <EmptyTableRow colSpan={7} message="Chưa có nhóm khách hàng nào" />
                ) : (
                  groups.map((g) => (
                    <tr key={g.id} className="border-b border-outline-variant hover:bg-surface-container-lowest">
                      <td className="p-3 text-sm">
                        <div className="font-medium flex items-center gap-1.5">
                          {g.name}
                          {g.isDefault && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Mặc định</span>}
                        </div>
                        <div className="text-xs text-on-surface-variant font-mono">{g.code}</div>
                      </td>
                      <td className="p-3 text-sm text-center tabular-nums">{g.priority}</td>
                      <td className="p-3 text-sm text-center tabular-nums">{g.memberCount}</td>
                      <td className="p-3 text-sm">{g.currentPriceList?.name ?? <span className="text-on-surface-variant italic">Bảng giá khách lẻ</span>}</td>
                      <td className="p-3 text-sm">{g.defaultCreditTier?.name ?? <span className="text-on-surface-variant italic">Chưa gắn</span>}</td>
                      <td className="p-3 text-sm text-center">
                        <StatusBadge label={g.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'} />
                      </td>
                      <td className="p-3 text-right">
                        <RowActionsMenu triggerLabel={`Thao tác nhóm ${g.name}`} actions={groupActions(g)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalCount={activeCount} totalPages={Math.max(1, Math.ceil(activeCount / LIST_PAGE_SIZE))} unitLabel={unitLabel} onPageChange={setPage} />
        </Card>
      )}

      {activeTab === 'TIERS' && canReadTiers && (
        <Card className="flex flex-col gap-space-md">
          <div className="flex justify-between items-center gap-3">
            <div>
              <h3 className="font-title-md text-title-md font-bold">Hạng tín dụng</h3>
            </div>

          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-surface-container-low border-y border-outline-variant">
                  <th className={th}>Hạng</th>
                  <th className={`${th} text-right`}>Hạn mức mặc định</th>
                  <th className={`${th} text-center`}>Thời hạn nợ</th>
                  <th className={`${th} text-center`}>Hồ sơ đang dùng</th>
                  <th className={th}>Nhóm dùng làm mặc định</th>
                  <th className={`${th} text-center`}>Trạng thái</th>
                  <th className="p-3 w-10"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <EmptyTableRow colSpan={7} message="Đang tải..." />
                ) : tiers.length === 0 ? (
                  <EmptyTableRow colSpan={7} message="Chưa có hạng tín dụng nào" />
                ) : (
                  tiers.map((t) => (
                    <tr key={t.id} className="border-b border-outline-variant hover:bg-surface-container-lowest">
                      <td className="p-3 text-sm">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-on-surface-variant font-mono">{t.code}</div>
                      </td>
                      <td className="p-3 text-sm text-right font-medium text-primary tabular-nums">{formatVnd(t.defaultCreditLimit)}</td>
                      <td className="p-3 text-sm text-center">{t.defaultPaymentTermDays} ngày</td>
                      <td className="p-3 text-sm text-center tabular-nums">{t.profileCount}</td>
                      <td className="p-3 text-sm">{t.groups?.length ? t.groups.map((g) => g.name).join(', ') : <span className="text-on-surface-variant">--</span>}</td>
                      <td className="p-3 text-sm text-center">
                        <StatusBadge label={t.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'} />
                      </td>
                      <td className="p-3 text-right">
                        <RowActionsMenu triggerLabel={`Thao tác hạng ${t.name}`} actions={tierActions(t)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        <ServerPagination page={page} pageSize={LIST_PAGE_SIZE} totalCount={activeCount} totalPages={Math.max(1, Math.ceil(activeCount / LIST_PAGE_SIZE))} unitLabel={unitLabel} onPageChange={setPage} />
        </Card>
      )}

      {promptProps && promptPermission && (
        <PermissionAction codes={[promptPermission]}><PromptModal open onClose={() => setPrompt(null)} loading={busy} {...promptProps} /></PermissionAction>
      )}

      <DetailModal open={history !== null} onClose={() => setHistory(null)} widthClassName="max-w-lg">
        {history && (
          <ModalLayout header={<h3 className="text-lg font-bold text-slate-900">Lịch sử bảng giá — {history.group.name}</h3>} bodyClassName="space-y-3">{history.links.length === 0 ? (
            <p className="text-sm text-slate-500">Nhóm chưa từng gắn bảng giá.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {history.links.map((l) => (
                <li key={l.id} className="py-2 flex justify-between gap-3">
                  <span className="font-medium">{l.priceList.name ?? l.priceList.code}</span>
                  <span className="text-slate-500">
                    {formatDay(l.effectiveFrom)} → {l.effectiveTo ? formatDay(l.effectiveTo) : 'nay'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          </ModalLayout>
        )}
      </DetailModal>
    </div>
  )
}
