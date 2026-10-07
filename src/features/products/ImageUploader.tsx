import { useRef, useState } from 'react'
import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import ProductThumb from '@/components/ui/ProductThumb'
import { IMAGE_MAX_BYTES, IMAGE_TYPES, productsApi, type UploadedImage } from '@/api/productsApi'
import { describeError } from '@/api/client'

interface ImageUploaderProps {
  /** The image shown now (a saved one, or one uploaded in this dialog). */
  url: string | null
  /** A file was uploaded: its public URL and storage key. */
  onUploaded: (image: UploadedImage) => void
  /** "Xóa ảnh" was pressed. */
  onRemove: () => void
  disabled?: boolean
}

/** Pick, drop, preview, replace or remove one product image (JPEG, PNG or WebP, up to 3 MB). The file is uploaded at once. */
export default function ImageUploader({ url, onUploaded, onRemove, disabled = false }: ImageUploaderProps) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const take = async (file: File | undefined) => {
    if (!file || disabled) return
    if (!IMAGE_TYPES.includes(file.type)) {
      setError('Chỉ nhận ảnh JPG, PNG hoặc WebP.')
      return
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)} MB). Tối đa ${IMAGE_MAX_BYTES / 1024 / 1024} MB.`)
      return
    }
    setError('')
    setUploading(true)
    try {
      onUploaded(await productsApi.uploadImage(file))
    } catch (err) {
      setError(describeError(err, 'Không tải được ảnh lên. Bạn thử lại nhé.'))
    } finally {
      setUploading(false)
      if (input.current) input.current.value = '' // lets the same file be picked again after a failure
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-4 p-3 rounded-xl border-2 border-dashed transition-colors ${
          dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50/50'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void take(e.dataTransfer.files?.[0])
        }}
      >
        <div className="relative">
          <ProductThumb src={url} alt="Ảnh sản phẩm" className="w-28 h-28 rounded-xl border border-slate-200" iconSize={36} showError />
          {uploading && (
            <div className="absolute inset-0 rounded-xl bg-white/70 flex items-center justify-center" aria-label="Đang tải ảnh lên">
              <Loader2 className="animate-spin text-emerald-600" size={26} />
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-xs text-slate-500">Kéo ảnh vào đây hoặc chọn từ máy. JPG, PNG, WebP, tối đa 3 MB. Nên dùng ảnh vuông, nền sáng.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => input.current?.click()}
              className="h-9 px-3 rounded-lg border border-emerald-600 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              {url ? <RefreshCw size={15} /> : <ImagePlus size={15} />} {url ? 'Đổi ảnh' : 'Chọn ảnh'}
            </button>
            {url && (
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={onRemove}
                className="h-9 px-3 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 size={15} /> Xóa ảnh
              </button>
            )}
          </div>
        </div>
      </div>
      <input ref={input} type="file" accept={IMAGE_TYPES.join(',')} className="hidden" aria-label="Chọn ảnh sản phẩm" onChange={(e) => void take(e.target.files?.[0])} />
      {error && (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
