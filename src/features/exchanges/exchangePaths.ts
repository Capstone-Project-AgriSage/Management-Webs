import { useLocation } from 'react-router-dom'

export function useExchangeBase() {
  const { pathname } = useLocation()
  return pathname.startsWith('/sales') ? '/sales/exchanges' : '/agent/exchanges'
}
