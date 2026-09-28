export type ReviewStatus = 'VISIBLE' | 'HIDDEN'

export type ProductReview = {
  id: string
  productId: string
  productName: string
  farmerId: string
  farmerName: string
  rating: number
  comment: string
  reply?: string
  status: ReviewStatus
  createdAt: string
  repliedAt?: string
  actions: { label: string; icon: string }[]
}

export const productReviews: ProductReview[] = [
  {
    id: 'REV-001',
    productId: 'P1',
    productName: 'Phân bón NPK 20-20-15',
    farmerId: 'F001',
    farmerName: 'Nguyễn Văn Hùng',
    rating: 5,
    comment: 'Sản phẩm rất tốt, lúa xanh mướt.',
    status: 'VISIBLE',
    createdAt: '2023-09-20T08:00:00Z',
    actions: [
      { label: 'Phản hồi', icon: 'reply' },
      { label: 'Ẩn bình luận', icon: 'visibility_off' }
    ]
  },
  {
    id: 'REV-002',
    productId: 'P2',
    productName: 'Thuốc trừ sâu sinh học',
    farmerId: 'F002',
    farmerName: 'Trần Văn Cường',
    rating: 2,
    comment: 'Thuốc xịt không thấy hiệu quả lắm.',
    reply: 'Chào anh, anh vui lòng kiểm tra lại tỷ lệ pha thuốc xem đã đúng hướng dẫn chưa ạ. Cửa hàng sẽ liên hệ hỗ trợ anh nhé.',
    status: 'VISIBLE',
    createdAt: '2023-09-21T09:30:00Z',
    repliedAt: '2023-09-21T10:15:00Z',
    actions: [
      { label: 'Sửa phản hồi', icon: 'edit' },
      { label: 'Ẩn bình luận', icon: 'visibility_off' }
    ]
  },
  {
    id: 'REV-003',
    productId: 'P3',
    productName: 'Phân Urê',
    farmerId: 'F003',
    farmerName: 'Lê Văn Mạnh',
    rating: 1,
    comment: 'Giao hàng chậm quá, làm trễ vụ của tôi.',
    status: 'HIDDEN',
    createdAt: '2023-09-22T07:45:00Z',
    actions: [
      { label: 'Hiển thị bình luận', icon: 'visibility' }
    ]
  }
]
