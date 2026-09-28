import { useEffect, useRef, useState } from 'react'

export interface RowAction {
  /** Stable identifier for dispatch (e.g. a switch in the page's action handler).
   * Prefer switching on this over matching `label` text, which is display copy and
   * can change without warning. */
  id?: string
  label: string
  icon?: string
  onClick?: () => void
  tone?: 'default' | 'primary' | 'danger'
}

interface RowActionsMenuProps {
  actions: RowAction[]
  /** Accessible label for the trigger button, e.g. "Thao tác tài khoản #ADM-102" */
  triggerLabel?: string
}

export default function RowActionsMenu({ actions, triggerLabel = 'Thao tác' }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const close = () => setOpen(false)

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
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const toggleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const menuWidth = 208
      const estimatedMenuHeight = actions.length * 36 + 8
      const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8)
      const spaceBelow = window.innerHeight - rect.bottom
      const top =
        spaceBelow < estimatedMenuHeight + 8 && rect.top > estimatedMenuHeight
          ? Math.max(8, rect.top - estimatedMenuHeight - 4)
          : rect.bottom + 4
      setMenuStyle({ top, left })
    }
    setOpen((v) => !v)
  }

  const toneClasses = (tone?: RowAction['tone']) => {
    switch (tone) {
      case 'primary':
        return 'text-primary font-semibold'
      case 'danger':
        return 'text-error'
      default:
        return 'text-on-surface'
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
        className="p-1 rounded hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors"
        title={triggerLabel}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={triggerLabel}
      >
        <span className="material-symbols-outlined text-[18px]">more_vert</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          className="fixed z-50 w-52 rounded-lg border border-outline-variant bg-white shadow-lg py-1"
          style={{ top: menuStyle.top, left: menuStyle.left }}
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
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface-container-low transition-colors ${toneClasses(action.tone)}`}
            >
              {action.icon ? <span className="material-symbols-outlined text-[16px]">{action.icon}</span> : null}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}
