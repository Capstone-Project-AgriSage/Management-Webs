import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, UserPlus, UserRound, X } from 'lucide-react'
import { customersApi, type CustomerResponse } from '@/api/customersApi'
import { customerGroupsApi, type CustomerGroupResponse } from '@/api/customerGroupsApi'
import { creditTiersApi, type CreditTierResponse } from '@/api/creditTiersApi'
import { customerCreditApi } from '@/api/customerCreditApi'
import CustomerFormModal from '@/features/customers/CustomerFormModal'
import { ApiError } from '@/api/client'
import { formatVnd } from '@/utils/money'
import { CREDIT_STATUS_LABEL, label } from '@/utils/creditLabels'
import { describeApiError } from '@/utils/apiError'
import type { DraftCustomer } from './orderDraft'

interface CustomerSectionProps {
  value: DraftCustomer
  onChange: (customer: DraftCustomer) => void
}

const inputClass =
  'w-full h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'

/** Walk-in buyer (name and phone optional) or a registered customer, whose group sets the prices and who may buy on credit. */
export default function CustomerSection({ value, onChange }: CustomerSectionProps) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // New farmer created at the counter: the create form is the one from the Customers page; its group and credit-tier
  // lists are fetched the first time it opens (a failure only leaves the lists empty, "default group" still works).
  const [adding, setAdding] = useState<{ name: string; phone: string } | null>(null)
  const [lists, setLists] = useState<{ groups: CustomerGroupResponse[]; tiers: CreditTierResponse[] } | null>(null)

  const openAdd = (typed: string) => {
    const text = typed.trim()
    // What the staff typed in the search is most likely the phone when it is mostly digits, else the name.
    setAdding(/^\+?[\d\s.-]{6,}$/.test(text) ? { name: '', phone: text.replace(/[\s.-]/g, '') } : { name: text, phone: '' })
    if (!lists) {
      Promise.all([
        customerGroupsApi.getCustomerGroups({ pageSize: 100 }).then((r) => r.items || []).catch(() => []),
        creditTiersApi.getCreditTiers({ pageSize: 100 }).then((r) => r.items || []).catch(() => []),
      ]).then(([groups, tiers]) => setLists({ groups, tiers }))
    }
  }

  const pick = async (c: CustomerResponse) => {
    setLoading(true)
    setError('')
    try {
      const [credit, addresses] = await Promise.all([
        customerCreditApi.getCredit(c.id).catch((err) => {
          if (err instanceof ApiError && err.status === 404) return null // no credit profile
          throw err
        }),
        customersApi.getAddresses(c.id).catch(() => []),
      ])
      onChange({ kind: 'REGISTERED', customer: c, credit, addresses })
    } catch (err) {
      setError(describeApiError(err, 'Không tải được thông tin khách'))
    } finally {
      setLoading(false)
    }
  }

  const tab = (kind: DraftCustomer['kind'], text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={value.kind === kind}
      onClick={() => value.kind !== kind && onChange(kind === 'WALK_IN' ? { kind: 'WALK_IN', name: '', phone: '' } : { kind: 'REGISTERED', customer: null, credit: null, addresses: [] })}
      className={`flex-1 h-8 rounded-md text-sm font-semibold transition-colors ${value.kind === kind ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
    >
      {text}
    </button>
  )

  return (
    <section className="space-y-2.5" aria-label="Khách hàng">
      <div className="flex gap-1 p-1 rounded-lg bg-surface-container" role="tablist">
        {tab('WALK_IN', 'Khách lẻ')}
        {tab('REGISTERED', 'Khách quen')}
      </div>

      {value.kind === 'WALK_IN' ? (
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Tên khách lẻ" className={inputClass} placeholder="Tên (không bắt buộc)" value={value.name} maxLength={200} onChange={(e) => onChange({ ...value, name: e.target.value })} />
          <input aria-label="SĐT khách lẻ" className={inputClass} placeholder="SĐT (không bắt buộc)" inputMode="tel" value={value.phone} maxLength={20} onChange={(e) => onChange({ ...value, phone: e.target.value })} />
        </div>
      ) : value.customer ? (
        <div className="p-3 rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm text-on-surface truncate">{value.customer.fullName}</div>
              <div className="text-xs text-on-surface-variant">
                {value.customer.phoneNumber ?? value.customer.email ?? '--'} · {value.customer.customerGroup?.name ?? 'Nhóm mặc định'}
              </div>
            </div>
            <button type="button" aria-label="Đổi khách" title="Đổi khách" className="p-1 rounded-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface" onClick={() => onChange({ kind: 'REGISTERED', customer: null, credit: null, addresses: [] })}>
              <X size={16} />
            </button>
          </div>
          <div className="mt-2 pt-2 border-t border-outline-variant/60 text-xs">
            {value.credit ? (
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                <span className={value.credit.status === 'ACTIVE' ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>
                  Mua chịu: {label(CREDIT_STATUS_LABEL, value.credit.status)}
                </span>
                <span className="text-on-surface-variant">
                  Còn được mua chịu <strong className="text-on-surface tabular-nums">{formatVnd(value.credit.availableCredit)}</strong> / {formatVnd(value.credit.creditLimit)}
                </span>
              </div>
            ) : (
              <span className="text-on-surface-variant">Chưa mở mua chịu — chỉ bán trả đủ.</span>
            )}
          </div>
        </div>
      ) : (
        <CustomerSearch onPick={pick} onAddNew={openAdd} loading={loading} />
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}

      <CustomerFormModal
        open={adding !== null}
        customer={null}
        groups={lists?.groups ?? []}
        tiers={lists?.tiers ?? []}
        initialName={adding?.name}
        initialPhone={adding?.phone}
        onClose={() => setAdding(null)}
        onSaved={(saved) => {
          setAdding(null)
          pick(saved) // loads the credit and saved addresses, then the order is built for this farmer
        }}
      />
    </section>
  )
}

function CustomerSearch({ onPick, onAddNew, loading }: { onPick: (c: CustomerResponse) => void; onAddNew: (typed: string) => void; loading: boolean }) {
  const [text, setText] = useState('')
  const [results, setResults] = useState<CustomerResponse[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    const t = setTimeout(() => {
      setSearching(true)
      customersApi
        .getCustomers({ search: text.trim() || undefined, status: 'ACTIVE', pageSize: 8 })
        .then((r) => alive && setResults(r.items))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setSearching(false))
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [text, open])

  useEffect(() => {
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div className="flex items-center gap-2">
      <div ref={box} className="relative flex-1 min-w-0">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          aria-label="Tìm khách quen"
          className={`${inputClass} pl-9`}
          placeholder="Tìm theo tên hoặc số điện thoại..."
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
        />
        {(searching || loading) && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-on-surface-variant" />}
        {open && (
          <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg" role="listbox">
            {results.length === 0 ? (
              <div className="px-3 py-3 text-sm text-on-surface-variant">
                {searching ? (
                  'Đang tìm...'
                ) : (
                  <>
                    <p>Không tìm thấy khách đang hoạt động.</p>
                    <button
                      type="button"
                      className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline"
                      onClick={() => {
                        setOpen(false)
                        onAddNew(text)
                      }}
                    >
                      <UserPlus size={14} /> Thêm {text.trim() ? `"${text.trim()}"` : 'nông dân'} làm khách mới
                    </button>
                  </>
                )}
              </div>
            ) : (
              results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 hover:bg-surface-container"
                  onClick={() => {
                    setOpen(false)
                    onPick(c)
                  }}
                >
                  <UserRound size={16} className="text-on-surface-variant shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-on-surface truncate">{c.fullName}</span>
                    <span className="block text-xs text-on-surface-variant">
                      {c.phoneNumber ?? '--'} · {c.customerGroup?.name ?? 'Nhóm mặc định'}
                      {c.allowCreditPurchase ? ' · có mua chịu' : ''}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className="h-9 shrink-0 px-3 rounded-lg border border-emerald-600 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 flex items-center gap-1.5"
        onClick={() => onAddNew(text)}
      >
        <UserPlus size={15} /> Khách mới
      </button>
    </div>
  )
}
