import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import SearchInput from './SearchInput'

interface ListToolbarProps {
  search?: { value: string; onChange: (value: string) => void; placeholder: string }
  children?: ReactNode
  actions?: ReactNode
  onClear: () => void
  disabled?: boolean
}

/** Search and actions on the left; filters in a two-column grid on the right. */
export default function ListToolbar({ search, children, actions, onClear, disabled = false }: ListToolbarProps) {
  return <div className={`agrisage-list-toolbar ${search ? 'agrisage-list-toolbar-with-search' : 'agrisage-list-toolbar-filters-only'}`} role="group" aria-label="Tìm kiếm và bộ lọc">
    {search && <SearchInput {...search} className="relative flex-1 min-w-0" />}
    <div className="agrisage-list-filters">{children}</div>
    <div className="agrisage-list-actions">
      <button type="button" className="agrisage-clear-filters" onClick={onClear} disabled={disabled}>
        <RefreshCw size={14} aria-hidden="true" /> Xóa lọc
      </button>
      {actions}
    </div>
  </div>
}
