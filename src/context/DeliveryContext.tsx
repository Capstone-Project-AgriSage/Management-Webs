import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ConfirmDeliveredInput, DeliveryOrder, ReportFailureInput } from '../types'
import { deliveryOrders as INITIAL_ORDERS } from '../data/mockDeliveries'
import { FAILURE_REASON_OPTIONS } from '../data/failureReasons'

interface DeliveryContextValue {
  orders: DeliveryOrder[]
  getById: (id: string) => DeliveryOrder | undefined
  startDelivery: (id: string) => void
  confirmDelivered: (id: string, input: ConfirmDeliveredInput) => void
  reportFailure: (id: string, input: ReportFailureInput) => void
  startRedelivery: (id: string) => void
}

const DeliveryContext = createContext<DeliveryContextValue | undefined>(undefined)

function nowIso(): string {
  return new Date().toISOString()
}

export function DeliveryProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<DeliveryOrder[]>(INITIAL_ORDERS)

  const getById = useCallback((id: string) => orders.find((o) => o.id === id), [orders])

  const startDelivery = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o
        const attemptNumber = o.attempts.length + 1
        return {
          ...o,
          status: 'OUT_FOR_DELIVERY',
          redeliveryDate: undefined,
          attempts: [
            ...o.attempts,
            { id: `${o.id}-A${attemptNumber}`, attemptNumber, status: 'OUT_FOR_DELIVERY', startedAt: nowIso() },
          ],
        }
      }),
    )
  }

  const confirmDelivered = (id: string, { proofPhotoUrl, note }: ConfirmDeliveredInput) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o
        const attempts = [...o.attempts]
        const last = attempts[attempts.length - 1]
        if (last) attempts[attempts.length - 1] = { ...last, status: 'DELIVERED', completedAt: nowIso(), proofPhotoUrl, note }
        return { ...o, status: 'DELIVERED', attempts }
      }),
    )
  }

  const reportFailure = (id: string, { reasonCode, note, redeliveryDate }: ReportFailureInput) => {
    const option = FAILURE_REASON_OPTIONS.find((r) => r.code === reasonCode)
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o
        const attempts = [...o.attempts]
        const last = attempts[attempts.length - 1]
        if (last) {
          attempts[attempts.length - 1] = {
            ...last,
            status: 'FAILED',
            completedAt: nowIso(),
            failureReasonCode: reasonCode,
            failureReasonLabel: option?.label,
            note,
          }
        }
        if (option?.outcome === 'CANCEL') {
          return { ...o, status: 'CANCELLED', cancelReasonLabel: option.label, attempts, redeliveryDate: undefined }
        }
        return { ...o, status: 'FAILED', redeliveryDate, attempts }
      }),
    )
  }

  const startRedelivery = (id: string) => startDelivery(id)

  const value = useMemo(
    () => ({ orders, getById, startDelivery, confirmDelivered, reportFailure, startRedelivery }),
    [orders, getById],
  )

  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>
}

export function useDeliveries() {
  const ctx = useContext(DeliveryContext)
  if (!ctx) throw new Error('useDeliveries must be used within DeliveryProvider')
  return ctx
}
