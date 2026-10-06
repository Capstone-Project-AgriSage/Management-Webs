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
  primary: 'bg-primary text-white hover:bg-primary/90',
  outlined: 'border border-primary text-primary hover:bg-primary/10',
  outline: 'border border-primary text-primary hover:bg-primary/10',
  text: 'text-primary hover:bg-primary/10',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  'outline-danger': 'border border-rose-300 text-rose-700 hover:bg-rose-50',
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
  const sizeStyle = size === 'small' ? 'px-3 py-1.5 text-xs' : size === 'large' ? 'px-5 py-2.5 text-base' : 'px-4 py-2 text-sm'
  const iconSize = size === 'small' ? 'text-[16px]' : 'text-[18px]'
  const baseStyle = `rounded font-medium disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5 ${sizeStyle} ${fullWidth ? 'w-full' : ''}`
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${VARIANT_CLASSES[variant]} ${className}`} {...rest}>
      {icon && <span className={`material-symbols-outlined ${iconSize}`} aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}
