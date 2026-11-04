import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'
import RowActionsMenu from '@/components/ui/RowActionsMenu'
import { cropSeasonsApi, type CropSeason, type LimitSuggestions } from '@/api/cropSeasonsApi'
import { describeApiError } from '@/utils/apiError'
import { CREDIT_STATUS_LABEL, formatDay, label, useRoleBase } from '@/utils/creditLabels'
import { formatVnd } from '@/utils/money'

// FE_GUIDE_FLOW_3 §3.1 mục 9: customers who paid on time in each of the last N closed seasons. Read only: the server never
// changes a limit; the owner opens the customer's profile (the existing credit-limit screen) to raise it. The rule that
// picks these customers is still open with the backend (D12), so this shows what the server returns today.

export default function LimitSuggestionsModal({ season, onClose }: { season: CropSeason; onClose: () => void }) {
  const navigate = useNavigate(), base = useRoleBase()
  const [data, setData] = useState<LimitSuggestions | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    cropSeasonsApi.getLimitSuggestions(season.id).then(r => { if (active) setData(r) }).catch(err => { if (active) setError(describeApiError(err, 'Không tải được gợi ý hạn mức')) })
    return () => { active = false }
  }, [season.id])

  return (
    <DetailModal open onClose={onClose} widthClassName="max-w-3xl">
      <ModalLayout header={<h3 className="text-lg font-semibold text-slate-900">Gợi ý tăng hạn mức sau vụ {season.name}</h3>}
        footer={<div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Đóng</button></div>} bodyClassName="space-y-4">
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {!data && !error && <p role="status" className="text-sm text-slate-500">Đang tải…</p>}
        {data && (
          <>
            <p className="text-sm text-slate-600">
              Khách trả đúng hạn trong <strong>{data.requiredSeasons}</strong> vụ liền nhau
              {data.seasons.length > 0 && <> ({data.seasons.map(s => s.name).join(', ')})</>}: không gia hạn, không bị giảm hay xóa nợ, trả xong trước hạn gốc.
              Đây chỉ là gợi ý, hệ thống không tự đổi hạn mức.
            </p>
            {data.items.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                {data.seasons.length === 0 ? `Chưa đủ ${data.requiredSeasons} vụ đã đóng liền nhau để gợi ý.` : 'Chưa có khách nào đủ điều kiện.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead><tr className="border-b border-slate-100 text-xs font-bold text-slate-700">
                    <th className="py-2 pr-3">Khách hàng</th><th className="px-3 py-2 text-right">Hạn mức hiện tại</th><th className="px-3 py-2">Tín dụng</th><th className="px-3 py-2 text-right">Đã trả</th><th className="px-3 py-2">Trả lần cuối</th><th className="py-2 pl-3 text-right"><span className="sr-only">Thao tác</span></th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.items.map(item => (
                      <tr key={item.farmerProfileId}>
                        <td className="py-2.5 pr-3"><div className="font-medium text-slate-900">{item.fullName}</div><div className="text-xs text-slate-500">{item.phoneNumber ?? ''}</div></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatVnd(item.creditLimit)}</td>
                        <td className="px-3 py-2.5">{label(CREDIT_STATUS_LABEL, item.creditStatus)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatVnd(item.paidAmount)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatDay(item.lastPaidOn)}</td>
                        <td className="py-2.5 pl-3 text-right"><RowActionsMenu triggerLabel={`Thao tác hạn mức ${item.fullName}`} actions={[
                          { label: 'Mở hồ sơ để nâng hạn mức', icon: 'credit_score', permissionCodes: ['CREDIT.UPDATE'], onClick: () => navigate(`${base}/farmers?customer=${item.farmerProfileId}`) },
                          { label: 'Xem công nợ của khách', icon: 'person', onClick: () => navigate(`${base}/debts/${item.farmerProfileId}`) },
                        ]} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </ModalLayout>
    </DetailModal>
  )
}
