interface EmptyTableRowProps {
  colSpan: number
  message: string
  className?: string
}

export default function EmptyTableRow({ colSpan, message, className = 'text-slate-500' }: EmptyTableRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={`agrisage-empty-row px-5 py-12 text-center text-sm leading-6 ${className}`}>
        <span className="inline-block max-w-md">{message}</span>
      </td>
    </tr>
  )
}
