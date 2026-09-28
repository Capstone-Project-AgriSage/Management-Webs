type FilterSelectOption = string | { value: string; label: string }

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: FilterSelectOption[]
  className?: string
}

export default function FilterSelect({ value, onChange, options, className = 'relative' }: FilterSelectProps) {
  return (
    <div className={className}>
      <select
        className="w-full appearance-none bg-surface-container-lowest border border-outline-variant hover:border-outline text-on-surface text-label-md font-label-md py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => {
          const optValue = typeof option === 'string' ? option : option.value
          const optLabel = typeof option === 'string' ? option : option.label
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          )
        })}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-outline">
        <span className="material-symbols-outlined text-[16px]" data-icon="expand_more">
          expand_more
        </span>
      </div>
    </div>
  )
}
