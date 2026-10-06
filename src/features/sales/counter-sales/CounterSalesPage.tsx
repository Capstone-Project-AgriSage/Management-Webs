import { useState, useCallback } from 'react'
import { usePageHeader } from '@/context/PageHeaderContext'
import ProductSearchPanel from './ProductSearchPanel'
import CartPanel from './CartPanel'
import type { CatalogProductDetail } from '@/api/types'

export interface CartItem {
  product: CatalogProductDetail
  packagingId: string
  packagingName: string
  /** Base units in one pack (lots and stock are counted in base units). */
  conversionToBase: number
  quantity: number
  price: number
}

export default function CounterSalesPage() {
  usePageHeader({ title: 'Bán tại quầy', subtitle: 'Tạo đơn và thu tiền trực tiếp' })
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  const handleAddToCart = useCallback((item: CartItem) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.product.id === item.product.id && i.packagingId === item.packagingId)
      if (existing) {
        return prev.map(i => i === existing ? { ...i, quantity: i.quantity + item.quantity } : i)
      }
      return [...prev, item]
    })
  }, [])

  const handleUpdateQuantity = useCallback((index: number, quantity: number) => {
    setCartItems(prev => prev.map((item, i) => i === index ? { ...item, quantity } : item))
  }, [])

  const handleRemoveItem = useCallback((index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleClearCart = useCallback(() => {
    setCartItems([])
  }, [])

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row bg-surface-container-lowest overflow-hidden -m-space-md">
      <div className="flex-1 min-w-0 flex flex-col border-r border-outline-variant">
        <ProductSearchPanel onAddToCart={handleAddToCart} />
      </div>
      <div className="w-full md:w-[450px] shrink-0 flex flex-col bg-surface-container-lowest">
        <CartPanel 
          items={cartItems} 
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
        />
      </div>
    </div>
  )
}
