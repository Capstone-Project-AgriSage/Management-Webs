interface StatusBadgeProps {
  label: string
  className: string
  size?: 'sm' | 'xs'
  /** Tailwind min-width class (e.g. "min-w-[120px]") so every badge in the same status column lines up regardless of label length. */
  minWidthClassName?: string
}

export default function StatusBadge({ label, className, size = 'sm', minWidthClassName = '' }: StatusBadgeProps) {
  const sizeClassName = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
  const alignClassName = minWidthClassName ? 'justify-center' : ''
  return (
    <span
      className={`inline-flex items-center ${alignClassName} ${sizeClassName} ${minWidthClassName} rounded-full font-medium border whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  )
}
