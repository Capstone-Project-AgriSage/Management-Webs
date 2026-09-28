import { createBrowserRouter } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import RequirePermission from './components/auth/RequirePermission'
import LoginPage from './features/auth/LoginPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import DashboardPage from './features/dashboard/DashboardPage'
import AccountsPage from './features/accounts/AccountsPage'
import RolesPage from './features/roles/RolesPage'

// Products
import CategoriesPage from './features/products/CategoriesPage'
import ProductMasterPage from './features/products/ProductMasterPage'
import ActiveIngredientsPage from './features/products/ActiveIngredientsPage'

// AI
import AiModelsPage from './features/ai-models/AiModelsPage'
import AiPolicyConfigsPage from './features/ai-models/AiPolicyConfigsPage'

// Content
import ArticlesPage from './features/content/ArticlesPage'

// System
import SystemNotificationsPage from './features/system/SystemNotificationsPage'
import AuditLogsPage from './features/system/AuditLogsPage'

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
          {
            index: true,
            element: (
              <RequirePermission module="reports">
                <DashboardPage />
              </RequirePermission>
            ),
          },
          {
            path: 'accounts',
            element: (
              <RequirePermission module="accounts">
                <AccountsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'roles',
            element: (
              <RequirePermission module="roles">
                <RolesPage />
              </RequirePermission>
            ),
          },
          {
            path: 'products/categories',
            element: (
              <RequirePermission module="products">
                <CategoriesPage />
              </RequirePermission>
            ),
          },
          {
            path: 'products/master',
            element: (
              <RequirePermission module="products">
                <ProductMasterPage />
              </RequirePermission>
            ),
          },
          {
            path: 'products/ingredients',
            element: (
              <RequirePermission module="products">
                <ActiveIngredientsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'ai/models',
            element: (
              <RequirePermission module="ai-config">
                <AiModelsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'ai/policies',
            element: (
              <RequirePermission module="ai-config">
                <AiPolicyConfigsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'articles',
            element: (
              <RequirePermission module="articles">
                <ArticlesPage />
              </RequirePermission>
            ),
          },
          {
            path: 'notifications',
            element: (
              <RequirePermission module="notifications">
                <SystemNotificationsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'audit-logs',
            element: (
              <RequirePermission module="audit-logs">
                <AuditLogsPage />
              </RequirePermission>
            ),
          },
        ],
      },
    ],
  },
])
