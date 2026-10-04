import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import DashboardLayout from '@/layouts/DashboardLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import RequirePermission from '@/components/auth/RequirePermission'
import RequireRole from '@/components/auth/RequireRole'
import LoginPage from '@/features/auth/LoginPage'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'

// =======================
// ADMIN FEATURES
// =======================
import AdminDashboardPage from '@/features/admin/dashboard/DashboardPage'
import AccountsPage from '@/features/admin/accounts/AccountsPage'
import RolesPage from '@/features/admin/roles/RolesPage'
import CategoriesPage from '@/features/admin/products/CategoriesPage'
import ProductMasterPage from '@/features/admin/products/ProductMasterPage'
import ActiveIngredientsPage from '@/features/admin/products/ActiveIngredientsPage'
import AiModelsPage from '@/features/admin/ai-models/AiModelsPage'
import AiPolicyConfigsPage from '@/features/admin/ai-models/AiPolicyConfigsPage'
import ArticlesPage from '@/features/admin/content/ArticlesPage'
import SystemNotificationsPage from '@/features/admin/system/SystemNotificationsPage'
import AuditLogsPage from '@/features/admin/system/AuditLogsPage'

// =======================
// AGENT FEATURES
// =======================
import AgentDashboardPage from '@/features/agent/dashboard/DashboardPage'
import AgentOrdersPage from '@/features/agent/orders/OrdersPage'
import AgentPaymentsPage from '@/features/agent/payments/PaymentsPage'
import AgentAiRecommendationsPage from '@/features/agent/ai-recommendations/AiRecommendationsPage'
import AgentProductsPage from '@/features/agent/products/ProductsPage'
import AgentInventoryPage from '@/features/agent/inventory/InventoryPage'
import AgentFarmersPage from '@/features/agent/farmers/FarmersPage'
import AgentDebtsPage from '@/features/agent/debts/DebtsPage'
import AgentInventoryMovementsPage from '@/features/agent/inventory/InventoryMovementsPage'
import AgentStocktakePage from '@/features/agent/inventory/StocktakePage'
import AgentDeliveriesPage from '@/features/agent/deliveries/DeliveriesPage'
import AgentSuppliersPage from '@/features/agent/purchases/SuppliersPage'
import AgentPurchaseOrdersPage from '@/features/agent/purchases/PurchaseOrdersPage'
import AgentSeasonalCreditPage from '@/features/agent/debts/SeasonalCreditPage'
import AgentProductReviewsPage from '@/features/agent/products/ProductReviewsPage'
import AgentStaffPage from '@/features/agent/staff/StaffPage'
import AgentActivityLogPage from '@/features/agent/system/ActivityLogPage'
import AgentSettingsPage from '@/features/agent/system/SettingsPage'

// =======================
// SALES FEATURES
// =======================
import SalesDashboardPage from '@/features/sales/dashboard/DashboardPage'
import SalesFarmersPage from '@/features/sales/farmers/FarmersPage'
import SalesProductsPage from '@/features/sales/products/ProductsPage'
import SalesOrdersPage from '@/features/sales/orders/OrdersPage'
import CounterSalesPage from '@/features/sales/counter-sales/CounterSalesPage'
import SalesPaymentsPage from '@/features/sales/payments/PaymentsPage'
import SalesDebtsPage from '@/features/sales/debts/DebtsPage'
import SalesCreditRequestsPage from '@/features/sales/credit-requests/CreditRequestsPage'
import SalesInventoryPage from '@/features/sales/inventory/InventoryPage'
import SalesPriceListsPage from '@/features/sales/price-lists/PriceListsPage'
import SalesAiReviewPage from '@/features/sales/ai-review/AiReviewPage'
import SalesSettingsPage from '@/features/sales/settings/SettingsPage'

// =======================
// DELIVERY FEATURES
// =======================
import DeliveryDashboardPage from '@/features/delivery/dashboard/DashboardPage'
import DeliveriesPage from '@/features/delivery/deliveries/DeliveriesPage'

// Fallback component for missing routes
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh] text-on-surface-variant">
      <div className="text-center">
        <span className="material-symbols-outlined text-[48px] mb-4">construction</span>
        <h2 className="text-xl font-bold">{title}</h2>
        <p>Tính năng đang được phát triển</p>
      </div>
    </div>
  )
}

function RootRedirect() {
  const { currentRole } = useAuth()
  if (currentRole === 'agent') return <Navigate to="/agent" replace />
  if (currentRole === 'sales_staff') return <Navigate to="/sales" replace />
  if (currentRole === 'delivery_staff') return <Navigate to="/delivery" replace />
  return <AdminDashboardPage />
}

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
          // Index route directs to correct dashboard based on role
          { index: true, element: <RootRedirect /> },

          // --- ADMIN ROUTES ---
          {
            path: 'admin/accounts',
            element: <RequireRole role="admin"><RequirePermission module="accounts"><AccountsPage /></RequirePermission></RequireRole>,
          },
          {
            path: 'admin/roles',
            element: <RequireRole role="admin"><RequirePermission module="roles"><RolesPage /></RequirePermission></RequireRole>,
          },
          {
            path: 'admin/products/categories',
            element: <RequireRole role="admin"><RequirePermission module="products"><CategoriesPage /></RequirePermission></RequireRole>,
          },
          {
            path: 'admin/products/master',
            element: <RequireRole role="admin"><RequirePermission module="products"><ProductMasterPage /></RequirePermission></RequireRole>,
          },
          {
            path: 'admin/products/ingredients',
            element: <RequireRole role="admin"><RequirePermission module="products"><ActiveIngredientsPage /></RequirePermission></RequireRole>,
          },
          {
            path: 'admin/ai/models',
            element: <RequireRole role="admin"><RequirePermission module="ai-config"><AiModelsPage /></RequirePermission></RequireRole>,
          },
          {
            path: 'admin/ai/policies',
            element: <RequireRole role="admin"><RequirePermission module="ai-config"><AiPolicyConfigsPage /></RequirePermission></RequireRole>,
          },
          {
            path: 'admin/articles',
            element: <RequireRole role="admin"><RequirePermission module="articles"><ArticlesPage /></RequirePermission></RequireRole>,
          },
          {
            path: 'admin/notifications',
            element: <RequireRole role="admin"><RequirePermission module="notifications"><SystemNotificationsPage /></RequirePermission></RequireRole>,
          },
          {
            path: 'admin/audit-logs',
            element: <RequireRole role="admin"><RequirePermission module="audit-logs"><AuditLogsPage /></RequirePermission></RequireRole>,
          },

          // --- AGENT ROUTES ---
          {
            path: 'agent',
            element: <RequireRole role="agent"><AgentDashboardPage /></RequireRole>,
          },
          {
            path: 'agent/orders',
            element: <RequireRole role="agent"><AgentOrdersPage /></RequireRole>,
          },
          {
            path: 'agent/counter-sales',
            element: <RequireRole role="agent"><CounterSalesPage /></RequireRole>,
          },
          {
            path: 'agent/payments',
            element: <RequireRole role="agent"><AgentPaymentsPage /></RequireRole>,
          },
          {
            path: 'agent/ai-recommendations',
            element: <RequireRole role="agent"><AgentAiRecommendationsPage /></RequireRole>,
          },
          {
            path: 'agent/products',
            element: <RequireRole role="agent"><AgentProductsPage /></RequireRole>,
          },
          {
            path: 'agent/inventory',
            element: <RequireRole role="agent"><AgentInventoryPage /></RequireRole>,
          },
          {
            path: 'agent/farmers',
            element: <RequireRole role="agent"><AgentFarmersPage /></RequireRole>,
          },
          {
            path: 'agent/debts',
            element: <RequireRole role="agent"><AgentDebtsPage /></RequireRole>,
          },
          {
            path: 'agent/inventory/movements',
            element: <RequireRole role="agent"><AgentInventoryMovementsPage /></RequireRole>,
          },
          {
            path: 'agent/inventory/stocktake',
            element: <RequireRole role="agent"><AgentStocktakePage /></RequireRole>,
          },
          {
            path: 'agent/deliveries',
            element: <RequireRole role="agent"><AgentDeliveriesPage /></RequireRole>,
          },
          {
            path: 'agent/purchases/suppliers',
            element: <RequireRole role="agent"><AgentSuppliersPage /></RequireRole>,
          },
          {
            path: 'agent/purchases/orders',
            element: <RequireRole role="agent"><AgentPurchaseOrdersPage /></RequireRole>,
          },
          {
            path: 'agent/debts/seasonal-credit',
            element: <RequireRole role="agent"><AgentSeasonalCreditPage /></RequireRole>,
          },
          {
            path: 'agent/products/reviews',
            element: <RequireRole role="agent"><AgentProductReviewsPage /></RequireRole>,
          },
          {
            path: 'agent/staff',
            element: <RequireRole role="agent"><AgentStaffPage /></RequireRole>,
          },
          {
            path: 'agent/activity-log',
            element: <RequireRole role="agent"><AgentActivityLogPage /></RequireRole>,
          },
          {
            path: 'agent/settings',
            element: <RequireRole role="agent"><AgentSettingsPage /></RequireRole>,
          },

          // --- SALES ROUTES ---
          {
            path: 'sales',
            element: <RequireRole role="sales_staff"><SalesDashboardPage /></RequireRole>,
          },
          {
            path: 'sales/farmers',
            element: <RequireRole role="sales_staff"><SalesFarmersPage /></RequireRole>,
          },
          {
            path: 'sales/products',
            element: <RequireRole role="sales_staff"><SalesProductsPage /></RequireRole>,
          },
          {
            path: 'sales/orders',
            element: <RequireRole role="sales_staff"><SalesOrdersPage /></RequireRole>,
          },
          {
            path: 'sales/counter-sales',
            element: <RequireRole role="sales_staff"><CounterSalesPage /></RequireRole>,
          },
          {
            path: 'sales/payments',
            element: <RequireRole role="sales_staff"><SalesPaymentsPage /></RequireRole>,
          },
          {
            path: 'sales/debts',
            element: <RequireRole role="sales_staff"><SalesDebtsPage /></RequireRole>,
          },
          {
            path: 'sales/credit-requests',
            element: <RequireRole role="sales_staff"><SalesCreditRequestsPage /></RequireRole>,
          },
          {
            path: 'sales/inventory',
            element: <RequireRole role="sales_staff"><SalesInventoryPage /></RequireRole>,
          },
          {
            path: 'sales/price-lists',
            element: <RequireRole role="sales_staff"><SalesPriceListsPage /></RequireRole>,
          },
          {
            path: 'sales/ai-review',
            element: <RequireRole role="sales_staff"><SalesAiReviewPage /></RequireRole>,
          },
          {
            path: 'sales/settings',
            element: <RequireRole role="sales_staff"><SalesSettingsPage /></RequireRole>,
          },

          // --- DELIVERY ROUTES ---
          {
            path: 'delivery',
            element: <RequireRole role="delivery_staff"><DeliveryDashboardPage /></RequireRole>,
          },
          {
            path: 'delivery/deliveries',
            element: <RequireRole role="delivery_staff"><DeliveriesPage /></RequireRole>,
          },
        ],
      },
    ],
  },
])
