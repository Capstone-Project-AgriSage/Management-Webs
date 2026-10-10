import React from 'react'

export default function Card({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`agrisage-card bg-white rounded-xl border border-slate-200 p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)] ${className}`}>
      {children}
    </div>
  )
}
