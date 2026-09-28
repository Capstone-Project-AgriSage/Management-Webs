/** Triggers a real browser download of the given rows as a UTF-8 CSV file (opens correctly in Excel). */
export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))]
  const csvContent = '﻿' + lines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
