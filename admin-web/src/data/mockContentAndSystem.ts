import type { Article, SystemNotification, AuditLog } from '../types'

export const mockArticles: Article[] = [
  {
    id: 'ART-001',
    title: 'Cách phòng trừ rầy nâu hại lúa vụ Đông Xuân',
    category: 'Kỹ thuật canh tác',
    author: 'TS. Nguyễn Văn A',
    views: 1250,
    status: 'Đã xuất bản',
    publishedAt: '2024-03-10'
  },
  {
    id: 'ART-002',
    title: 'Bảng giá phân bón mới nhất tháng 4',
    category: 'Tin tức thị trường',
    author: 'Admin',
    views: 890,
    status: 'Đã xuất bản',
    publishedAt: '2024-03-25'
  },
  {
    id: 'ART-003',
    title: 'Cảnh báo sương muối ở Tây Nguyên',
    category: 'Cảnh báo thời tiết',
    author: 'Trung tâm DBKTTV',
    views: 0,
    status: 'Chờ duyệt',
    publishedAt: '2024-04-01'
  },
  {
    id: 'ART-004',
    title: 'Ứng dụng AI trong nhận diện sâu bệnh',
    category: 'Cẩm nang Agrisage',
    author: 'Team Kỹ thuật',
    views: 0,
    status: 'Bản nháp',
    publishedAt: '-'
  }
]

export const mockNotifications: SystemNotification[] = [
  {
    id: 'NOTIF-001',
    title: 'Bảo trì hệ thống AI',
    content: 'Hệ thống AI sẽ tạm dừng 30 phút từ 23:00 tối nay để nâng cấp model nhận diện bệnh.',
    target: 'Tất cả',
    type: 'Hệ thống',
    status: 'Lên lịch',
    scheduledFor: '2024-04-05 23:00',
    sentCount: 0
  },
  {
    id: 'NOTIF-002',
    title: 'Khuyến mãi phân bón tháng 4',
    content: 'Giảm giá 10% các loại phân bón lá cho Đại lý nhập hàng trong tuần này.',
    target: 'Đại lý',
    type: 'Khuyến mãi',
    status: 'Đã gửi',
    scheduledFor: '2024-04-01 08:00',
    sentCount: 450
  },
  {
    id: 'NOTIF-003',
    title: 'Cảnh báo dịch sương mai',
    content: 'Cảnh báo nguy cơ cao lây lan dịch sương mai trên cà phê do sương mù dày đặc.',
    target: 'Nông dân',
    type: 'Cảnh báo',
    status: 'Đã gửi',
    scheduledFor: '2024-03-28 09:30',
    sentCount: 12500
  }
]

export const mockAuditLogs: AuditLog[] = [
  { id: 'LOG-12450', timestamp: '2024-04-01 14:30:12', actor: 'Admin (admin@agrisage.vn)', action: 'Cập nhật', targetResource: 'Quy tắc AI: POL-002', level: 'Info', ipAddress: '192.168.1.45' },
  { id: 'LOG-12449', timestamp: '2024-04-01 14:15:00', actor: 'Admin (admin@agrisage.vn)', action: 'Khóa tài khoản', targetResource: 'Tài khoản: USR-9921', level: 'Warning', ipAddress: '192.168.1.45' },
  { id: 'LOG-12448', timestamp: '2024-04-01 10:05:33', actor: 'Hệ thống', action: 'Lỗi', targetResource: 'AI Model: MOD-CV-001', level: 'Error', ipAddress: '127.0.0.1' },
  { id: 'LOG-12447', timestamp: '2024-04-01 09:00:21', actor: 'Moderator (mod@agrisage.vn)', action: 'Phê duyệt', targetResource: 'Bài viết: ART-001', level: 'Info', ipAddress: '113.190.2.14' },
  { id: 'LOG-12446', timestamp: '2024-04-01 08:45:00', actor: 'Moderator (mod@agrisage.vn)', action: 'Đăng nhập', targetResource: 'Hệ thống', level: 'Info', ipAddress: '113.190.2.14' },
]
