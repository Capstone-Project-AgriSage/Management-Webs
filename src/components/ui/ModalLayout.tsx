import type { ReactNode } from 'react'

interface ModalLayoutProps {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  bodyClassName?: string
}

/** A fixed header and action bar surround the only scrolling region. */
export default function ModalLayout({ header, footer, children, bodyClassName = 'space-y-4' }: ModalLayoutProps) {
  return (
    <div className="modal-sections">
      {header && <div className="modal-header">{header}</div>}
      <div className={`modal-body ${bodyClassName}`}>{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </div>
  )
}
