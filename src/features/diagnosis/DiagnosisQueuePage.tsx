import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { describeError } from '@/api/client'
import { diagnosisApi, type DiagnosisListItem, type DiagnosisStatus } from '@/api/diagnosisApi'
import type { Paged } from '@/api/types'
import SearchInput from '@/components/ui/SearchInput'
import FilterSelect from '@/components/ui/FilterSelect'
import Pagination from '@/components/ui/Pagination'
import EmptyTableRow from '@/components/ui/EmptyTableRow'
import { formatDateTime } from '@/utils/units'
import { DIAGNOSIS_STATUS_BADGE_CLASS, DIAGNOSIS_STATUS_LABEL, diseaseLabel, useDiagnosisBase } from './diagnosisLabels'

const PAGE_SIZE = 10

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  ...(Object.keys(DIAGNOSIS_STATUS_LABEL) as DiagnosisStatus[]).map((s) => ({ value: s, label: DIAGNOSIS_STATUS_LABEL[s] })),
]

const POLICY_OPTIONS = [
  { value: '', label: 'Mọi kết quả AI' },
  { value: 'true', label: 'Đạt ngưỡng của AI' },
  { value: 'false', label: 'Không đạt ngưỡng' },
]

function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`
}

export default function DiagnosisQueuePage() {
  usePageHeader({
    title: 'Hàng đợi chẩn đoán AI',
    subtitle: 'Duyệt ảnh lá lúa nông dân gửi: xác nhận, sửa bệnh hoặc chưa kết luận, rồi gợi ý cách xử lý',
  })
  const { showToast } = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()
  const base = useDiagnosisBase()
  const canReview = Boolean(user?.canReviewAi)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [status, setStatus] = useState<string>('AI_COMPLETED')
  const [policy, setPolicy] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<DiagnosisListItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const request = useRef(0)

  const load = useCallback(async () => {
    const id = ++request.current
    setLoading(true)
    try {
      const res = await diagnosisApi.list({
        status: (status || undefined) as DiagnosisStatus | undefined,
        aiPassed: policy === '' ? undefined : policy === 'true',
        search: debouncedSearch.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      if (id === request.current) setData(res)
    } catch (err) {
      if (id === request.current) showToast(describeError(err, 'Không tải được hàng đợi chẩn đoán'), 'error')
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [status, policy, debouncedSearch, page, showToast])

  useEffect(() => {
    load()
  }, [load])

  const items = data?.items ?? []

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg p-space-md">
      {!canReview && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <span>
            Bạn xem được hàng đợi nhưng chưa được cấp quyền duyệt AI. Chủ cửa hàng cấp quyền này trong mục quản lý nhân viên.
          </span>
        </div>
      )}

      <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-sm flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Tìm theo mã ca, tên hoặc số điện thoại nông dân..."
          className="relative flex-1 min-w-[240px]"
        />
        <FilterSelect
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          value={policy}
          onChange={(v) => {
            setPolicy(v)
            setPage(1)
          }}
          options={POLICY_OPTIONS}
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
              <tr>
                <th className="py-3 px-4 font-medium">Mã ca</th>
                <th className="py-3 px-3 font-medium">Nông dân</th>
                <th className="py-3 px-3 font-medium text-center">Trạng thái</th>
                <th className="py-3 px-3 font-medium">AI đoán</th>
                <th className="py-3 px-3 font-medium text-right">Độ tin cậy</th>
                <th className="py-3 px-3 font-medium text-center">Ngưỡng</th>
                <th className="py-3 px-3 font-medium">Kết luận</th>
                <th className="py-3 px-4 font-medium">Gửi lúc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 text-sm">
              {loading && items.length === 0 ? (
                <EmptyTableRow colSpan={8} message="Đang tải..." className="text-slate-500 animate-pulse" />
              ) : items.length === 0 ? (
                <EmptyTableRow colSpan={8} message="Không có ca chẩn đoán nào." />
              ) : (
                items.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-surface-container-low transition-colors cursor-pointer"
                    onClick={() => navigate(`${base}/${c.id}`)}
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold">{c.caseNumber}</td>
                    <td className="py-3 px-3">
                      <div>{c.farmerName}</div>
                      {c.farmerPhone && <div className="text-xs text-slate-500">{c.farmerPhone}</div>}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded tracking-wide whitespace-nowrap ${DIAGNOSIS_STATUS_BADGE_CLASS[c.status]}`}
                      >
                        {DIAGNOSIS_STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {c.predictedClassLabel ? diseaseLabel(c.predictedClassLabel) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{percent(c.confidence)}</td>
                    <td className="py-3 px-3 text-center">
                      {c.passedPolicy === null ? (
                        <span className="text-slate-400">—</span>
                      ) : c.passedPolicy ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Đạt</span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Không đạt</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {c.finalDiseaseCode ? diseaseLabel(c.finalDiseaseCode) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{formatDateTime(c.submittedAt)}</td>
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
          unitLabel="ca chẩn đoán"
          goPrev={() => setPage((p) => Math.max(1, p - 1))}
          goNext={() => setPage((p) => Math.min(data?.totalPages ?? 1, p + 1))}
          setPage={setPage}
        />
      </div>

      <p className="text-xs text-slate-500">
        AI chỉ là bằng chứng. Mọi ca, kể cả ca đạt ngưỡng, đều cần người có quyền duyệt xác minh trước khi nông dân thấy kết quả và gợi ý thuốc.
      </p>
    </div>
  )
}
