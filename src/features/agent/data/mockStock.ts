export type StockMovementType = 'STOCK_IN' | 'SALE' | 'ADJUSTMENT'

export type StockMovement = {
  id: string
  productName: string
  sku: string
  type: StockMovementType
  quantityChange: number
  balanceAfter: number
  createdAt: string
  createdBy: string
  note?: string
  referenceId?: string
}

export const stockMovements: StockMovement[] = [
  {
    id: 'SM-1001',
    productName: 'Phân bón NPK 20-20-15',
    sku: 'NPK-001',
    type: 'STOCK_IN',
    quantityChange: 50,
    balanceAfter: 150,
    createdAt: '2023-09-21T10:00:00Z',
    createdBy: 'Nguyễn Văn A',
    note: 'Nhập hàng từ PO-2309-001',
    referenceId: 'PO-2309-001'
  },
  {
    id: 'SM-1002',
    productName: 'Thuốc trừ sâu sinh học',
    sku: 'BVTV-002',
    type: 'SALE',
    quantityChange: -5,
    balanceAfter: 45,
    createdAt: '2023-09-21T14:30:00Z',
    createdBy: 'Hệ thống',
    note: 'Xuất kho cho Đơn hàng ORD-9012',
    referenceId: 'ORD-9012'
  },
  {
    id: 'SM-1003',
    productName: 'Phân Urê',
    sku: 'URE-003',
    type: 'ADJUSTMENT',
    quantityChange: -2,
    balanceAfter: 38,
    createdAt: '2023-09-22T08:15:00Z',
    createdBy: 'Trần Thị B',
    note: 'Kiểm kê thấy hao hụt rách bao',
    referenceId: 'ST-001'
  }
]

export type StocktakeStatus = 'DRAFT' | 'COMPLETED'

export type StocktakeItem = {
  id: string
  productId: string
  productName: string
  systemQuantity: number
  actualQuantity: number
  variance: number
  note: string
}

export type Stocktake = {
  id: string
  createdAt: string
  createdBy: string
  status: StocktakeStatus
  items: StocktakeItem[]
  actions: { label: string; icon: string }[]
}

export const stocktakes: Stocktake[] = [
  {
    id: 'ST-001',
    createdAt: '2023-09-22T08:00:00Z',
    createdBy: 'Trần Thị B',
    status: 'COMPLETED',
    items: [
      { id: 'I1', productId: 'P3', productName: 'Phân Urê', systemQuantity: 40, actualQuantity: 38, variance: -2, note: 'Rách 2 bao' }
    ],
    actions: [
      { label: 'Xem chi tiết', icon: 'visibility' }
    ]
  },
  {
    id: 'ST-002',
    createdAt: '2023-09-22T15:00:00Z',
    createdBy: 'Nguyễn Văn A',
    status: 'DRAFT',
    items: [
      { id: 'I2', productId: 'P1', productName: 'Phân bón NPK 20-20-15', systemQuantity: 150, actualQuantity: 150, variance: 0, note: '' }
    ],
    actions: [
      { label: 'Tiếp tục kiểm kê', icon: 'edit' },
      { label: 'Hoàn tất kiểm kê', icon: 'check_circle' }
    ]
  }
]
