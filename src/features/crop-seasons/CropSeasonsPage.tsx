import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import ListToolbar from '@/components/ui/ListToolbar'
import FilterSelect from '@/components/ui/FilterSelect'
import PermissionAction from '@/components/auth/PermissionAction'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import StatusBadge from '@/components/ui/StatusBadge'
import ListReportCards from '@/features/agent/reports/ListReportCards'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { cropSeasonsApi, type ClosingBlocker, type CropSeason } from '@/api/cropSeasonsApi'
import { ApiError } from '@/api/client'
import { describeApiError } from '@/utils/apiError'
import { formatDay, useCanManage } from '@/utils/creditLabels'
import { formatVnd } from '@/utils/money'
import CropSeasonFormModal, { type SeasonFormResult } from './CropSeasonFormModal'
import { SEASON_STATUS, findWindowIssues, suggestedWindowStart } from './seasonRules'

// Seasons are few (about three a year), so the page loads them all: the gap/overlap check needs every season anyway.
const ALL = 100


const CLOSING_BLOCKER: Record<ClosingBlocker, (n: { entries: number; orders: number }) => string> = {
  ALREADY_CLOSED: () => 'vụ đã đóng',
  HARVEST_NOT_ENDED: () => 'vụ chưa hết thu hoạch',
  OPEN_ENTRIES: (n) => `còn ${n.entries} khoản nợ đang thu`,
  OPEN_CREDIT_ORDERS: (n) => `còn ${n.orders} đơn chịu chưa xong`,
}

type FormState = { season: CropSeason | null } | null

// Mục 6 và 14 của tài liệu công nợ theo vụ: the store owner keeps the season calendar; each credit order takes the
// season whose order window holds its confirmation day, and every debt entry of a season shares its due date.
export default function CropSeasonsPage() {
  const canManage = useCanManage(['CROP_SEASONS.MANAGE'])
  usePageHeader({
    title: 'Vụ mùa',
    subtitle: canManage ? 'Lịch vụ của cửa hàng: khoảng nhận đơn mua chịu, ngày thu hoạch và hạn trả nợ' : 'Lịch vụ và hạn trả nợ của cửa hàng',
  })
  const { showToast } = useToast()

  const [seasons, setSeasons] = useState<CropSeason[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [form, setForm] = useState<FormState>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setListError(false)
    try {
      const result = await cropSeasonsApi.getSeasons({ pageSize: ALL })
      setSeasons(result.items)
    } catch (err) {
      showToast(describeApiError(err, 'Không tải được danh sách vụ mùa'), 'error')
      setListError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const all = useMemo(() => (seasons ?? []).slice().sort((a, b) => b.orderWindowStart.localeCompare(a.orderWindowStart)), [seasons])
  const issues = useMemo(() => findWindowIssues(all), [all])
  const term = search.trim().toLowerCase()
  const visible = all.filter((s) => (!status || s.status === status) && (!term || s.code.toLowerCase().includes(term) || s.name.toLowerCase().includes(term)))
  const current = all.find((s) => s.status === 'OPEN')
  const nextOf = (season: CropSeason | null) => (season ? all.slice().reverse().find((s) => s.orderWindowStart > season.orderWindowStart) ?? null : null)
  const collecting = all.filter((s) => s.status === 'HARVESTING' || s.status === 'COLLECTING')

  const submit = async (result: SeasonFormResult) => {
    if (!form) return
    setSaving(true)
    try {
      if (result.mode === 'create') {
        await cropSeasonsApi.create(result.body)
        showToast(`Đã tạo vụ ${result.body.name}`, 'success')
      } else if (form.season) {
        const saved = await cropSeasonsApi.update(form.season.id, result.body)
        const ext = saved.debtExtension
        if (ext) showToast(ext.skippedDisputed > 0 ? `Đã dời ${ext.moved} khoản sang hạn mới; ${ext.skippedDisputed} khoản đang khiếu nại giữ hạn cũ, cần Chủ quyết riêng` : `Đã lưu vụ và dời ${ext.moved} khoản sang hạn mới`, 'success')
        else showToast('Đã lưu vụ mùa', 'success')
      }
      setForm(null)
      await load()
    } catch (err) {
      showToast(describeApiError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const close = async (season: CropSeason) => {
    setSaving(true)
    try {
      const check = await cropSeasonsApi.getClosingCheck(season.id)
      if (!check.canClose) {
        showToast(`Chưa đóng được vụ ${season.name}: ${check.reasons.map((r) => CLOSING_BLOCKER[r]({ entries: check.openEntryCount, orders: check.openCreditOrderCount })).join('; ')}`, 'error')
        return
      }
      if (!window.confirm(`Đóng vụ ${season.name}?
Số liệu của vụ sẽ được chốt để báo cáo, không sửa và không mở lại được.`)) return
      await cropSeasonsApi.close(season.id, season.version)
      showToast(`Đã đóng vụ ${season.name}`, 'success')
      await load()
    } catch (err) {
      showToast(describeApiError(err), 'error')
      if (err instanceof ApiError && err.status === 409) await load()
    } finally {
      setSaving(false)
    }
  }

  const columns = canManage ? 8 : 7

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <ListReportCards title="Tổng hợp vụ mùa" totalCount={seasons ? seasons.length : null} totalLabel="Số vụ" totalNote="Tất cả vụ của cửa hàng" unit="vụ" loading={loading} error={listError} metrics={[
        { label: 'Đang thu hoạch, thu nợ', value: collecting.length, note: 'Tất cả vụ của cửa hàng' },
        { label: 'Nợ đang thu của các vụ', value: seasons ? all.filter((s) => s.status !== 'CLOSED').reduce((sum, s) => sum + s.collecting.outstandingAmount, 0) : null, kind: 'money', note: 'Các vụ chưa đóng' },
        { label: 'Đã đóng', value: all.filter((s) => s.status === 'CLOSED').length, note: 'Tất cả vụ của cửa hàng' },
      ]} />

      {!loading && seasons && (
        current ? (
          <p className="text-sm text-slate-600">
            Đơn mua chịu xác nhận hôm nay thuộc vụ <strong className="text-slate-900">{current.name}</strong>, hạn trả <strong className="text-slate-900 tabular-nums">{formatDay(current.paymentDueDate)}</strong>.
          </p>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900" role="status">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Chưa có vụ đang nhận đơn</p>
              <p className="mt-0.5">Đơn mua chịu xác nhận lúc này sẽ tính hạn theo số ngày của hạng tín dụng. {canManage ? 'Hãy tạo vụ kế tiếp.' : 'Hãy báo chủ cửa hàng tạo vụ.'}</p>
            </div>
          </div>
        )
      )}

      {issues.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900" role="status">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">Lịch vụ chưa liền nhau</p>
            {issues.map((issue) => (
              <p key={`${issue.previous.id}-${issue.next.id}`}>
                {issue.kind === 'gap'
                  ? `Hở ${issue.days} ngày giữa ${issue.previous.name} và ${issue.next.name}: đơn chịu xác nhận từ ${formatDay(issue.previous.harvestStart)} tới trước ${formatDay(issue.next.orderWindowStart)} không thuộc vụ nào.`
                  : `Chồng ${issue.days} ngày giữa ${issue.previous.name} và ${issue.next.name}: ${issue.next.name} nên bắt đầu nhận đơn từ ${formatDay(issue.previous.harvestStart)}.`}
              </p>
            ))}
          </div>
        </div>
      )}

      <ListToolbar
        search={{ value: search, onChange: setSearch, placeholder: 'Tìm theo mã hoặc tên vụ...' }}
        onClear={() => { setSearch(''); setStatus('') }}
        actions={canManage ? (
          <PermissionAction codes={['CROP_SEASONS.MANAGE']}>
            <button type="button" className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center gap-1.5" onClick={() => setForm({ season: null })}>
              <Plus size={16} /> Tạo vụ
            </button>
          </PermissionAction>
        ) : undefined}
      >
        <FilterSelect label="Trạng thái" value={status} onChange={setStatus} options={[{ value: '', label: 'Mọi trạng thái' }, ...Object.entries(SEASON_STATUS).map(([value, item]) => ({ value, label: item.label }))]} />
      </ListToolbar>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-900 text-[13px] font-bold">
                <th className="py-3 px-4" scope="col">Vụ</th>
                <th className="py-3 px-3" scope="col">Nhận đơn từ</th>
                <th className="py-3 px-3" scope="col">Thu hoạch</th>
                <th className="py-3 px-3 text-right" scope="col">Ân hạn</th>
                <th className="py-3 px-3" scope="col">Hạn trả</th>
                <th className="py-3 px-3 text-right" scope="col">Còn nợ</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                {canManage && <th className="py-3 px-4 text-right" scope="col">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-900">
              {loading && !seasons ? (
                <EmptyTableRow colSpan={columns} message="Đang tải dữ liệu..." />
              ) : visible.length === 0 ? (
                <EmptyTableRow colSpan={columns} message={all.length === 0 && !listError ? 'Chưa có vụ nào. Tạo vụ đầu tiên để tính hạn trả theo vụ.' : 'Không tìm thấy vụ nào.'} />
              ) : (
                visible.map((season) => {
                  const closed = season.status === 'CLOSED'
                  return (
                    <tr key={season.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{season.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">{season.code}</div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap tabular-nums">{formatDay(season.orderWindowStart)}</td>
                      <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap tabular-nums">{formatDay(season.harvestStart)} → {formatDay(season.harvestEnd)}</td>
                      <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">{season.graceDays} ngày</td>
                      <td className="py-3.5 px-3 whitespace-nowrap font-semibold tabular-nums">{formatDay(season.paymentDueDate)}</td>
                      <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">
                        {season.originated.openEntryCount > 0 || season.collecting.openEntryCount > 0 ? (
                          <>
                            <div title="Nợ đang thu trong vụ này (gồm cả nợ chuyển từ vụ trước)">{formatVnd(season.collecting.outstandingAmount)}</div>
                            <div className="text-xs text-slate-500">{season.collecting.openEntryCount} khoản đang thu</div>
                            <div className="text-xs text-slate-400" title="Nợ phát sinh trong vụ này, tính cả phần đã chuyển sang vụ sau">{formatVnd(season.originated.outstandingAmount)} phát sinh ({season.originated.openEntryCount})</div>
                          </>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <StatusBadge label={SEASON_STATUS[season.status]?.label ?? season.status} className={SEASON_STATUS[season.status]?.className} />
                      </td>
                      {canManage && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap"><RowActionsMenu disabled={saving} triggerLabel={`Thao tác vụ ${season.name}`} actions={closed ? [] : [
                            { label: 'Sửa vụ', icon: 'edit', permissionCodes: ['CROP_SEASONS.MANAGE'], onClick: () => setForm({ season }) },
                            ...(['COLLECTING', 'HARVESTING'].includes(season.status) ? [{ label: 'Đóng vụ', icon: 'lock', permissionCodes: ['CROP_SEASONS.MANAGE'], title: 'Kiểm tra điều kiện rồi đóng vụ', onClick: () => { void close(season) } }] : []),
                          ]} /></td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CropSeasonFormModal
        open={form !== null}
        season={form?.season ?? null}
        suggestedStart={suggestedWindowStart(all)}
        nextSeason={nextOf(form?.season ?? null)}
        saving={saving}
        onClose={() => setForm(null)}
        onSubmit={submit}
      />
    </div>
  )
}
