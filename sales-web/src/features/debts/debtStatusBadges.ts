/** Shared status-badge presentation for a fully paid-off debt — reused everywhere a
 * customer's debt is marked "Đã thanh toán" instead of being copy-pasted per call site. */
export const PAID_STATUS_BADGE = {
  label: 'Đã thanh toán',
  className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  dotClassName: 'bg-emerald-600',
} as const
