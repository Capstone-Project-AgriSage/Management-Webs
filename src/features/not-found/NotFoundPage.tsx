import { Link } from 'react-router-dom'
import { usePageHeader } from '@/context/PageHeaderContext'

/** Any address the router does not know, inside the signed-in layout so the menu stays there to go somewhere else. */
export default function NotFoundPage() {
  usePageHeader({ title: 'Không tìm thấy trang' })
  return (
    <div role="alert" className="rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm py-16 flex flex-col items-center text-center gap-2">
      <span className="material-symbols-outlined text-[40px] text-outline" aria-hidden="true">search_off</span>
      <p className="font-title-md text-title-md text-on-surface font-semibold">Không tìm thấy trang</p>
      <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">
        Địa chỉ này không có trong hệ thống hoặc trang đã được gỡ bỏ. Chọn một mục trong menu hoặc quay về trang chủ.
      </p>
      <Link to="/" className="mt-3 inline-flex items-center rounded-[10px] bg-primary-dark px-4 py-2 text-sm font-semibold text-white">
        Về trang chủ
      </Link>
    </div>
  )
}
