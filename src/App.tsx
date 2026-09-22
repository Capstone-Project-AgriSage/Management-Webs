import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { DeliveryProvider } from './context/DeliveryContext'
import { router } from './router'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DeliveryProvider>
          <RouterProvider router={router} />
        </DeliveryProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
