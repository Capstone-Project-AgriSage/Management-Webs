interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}

export default function SearchInput({ value, onChange, placeholder, className = 'relative flex-1 min-w-[220px]' }: SearchInputProps) {
  return (
    <div className={className}>
      <span
        className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none"
        data-icon="search"
      >
        search
      </span>
      <input
        className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
