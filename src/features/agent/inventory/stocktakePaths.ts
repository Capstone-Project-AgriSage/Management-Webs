import { useLocation } from 'react-router-dom'

/** The stocktake screens are shared: the store owner opens them under /agent, sales staff (who count) under /sales. */
export function useStocktakeBase(): string {
  const { pathname } = useLocation()
  return pathname.startsWith('/sales') ? '/sales/inventory/stocktake' : '/agent/inventory/stocktake'
}
