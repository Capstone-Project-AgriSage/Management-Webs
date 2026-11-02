import { useCallback, useEffect, useRef, useState } from 'react'
import { Phone } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { describeError } from '@/api/client'
import { advisorySessionsApi, type AdvisorySession } from '@/api/advisoryApi'
import { diseasesApi, type Disease } from '@/api/diagnosisApi'
import type { Paged } from '@/api/types'
import ListToolbar from '@/components/ui/ListToolbar'
import ListReportCards from '@/features/agent/reports/ListReportCards'
import DateFilter from '@/components/ui/DateFilter'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { formatDateTime } from '@/utils/units'
import { GROWTH_STAGE_LABEL } from './diagnosisLabels'
import type { GrowthStage } from '@/api/advisoryApi'

const PAGE_SIZE = 10

/** 1 công = 1.000 m², the unit a rice Farmer quotes. */
function areaText(sqm: number | null): string {
  if (sqm === null) return 'Không nhập'
  return sqm >= 1000 ? `${(sqm / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} công (${sqm.toLocaleString('vi-VN')} m²)` : `${sqm.toLocaleString('vi-VN')} m²`
}

/**
 * What the Farmers were advised (ADVISORY.md section 7): one row per consultation, the products offered, and whether the Farmer
 * bought one of them within 7 days. Read only; the store uses it to see which problems and products matter.
 */
export default function AdvisorySessionsPage() {
  usePageHeader({
    title: 'Ca tư vấn vật tư',
    subtitle: 'Nông dân đã hỏi về vấn đề gì, được gợi ý sản phẩm nào và có mua trong 7 ngày hay không',
  })
  const { showToast } = useToast()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [diseaseId, setDiseaseId] = useState('')
  const [page, setPage] = useState(1)
  const [diseases, setDiseases] = useState<Disease[]>([])
  const [data, setData] = useState<Paged<AdvisorySession> | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const request = useRef(0)

  useEffect(() => {
    diseasesApi
      .list()
      .then(setDiseases)
      .catch(() => undefined) // the problem filter then only offers "all"
  }, [])

  const rangeInvalid = from !== '' && to !== '' && to < from

  const load = useCallback(async () => {
    if (rangeInvalid) return
    const id = ++request.current
    setLoading(true)
    setLoadError(false)
    try {
      const res = await advisorySessionsApi.list({
        from: from || undefined,
        to: to || undefined,
        diseaseId: diseaseId || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      if (id === request.current) setData(res)
    } catch (err) {
      if (id === request.current) {
        setLoadError(true)
        showToast(describeError(err, 'Không tải được danh sách ca tư vấn'), 'error')
      }
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [from, to, diseaseId, page, rangeInvalid, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const items = data?.items ?? []

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      <ListReportCards
        title="Tổng hợp tư vấn vật tư"
        totalCount={data?.totalCount ?? null}
        unit="ca tư vấn"
        loading={loading}
        error={loadError}
        metrics={[
          { label: 'Có mua trong 7 ngày (trang này)', value: items.filter((s) => s.boughtWithin7Days).length },
          { label: 'Đi từ kết quả AI (trang này)', value: items.filter((s) => s.source === 'DIAGNOSIS_CASE').length },
          { label: 'Không có sản phẩm nào (trang này)', value: items.filter((s) => s.items.length === 0).length },
        ]}
      />

      <ListToolbar
        onClear={() => {
          setFrom('')
          setTo('')
          setDiseaseId('')
          setPage(1)
        }}
      >
        <DateFilter label="Từ ngày" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
        <DateFilter label="Đến ngày" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
        <FilterSelect
          label="Vấn đề"
          value={diseaseId}
          onChange={(v) => {
            setDiseaseId(v)
            setPage(1)
          }}
          options={[{ value: '', label: 'Tất cả vấn đề' }, ...diseases.filter((d) => !d.isHealthyClass).map((d) => ({ value: d.id, label: d.name }))]}
        />
      </ListToolbar>
      {rangeInvalid && <p role="alert" className="text-sm text-rose-700">Ngày bắt đầu phải trước hoặc cùng ngày với ngày kết thúc.</p>}

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 font-medium">Thời gian</th>
                <th className="py-3 px-3 font-medium">Nông dân</th>
                <th className="py-3 px-3 font-medium">Vấn đề</th>
                <th className="py-3 px-3 font-medium">Ruộng</th>
                <th className="py-3 px-3 font-medium">Sản phẩm được gợi ý</th>
                <th className="py-3 px-3 font-medium text-center">Nguồn</th>
                <th className="py-3 px-4 font-medium text-center">Mua trong 7 ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm">
              {loading && items.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Đang tải..." className="text-slate-500 animate-pulse" />
              ) : items.length === 0 ? (
                <EmptyTableRow colSpan={7} message="Chưa có ca tư vấn nào." />
              ) : (
                items.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-container-low transition-colors align-top">
                    <td className="py-3 px-4 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                    <td className="py-3 px-3">
                      <div>{s.farmer.name}</div>
                      {s.farmer.phone && (
                        <a href={`tel:${s.farmer.phone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" title="Gọi nông dân">
                          <Phone size={12} /> {s.farmer.phone}
                        </a>
                      )}
                    </td>
                    <td className="py-3 px-3 font-medium">{s.problem.name}</td>
                    <td className="py-3 px-3">
                      <div>{areaText(s.areaSqm)}</div>
                      {s.growthStage && <div className="text-xs text-slate-500">{GROWTH_STAGE_LABEL[s.growthStage as GrowthStage] ?? s.growthStage}</div>}
                    </td>
                    <td className="py-3 px-3">
                      {s.items.length === 0 ? (
                        <span className="text-slate-400">Không có sản phẩm</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {[...s.items]
                            .sort((a, b) => a.group.localeCompare(b.group) || a.rankOrder - b.rankOrder)
                            .map((i) => (
                              <li key={`${i.group}-${i.storeProductId}`}>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mr-1">{i.group === 'PROTECTION' ? 'Thuốc' : 'Phân'}</span>
                                {i.name}
                              </li>
                            ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap">
                        {s.source === 'DIAGNOSIS_CASE' ? 'Từ kết quả AI' : 'Tự tìm'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {s.boughtWithin7Days ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Đã mua</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={data?.totalPages ?? 1}
          startIndex={(page - 1) * PAGE_SIZE}
          endIndex={Math.min(page * PAGE_SIZE, data?.totalCount ?? 0)}
          totalCount={data?.totalCount ?? 0}
          unitLabel="ca tư vấn"
          goPrev={() => setPage((p) => Math.max(1, p - 1))}
          goNext={() => setPage((p) => Math.min(data?.totalPages ?? 1, p + 1))}
          setPage={setPage}
        />
      </div>
    </div>
  )
}
