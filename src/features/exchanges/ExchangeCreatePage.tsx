import { useEffect, useId, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { ordersApi } from '@/api/ordersApi'
import type { OrderResponse } from '@/api/types'
import Select from '@/components/ui/Select'
import SearchInput from '@/components/ui/SearchInput'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import ExchangeRequestForm, { type ExchangeFormState } from './ExchangeRequestForm'
import ExchangeDialog from './ExchangeDialog'
import { useExchangeBase } from './exchangePaths'
import { exchangeField, exchangePrimary, exchangeSecondary, exchangeSection } from './exchangeStyles'

export default function ExchangeCreatePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const base = useExchangeBase()
  const formId = useId()
  const pinnedOrderId = params.get('orderId')
  const [orderId, setOrderId] = useState(pinnedOrderId ?? '')
  const [search, setSearch] = useState('')
  const keyword = useDebouncedValue(search)
  const [orders, setOrders] = useState<OrderResponse[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!pinnedOrderId)
  const [revision, setRevision] = useState(0)
  const [formState, setFormState] = useState<ExchangeFormState>({ busy: false, canSubmit: false })

  useEffect(() => {
    if (pinnedOrderId) return
    const controller = new AbortController()
    ordersApi.getOrders({ status: 'COMPLETED', search: keyword, page: 1, pageSize: 100 }, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setOrders(result.items); setError('') } })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Không tải được đơn hàng') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [pinnedOrderId, keyword, revision])

  return <ExchangeDialog title="Tạo yêu cầu đổi hàng" subtitle="Chọn hàng thu hồi và sản phẩm thay thế từ đơn đã hoàn thành" busy={formState.busy}
    footer={<div className="flex flex-wrap items-center justify-end gap-3">
      <button type="button" className={exchangeSecondary} disabled={formState.busy} onClick={() => navigate(base, { replace: true })}>Hủy</button>
      <button type="submit" form={formId} className={exchangePrimary} disabled={!orderId || !formState.canSubmit || formState.busy}><Plus size={16} aria-hidden="true" />{formState.busy ? 'Đang gửi...' : 'Gửi yêu cầu đổi hàng'}</button>
    </div>}>
    {!pinnedOrderId && <section className={exchangeSection}>
      <div><h3 className="font-semibold text-on-surface">Đơn hàng gốc</h3><p className="mt-1 text-sm text-on-surface-variant">Tìm và chọn đơn đã hoàn thành để kiểm tra số lượng còn được đổi.</p></div>
      <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã đơn hoặc tên khách hàng..." />
      <label className="block space-y-1.5 text-sm font-medium">Chọn đơn hàng<Select aria-label="Đơn hàng gốc" className={exchangeField} value={orderId} disabled={formState.busy} onChange={event => { setOrderId(event.target.value); setFormState({ busy: false, canSubmit: false }) }}>
        <option value="">{loading ? 'Đang tải đơn hàng...' : 'Chọn đơn hàng đã hoàn thành'}</option>
        {orders.map(order => <option key={order.id} value={order.id}>{order.orderNumber} — {order.customerName}</option>)}
      </Select></label>
      {error && <p role="alert" className="text-sm text-rose-700">{error} <button type="button" className="font-semibold underline" onClick={() => { setLoading(true); setRevision(value => value + 1) }}>Thử lại</button></p>}
      {!loading && !error && !orders.length && <p className="text-sm text-on-surface-variant">Không tìm thấy đơn hoàn thành phù hợp.</p>}
    </section>}
    {orderId ? <ExchangeRequestForm key={orderId} orderId={orderId} formId={formId} onStateChange={setFormState} onCreated={exchange => navigate(`${base}/${exchange.id}`, { replace: true })} /> : <div className="rounded-xl border border-dashed border-outline-variant px-5 py-10 text-center text-sm text-on-surface-variant">Chọn đơn hàng để thêm hàng thu hồi và hàng thay thế.</div>}
  </ExchangeDialog>
}
