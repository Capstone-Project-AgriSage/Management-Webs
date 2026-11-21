import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { isoFromParts, isoToDisplay, parseDateText, parseTimeText, todayIsoVn } from '@/utils/date'

/** What `onChange` receives: shaped like an input event, so `e => setValue(e.target.value)` keeps working. */
export type DateInputChange = { target: { value: string }; currentTarget: { value: string } }

type DateInputProps = {
  /** yyyy-MM-dd or '' (the API's format; only the screen shows dd/mm/yyyy). */
  value: string
  onChange?: (event: DateInputChange) => void
  min?: string
  max?: string
  id?: string
  name?: string
  className?: string
  'aria-label'?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const LAYOUT_CLASS = /^(?:[a-z0-9]+:)?(?:w-|min-w-|max-w-|flex-|basis-|grow|shrink|self-|col-span|order-)/

/** Width and flex classes size the wrapper; the rest style the text box itself. */
function splitClasses(className = '') {
  const tokens = className.split(/\s+/).filter(Boolean)
  const wrapper = tokens.filter(token => LAYOUT_CLASS.test(token))
  return { wrapper: wrapper.join(' '), input: tokens.filter(token => !LAYOUT_CLASS.test(token)).join(' ') }
}

const change = (value: string): DateInputChange => ({ target: { value }, currentTarget: { value } })
const pad2 = (value: number) => String(value).padStart(2, '0')
const isoOf = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
const dateOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (iso: string, days: number) => { const d = dateOf(iso); d.setDate(d.getDate() + days); return isoOf(d) }
const addMonths = (iso: string, months: number) => {
  const d = dateOf(iso); const day = d.getDate()
  d.setDate(1); d.setMonth(d.getMonth() + months)
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  return isoOf(d)
}
const validIso = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isoFromParts(Number(value.slice(8, 10)), Number(value.slice(5, 7)), Number(value.slice(0, 4))) !== null

/**
 * A date field that always reads dd/mm/yyyy, whatever the browser's language (the native date input follows it and
 * shows mm/dd/yyyy in an English browser). The value stays yyyy-MM-dd. Type the digits, or open the calendar.
 * Like the native input, a date outside min/max is still reported (the page decides) but the field is marked invalid.
 */
export default function DateInput({ value, onChange, min, max, id, name, className, 'aria-label': ariaLabel, required, disabled, placeholder = 'dd/mm/yyyy' }: DateInputProps) {
  const classes = splitClasses(className)
  const [text, setText] = useState(() => isoToDisplay(value))
  const [badText, setBadText] = useState(false)
  const [open, setOpen] = useState(false)
  const [focusedIso, setFocusedIso] = useState(() => validIso(value) ? value : todayIsoVn())
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const emitted = useRef(value)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const focusDayOnOpen = useRef(false)

  // A value set by the page (reset, preset period) replaces whatever is in the box.
  useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    setText(isoToDisplay(value))
    setBadText(false)
  }, [value])

  const emit = useCallback((iso: string) => {
    emitted.current = iso
    onChange?.(change(iso))
  }, [onChange])

  const outOfRange = validIso(value) && ((!!min && validIso(min) && value < min) || (!!max && validIso(max) && value > max))
  const invalid = badText || outOfRange
  const enabled = (iso: string) => (!min || !validIso(min) || iso >= min) && (!max || !validIso(max) || iso <= max)

  function typed(raw: string) {
    const result = parseDateText(raw)
    if (result.kind === 'empty') { setText(''); setBadText(false); if (value !== '') emit(''); return }
    setText(result.display)
    if (result.kind === 'complete') {
      setBadText(false)
      if (result.iso !== value) emit(result.iso)
      setFocusedIso(result.iso)
    } else {
      setBadText(result.kind === 'invalid')
    }
  }

  function leave() {
    // A half-typed or impossible date is dropped and the box shows the value the page holds.
    const result = parseDateText(text)
    if (result.kind !== 'complete' && result.kind !== 'empty') { setText(isoToDisplay(value)); setBadText(false) }
  }

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) inputRef.current?.focus()
  }, [])

  function openCalendar(focusDay: boolean) {
    if (disabled) return
    setFocusedIso(validIso(value) ? value : todayIsoVn())
    focusDayOnOpen.current = focusDay
    setPosition({ visibility: 'hidden' })
    setOpen(true)
  }

  function pick(iso: string) {
    if (!enabled(iso)) return
    setText(isoToDisplay(iso)); setBadText(false)
    if (iso !== value) emit(iso)
    close(true)
  }

  // Place the calendar under the field (above when there is no room), in a layer over modals and scroll boxes.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = wrapperRef.current?.getBoundingClientRect()
      const panel = popoverRef.current
      if (!anchor || !panel) return
      const height = panel.offsetHeight; const width = panel.offsetWidth
      const below = anchor.bottom + 4
      const top = below + height > window.innerHeight - 8 && anchor.top - 4 - height >= 8 ? anchor.top - 4 - height : below
      const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))
      setPosition({ top, left, visibility: 'visible' })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (wrapperRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Keyboard focus follows the highlighted day (one tab stop for the whole month).
  // A hidden element cannot take focus: wait until the calendar has been placed and shown.
  const shown = position.visibility === 'visible'
  useEffect(() => {
    if (!open || !shown) return
    if (!focusDayOnOpen.current && !gridRef.current?.contains(document.activeElement)) return
    focusDayOnOpen.current = false
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusedIso}"]`)?.focus()
  }, [open, shown, focusedIso])

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focusedIso, -1), ArrowRight: () => addDays(focusedIso, 1),
      ArrowUp: () => addDays(focusedIso, -7), ArrowDown: () => addDays(focusedIso, 7),
      PageUp: () => addMonths(focusedIso, event.shiftKey ? -12 : -1), PageDown: () => addMonths(focusedIso, event.shiftKey ? 12 : 1),
      Home: () => addDays(focusedIso, -((dateOf(focusedIso).getDay() + 6) % 7)),
      End: () => addDays(focusedIso, 6 - ((dateOf(focusedIso).getDay() + 6) % 7)),
    }
    if (moves[event.key]) { event.preventDefault(); setFocusedIso(moves[event.key]()); return }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(focusedIso) }
  }

  const view = dateOf(focusedIso)
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const gridStart = addDays(isoOf(first), -((first.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  const today = todayIsoVn()

  return <span ref={wrapperRef} className={`relative inline-flex align-middle ${classes.wrapper || 'w-39'}`}>
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      title={outOfRange ? 'Ngày nằm ngoài khoảng cho phép' : badText ? 'Ngày không hợp lệ' : undefined}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={10}
      data-value={value}
      value={text}
      onChange={event => typed(event.target.value)}
      onBlur={leave}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' && !open) { event.preventDefault(); openCalendar(true) }
        else if (event.key === 'Escape' && open) { event.preventDefault(); close(false) }
      }}
      className={`agrisage-date-input w-full tabular-nums ${classes.input} ${invalid ? 'border-rose-400! ring-rose-200!' : ''}`}
      style={{ paddingRight: '2.25rem' }}
    />
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-label="Mở lịch chọn ngày"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => (open ? close(false) : openCalendar(true))}
      className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
    >
      <CalendarDays size={16} aria-hidden="true" />
    </button>
    {open && createPortal(
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Chọn ngày"
        style={{ position: 'fixed', ...position }}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true) } }}
        className="z-1000 w-70 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-xl"
      >
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Tháng trước" onClick={() => setFocusedIso(addMonths(focusedIso, -1))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"><ChevronLeft size={16} aria-hidden="true" /></button>
          <span aria-live="polite" className="font-semibold">Tháng {view.getMonth() + 1}, {view.getFullYear()}</span>
          <button type="button" aria-label="Tháng sau" onClick={() => setFocusedIso(addMonths(focusedIso, 1))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"><ChevronRight size={16} aria-hidden="true" /></button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-500" aria-hidden="true">
          {WEEKDAYS.map(day => <span key={day} className="py-1">{day}</span>)}
        </div>
        <div ref={gridRef} role="grid" aria-label={`Tháng ${view.getMonth() + 1} năm ${view.getFullYear()}`} onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
          {days.map(iso => {
            const inMonth = dateOf(iso).getMonth() === view.getMonth()
            const selected = iso === value
            const allowed = enabled(iso)
            return <button
              key={iso}
              type="button"
              role="gridcell"
              data-iso={iso}
              tabIndex={iso === focusedIso ? 0 : -1}
              disabled={!allowed}
              aria-selected={selected}
              aria-label={isoToDisplay(iso)}
              onClick={() => pick(iso)}
              onFocus={() => { if (iso !== focusedIso) setFocusedIso(iso) }}
              className={`h-9 rounded-lg tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:text-slate-300 ${selected ? 'bg-emerald-700 font-semibold text-white' : iso === today ? 'font-semibold text-emerald-800 ring-1 ring-emerald-600' : inMonth ? 'hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-50'}`}
            >{Number(iso.slice(8, 10))}</button>
          })}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
          <button type="button" disabled={!enabled(today)} onClick={() => pick(today)} className="rounded-lg px-2 py-1 font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-40">Hôm nay</button>
          {!required && <button type="button" onClick={() => { setText(''); setBadText(false); if (value !== '') emit(''); close(true) }} className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100">Xoá</button>}
        </div>
      </div>,
      document.body,
    )}
  </span>
}

type DateTimeInputProps = Omit<DateInputProps, 'placeholder'>

/**
 * Date and time for a yyyy-MM-ddTHH:mm value (the native datetime-local format): the date reads dd/mm/yyyy and the time
 * HH:mm on a 24-hour clock. min/max limit the calendar days.
 */
export function DateTimeInput({ value, onChange, min, max, id, name, className, 'aria-label': ariaLabel, required, disabled }: DateTimeInputProps) {
  const classes = splitClasses(className)
  const datePart = value.slice(0, 10)
  const timePart = value.length >= 16 ? value.slice(11, 16) : ''
  const [timeText, setTimeText] = useState(timePart)
  const lastTime = useRef(timePart)

  useEffect(() => {
    if (timePart === lastTime.current) return
    lastTime.current = timePart
    setTimeText(timePart)
  }, [timePart])

  const emit = (date: string, time: string) => {
    const next = date ? `${date}T${time || '00:00'}` : ''
    lastTime.current = date ? (time || '00:00') : ''
    onChange?.(change(next))
  }

  return <span className={`inline-flex items-center gap-2 ${classes.wrapper}`}>
    <DateInput
      id={id}
      name={name}
      aria-label={ariaLabel}
      required={required}
      disabled={disabled}
      value={datePart}
      min={min?.slice(0, 10)}
      max={max?.slice(0, 10)}
      className={`min-w-0 flex-1 ${classes.input}`}
      onChange={event => emit(event.target.value, parseTimeText(timeText).time ?? lastTime.current)}
    />
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={ariaLabel ? `${ariaLabel} (giờ)` : 'Giờ'}
      placeholder="HH:mm"
      maxLength={5}
      disabled={disabled || !datePart}
      value={timeText}
      onChange={event => {
        const parsed = parseTimeText(event.target.value)
        setTimeText(parsed.display)
        if (parsed.time && datePart) emit(datePart, parsed.time)
      }}
      onBlur={() => { if (!parseTimeText(timeText).time) setTimeText(lastTime.current) }}
      className={`w-19 shrink-0 tabular-nums ${classes.input}`}
    />
  </span>
}
