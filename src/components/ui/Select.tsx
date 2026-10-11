import { useEffect, useId, useLayoutEffect, useRef, useState, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

type Option = { value: string; label: string; disabled: boolean }
type Menu = { options: Option[]; active: number; top: number; left: number; width: number; maxHeight: number }

function readOptions(select: HTMLSelectElement): Option[] {
  return Array.from(select.options, option => ({ value: option.value, label: option.text, disabled: option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled) }))
}

function position(select: HTMLSelectElement, count: number) {
  const rect = select.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - 12
  const above = rect.top - 12
  const useBelow = below >= Math.min(320, count * 44 + 16) || below >= above
  const maxHeight = Math.max(44, Math.min(320, useBelow ? below : above))
  const height = Math.min(maxHeight, count * 44 + 16)
  return { top: useBelow ? rect.bottom + 6 : Math.max(6, rect.top - height - 6), left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: Math.min(rect.width, window.innerWidth - 16), maxHeight }
}

/** Keeps native form values/validation while rendering a consistent, keyboard-accessible popup. */
export default function Select({ children, className = '', onPointerDown, onKeyDown, onBlur, onChange, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const input = useRef<HTMLSelectElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const id = useId()
  const [menu, setMenu] = useState<Menu | null>(null)
  const [autoLabel, setAutoLabel] = useState<string>()
  const typed = useRef({ text: '', at: 0 })

  useLayoutEffect(() => {
    if (props['aria-label']) return
    const label = Array.from(input.current?.labels ?? [], element => {
      const copy = element.cloneNode(true) as HTMLElement
      copy.querySelectorAll('.agrisage-select-field, select').forEach(control => control.remove())
      return copy.textContent?.trim().replace(/\s+/g, ' ') ?? ''
    }).filter(Boolean).join(', ')
    setAutoLabel(label || undefined)
  }, [children, props.id, props['aria-label']])

  useEffect(() => setMenu(null), [props.disabled, props.value])
  useEffect(() => {
    setMenu(previous => {
      if (!previous || !input.current) return previous
      const options = readOptions(input.current)
      if (JSON.stringify(options) === JSON.stringify(previous.options)) return previous
      const activeValue = previous.options[previous.active]?.value
      return { ...previous, options, active: options.findIndex(option => option.value === activeValue), ...position(input.current, options.length) }
    })
  }, [children])

  const open = (prefix?: string) => {
    const select = input.current
    if (!select || select.disabled) return
    const options = readOptions(select)
    typed.current = { text: prefix ?? '', at: Date.now() }
    const match = prefix ? options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase('vi').startsWith(prefix)) : -1
    setMenu({ options, active: match >= 0 ? match : select.selectedIndex, ...position(select, options.length) })
  }

  const choose = (index: number) => {
    const select = input.current
    const option = menu?.options[index]
    if (!select || !option || option.disabled) return
    // Dispatch through the select so existing form handlers receive the same event and value.
    select.value = option.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    setMenu(null)
    select.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!menu) return
    const dismiss = (event: PointerEvent) => {
      if (!input.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) setMenu(null)
    }
    const reposition = (event: Event) => {
      if (popup.current?.contains(event.target as Node) || !input.current) return
      const select = input.current
      const rect = select.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > innerHeight) { setMenu(null); return }
      setMenu(previous => previous ? { ...previous, ...position(select, previous.options.length) } : null)
    }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [menu !== null])

  useEffect(() => {
    const option = popup.current?.children[menu?.active ?? -1] as HTMLElement | undefined
    if (!option || !popup.current) return
    if (option.offsetTop < popup.current.scrollTop) popup.current.scrollTop = option.offsetTop
    else if (option.offsetTop + option.offsetHeight > popup.current.scrollTop + popup.current.clientHeight) popup.current.scrollTop = option.offsetTop + option.offsetHeight - popup.current.clientHeight
  }, [menu?.active])

  // Wrapped option labels can make the popup taller than the initial estimate.
  useLayoutEffect(() => {
    if (!menu || !popup.current || !input.current) return
    const height = popup.current.getBoundingClientRect().height
    const rect = input.current.getBoundingClientRect()
    const top = Math.max(8, Math.min(innerHeight - height - 8, menu.top < rect.top ? rect.top - height - 6 : rect.bottom + 6))
    if (Math.abs(top - menu.top) > 1) setMenu(previous => previous ? { ...previous, top } : null)
  }, [menu?.top, menu?.maxHeight, menu?.options])

  return <span className="agrisage-select-field">
    <select {...props} ref={input} className={`agrisage-select ${className}`} aria-label={props['aria-label'] ?? autoLabel} aria-expanded={menu !== null} aria-controls={menu ? `${id}-list` : undefined} aria-activedescendant={menu && menu.active >= 0 ? `${id}-option-${menu.active}` : undefined}
      onPointerDown={event => {
        onPointerDown?.(event)
        if (event.defaultPrevented || event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus({ preventScroll: true })
        if (menu) setMenu(null); else open()
      }}
      onClick={event => event.preventDefault()}
      onBlur={event => { onBlur?.(event); setMenu(null) }}
      onChange={event => { onChange?.(event); setMenu(null) }}
      onKeyDown={event => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (event.key === 'Escape' && menu) { event.preventDefault(); event.stopPropagation(); setMenu(null); return }
        if (event.key === 'Tab') { setMenu(null); return }
        if (['Enter', ' '].includes(event.key)) { event.preventDefault(); if (menu) choose(menu.active); else open(); return }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          if (!menu) { open(); return }
          const enabled = menu.options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0)
          const current = enabled.indexOf(menu.active)
          const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1) : enabled[Math.max(0, Math.min(enabled.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)))]
          if (next !== undefined) setMenu({ ...menu, active: next })
          return
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          if (!menu) { open(event.key.toLocaleLowerCase('vi')); return }
          const now = Date.now()
          typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + event.key.toLocaleLowerCase('vi'), at: now }
          const next = menu.options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase('vi').startsWith(typed.current.text))
          if (next >= 0) setMenu({ ...menu, active: next })
        }
      }}>
      {children}
    </select>
    <ChevronDown aria-hidden="true" size={18} className="agrisage-select-chevron" />
    {menu && createPortal(<div ref={popup} id={`${id}-list`} role="listbox" aria-label={props['aria-label'] ?? autoLabel ?? 'Lựa chọn'} className="agrisage-select-menu" style={{ top: menu.top, left: menu.left, width: menu.width, maxHeight: menu.maxHeight }}>
      {menu.options.map((option, index) => <div key={`${option.value}-${index}`} id={`${id}-option-${index}`} role="option" aria-selected={option.value === input.current?.value} aria-disabled={option.disabled} data-active={index === menu.active} className="agrisage-select-option"
        onPointerDown={event => event.preventDefault()} onPointerMove={() => { if (!option.disabled) setMenu({ ...menu, active: index }) }} onClick={() => choose(index)}>{option.label}</div>)}
    </div>, document.body)}
  </span>
}
