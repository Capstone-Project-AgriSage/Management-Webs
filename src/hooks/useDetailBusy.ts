import { createContext, useContext, useEffect } from 'react'

export const DetailBusyContext = createContext<((busy: boolean) => void) | null>(null)

/** Prevent closing a detail dialog while its operation is being saved. */
export function useDetailBusy(busy: boolean) {
  const setBusy = useContext(DetailBusyContext)
  useEffect(() => { setBusy?.(busy) }, [busy, setBusy])
}
