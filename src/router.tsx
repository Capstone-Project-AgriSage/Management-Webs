import { DetailListLayout, DetailRoute } from '@/components/ui/DetailRoute'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from '@/context/AuthContext'
import DashboardLayout from '@/layouts/DashboardLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import RequirePermission from '@/components/auth/RequirePermission'
import RequireRole from '@/components/auth/RequireRole'
import LoginPage from '@/features/auth/LoginPage'
import NotificationsPage from '@/features/notifications/NotificationsPage'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/features/auth/ResetPasswordPage'

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
import AuditLogsPage from '@/features/admin/system/AuditLogsPage'
import CreditConfigPage from '@/features/admin/credit-config/CreditConfigPage'

// =======================
// AGENT FEATURES
// =======================
import AgentDashboardPage from '@/features/agent/dashboard/DashboardPage'
import OrdersPage from '@/features/orders/OrdersPage'
import PaymentsPage from '@/features/payments/PaymentsPage'
import DiagnosisQueuePage from '@/features/diagnosis/DiagnosisQueuePage'
import DiagnosisCasePage from '@/features/diagnosis/DiagnosisCasePage'
import DiseaseContentPage from '@/features/diagnosis/DiseaseContentPage'
import NotFoundPage from '@/features/not-found/NotFoundPage'
import AgentInventoryPage from '@/features/agent/inventory/StockOverviewPage'
import AgentInventoryMovementsPage from '@/features/agent/inventory/StockMovementsPage'
import AgentStockCardPage from '@/features/agent/inventory/StockCardPage'
import AgentInventoryReportsPage from '@/features/agent/inventory/InventoryReportsPage'
import AgentStocktakePage from '@/features/agent/inventory/StocktakeListPage'
import StocktakeDetailPage from '@/features/agent/inventory/StocktakeDetailPage'
import AgentDeliveriesPage from '@/features/agent/deliveries/DeliveriesPage'
import AgentSuppliersPage from '@/features/agent/purchases/SuppliersPage'
import RefundsPage from '@/features/agent/refunds/RefundsPage'
import ReturnsListPage from '@/features/agent/returns/ReturnsListPage'
import ReturnCreatePage from '@/features/agent/returns/ReturnCreatePage'
import ReturnDetailPage from '@/features/agent/returns/ReturnDetailPage'
import AgentGoodsReceiptsPage from '@/features/agent/purchases/GoodsReceiptsPage'
import GoodsReceiptDetailPage from '@/features/agent/purchases/GoodsReceiptDetailPage'
import ReceiptImportPage from '@/features/agent/purchases/ReceiptImportPage'
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
import SalesSettingsPage from '@/features/sales/settings/SettingsPage'

// =======================
// DELIVERY FEATURES
// =======================
import DeliveryDashboardPage from '@/features/delivery/dashboard/DashboardPage'
import DeliveriesPage from '@/features/delivery/deliveries/DeliveriesPage'
import DeliveryDetailPage from '@/features/delivery/deliveries/DeliveryDetailPage'

// Load chart libraries only when a detailed report is opened.
const AgentDeliveryReportsPage = lazy(() => import('@/features/agent/deliveries/DeliveryReportsPage'))
const DebtReportsPage = lazy(() => import('@/features/agent/debts/DebtReportsPage'))
const reportFallback = <p role="status" className="p-5 text-sm text-slate-500">Đang tải báo cáo...</p>

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
  { path: '/reset-password', element: <ResetPasswordPage /> },
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
            path: 'admin/diseases',
            element: <RequireRole role="admin"><RequirePermission module="diseases"><DiseaseContentPage /></RequirePermission></RequireRole>,
          },
          // Not routed until their API exists (the backend has none): Articles (admin) and Product reviews (owner).
          // The pages stay in features/admin/content and features/agent/products, still on sample data, to be wired then.
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
            element: <RequireRole role={["agent", "sales_staff"]}><DetailListLayout><DiagnosisQueuePage /></DetailListLayout></RequireRole>,
            children: [{ path: ':id', element: <DetailRoute><DiagnosisCasePage /></DetailRoute> }],
          },
          {
            path: 'agent/diseases',
            element: <RequireRole role="agent"><DiseaseContentPage /></RequireRole>,
          },
          {
            path: 'agent/products',
            element: <RequireRole role={["agent", "sales_staff"]}><ProductManagementPage /></RequireRole>,
          },
          {
            path: 'agent/inventory',
            element: <RequireRole role={["agent", "sales_staff"]}><DetailListLayout><AgentInventoryPage /></DetailListLayout></RequireRole>,
            children: [{ path: 'stock-card', element: <DetailRoute><AgentStockCardPage /></DetailRoute> }],
          },
          {
            path: 'agent/farmers',
            element: <RequireRole role={["agent", "sales_staff"]}><CustomersPage /></RequireRole>,
          },
          {
            path: 'agent/debts',
            element: <RequireRole role={["agent", "sales_staff"]}><DetailListLayout><DebtsPage /></DetailListLayout></RequireRole>,
            children: [{ path: ':id', element: <DetailRoute><CustomerDebtPage /></DetailRoute> }],
          },
          {
            path: 'agent/debts/reports',
            element: <RequireRole role={["admin", "agent", "sales_staff"]}><Suspense fallback={reportFallback}><DebtReportsPage /></Suspense></RequireRole>,
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
            element: <RequireRole role={["agent", "sales_staff"]}><DetailListLayout><ReturnsListPage /></DetailListLayout></RequireRole>,
            children: [{ path: ':id', element: <DetailRoute><ReturnDetailPage /></DetailRoute> }],
          },
          {
            path: 'agent/returns/new',
            element: <RequireRole role={["agent", "sales_staff"]}><ReturnCreatePage /></RequireRole>,
          },
          {
            path: 'agent/inventory/reports',
            element: <RequireRole role={["admin", "agent", "sales_staff"]}><AgentInventoryReportsPage /></RequireRole>,
          },
          {
            path: 'agent/inventory/stocktake',
            element: <RequireRole role={["agent", "sales_staff"]}><DetailListLayout><AgentStocktakePage /></DetailListLayout></RequireRole>,
            children: [{ path: ':id', element: <DetailRoute><StocktakeDetailPage /></DetailRoute> }],
          },
          {
            path: 'agent/deliveries',
            element: <RequireRole role={["agent", "sales_staff"]}><AgentDeliveriesPage /></RequireRole>,
          },
          {
            path: 'agent/deliveries/reports',
            element: <RequireRole role={["admin", "agent", "sales_staff"]}><Suspense fallback={reportFallback}><AgentDeliveryReportsPage /></Suspense></RequireRole>,
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
            element: <RequireRole role={["agent", "sales_staff"]}><DetailListLayout><AgentGoodsReceiptsPage /></DetailListLayout></RequireRole>,
            children: [{ path: ':id', element: <DetailRoute><GoodsReceiptDetailPage /></DetailRoute> }],
          },
          {
            path: 'agent/purchases/receipts/import',
            element: <RequireRole role={["agent", "sales_staff"]}><ReceiptImportPage /></RequireRole>,
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
            element: <RequireRole role="sales_staff"><DetailListLayout><DebtsPage /></DetailListLayout></RequireRole>,
            children: [{ path: ':id', element: <DetailRoute><CustomerDebtPage /></DetailRoute> }],
          },
          {
            path: 'sales/inventory',
            element: <RequireRole role="sales_staff"><SalesInventoryPage /></RequireRole>,
          },
          {
            path: 'sales/returns',
            element: <RequireRole role="sales_staff"><DetailListLayout><ReturnsListPage /></DetailListLayout></RequireRole>,
            children: [{ path: ':id', element: <DetailRoute><ReturnDetailPage /></DetailRoute> }],
          },
          {
            path: 'sales/returns/new',
            element: <RequireRole role="sales_staff"><ReturnCreatePage /></RequireRole>,
          },
          {
            path: 'sales/inventory/stocktake',
            element: <RequireRole role="sales_staff"><DetailListLayout><AgentStocktakePage /></DetailListLayout></RequireRole>,
            children: [{ path: ':id', element: <DetailRoute><StocktakeDetailPage /></DetailRoute> }],
          },
          {
            path: 'sales/price-lists',
            element: <RequireRole role="sales_staff"><PriceListsPage /></RequireRole>,
          },
          {
            path: 'sales/ai-review',
            element: <RequireRole role="sales_staff"><DetailListLayout><DiagnosisQueuePage /></DetailListLayout></RequireRole>,
            children: [{ path: ':id', element: <DetailRoute><DiagnosisCasePage /></DetailRoute> }],
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
            element: <RequireRole role="delivery_staff"><DetailListLayout><DeliveriesPage /></DetailListLayout></RequireRole>,
            children: [{ path: ':id', element: <DetailRoute><DeliveryDetailPage /></DetailRoute> }],
          },

          // Last: any address above does not match. Signed-out visitors never get here, ProtectedRoute sends them to /login.
          { path: '*', element: <NotFoundPage />, handle: { notFound: true } },
        ],
      },
    ],
  },
])
