import { useState, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PageHeaderProvider, usePageHeaderValue } from '@/context/PageHeaderContext'
import { DetailBusyContext } from '@/hooks/useDetailBusy'
import DetailModal from './DetailModal'
import ModalLayout from './ModalLayout'

/** Keep the list mounted, including its search, filters and current page. */
export function DetailListLayout({ children }: { children: ReactNode }) {
  return <>{children}<Outlet /></>
}

/** Existing detail screens retain their route parameters and permission checks. */
export function DetailRoute({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <PageHeaderProvider key={pathname}><DetailRouteDialog>{children}</DetailRouteDialog></PageHeaderProvider>
}

function DetailRouteDialog({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const header = usePageHeaderValue()
  const [busy, setBusy] = useState(false)
  const close = () => navigate('..', { relative: 'path', replace: true })
  return <DetailBusyContext.Provider value={setBusy}>
    <DetailModal open title={header.title} busy={busy} onClose={close} widthClassName="max-w-4xl">
      <ModalLayout header={<div><h2>{header.title}</h2>{header.subtitle && <p className="mt-1 text-sm text-slate-500">{header.subtitle}</p>}</div>}>
        <div className="route-detail-content">{children}</div>
      </ModalLayout>
    </DetailModal>
  </DetailBusyContext.Provider>
}

