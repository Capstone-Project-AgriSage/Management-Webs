export type Supplier = {
  id: string
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  status: 'Đang hợp tác' | 'Ngừng hợp tác'
  actions: { label: string; icon: string }[]
}

export type POStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'

export type PurchaseOrderItem = {
  id: string
  productName: string
  orderedQuantity: number
  receivedQuantity: number
  unitPrice: number
}

export type PurchaseOrder = {
  id: string
  supplierId: string
  supplierName: string
  status: POStatus
  totalAmount: number
  createdAt: string
  expectedDate?: string
  items: PurchaseOrderItem[]
  actions: { label: string; icon: string }[]
}

export const suppliers: Supplier[] = [
  {
    id: 'SUP-001',
    name: 'Công ty Phân Bón Bình Điền',
    contactName: 'Lê Văn Trọng',
    phone: '0987654321',
    email: 'trong.le@binhdien.vn',
    address: 'KCN Tân Tạo, Bình Tân, TP.HCM',
    status: 'Đang hợp tác',
    actions: [{ label: 'Sửa thông tin', icon: 'edit' }, { label: 'Ngừng hợp tác', icon: 'block' }]
  },
  {
    id: 'SUP-002',
    name: 'Bảo Vệ Thực Vật An Giang',
    contactName: 'Nguyễn Thị Hoa',
    phone: '0976543210',
    email: 'hoa.nguyen@agpps.com.vn',
    address: 'Châu Thành, An Giang',
    status: 'Đang hợp tác',
    actions: [{ label: 'Sửa thông tin', icon: 'edit' }, { label: 'Ngừng hợp tác', icon: 'block' }]
  }
]

export const purchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO-2309-001',
    supplierId: 'SUP-001',
    supplierName: 'Công ty Phân Bón Bình Điền',
    status: 'ORDERED',
    totalAmount: 15000000,
    createdAt: '2023-09-20T10:00:00Z',
    expectedDate: '2023-09-25',
    items: [
      { id: 'I1', productName: 'Phân bón NPK 20-20-15', orderedQuantity: 50, receivedQuantity: 0, unitPrice: 300000 }
    ],
    actions: [
      { label: 'Ghi nhận nhận hàng', icon: 'inventory_2' },
      { label: 'Hủy phiếu', icon: 'cancel' }
    ]
  },
  {
    id: 'PO-2309-002',
    supplierId: 'SUP-002',
    supplierName: 'Bảo Vệ Thực Vật An Giang',
    status: 'DRAFT',
    totalAmount: 2400000,
    createdAt: '2023-09-21T14:30:00Z',
    items: [
      { id: 'I2', productName: 'Thuốc trừ sâu sinh học', orderedQuantity: 20, receivedQuantity: 0, unitPrice: 120000 }
    ],
    actions: [
      { label: 'Chỉnh sửa phiếu', icon: 'edit' },
      { label: 'Chốt đơn (ORDERED)', icon: 'send' },
      { label: 'Hủy phiếu', icon: 'cancel' }
    ]
  },
  {
    id: 'PO-2308-015',
    supplierId: 'SUP-001',
    supplierName: 'Công ty Phân Bón Bình Điền',
    status: 'RECEIVED',
    totalAmount: 12000000,
    createdAt: '2023-08-15T08:00:00Z',
    items: [
      { id: 'I3', productName: 'Phân Urê', orderedQuantity: 40, receivedQuantity: 40, unitPrice: 300000 }
    ],
    actions: [
      { label: 'Xem chi tiết', icon: 'visibility' }
    ]
  }
]
