import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePermission } from '@/context/PermissionContext'
import { MoreVertical } from 'lucide-react'

export interface RowAction {
  permissionCodes?: string[]
  label: string
  icon?: string
  onClick?: () => void
  tone?: 'default' | 'primary' | 'danger'
}

interface RowActionsMenuProps {
  actions: RowAction[]
  /** Accessible label for the trigger button, e.g. "Thao tác đơn #DH-2024-1082" */
  triggerLabel?: string
}

export default function RowActionsMenu({ actions: allActions, triggerLabel = 'Thao tác' }: RowActionsMenuProps) {
  const { has } = usePermission()
  const actions = allActions.filter(action => !action.permissionCodes || action.permissionCodes.every(has))
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
      if (e.key === 'Escape') close()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', close)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open, positionMenu])

  useLayoutEffect(() => {
    if (open) positionMenu()
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
        onClick={(e) => {
          e.stopPropagation()
          toggleOpen()
        }}
        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        title={triggerLabel}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={triggerLabel}
      >
        <MoreVertical size={16} />
      </button>
      {open ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1 overflow-y-auto"
          style={{ top: menuStyle.top, left: menuStyle.left, maxHeight: 'calc(100vh - 16px)', maxWidth: 'calc(100vw - 16px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                action.onClick?.()
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-slate-50 transition-colors ${toneClasses(action.tone)}`}
            >
              {action.icon ? <span className="material-symbols-outlined text-[16px]">{action.icon}</span> : null}
              <span>{action.label}</span>
            </button>
          ))}
        </div>, document.body
      ) : null}
    </>
  )
}
