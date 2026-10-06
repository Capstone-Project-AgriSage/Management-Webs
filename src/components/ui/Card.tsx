import React from 'react'

export default function Card({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-white rounded border border-gray-200 p-4 ${className}`}>
      {children}
    </div>
  )
}
