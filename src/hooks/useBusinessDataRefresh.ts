import { useEffect } from 'react'
import { useRealtimeRefresh } from './useRealtimeRefresh'

/** Refresh a mounted list when an operation in its detail popup succeeds. */
export function useBusinessDataRefresh(reload: () => unknown, topics: readonly string[] = []) {
  useRealtimeRefresh(topics, reload)
  useEffect(() => {
    const refresh = () => { void reload() }
    window.addEventListener('agrisage-business-data-changed', refresh)
    return () => window.removeEventListener('agrisage-business-data-changed', refresh)
  }, [reload])
}
