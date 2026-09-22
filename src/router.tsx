import { createBrowserRouter } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoginPage from './features/auth/LoginPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import DashboardPage from './features/dashboard/DashboardPage'
import FarmersPage from './features/farmers/FarmersPage'
import ProductsPage from './features/products/ProductsPage'
import OrdersPage from './features/orders/OrdersPage'
import PaymentsPage from './features/payments/PaymentsPage'
import CreditRequestsPage from './features/credit-requests/CreditRequestsPage'
import DebtsPage from './features/debts/DebtsPage'
import InventoryPage from './features/inventory/InventoryPage'
import AiReviewPage from './features/ai-review/AiReviewPage'
import SettingsPage from './features/settings/SettingsPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <DashboardLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'farmers', element: <FarmersPage /> },
          { path: 'products', element: <ProductsPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'payments', element: <PaymentsPage /> },
          { path: 'credit-requests', element: <CreditRequestsPage /> },
          { path: 'debts', element: <DebtsPage /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'ai-review', element: <AiReviewPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
])
