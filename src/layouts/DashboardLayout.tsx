import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { PermissionRoute } from '@/components/auth/PermissionRoute';
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { PageHeaderProvider } from '@/context/PageHeaderContext';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
      <div className={`management-shell bg-background text-on-surface antialiased text-body-md min-h-screen flex selection:bg-primary-fixed selection:text-on-primary-fixed ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} />
        <div className="management-workspace flex-1 flex flex-col min-w-0">
          <Topbar onMenuClick={() => setSidebarOpen(true)} menuOpen={sidebarOpen} />
          <main id="main-content" className="management-content flex-1 space-y-5" tabIndex={-1}>
            <PermissionRoute><Outlet /></PermissionRoute>
          </main>
        </div>
      </div>
    </PageHeaderProvider>
  )
}
