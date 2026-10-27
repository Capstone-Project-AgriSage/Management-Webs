import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import ConfirmModal from '@/components/ui/ConfirmModal'

export function usePermissionDraftGuard(dirty: boolean) {
  const [pending, setPending] = useState<(() => void) | null>(null)
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  const guard = (action: () => void) => { if (dirty) setPending(() => action); else action() }
  const cancel = () => { setPending(null); if (blocker.state === 'blocked') blocker.reset() }
  const confirm = () => { const action = pending; setPending(null); if (blocker.state === 'blocked') blocker.proceed(); else action?.() }
  const dialog = <ConfirmModal open={!!pending || blocker.state === 'blocked'} title="Bỏ thay đổi chưa lưu?" message="Các điều chỉnh quyền trong bản nháp chưa được lưu. Bạn có muốn bỏ bản nháp và tiếp tục?" confirmLabel="Bỏ thay đổi" cancelLabel="Tiếp tục chỉnh sửa" onClose={cancel} onConfirm={confirm} />
  return { guard, dialog }
}
