import { useState } from 'react'
import { usePageHeader } from '../../context/PageHeaderContext'
import { useToast } from '../../context/ToastContext'
import * as rolesService from '../../services/rolesService'
import type { Role } from '../../types'

const { permissionModules } = rolesService

export default function RolesPage() {
  usePageHeader({ title: 'Phân quyền', subtitle: 'Cấu hình quyền truy cập cho từng vai trò trong hệ thống AgriSage' })

  // Local draft state, seeded from rolesService — toggling a checkbox only edits
  // this draft; "Lưu thay đổi" is what actually persists it back to rolesService
  // (the same store PermissionContext reads from for route/nav gating).
  const [roleList, setRoleList] = useState<Role[]>(() => rolesService.list())
  const { showToast } = useToast()
  const [selectedRoleId, setSelectedRoleId] = useState(roleList[0].id)
  const [dirty, setDirty] = useState(false)

  const selectedRole = roleList.find((r) => r.id === selectedRoleId) as Role

  const togglePermission = (key: string) => {
    if (!selectedRole.editable) {
      showToast('Không thể chỉnh sửa quyền của vai trò Quản trị viên')
      return
    }
    setRoleList((prev) =>
      prev.map((r) =>
        r.id === selectedRole.id
          ? { ...r, grantedKeys: r.grantedKeys.includes(key) ? r.grantedKeys.filter((k) => k !== key) : [...r.grantedKeys, key] }
          : r,
      ),
    )
    setDirty(true)
  }

  const handleSave = () => {
    rolesService.updatePermissions(selectedRole.id, selectedRole.grantedKeys)
    setDirty(false)
    showToast(`Đã lưu cấu hình quyền cho vai trò "${selectedRole.name}"`)
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        {roleList.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setSelectedRoleId(role.id)}
            className={`text-left p-space-base rounded-xl bg-surface-container-lowest border shadow-sm transition-colors ${
              role.id === selectedRoleId ? 'border-primary ring-1 ring-primary' : 'border-outline-variant hover:border-outline'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center border ${role.colorClassName}`}>
                <span className="material-symbols-outlined text-[20px]">{role.icon}</span>
              </span>
              <span className="text-xs font-semibold text-outline">{role.accountCount} tài khoản</span>
            </div>
            <div className="mt-space-sm">
              <div className="font-title-lg text-title-lg text-on-surface font-semibold flex items-center gap-1.5">
                {role.name}
                {!role.editable ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-container text-outline border border-outline-variant">
                    Cố định
                  </span>
                ) : null}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">{role.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        <div className="px-space-md py-space-sm border-b border-outline-variant flex items-center justify-between bg-surface-container-low/40">
          <div className="flex items-center gap-2">
            <span className="font-title-md text-title-md text-on-surface font-semibold">
              Ma trận quyền — {selectedRole.name}
            </span>
            {!selectedRole.editable ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container text-outline">Toàn quyền, không thể chỉnh sửa</span>
            ) : null}
          </div>
          <button
            type="button"
            disabled={!dirty || !selectedRole.editable}
            onClick={handleSave}
            className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            Lưu thay đổi
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/80 border-b border-outline-variant">
                <th className="py-2.5 px-3 font-label-sm text-label-sm text-outline uppercase tracking-wider w-64">Module</th>
                <th className="py-2.5 px-3 font-label-sm text-label-sm text-outline uppercase tracking-wider">Quyền hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {permissionModules.map((module) => (
                <tr key={module.key} className="hover:bg-surface-container-low/50">
                  <td className="py-3 px-3 align-top">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">{module.icon}</span>
                      <span className="font-medium text-on-surface text-sm">{module.label}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-2">
                      {module.permissions.map((perm) => {
                        const key = `${module.key}:${perm.key}`
                        const granted = selectedRole.grantedKeys.includes(key)
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => togglePermission(key)}
                            disabled={!selectedRole.editable}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                              granted
                                ? 'bg-primary/10 text-primary border-primary/40'
                                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-container-low'
                            } ${!selectedRole.editable ? 'opacity-70' : ''}`}
                          >
                            <span className="material-symbols-outlined text-[15px]">{granted ? 'check_box' : 'check_box_outline_blank'}</span>
                            {perm.label}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
