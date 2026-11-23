import { useId } from 'react'
import DateInput, { type DateInputChange } from './DateInput'

type DateFilterProps = {
  label: string
  value: string
  onChange?: (event: DateInputChange) => void
  min?: string
  max?: string
  id?: string
  className?: string
  disabled?: boolean
}

/** A date filter (dd/mm/yyyy with a calendar) with a visible caption inside the same frame as the other filters. */
export default function DateFilter({ label, id, className = '', ...props }: DateFilterProps) {
  const generatedId = useId()
  return <label className="agrisage-filter agrisage-date-filter relative block" htmlFor={id ?? generatedId}>
    <span className="agrisage-filter-caption" aria-hidden="true">{label}</span>
    <DateInput {...props} id={id ?? generatedId} aria-label={label} className={`w-full min-w-0 rounded-lg border border-slate-200 bg-white text-sm ${className}`} />
  </label>
}
