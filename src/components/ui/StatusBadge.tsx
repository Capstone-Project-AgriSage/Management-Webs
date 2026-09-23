import { CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface StatusBadgeProps {
  label: string
  className: string
  size?: 'sm' | 'xs'
  minWidthClassName?: string
}

export default function StatusBadge({ label, size = 'sm', minWidthClassName = '' }: StatusBadgeProps) {
  const sizeClassName = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
  const alignClassName = minWidthClassName ? 'justify-center' : ''
  
  let icon = null;
  const labelLower = label.toLowerCase();
  
  if (labelLower.includes('đã tt') || labelLower.includes('hoàn thành') || labelLower.includes('thành công') || labelLower.includes('chuyển khoản') || labelLower.includes('tiền mặt') || labelLower.includes('đã giao')) {
    icon = <CheckCircle size={10} className="text-emerald-500 mr-1.5 flex-shrink-0" />;
  } else if (labelLower.includes('cọc') || labelLower.includes('chờ') || labelLower.includes('đang') || labelLower.includes('pending')) {
    icon = <Clock size={10} className="text-amber-500 mr-1.5 flex-shrink-0" />;
  } else if (labelLower.includes('nợ') || labelLower.includes('trễ') || labelLower.includes('hủy') || labelLower.includes('lỗi') || labelLower.includes('thất bại')) {
    icon = <AlertCircle size={10} className="text-rose-500 mr-1.5 flex-shrink-0" />;
  } else {
    icon = <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-1.5 flex-shrink-0" />;
  }

  return (
    <span
      className={`inline-flex items-center ${alignClassName} ${sizeClassName} ${minWidthClassName} rounded-full font-medium border border-slate-200 bg-white text-slate-600 whitespace-nowrap shadow-sm`}
    >
      {icon}
      {label}
    </span>
  )
}
