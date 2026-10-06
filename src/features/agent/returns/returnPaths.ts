import { useLocation } from 'react-router-dom'

/** The return screens are shared: the store owner opens them under /agent, sales staff under /sales. */
export function useReturnsBase(): string {
  const { pathname } = useLocation()
  return pathname.startsWith('/sales') ? '/sales/returns' : '/agent/returns'
}
