import type React from 'react'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  label?: string | null
  className?: string
  size?: 'sm' | 'xs'
  minWidthClassName?: string
}

export default function StatusBadge({ label, size = 'sm', minWidthClassName = '', className = '' }: StatusBadgeProps) {
  const displayLabel = label || 'Chưa xác định'
  const sizeClassName = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
  const alignClassName = minWidthClassName ? 'justify-center' : ''

  let icon: React.ReactNode = null;
  const labelLower = displayLabel.toLowerCase();

  if (labelLower.includes('đã tt') || labelLower.includes('hoàn thành') || labelLower.includes('thành công') || labelLower.includes('chuyển khoản') || labelLower.includes('tiền mặt') || labelLower.includes('đã giao') || labelLower.includes('bình thường')) {
    icon = <CheckCircle size={12} aria-hidden="true" className="text-green-700 mr-1.5 flex-shrink-0" />;
  } else if (labelLower.includes('cọc') || labelLower.includes('chờ') || labelLower.includes('đang') || labelLower.includes('pending') || labelLower.includes('cảnh báo')) {
    icon = <Clock size={12} aria-hidden="true" className="text-amber-600 mr-1.5 flex-shrink-0" />;
  } else if (labelLower.includes('nợ') || labelLower.includes('trễ') || labelLower.includes('hủy') || labelLower.includes('lỗi') || labelLower.includes('thất bại') || labelLower.includes('quá hạn') || labelLower.includes('khoá')) {
    icon = <AlertCircle size={12} aria-hidden="true" className="text-rose-600 mr-1.5 flex-shrink-0" />;
  } else {
    icon = <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5 flex-shrink-0" />;
  }

  return (
    <span
      className={`agrisage-status-badge inline-flex items-center ${alignClassName} ${sizeClassName} ${minWidthClassName} rounded-full font-semibold leading-4 border border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap ${className}`}
    >
      {icon}
      {displayLabel}
    </span>
  )
}
