import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Keep list search addressable so a global-search result also works on the currently open list. */
export function useUrlSearch(): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams()
  const setSearch = useCallback((value: string) => setParams(previous => {
    const next = new URLSearchParams(previous)
    if (value) next.set('search', value)
    else next.delete('search')
    return next
  }, { replace: true }), [setParams])
  return [params.get('search') ?? '', setSearch]
}
