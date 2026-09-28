import { useRef, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import type { ConfirmDeliveredInput } from '../../types'

interface DeliverySuccessModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (input: ConfirmDeliveredInput) => void
}

export default function DeliverySuccessModal({ open, onClose, onConfirm }: DeliverySuccessModalProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = () => setPhotoUrl(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  const handleSubmit = () => {
    if (!photoUrl) {
      setError('Vui lòng chụp hoặc tải lên ảnh chứng minh giao hàng.')
      return
    }
    onConfirm({ proofPhotoUrl: photoUrl, note: note.trim() || undefined })
    setPhotoUrl(null)
    setNote('')
    setError('')
  }

  const handleClose = () => {
    setPhotoUrl(null)
    setNote('')
    setError('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Xác nhận giao thành công">
      <div className="space-y-space-md">
        <div>
          <label className="font-label-md text-label-md text-on-surface-variant block mb-space-xs">
            Ảnh chứng minh giao hàng <span className="text-error">*</span>
          </label>
          {photoUrl ? (
            <div className="relative">
              <img src={photoUrl} alt="Ảnh chứng minh giao hàng" className="w-full rounded-lg border border-outline-variant object-cover max-h-64" />
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-inverse-surface/70 text-white flex items-center justify-center"
                aria-label="Xóa ảnh"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-space-xl border-2 border-dashed border-outline-variant rounded-lg flex flex-col items-center justify-center gap-space-xs text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[32px]">add_a_photo</span>
              <span className="font-label-md text-label-md">Chụp / tải ảnh giao hàng</span>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          {error ? <p className="font-body-sm text-body-sm text-error mt-space-xs">{error}</p> : null}
        </div>

        <label className="block">
          <span className="font-label-md text-label-md text-on-surface-variant block mb-space-xs">Ghi chú (không bắt buộc)</span>
          <textarea
            className="w-full min-h-20 p-space-sm text-sm bg-surface-container-low border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface"
            placeholder="VD: Khách đã ký nhận, hàng đủ số lượng..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <Button icon="check_circle" onClick={handleSubmit}>
          Xác nhận đã giao
        </Button>
      </div>
    </Modal>
  )
}
