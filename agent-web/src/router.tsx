import { createBrowserRouter } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoginPage from './features/auth/LoginPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import DashboardPage from './features/dashboard/DashboardPage'
import ProductsPage from './features/products/ProductsPage'
import InventoryPage from './features/inventory/InventoryPage'
import OrdersPage from './features/orders/OrdersPage'
import PaymentsPage from './features/payments/PaymentsPage'
import DebtsPage from './features/debts/DebtsPage'
import AiRecommendationsPage from './features/ai-recommendations/AiRecommendationsPage'
import FarmersPage from './features/farmers/FarmersPage'
import ActivityLogPage from './features/activity-log/ActivityLogPage'
import SettingsPage from './features/settings/SettingsPage'
import StockMovementsPage from './features/inventory/StockMovementsPage'
import StocktakePage from './features/inventory/StocktakePage'
import SuppliersPage from './features/purchases/SuppliersPage'
import PurchaseOrdersPage from './features/purchases/PurchaseOrdersPage'
import SeasonalCreditPage from './features/debts/SeasonalCreditPage'
import DeliveryPage from './features/delivery/DeliveryPage'
import ProductReviewsPage from './features/products/ProductReviewsPage'
import StaffManagementPage from './features/staff/StaffManagementPage'

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
          { path: 'products', element: <ProductsPage /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'payments', element: <PaymentsPage /> },
          { path: 'debts', element: <DebtsPage /> },
          { path: 'ai-recommendations', element: <AiRecommendationsPage /> },
          { path: 'farmers', element: <FarmersPage /> },
          { path: 'activity-log', element: <ActivityLogPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'inventory/movements', element: <StockMovementsPage /> },
          { path: 'inventory/stocktake', element: <StocktakePage /> },
          { path: 'purchases/suppliers', element: <SuppliersPage /> },
          { path: 'purchases/orders', element: <PurchaseOrdersPage /> },
          { path: 'debts/seasonal-credit', element: <SeasonalCreditPage /> },
          { path: 'deliveries', element: <DeliveryPage /> },
          { path: 'products/reviews', element: <ProductReviewsPage /> },
          { path: 'staff', element: <StaffManagementPage /> },
        ],
      },
    ],
  },
])
