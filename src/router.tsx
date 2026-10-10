import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import DashboardLayout from '@/layouts/DashboardLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import RequirePermission from '@/components/auth/RequirePermission'
import RequireRole from '@/components/auth/RequireRole'
import LoginPage from '@/features/auth/LoginPage'
import NotificationsPage from '@/features/notifications/NotificationsPage'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'

// =======================
// ADMIN FEATURES
// =======================
import AdminDashboardPage from '@/features/admin/dashboard/DashboardPage'
import AccountsPage from '@/features/admin/accounts/AccountsPage'
import RolesPage from '@/features/admin/roles/RolesPage'
import CategoriesPage from '@/features/admin/products/CategoriesPage'
import ProductManagementPage from '@/features/products/ProductManagementPage'
import ActiveIngredientsPage from '@/features/admin/products/ActiveIngredientsPage'
import AiModelsPage from '@/features/admin/ai-models/AiModelsPage'
import AiPolicyConfigsPage from '@/features/admin/ai-models/AiPolicyConfigsPage'
import ArticlesPage from '@/features/admin/content/ArticlesPage'
import AuditLogsPage from '@/features/admin/system/AuditLogsPage'
import CreditConfigPage from '@/features/admin/credit-config/CreditConfigPage'

// =======================
// AGENT FEATURES
// =======================
import AgentDashboardPage from '@/features/agent/dashboard/DashboardPage'
import OrdersPage from '@/features/orders/OrdersPage'
import PaymentsPage from '@/features/payments/PaymentsPage'
import AgentAiRecommendationsPage from '@/features/agent/ai-recommendations/AiRecommendationsPage'
import AgentInventoryPage from '@/features/agent/inventory/StockOverviewPage'
import AgentInventoryMovementsPage from '@/features/agent/inventory/StockMovementsPage'
import AgentStockCardPage from '@/features/agent/inventory/StockCardPage'
import AgentInventoryReportsPage from '@/features/agent/inventory/InventoryReportsPage'
import AgentStocktakePage from '@/features/agent/inventory/StocktakeListPage'
import StocktakeDetailPage from '@/features/agent/inventory/StocktakeDetailPage'
import AgentDeliveriesPage from '@/features/agent/deliveries/DeliveriesPage'
import AgentDeliveryReportsPage from '@/features/agent/deliveries/DeliveryReportsPage'
import AgentSuppliersPage from '@/features/agent/purchases/SuppliersPage'
import RefundsPage from '@/features/agent/refunds/RefundsPage'
import ReturnsListPage from '@/features/agent/returns/ReturnsListPage'
import ReturnCreatePage from '@/features/agent/returns/ReturnCreatePage'
import ReturnDetailPage from '@/features/agent/returns/ReturnDetailPage'
import AgentGoodsReceiptsPage from '@/features/agent/purchases/GoodsReceiptsPage'
import GoodsReceiptDetailPage from '@/features/agent/purchases/GoodsReceiptDetailPage'
import ReceiptImportPage from '@/features/agent/purchases/ReceiptImportPage'
import DebtReportsPage from '@/features/agent/debts/DebtReportsPage'
import AgentProductReviewsPage from '@/features/agent/products/ProductReviewsPage'
import AgentStaffPage from '@/features/agent/staff/StaffPage'
import AgentActivityLogPage from '@/features/agent/system/ActivityLogPage'
import AgentSettingsPage from '@/features/agent/system/SettingsPage'

// =======================
// SALES FEATURES
// =======================
import SalesDashboardPage from '@/features/sales/dashboard/DashboardPage'
import SalesProductsPage from '@/features/sales/products/ProductsPage'
import CounterSalesPage from '@/features/sales/counter-sales/CounterSalesPage'
import CustomersPage from '@/features/customers/CustomersPage'
import DebtsPage from '@/features/debts/DebtsPage'
import CustomerDebtPage from '@/features/debts/CustomerDebtPage'
import SalesInventoryPage from '@/features/sales/inventory/InventoryPage'
import PriceListsPage from '@/features/price-lists/PriceListsPage'
import SalesAiReviewPage from '@/features/sales/ai-review/AiReviewPage'
import SalesSettingsPage from '@/features/sales/settings/SettingsPage'

// =======================
// DELIVERY FEATURES
// =======================
import DeliveryDashboardPage from '@/features/delivery/dashboard/DashboardPage'
import DeliveriesPage from '@/features/delivery/deliveries/DeliveriesPage'
import DeliveryDetailPage from '@/features/delivery/deliveries/DeliveryDetailPage'

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
          { path: 'notifications', element: <NotificationsPage /> },

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
            element: <RequireRole role="admin"><RequirePermission module="products"><ProductManagementPage /></RequirePermission></RequireRole>,
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
            element: <RequireRole role="admin"><NotificationsPage /></RequireRole>,
          },
          {
            path: 'admin/audit-logs',
            element: <RequireRole role="admin"><RequirePermission module="audit-logs"><AuditLogsPage /></RequirePermission></RequireRole>,
          },
          {
            path: 'admin/credit-config',
            element: <RequireRole role="admin"><RequirePermission module="accounts"><CreditConfigPage /></RequirePermission></RequireRole>,
          },

          // --- AGENT ROUTES ---
          {
            path: 'agent',
            element: <RequireRole role="agent"><AgentDashboardPage /></RequireRole>,
          },
          {
            path: 'agent/orders',
            element: <RequireRole role={["agent", "sales_staff"]}><OrdersPage /></RequireRole>,
          },
          {
            path: 'agent/counter-sales',
            element: <RequireRole role={["agent", "sales_staff"]}><CounterSalesPage /></RequireRole>,
          },
          {
            path: 'agent/payments',
            element: <RequireRole role={["agent", "sales_staff"]}><PaymentsPage /></RequireRole>,
          },
          {
            path: 'agent/ai-recommendations',
            element: <RequireRole role={["agent", "sales_staff"]}><AgentAiRecommendationsPage /></RequireRole>,
          },
          {
            path: 'agent/products',
            element: <RequireRole role={["agent", "sales_staff"]}><ProductManagementPage /></RequireRole>,
          },
          {
            path: 'agent/inventory',
            element: <RequireRole role={["agent", "sales_staff"]}><AgentInventoryPage /></RequireRole>,
          },
          {
            path: 'agent/farmers',
            element: <RequireRole role={["agent", "sales_staff"]}><CustomersPage /></RequireRole>,
          },
          {
            path: 'agent/debts',
            element: <RequireRole role={["agent", "sales_staff"]}><DebtsPage /></RequireRole>,
          },
          {
            path: 'agent/debts/reports',
            element: <RequireRole role={["admin", "agent", "sales_staff"]}><DebtReportsPage /></RequireRole>,
          },
          {
            path: 'agent/debts/:id',
            element: <RequireRole role={["agent", "sales_staff"]}><CustomerDebtPage /></RequireRole>,
          },
          {
            path: 'agent/inventory/movements',
            element: <RequireRole role={["agent", "sales_staff"]}><AgentInventoryMovementsPage /></RequireRole>,
          },
          {
            path: 'agent/refunds',
            element: <RequireRole role={["agent", "sales_staff"]}><RefundsPage /></RequireRole>,
          },
          {
            path: 'agent/returns',
            element: <RequireRole role={["agent", "sales_staff"]}><ReturnsListPage /></RequireRole>,
          },
          {
            path: 'agent/returns/new',
            element: <RequireRole role={["agent", "sales_staff"]}><ReturnCreatePage /></RequireRole>,
          },
          {
            path: 'agent/returns/:id',
            element: <RequireRole role={["agent", "sales_staff"]}><ReturnDetailPage /></RequireRole>,
          },
          {
            path: 'agent/inventory/stock-card',
            element: <RequireRole role={["agent", "sales_staff"]}><AgentStockCardPage /></RequireRole>,
          },
          {
            path: 'agent/inventory/reports',
            element: <RequireRole role={["admin", "agent", "sales_staff"]}><AgentInventoryReportsPage /></RequireRole>,
          },
          {
            path: 'agent/inventory/stocktake',
            element: <RequireRole role={["agent", "sales_staff"]}><AgentStocktakePage /></RequireRole>,
          },
          {
            path: 'agent/inventory/stocktake/:id',
            element: <RequireRole role={["agent", "sales_staff"]}><StocktakeDetailPage /></RequireRole>,
          },
          {
            path: 'agent/deliveries',
            element: <RequireRole role={["agent", "sales_staff"]}><AgentDeliveriesPage /></RequireRole>,
          },
          {
            path: 'agent/deliveries/reports',
            element: <RequireRole role={["admin", "agent", "sales_staff"]}><AgentDeliveryReportsPage /></RequireRole>,
          },
          {
            path: 'agent/purchases/suppliers',
            element: <RequireRole role={["agent", "sales_staff"]}><AgentSuppliersPage /></RequireRole>,
          },
          {
            path: 'agent/purchases/orders',
            element: <Navigate to="/agent/purchases/receipts" replace />,
          },
          {
            path: 'agent/purchases/receipts',
            element: <RequireRole role={["agent", "sales_staff"]}><AgentGoodsReceiptsPage /></RequireRole>,
          },
          {
            path: 'agent/purchases/receipts/import',
            element: <RequireRole role={["agent", "sales_staff"]}><ReceiptImportPage /></RequireRole>,
          },
          {
            path: 'agent/purchases/receipts/:id',
            element: <RequireRole role={["agent", "sales_staff"]}><GoodsReceiptDetailPage /></RequireRole>,
          },
          {
            path: 'agent/price-lists',
            element: <RequireRole role={["agent", "sales_staff"]}><PriceListsPage /></RequireRole>,
          },
          {
            path: 'agent/credit-config',
            element: <RequireRole role={["agent", "sales_staff"]}><CreditConfigPage /></RequireRole>,
          },
          {
            path: 'agent/products/reviews',
            element: <RequireRole role={["agent", "sales_staff"]}><AgentProductReviewsPage /></RequireRole>,
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
            element: <RequireRole role="sales_staff"><CustomersPage /></RequireRole>,
          },
          {
            path: 'sales/products',
            element: <RequireRole role="sales_staff"><SalesProductsPage /></RequireRole>,
          },
          {
            path: 'sales/orders',
            element: <RequireRole role="sales_staff"><OrdersPage /></RequireRole>,
          },
          {
            path: 'sales/deliveries',
            element: <RequireRole role="sales_staff"><AgentDeliveriesPage /></RequireRole>,
          },
          {
            path: 'sales/counter-sales',
            element: <RequireRole role="sales_staff"><CounterSalesPage /></RequireRole>,
          },
          {
            path: 'sales/payments',
            element: <RequireRole role="sales_staff"><PaymentsPage /></RequireRole>,
          },
          {
            path: 'sales/debts',
            element: <RequireRole role="sales_staff"><DebtsPage /></RequireRole>,
          },
          {
            path: 'sales/debts/:id',
            element: <RequireRole role="sales_staff"><CustomerDebtPage /></RequireRole>,
          },
          {
            path: 'sales/inventory',
            element: <RequireRole role="sales_staff"><SalesInventoryPage /></RequireRole>,
          },
          {
            path: 'sales/returns',
            element: <RequireRole role="sales_staff"><ReturnsListPage /></RequireRole>,
          },
          {
            path: 'sales/returns/new',
            element: <RequireRole role="sales_staff"><ReturnCreatePage /></RequireRole>,
          },
          {
            path: 'sales/returns/:id',
            element: <RequireRole role="sales_staff"><ReturnDetailPage /></RequireRole>,
          },
          {
            path: 'sales/inventory/stocktake',
            element: <RequireRole role="sales_staff"><AgentStocktakePage /></RequireRole>,
          },
          {
            path: 'sales/inventory/stocktake/:id',
            element: <RequireRole role="sales_staff"><StocktakeDetailPage /></RequireRole>,
          },
          {
            path: 'sales/price-lists',
            element: <RequireRole role="sales_staff"><PriceListsPage /></RequireRole>,
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
          {
            path: 'delivery/deliveries/:id',
            element: <RequireRole role="delivery_staff"><DeliveryDetailPage /></RequireRole>,
          },
        ],
      },
    ],
  },
])
