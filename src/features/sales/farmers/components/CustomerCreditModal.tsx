import { useState, useEffect } from 'react'
import FormModal from '@/components/ui/FormModal'
import Button from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { customersApi, type CustomerProfileResponse } from '@/api/customersApi'
import { customerGroupsApi, type CustomerGroupResponse } from '@/api/customerGroupsApi'
import { formatVnd } from '@/utils/money'

interface CustomerCreditModalProps {
  open: boolean
  onClose: () => void
  customerId: string | null
}

export default function CustomerCreditModal({ open, onClose, customerId }: CustomerCreditModalProps) {
  const { showToast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [profile, setProfile] = useState<CustomerProfileResponse | null>(null)
  const [groups, setGroups] = useState<CustomerGroupResponse[]>([])
  
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [creditLimit, setCreditLimit] = useState<string>('')

  useEffect(() => {
    if (open && customerId) {
      fetchData()
    } else {
      setProfile(null)
      setSelectedGroup('')
      setCreditLimit('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [profileRes, groupsRes] = await Promise.all([
        customersApi.getCustomerById(customerId!),
        customerGroupsApi.getCustomerGroups({ pageSize: 100 })
      ])
      
      setProfile(profileRes)
      setGroups(groupsRes.items || [])
      setSelectedGroup(profileRes.customerGroup?.id || '')
      setCreditLimit(profileRes.creditLimit.toString())
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tải hồ sơ tín dụng', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return
    try {
      setSaving(true)
      // 1. Update Group
      if (selectedGroup && selectedGroup !== profile.customerGroup?.id) {
        await customersApi.updateCustomerGroup(profile.id, selectedGroup)
      }
      
      // 2. Update Credit Limit
      if (creditLimit && Number(creditLimit) !== profile.creditLimit) {
        await customersApi.updateCreditLimit(profile.id, Number(creditLimit))
      }
      
      showToast('Cập nhật hồ sơ tín dụng thành công', 'success')
      onClose()
    } catch (err: any) {
      showToast(err.message || 'Lỗi cập nhật', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSuspend = async () => {
    if (!profile) return
    try {
      setSaving(true)
      if (profile.isCreditSuspended) {
        await customersApi.activateCredit(profile.id)
        showToast('Đã mở lại tín dụng', 'success')
      } else {
        await customersApi.suspendCredit(profile.id)
        showToast('Đã đình chỉ tín dụng', 'warning')
      }
      await fetchData()
    } catch (err: any) {
      showToast(err.message || 'Lỗi hệ thống', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Cấu hình Hồ sơ Tín dụng Khách hàng">
      {loading ? (
        <div className="p-10 text-center text-on-surface-variant">Đang tải hồ sơ...</div>
      ) : profile ? (
        <div className="flex flex-col gap-space-lg pt-2">
          {/* Info */}
          <div className="bg-surface-container-low p-space-md rounded border border-outline-variant">
            <h4 className="font-title-md font-bold mb-2">{profile.fullName} ({profile.code})</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-on-surface-variant">Số dư khả dụng:</p>
                <p className="font-medium text-primary">{formatVnd(profile.availableCredit)}</p>
              </div>
              <div>
                <p className="text-on-surface-variant">Dư nợ hiện tại:</p>
                <p className="font-medium text-error">{formatVnd(profile.outstandingReceivable)}</p>
              </div>
            </div>
            {profile.isCreditSuspended && (
              <div className="mt-3 text-error bg-error-container/30 px-3 py-1.5 rounded text-sm font-medium border border-error/20 inline-block">
                Tài khoản đang bị KHOÁ TÍN DỤNG
              </div>
            )}
          </div>

          <div className="flex flex-col gap-space-md">
            {/* Nhóm KH */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Nhóm Khách hàng</span>
              <select 
                className="h-10 px-3 border border-outline-variant rounded focus:border-primary text-sm bg-white"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                <option value="">-- Chọn nhóm --</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </label>

            {/* Hạn mức thủ công */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Hạn mức Tín dụng riêng (VND)</span>
              <input 
                type="number"
                className="h-10 px-3 border border-outline-variant rounded focus:border-primary text-sm bg-white"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="Để trống để áp dụng theo nhóm"
              />
              <span className="text-xs text-on-surface-variant italic">
                Nếu đặt giá trị này, hệ thống sẽ bỏ qua hạn mức mặc định của nhóm/hạng tín dụng.
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-outline-variant">
            <Button 
              variant={profile.isCreditSuspended ? 'primary' : 'outlined'} 
              className={!profile.isCreditSuspended ? 'text-error border-error hover:bg-error-container/20' : ''}
              onClick={handleToggleSuspend}
              disabled={saving}
            >
              {profile.isCreditSuspended ? 'Mở lại Tín dụng' : 'Khoá Tín dụng'}
            </Button>
            
            <div className="flex gap-2">
              <Button variant="text" onClick={onClose} disabled={saving}>Hủy</Button>
              <Button onClick={handleSave} disabled={saving}>Lưu cấu hình</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center text-error">Không tìm thấy thông tin khách hàng</div>
      )}
    </FormModal>
  )
}

