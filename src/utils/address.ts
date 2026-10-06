export function formatAddress(addr: any): string {
  if (!addr) return ''
  if (typeof addr === 'string') return addr
  if (typeof addr === 'object') {
    const parts = [addr.addressLine, addr.ward, addr.district, addr.province].filter(Boolean)
    return parts.join(', ') || addr.recipientAddress || ''
  }
  return String(addr)
}
