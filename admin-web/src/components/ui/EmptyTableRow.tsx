interface EmptyTableRowProps {
  colSpan: number
  message: string
  className?: string
}

export default function EmptyTableRow({ colSpan, message, className = 'text-outline' }: EmptyTableRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={`py-8 text-center text-xs ${className}`}>
        {message}
      </td>
    </tr>
  )
}
