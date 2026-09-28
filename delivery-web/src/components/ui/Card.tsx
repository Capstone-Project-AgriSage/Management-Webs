import type { ReactNode } from 'react'

interface CardProps {
  className?: string
  children: ReactNode
}

export default function Card({ className = '', children }: CardProps) {
  return <div className={`bg-white rounded-lg border border-outline-variant/60 shadow-2xs p-space-lg ${className}`}>{children}</div>
}
