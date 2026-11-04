import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/glass-theme.css'
import App from '@/App'
import { installLookupCacheInvalidation } from './api/lookupCache'

const disposeLookupCache = installLookupCacheInvalidation()
import.meta.hot?.dispose(disposeLookupCache)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
