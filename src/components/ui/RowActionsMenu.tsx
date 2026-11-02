import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePermission } from '@/context/PermissionContext'
import { MoreVertical } from 'lucide-react'

export interface RowAction {
  permissionCodes?: string[]
  label: string
  icon?: string
  onClick?: () => void
  tone?: 'default' | 'primary' | 'danger'
  disabled?: boolean
  title?: string
}

interface RowActionsMenuProps {
  actions: RowAction[]
  /** Accessible label for the trigger button, e.g. "Thao tác đơn #DH-2024-1082" */
  triggerLabel?: string
  disabled?: boolean
}

export default function RowActionsMenu({ actions: allActions, triggerLabel = 'Thao tác', disabled = false }: RowActionsMenuProps) {
  const { has } = usePermission()
  const permitted = allActions.filter(action => !action.permissionCodes || action.permissionCodes.every(has))
  const actions = [...permitted.filter(action => action.tone !== 'danger'), ...permitted.filter(action => action.tone === 'danger')]
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const positionMenu = useCallback(() => {
    if (!triggerRef.current || !menuRef.current) return false
    const trigger = triggerRef.current.getBoundingClientRect()
    if (trigger.bottom <= 0 || trigger.top >= window.innerHeight || trigger.right <= 0 || trigger.left >= window.innerWidth) return false
    const menu = menuRef.current.getBoundingClientRect()
    const margin = 8
    const left = Math.max(margin, Math.min(trigger.right - menu.width, window.innerWidth - menu.width - margin))
    const below = trigger.bottom + 4
    const top = below + menu.height <= window.innerHeight - margin ? below : Math.max(margin, trigger.top - menu.height - 4)
    const clampedTop = Math.min(top, Math.max(margin, window.innerHeight - menu.height - margin))
    setMenuStyle(previous => previous.left === left && previous.top === clampedTop ? previous : { left, top: clampedTop })
    return true
  }, [])

  useEffect(() => {
    if (!open) return

    const close = () => setOpen(false)
    const handleScroll = (event: Event) => {
      // A long menu can scroll internally without moving its anchor.
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      // Focus restoration can scroll the page immediately after opening; keep the menu anchored while its trigger is visible.
      if (!positionMenu()) close()
    }

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      close()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); triggerRef.current?.focus() }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', close)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open, positionMenu])

  useLayoutEffect(() => {
    if (open) {
      positionMenu()
      menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    }
  }, [open, actions.length, positionMenu])

  if (!actions.length) return null

  const toggleOpen = () => {
    setOpen((v) => !v)
  }

  const toneClasses = (tone?: RowAction['tone']) => {
    switch (tone) {
      case 'primary':
        return 'text-emerald-600 font-semibold'
      case 'danger':
        return 'text-rose-600'
      default:
        return 'text-slate-700'
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          toggleOpen()
        }}
        className="agrisage-row-menu-trigger inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open && !disabled}
        aria-controls={open && !disabled ? menuId : undefined}
        onKeyDown={e => {
          if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); return }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setOpen(true) }
        }}
        aria-label={triggerLabel}
      >
        <MoreVertical size={16} />
      </button>
      {open && !disabled ? createPortal(
        <div
          id={menuId}
          role="menu"
          aria-label={triggerLabel}
          ref={menuRef}
          className="agrisage-row-menu fixed z-[100] w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1 overflow-y-auto"
          style={{ top: menuStyle.top, left: menuStyle.left, maxHeight: 'calc(100vh - 16px)', maxWidth: 'calc(100vw - 16px)' }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); triggerRef.current?.focus(); return }
            if (e.key === 'Tab') { setOpen(false); triggerRef.current?.focus(); return }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
            e.preventDefault(); e.stopPropagation()
            const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1
              : (current + (e.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length
            buttons[next]?.focus()
          }}
        >
          {actions.map((action, i) => (
            <div key={`${action.label}-${i}`} className={action.tone === 'danger' && i > 0 && actions[i - 1].tone !== 'danger' ? 'mt-1 border-t border-slate-100 pt-1' : undefined} role="none"><button
              type="button"
              role="menuitem"
              disabled={action.disabled}
              title={action.title}
              tabIndex={-1}
              onClick={() => {
                setOpen(false)
                triggerRef.current?.focus()
                action.onClick?.()
              }}
              className={`w-full min-h-10 flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${toneClasses(action.tone)}`}
            >
              {action.icon ? <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{action.icon}</span> : null}
              <span>{action.label}</span>
            </button></div>
          ))}
        </div>, document.body
      ) : null}
    </>
  )
}
