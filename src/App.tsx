import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { PermissionProvider } from '@/context/PermissionContext'
import { ToastProvider } from '@/context/ToastContext'
import { router } from '@/router'
import { RealtimeProvider } from '@/context/RealtimeProvider'

function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <NotificationsProvider>
          <PermissionProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </PermissionProvider>
        </NotificationsProvider>
      </RealtimeProvider>
    </AuthProvider>
  )
}

export default App
