import type { StaffMember } from '../types'

export const staffMembers: StaffMember[] = [
  {
    id: 'STF-001',
    name: 'Nguyễn Văn A',
    phone: '0901234567',
    role: 'Store Owner',
    status: 'Đang làm việc',
    can_review_ai: true,
    joinedAt: '2023-01-15T08:00:00Z',
    actions: [
      { label: 'Chỉnh sửa', icon: 'edit' },
      { label: 'Khóa tài khoản', icon: 'lock' },
    ]
  },
  {
    id: 'STF-002',
    name: 'Trần Thị B',
    phone: '0902345678',
    role: 'Sales Staff',
    status: 'Đang làm việc',
    can_review_ai: false,
    joinedAt: '2023-03-20T08:00:00Z',
    actions: [
      { label: 'Chỉnh sửa', icon: 'edit' },
      { label: 'Khóa tài khoản', icon: 'lock' },
    ]
  },
  {
    id: 'STF-003',
    name: 'Lê Văn C',
    phone: '0903456789',
    role: 'Delivery Staff',
    status: 'Đang làm việc',
    can_review_ai: false,
    joinedAt: '2023-05-10T08:00:00Z',
    actions: [
      { label: 'Chỉnh sửa', icon: 'edit' },
      { label: 'Khóa tài khoản', icon: 'lock' },
    ]
  },
  {
    id: 'STF-004',
    name: 'Phạm Thị D',
    phone: '0904567890',
    role: 'Sales Staff',
    status: 'Đã khóa',
    can_review_ai: false,
    joinedAt: '2023-08-01T08:00:00Z',
    actions: [
      { label: 'Chỉnh sửa', icon: 'edit' },
      { label: 'Mở khóa tài khoản', icon: 'lock_open' },
    ]
  }
]
