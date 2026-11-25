import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExchangeBase } from './exchangePaths'
import DetailModal from '@/components/ui/DetailModal'
import ModalLayout from '@/components/ui/ModalLayout'

export default function ExchangeDialog({ title, subtitle, busy = false, footer, children }: {
  title: string
  subtitle: string
  busy?: boolean
  footer: ReactNode
  children: ReactNode
}) {
  const navigate = useNavigate()
  const base = useExchangeBase()
  return <DetailModal open title={title} busy={busy} onClose={() => navigate(base, { replace: true })} widthClassName="max-w-4xl">
    <ModalLayout header={<div><h2>{title}</h2><p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p></div>} footer={footer} bodyClassName="space-y-5">
      {children}
    </ModalLayout>
  </DetailModal>
}
