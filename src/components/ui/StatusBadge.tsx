import { CheckCircle, Clock, AlertCircle, Truck } from 'lucide-react';

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

  const labelLower = displayLabel.toLowerCase()
  const matches = (...words: string[]) => words.some(word => labelLower.includes(word))
  const tone = matches('mua chịu', 'mua nợ', 'trả sau', 'tín dụng') ? 'credit'
    : matches('chưa thanh toán', 'chưa tt') ? 'neutral'
    : matches('trễ', 'hủy', 'huỷ', 'lỗi', 'thất bại', 'bị từ chối', 'quá hạn', 'khoá', 'khóa', 'ngừng', 'không hoạt động') ? 'danger'
    : matches('sẵn sàng giao', 'đang giao', 'giao một phần') ? 'info'
    : matches('đã tt', 'đã thanh toán', 'đã trả hết', 'đã hoàn tiền', 'đã duyệt', 'đã xuất bản', 'hoàn thành', 'thành công', 'đã giao', 'bình thường', 'đang hoạt động', 'đang kinh doanh', 'chuyển khoản', 'tiền mặt') ? 'success'
    : matches('cọc', 'chờ', 'đang', 'pending', 'cảnh báo', 'cần hoàn', 'chưa trả', 'một phần', '1 phần') ? 'warning'
    : /(?:bg|text|border)-(?:rose|red)-/.test(className) ? 'danger'
    : /(?:bg|text|border)-(?:amber|orange|yellow)-/.test(className) ? 'warning'
    : /(?:bg|text|border)-(?:emerald|green)-/.test(className) ? 'success'
    : /(?:bg|text|border)-(?:blue|sky)-/.test(className) ? 'info' : 'neutral'
  const Icon = tone === 'success' ? CheckCircle : tone === 'warning' ? Clock : tone === 'danger' ? AlertCircle : tone === 'info' && matches('giao') ? Truck : null
  const icon = Icon ? <Icon size={size === 'xs' ? 12 : 15} aria-hidden="true" className="shrink-0" /> : <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current shrink-0 opacity-70" />

  return (
    <span
      data-tone={tone}
      data-size={size}
      className={`agrisage-status-badge inline-flex items-center ${alignClassName} ${sizeClassName} ${minWidthClassName} rounded-full font-semibold leading-4 border border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap ${className}`}
    >
      {icon}
      {displayLabel}
    </span>
  )
}
