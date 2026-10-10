import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PageHeaderState } from '@/types'

const DEFAULT_HEADER: PageHeaderState = { title: 'Tổng quan hệ thống' }

const PageHeaderContext = createContext<PageHeaderState | undefined>(undefined)
const PageHeaderSetterContext = createContext<((header: PageHeaderState) => void) | undefined>(undefined)

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, updateHeader] = useState<PageHeaderState>(DEFAULT_HEADER)
  const setHeader = useCallback((next: PageHeaderState) => {
    updateHeader(previous => previous.title === next.title && previous.subtitle === next.subtitle && previous.badge === next.badge ? previous : next)
  }, [])
  return <PageHeaderSetterContext.Provider value={setHeader}><PageHeaderContext.Provider value={header}>{children}</PageHeaderContext.Provider></PageHeaderSetterContext.Provider>
}

export function usePageHeaderValue() {
  const header = useContext(PageHeaderContext)
  if (!header) throw new Error('usePageHeaderValue must be used within PageHeaderProvider')
  return header
}

export function usePageHeader(header: PageHeaderState) {
  const setHeader = useContext(PageHeaderSetterContext)
  if (!setHeader) throw new Error('usePageHeader must be used within PageHeaderProvider')
  const { title, subtitle, badge } = header
  useEffect(() => {
    setHeader({ title, subtitle, badge })
  }, [title, subtitle, badge, setHeader])
}
