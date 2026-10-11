import { useId, type InputHTMLAttributes } from 'react'

type DateFilterProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'aria-label'> & { label: string }

/** Native calendar with a visible caption inside the same frame as the other filters. */
export default function DateFilter({ label, id, className = '', ...props }: DateFilterProps) {
  const generatedId = useId()
  return <label className="agrisage-filter agrisage-date-filter relative block" htmlFor={id ?? generatedId}>
    <span className="agrisage-filter-caption" aria-hidden="true">{label}</span>
    <input {...props} id={id ?? generatedId} type="date" aria-label={label} className={`w-full min-w-0 rounded-lg border border-slate-200 bg-white text-sm ${className}`} />
  </label>
}
