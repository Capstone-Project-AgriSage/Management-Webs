import type { DeliveryOrder } from '@/data/types'
import { isoDateOffsetFromToday } from '@/utils/date'

const TODAY = isoDateOffsetFromToday(0)
const TOMORROW = isoDateOffsetFromToday(1)
const YESTERDAY = isoDateOffsetFromToday(-1)

export const deliveryOrders: DeliveryOrder[] = [
  {
    id: 'GH-9001',
    orderCode: '#DH-2024-2201',
    farmerName: 'Trần Văn Hải',
    farmerPhone: '0918.234.567',
    deliveryAddress: 'Cầu Vàm Xáng, Ấp Thới Phước 1, Xã Trường Thành, Huyện Thới Lai, TP. Cần Thơ',
    deliveryNote: 'Có ghe đón dưới bến sông, gọi trước 15 phút khi tới nơi.',
    isCreditPurchase: false,
    scheduledDate: TODAY,
    scheduledWindowLabel: 'Hôm nay 09:00 - 09:30',
    status: 'ASSIGNED',
    products: [
      { name: 'Phân NPK Đầu Trâu 20-20-15+TE', quantityLabel: '10 bao' },
      { name: 'Thuốc trừ cỏ Sofit 300EC', quantityLabel: '5 chai (1L)' },
    ],
    attempts: [],
  },
  {
    id: 'GH-9002',
    orderCode: '#DH-2024-2202',
    farmerName: 'Lê Thị Bảy',
    farmerPhone: '0907.891.234',
    deliveryAddress: 'Kênh Ranh Cây Sung, Xã Tân Hưng, Quận Ô Môn, TP. Cần Thơ',
    isCreditPurchase: true,
    scheduledDate: TODAY,
    scheduledWindowLabel: 'Hôm nay 10:45 - 11:15',
    status: 'OUT_FOR_DELIVERY',
    products: [
      { name: 'Lúa Giống Xác Nhận ST25 (F1)', quantityLabel: '20 bao' },
      { name: 'Thuốc Trừ Bệnh Beam 75WP', quantityLabel: '15 gói' },
    ],
    attempts: [
      { id: 'GH-9002-A1', attemptNumber: 1, status: 'OUT_FOR_DELIVERY', startedAt: `${TODAY}T10:20:00` },
    ],
  },
  {
    id: 'GH-9003',
    orderCode: '#DH-2024-2200',
    farmerName: 'Nguyễn Hữu Trí',
    farmerPhone: '0939.456.789',
    deliveryAddress: 'Vàm Xáng, Ấp Nhơn Lộc, Xã Nhơn Ái, Huyện Phong Điền, TP. Cần Thơ',
    isCreditPurchase: false,
    scheduledDate: TODAY,
    scheduledWindowLabel: 'Hôm nay 08:45 - 09:12',
    status: 'DELIVERED',
    products: [
      { name: 'Thuốc Trừ Sâu Virtako 40WG', quantityLabel: '30 gói' },
      { name: 'Thuốc trừ cỏ Sofit 300EC', quantityLabel: '8 chai (1L)' },
    ],
    attempts: [
      {
        id: 'GH-9003-A1',
        attemptNumber: 1,
        status: 'DELIVERED',
        startedAt: `${TODAY}T08:45:00`,
        completedAt: `${TODAY}T09:12:00`,
        note: 'Khách ký nhận đủ hàng.',
        proofPhotoUrl:
          'data:image/svg+xml;utf8,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><rect width="100%" height="100%" fill="%23e8f5e9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%232e7d32" font-family="sans-serif" font-size="16">Anh minh chung giao hang</text></svg>',
          ),
      },
    ],
  },
  {
    id: 'GH-9004',
    orderCode: '#DH-2024-2196',
    farmerName: 'Võ Thị Hạnh',
    farmerPhone: '0913.567.890',
    deliveryAddress: 'Bến đò Bà Đầm, Khu vực Bình Chánh, Phường Bình Thủy, Quận Bình Thủy, TP. Cần Thơ',
    deliveryNote: 'Khách hẹn giao lại buổi chiều.',
    isCreditPurchase: true,
    scheduledDate: YESTERDAY,
    scheduledWindowLabel: 'Hôm qua 16:15 - 16:45',
    status: 'FAILED',
    redeliveryDate: TODAY,
    products: [{ name: 'Lô hàng vật tư nông nghiệp (giao đợt 2)', quantityLabel: '1 lô' }],
    attempts: [
      {
        id: 'GH-9004-A1',
        attemptNumber: 1,
        status: 'FAILED',
        startedAt: `${YESTERDAY}T16:15:00`,
        completedAt: `${YESTERDAY}T16:45:00`,
        failureReasonCode: 'CUSTOMER_ABSENT',
        failureReasonLabel: 'Không gặp người nhận',
        note: 'Khách hẹn ngày khác, chưa giao được hàng.',
      },
    ],
  },
  {
    id: 'GH-9005',
    orderCode: '#DH-2024-2189',
    farmerName: 'Phan Văn Thắng',
    farmerPhone: '0948.112.334',
    deliveryAddress: 'Cống Cây Trâm, Ấp Thới Hòa A, Xã Thới Đông, Huyện Cờ Đỏ, TP. Cần Thơ',
    isCreditPurchase: false,
    scheduledDate: isoDateOffsetFromToday(-2),
    scheduledWindowLabel: '2 ngày trước',
    status: 'CANCELLED',
    cancelReasonLabel: 'Farmer không còn nhu cầu mua',
    products: [{ name: 'Phân Urê Hạt Đục Cà Mau', quantityLabel: '15 bao' }],
    attempts: [
      {
        id: 'GH-9005-A1',
        attemptNumber: 1,
        status: 'FAILED',
        startedAt: `${isoDateOffsetFromToday(-2)}T13:30:00`,
        completedAt: `${isoDateOffsetFromToday(-2)}T14:00:00`,
        failureReasonCode: 'CUSTOMER_NO_LONGER_NEEDS',
        failureReasonLabel: 'Farmer không còn nhu cầu mua',
        note: 'Khách báo đã mua chỗ khác, không nhận hàng nữa.',
      },
    ],
  },
  {
    id: 'GH-9006',
    orderCode: '#DH-2024-2203',
    farmerName: 'Đặng Văn Sơn',
    farmerPhone: '0912.334.556',
    deliveryAddress: 'Ấp Vĩnh Lợi, Xã Vĩnh Trinh, Huyện Vĩnh Thạnh, TP. Cần Thơ',
    isCreditPurchase: false,
    scheduledDate: TOMORROW,
    scheduledWindowLabel: 'Ngày mai 14:30 - 15:00',
    status: 'ASSIGNED',
    products: [{ name: 'Phân Kali Clorua (MOP) Cà Mau', quantityLabel: '10 bao' }],
    attempts: [],
  },
]
