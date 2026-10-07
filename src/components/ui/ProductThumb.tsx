import { useEffect, useState } from 'react'
import { ImageOff, Package } from 'lucide-react'

interface ProductThumbProps {
  src?: string | null
  alt: string
  /** Size and shape of the box, e.g. "w-10 h-10 rounded-lg". */
  className?: string
  iconSize?: number
  /** Show a "broken image" icon instead of the neutral one when the picture fails to load. */
  showError?: boolean
}

/** A product picture that falls back to a neutral icon when there is no image or it cannot be loaded. */
export default function ProductThumb({ src, alt, className = 'w-10 h-10 rounded-lg', iconSize = 20, showError = false }: ProductThumbProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  const box = `${className} shrink-0 overflow-hidden bg-surface-container-high text-on-surface-variant`

  if (!src || failed) {
    return (
      <div className={`${box} flex items-center justify-center`} role="img" aria-label={alt}>
        {failed && showError ? <ImageOff size={iconSize} /> : <Package size={iconSize} />}
      </div>
    )
  }

  return (
    <div className={box}>
      <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" onError={() => setFailed(true)} />
    </div>
  )
}
