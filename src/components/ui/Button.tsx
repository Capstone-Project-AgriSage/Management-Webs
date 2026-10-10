import React from 'react'

type ButtonVariant = 'primary' | 'outlined' | 'text' | 'danger' | 'outline-danger' | 'outline'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 'outline' is kept as an alias of 'outlined' for older call sites. */
  variant?: ButtonVariant
  size?: 'small' | 'medium' | 'large'
  /** Material Symbols icon name shown before the label. */
  icon?: string
  fullWidth?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'border border-primary bg-primary text-white shadow-sm hover:bg-green-800 hover:border-green-800',
  outlined: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-green-300 hover:bg-green-50 hover:text-green-800',
  outline: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-green-300 hover:bg-green-50 hover:text-green-800',
  text: 'text-green-800 hover:bg-green-50',
  danger: 'border border-rose-600 bg-rose-600 text-white shadow-sm hover:bg-rose-700 hover:border-rose-700',
  'outline-danger': 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
}

export default function Button({
  children,
  onClick,
  className = '',
  disabled,
  variant = 'primary',
  size = 'medium',
  type = 'button',
  icon,
  fullWidth = false,
  ...rest
}: ButtonProps) {
  const sizeStyle = size === 'small' ? 'min-h-9 px-3 py-1.5 text-xs' : size === 'large' ? 'min-h-12 px-5 py-2.5 text-base' : 'min-h-[42px] px-4 py-2 text-sm'
  const iconSize = size === 'small' ? 'text-[16px]' : 'text-[18px]'
  const baseStyle = `agrisage-button rounded-[10px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${sizeStyle} ${fullWidth ? 'w-full' : ''}`
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${VARIANT_CLASSES[variant]} ${className}`} {...rest}>
      {icon && <span className={`material-symbols-outlined ${iconSize}`} aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}
