import type { ReactNode } from 'react'

interface StickyActionBarProps {
  className?: string
  children: ReactNode
}

/** Pins its content to the bottom of the viewport on mobile (where a delivery
 * staff needs the primary action reachable with one thumb) and falls back to
 * an inline block on larger screens (`sm:static`). */
export default function StickyActionBar({ className = '', children }: StickyActionBarProps) {
  return (
    <div
      className={`fixed sm:static bottom-0 left-0 right-0 p-space-md sm:p-0 bg-white sm:bg-transparent border-t sm:border-0 border-outline-variant/60 z-30 ${className}`}
    >
      {children}
    </div>
  )
}
