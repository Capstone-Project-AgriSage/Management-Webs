const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_EDGE = 1600

/**
 * Phone photos are often larger than the 5 MB the proof upload accepts (FE_GUIDE_FLOW_2 §D2),
 * so downscale to MAX_EDGE and re-encode as JPEG before sending.
 */
export async function prepareProofPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Chỉ nhận ảnh JPEG, PNG hoặc WebP.')
  if (ACCEPTED_TYPES.includes(file.type) && file.size <= 1.5 * 1024 * 1024) return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) {
    if (ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_BYTES) return file
    throw new Error('Không đọc được ảnh, vui lòng chụp lại.')
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
  if (!blob || blob.size > MAX_BYTES) throw new Error('Ảnh quá lớn (tối đa 5 MB).')
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}
