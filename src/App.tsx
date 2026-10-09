import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { PermissionProvider } from '@/context/PermissionContext'
import { ToastProvider } from '@/context/ToastContext'
import { router } from '@/router'

function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <PermissionProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </PermissionProvider>
      </NotificationsProvider>
    </AuthProvider>
  )
}

export default App
