import Select from './Select'

type FilterSelectOption = string | { value: string; label: string }

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: FilterSelectOption[]
  className?: string
  label?: string
  labelPlacement?: 'above' | 'inside'
  disabled?: boolean
}

export default function FilterSelect({ value, onChange, options, className = '', label = 'Lọc danh sách', labelPlacement = 'inside', disabled = false }: FilterSelectProps) {
  return (
    <div className={`agrisage-filter relative ${className}`} data-label-placement={labelPlacement}>
      <span aria-hidden="true" title={label} className={labelPlacement === 'inside' ? 'agrisage-filter-caption' : 'agrisage-select-label'}>{label}</span>
      <Select
        className="w-full min-h-[42px] appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm py-2 pl-3 pr-9 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-green-100 focus:border-primary transition-colors cursor-pointer"
        aria-label={label}
        disabled={disabled}
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
      </Select>
    </div>
  )
}
