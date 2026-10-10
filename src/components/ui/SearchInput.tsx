import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}

export default function SearchInput({ value, onChange, placeholder, className = 'relative flex-1 min-w-0 sm:min-w-[220px]' }: SearchInputProps) {
  return (
    <div className={`agrisage-search ${className}`}>
      <Search
        size={16}
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      />
      <input
        className="w-full min-h-[42px] pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-[10px] text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-100 focus:border-primary transition-colors"
        aria-label={placeholder}
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
