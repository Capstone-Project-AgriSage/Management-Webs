import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'danger' | 'outline' | 'outline-danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: string
  fullWidth?: boolean
}

const VARIANT_CLASSNAME: Record<ButtonVariant, string> = {
  primary: 'bg-primary hover:bg-primary-container text-on-primary',
  danger: 'bg-error hover:bg-error/90 text-white',
  outline: 'bg-white border border-outline-variant text-on-surface hover:bg-surface-container-low',
  'outline-danger': 'bg-white border border-error text-error hover:bg-error-container/40',
}

export default function Button({
  variant = 'primary',
  icon,
  fullWidth = true,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${fullWidth ? 'w-full' : ''} py-3 px-4 rounded-lg font-title-md text-title-md flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSNAME[variant]} ${className}`}
      {...rest}
    >
      {icon ? <span className="material-symbols-outlined text-[20px]">{icon}</span> : null}
      {children}
    </button>
  )
}
