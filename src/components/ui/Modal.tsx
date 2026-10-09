import type { ReactNode } from 'react'
import ModalFrame from './ModalFrame'
import ModalLayout from './ModalLayout'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  widthClassName?: string
  busy?: boolean
}

export default function Modal({ open, onClose, title, description, children, widthClassName, busy }: ModalProps) {
  return (
    <ModalFrame open={open} onClose={onClose} title={title} widthClassName={widthClassName} busy={busy}>
      <ModalLayout header={<div><h2>{title}</h2>{description && <div className="mt-1 text-sm text-slate-500">{description}</div>}</div>} bodyClassName="space-y-4">
        {children}
      </ModalLayout>
    </ModalFrame>
  )
}
