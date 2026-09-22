import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PageHeaderState } from '../types'

const DEFAULT_HEADER: PageHeaderState = { title: 'Tổng quan' }

interface PageHeaderContextValue {
  header: PageHeaderState
  setHeader: (header: PageHeaderState) => void
}

const PageHeaderContext = createContext<PageHeaderContextValue | undefined>(undefined)

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeaderState>(DEFAULT_HEADER)
  const value = useMemo(() => ({ header, setHeader }), [header])
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
}

function usePageHeaderContext() {
  const ctx = useContext(PageHeaderContext)
  if (!ctx) throw new Error('usePageHeaderContext must be used within PageHeaderProvider')
  return ctx
}

export function usePageHeaderValue() {
  return usePageHeaderContext().header
}

export function usePageHeader(header: PageHeaderState) {
  const { setHeader } = usePageHeaderContext()
  const { title, subtitle, badge } = header
  useEffect(() => {
    setHeader({ title, subtitle, badge })
  }, [title, subtitle, badge, setHeader])
}
