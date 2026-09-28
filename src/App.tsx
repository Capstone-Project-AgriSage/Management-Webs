import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { PermissionProvider } from '@/context/PermissionContext'
import { DeliveryProvider } from '@/context/DeliveryContext'
import { ToastProvider } from '@/context/ToastContext'
import { router } from '@/router'

function App() {
  return (
    <AuthProvider>
      <PermissionProvider>
        <DeliveryProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </DeliveryProvider>
      </PermissionProvider>
    </AuthProvider>
  )
}

export default App
