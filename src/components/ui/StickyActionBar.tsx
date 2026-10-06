import React, { type ReactNode } from 'react'

export interface StickyActionBarProps {
  children: ReactNode
  className?: string
}

export default function StickyActionBar({ children, className = '' }: StickyActionBarProps) {
  return (
    <div className={`sticky bottom-0 left-0 right-0 z-20 bg-white border-t border-outline-variant/60 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] p-4 ${className}`}>
      <div className="max-w-[1600px] mx-auto">
        {children}
      </div>
    </div>
  )
}
