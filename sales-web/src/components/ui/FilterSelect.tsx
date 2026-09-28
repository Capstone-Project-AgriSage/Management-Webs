import { ChevronDown } from 'lucide-react'

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
        className="w-full appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer shadow-sm"
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
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
        <ChevronDown size={16} />
      </div>
    </div>
  )
}
