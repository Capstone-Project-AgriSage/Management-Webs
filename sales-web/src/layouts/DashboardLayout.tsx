import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import Topbar from '../components/layout/Topbar'
import { PageHeaderProvider } from '../context/PageHeaderContext'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = (e: MediaQueryList | MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false)
    }
    closeOnDesktop(desktopQuery)
    desktopQuery.addEventListener('change', closeOnDesktop)
    return () => desktopQuery.removeEventListener('change', closeOnDesktop)
  }, [])

  return (
    <PageHeaderProvider>
      <div className="bg-background text-on-surface antialiased text-body-md min-h-screen flex selection:bg-primary-fixed selection:text-on-primary-fixed">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:pl-nav-sidebar-width flex-1 flex flex-col min-w-0">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 px-layout-margin-desktop py-3 space-y-3 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </PageHeaderProvider>
  )
}
