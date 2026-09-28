import type { DashboardAlert, RecentActivityEntry } from '../types'

export const systemAlerts: DashboardAlert[] = [
  {
    icon: 'report',
    iconClassName: 'bg-error-container text-on-error-container',
    title: 'Đại lý Đồng Tháp có tỷ lệ từ chối AI bất thường',
    note: 'Đại lý #AG-033 từ chối 8/10 gợi ý AI gần đây — đã tạm khóa tài khoản để xác minh.',
    timeAgo: '2 giờ trước',
  },
  {
    icon: 'hourglass_top',
    iconClassName: 'bg-amber-100 text-amber-700',
    title: '4 ca AI đang chờ Admin xử lý',
    note: 'Có 2 ca quá 3 giờ chưa được xử lý, cần ưu tiên duyệt trước SLA 6 giờ.',
    timeAgo: '25 phút trước',
  },
  {
    icon: 'person_add',
    iconClassName: 'bg-sky-100 text-sky-700',
    title: '2 tài khoản đại lý mới chờ phê duyệt',
    note: 'Cần xác minh giấy phép kinh doanh vật tư nông nghiệp trước khi kích hoạt.',
    timeAgo: '1 ngày trước',
  },
]

export const recentActivity: RecentActivityEntry[] = [
  {
    actorInitials: 'LA',
    actorAvatarClassName: 'bg-primary-container text-on-primary',
    actorName: 'Trần Thị Lan Anh',
    actorRole: 'Quản trị viên',
    action: 'Phê duyệt ca AI leo thang',
    target: '#AI-3102 — Lê Văn Tài',
    time: '15/09/2026 09:10',
    resultClassName: 'text-emerald-700',
  },
  {
    actorInitials: 'NM',
    actorAvatarClassName: 'bg-secondary-container/40 text-on-secondary-container',
    actorName: 'Nguyễn Văn Minh',
    actorRole: 'Đại lý — Cần Thơ',
    action: 'Duyệt gợi ý AI cho nông dân',
    target: '#AI-2402',
    time: '15/09/2026 08:55',
    resultClassName: 'text-emerald-700',
  },
  {
    actorInitials: 'BC',
    actorAvatarClassName: 'bg-primary-container text-on-primary',
    actorName: 'Ngô Bảo Châu',
    actorRole: 'Quản trị viên',
    action: 'Phê duyệt tài khoản đại lý mới',
    target: '#AG-052 — Hoàng Đức Thịnh',
    time: '15/09/2026 08:00',
    resultClassName: 'text-emerald-700',
  },
  {
    actorInitials: 'LA',
    actorAvatarClassName: 'bg-primary-container text-on-primary',
    actorName: 'Trần Thị Lan Anh',
    actorRole: 'Quản trị viên',
    action: 'Khóa tài khoản đại lý',
    target: '#AG-033 — Đỗ Quang Huy',
    time: '06/09/2026 11:05',
    resultClassName: 'text-error',
  },
  {
    actorInitials: 'PH',
    actorAvatarClassName: 'bg-secondary-container/40 text-on-secondary-container',
    actorName: 'Phạm Thị Hồng',
    actorRole: 'Đại lý — An Giang',
    action: 'Xác nhận đơn hàng',
    target: '#DH-2026-0931',
    time: '15/09/2026 07:30',
    resultClassName: 'text-emerald-700',
  },
]
