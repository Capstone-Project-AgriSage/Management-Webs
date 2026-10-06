import { useState, useEffect } from 'react'
import { usePageHeader } from '@/context/PageHeaderContext'
import { creditTiersApi, type CreditTierResponse } from '@/api/creditTiersApi'
import { customerGroupsApi, type CustomerGroupResponse } from '@/api/customerGroupsApi'
import { useToast } from '@/context/ToastContext'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatVnd } from '@/utils/money'
import StatusBadge from '@/components/ui/StatusBadge'

export default function CreditConfigPage() {
  usePageHeader({ title: 'Cấu hình Tín dụng & Nhóm Khách Hàng', subtitle: 'Quản lý hạng tín dụng và thiết lập nhóm' })
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState<'GROUPS' | 'TIERS'>('GROUPS')
  
  const [tiers, setTiers] = useState<CreditTierResponse[]>([])
  const [groups, setGroups] = useState<CustomerGroupResponse[]>([])
  const [loading, setLoading] = useState(false)

  const fetchTiers = async () => {
    try {
      setLoading(true)
      const res = await creditTiersApi.getCreditTiers({ pageSize: 100 })
      setTiers(res.items || [])
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchGroups = async () => {
    try {
      setLoading(true)
      const res = await customerGroupsApi.getCustomerGroups({ pageSize: 100 })
      setGroups(res.items || [])
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'TIERS') {
      fetchTiers()
    } else {
      fetchGroups()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Mock functions for opening modals
  const handleOpenTierModal = (tier?: CreditTierResponse) => {
    showToast(tier ? 'Tính năng sửa hạng tín dụng đang phát triển' : 'Tính năng thêm hạng tín dụng đang phát triển')
  }

  const handleOpenGroupModal = (group?: CustomerGroupResponse) => {
    showToast(group ? 'Tính năng sửa nhóm khách hàng đang phát triển' : 'Tính năng thêm nhóm khách hàng đang phát triển')
  }

  const handleLinkTier = (groupId: string) => {
    showToast('Tính năng liên kết hạng tín dụng đang phát triển')
  }

  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-space-lg pb-10">
      <div className="flex bg-surface-container-low p-1 rounded-lg w-fit">
        <button
          className={`px-6 py-2 rounded-md font-label-md text-label-md transition-colors ${
            activeTab === 'GROUPS' ? 'bg-white shadow text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
          }`}
          onClick={() => setActiveTab('GROUPS')}
        >
          Nhóm Khách Hàng
        </button>
        <button
          className={`px-6 py-2 rounded-md font-label-md text-label-md transition-colors ${
            activeTab === 'TIERS' ? 'bg-white shadow text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
          }`}
          onClick={() => setActiveTab('TIERS')}
        >
          Hạng Tín Dụng
        </button>
      </div>

      {activeTab === 'TIERS' && (
        <Card className="flex flex-col gap-space-md">
          <div className="flex justify-between items-center">
            <h3 className="font-title-md text-title-md font-bold">Danh sách Hạng Tín Dụng</h3>
            <Button icon="add" onClick={() => handleOpenTierModal()}>Thêm Hạng</Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-container-low border-y border-outline-variant">
                  <th className="p-3 text-sm font-semibold text-on-surface">Mã Hạng</th>
                  <th className="p-3 text-sm font-semibold text-on-surface">Tên Hạng</th>
                  <th className="p-3 text-sm font-semibold text-on-surface text-right">Hạn mức mặc định</th>
                  <th className="p-3 text-sm font-semibold text-on-surface text-center">Thời hạn nợ</th>
                  <th className="p-3 text-sm font-semibold text-on-surface text-center">Trạng thái</th>
                  <th className="p-3 text-sm font-semibold text-on-surface text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-10 text-center text-on-surface-variant">Đang tải...</td></tr>
                ) : tiers.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-on-surface-variant">Chưa có hạng tín dụng nào</td></tr>
                ) : (
                  tiers.map((tier) => (
                    <tr key={tier.id} className="border-b border-outline-variant hover:bg-surface-container-lowest">
                      <td className="p-3 font-medium text-sm">{tier.code}</td>
                      <td className="p-3 text-sm">{tier.name}</td>
                      <td className="p-3 text-sm text-right font-medium text-primary">{formatVnd(tier.defaultCreditLimit)}</td>
                      <td className="p-3 text-sm text-center">{tier.defaultPaymentTermDays} ngày</td>
                      <td className="p-3 text-sm text-center">
                        <StatusBadge 
                          label={tier.isActive ? 'Đang hoạt động' : 'Đã khoá'} 
                          className={tier.isActive ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'} 
                        />
                      </td>
                      <td className="p-3 text-sm text-right">
                        <Button variant="outlined" size="small" onClick={() => handleOpenTierModal(tier)}>Sửa</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'GROUPS' && (
        <Card className="flex flex-col gap-space-md">
          <div className="flex justify-between items-center">
            <h3 className="font-title-md text-title-md font-bold">Danh sách Nhóm Khách Hàng</h3>
            <Button icon="add" onClick={() => handleOpenGroupModal()}>Thêm Nhóm</Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-container-low border-y border-outline-variant">
                  <th className="p-3 text-sm font-semibold text-on-surface">Mã Nhóm</th>
                  <th className="p-3 text-sm font-semibold text-on-surface">Tên Nhóm</th>
                  <th className="p-3 text-sm font-semibold text-on-surface text-center">Số KH</th>
                  <th className="p-3 text-sm font-semibold text-on-surface">Bảng giá áp dụng</th>
                  <th className="p-3 text-sm font-semibold text-on-surface">Hạng tín dụng</th>
                  <th className="p-3 text-sm font-semibold text-on-surface text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-10 text-center text-on-surface-variant">Đang tải...</td></tr>
                ) : groups.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-on-surface-variant">Chưa có nhóm nào</td></tr>
                ) : (
                  groups.map((group) => (
                    <tr key={group.id} className="border-b border-outline-variant hover:bg-surface-container-lowest">
                      <td className="p-3 font-medium text-sm">{group.code}</td>
                      <td className="p-3 text-sm">{group.name}</td>
                      <td className="p-3 text-sm text-center">{group.memberCount}</td>
                      <td className="p-3 text-sm">
                        {group.currentPriceList ? (
                          <span className="text-primary font-medium">{group.currentPriceList.name}</span>
                        ) : (
                          <span className="text-on-surface-variant italic">Chưa liên kết</span>
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        {group.defaultCreditTier ? (
                          <span className="text-secondary font-medium">{group.defaultCreditTier.name}</span>
                        ) : (
                          <span className="text-on-surface-variant italic">Chưa liên kết</span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-right flex justify-end gap-2">
                        <Button variant="outlined" size="small" icon="link" onClick={() => handleLinkTier(group.id)}>Liên kết</Button>
                        <Button variant="text" size="small" icon="edit" onClick={() => handleOpenGroupModal(group)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}


