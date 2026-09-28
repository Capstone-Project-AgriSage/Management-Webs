import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PermissionProvider } from './context/PermissionContext'
import { ToastProvider } from './context/ToastContext'
import { router } from './router'

function App() {
  return (
    <AuthProvider>
      <PermissionProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </PermissionProvider>
    </AuthProvider>
  )
}

export default App
