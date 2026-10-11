import { useEffect } from 'react'

/** Refresh a mounted list when an operation in its detail popup succeeds. */
export function useBusinessDataRefresh(reload: () => unknown) {
  useEffect(() => {
    const refresh = () => { void reload() }
    window.addEventListener('agrisage-business-data-changed', refresh)
    return () => window.removeEventListener('agrisage-business-data-changed', refresh)
  }, [reload])
}
