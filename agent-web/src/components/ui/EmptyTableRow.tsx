interface EmptyTableRowProps {
  colSpan: number
  message: string
  className?: string
}

export default function EmptyTableRow({ colSpan, message, className = 'text-slate-500' }: EmptyTableRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={`py-8 text-center text-sm ${className}`}>
        {message}
      </td>
    </tr>
  )
}
