import type { ReactNode } from 'react'
import ModalFrame from './ModalFrame'

interface DetailModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  widthClassName?: string
  busy?: boolean
  title?: string
}

export default function DetailModal(props: DetailModalProps) {
  return <ModalFrame {...props} />
}
