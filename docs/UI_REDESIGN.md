# Cải tiến giao diện Management-Webs

Ngày thực hiện: 10/10/2026. Phạm vi: lớp trình bày của React + Vite + TypeScript hiện có.

## Tham chiếu và phạm vi

Đã đọc mã CSS, bố cục quản trị và trang tổng quan công khai của [Kisan Setu](https://github.com/Dragonarya/Kisan-Setu), đồng thời xem trang giới thiệu và đăng nhập của [bản demo](https://kisan-setu-gules-beta.vercel.app/). Phần tổng quan sau đăng nhập được đối chiếu qua mã nguồn công khai. Kiểm tra phê duyệt tự động từ chối đăng nhập dịch vụ demo vì yêu cầu xem thiết kế không cấp quyền đăng nhập dịch vụ tham chiếu; không tiếp tục thao tác này.

Áp dụng nền #F8FAFC, bề mặt trắng, chữ #0F172A/#64748B, viền #E2E8F0 và điểm nhấn #16A34A. Nút có chữ trắng dùng xanh đậm #166534 để giữ độ tương phản. Giữ cấu trúc thư mục, thư viện, mô-đun và định tuyến hiện tại.

## Các thay đổi giao diện

- Thanh điều hướng trắng, nhóm menu rõ ràng, trạng thái chọn nền xanh nhạt; rộng 264px và thu gọn còn 80px trên màn hình từ 1024px. Menu thu gọn có nhãn trợ năng và tooltip. Drawer trên tablet/mobile khóa cuộn, giữ focus, hỗ trợ Escape và trả focus về nút mở.
- Header sticky, tìm kiếm hiện có, số thông báo chưa đọc, avatar và thông tin tài khoản. Đã bỏ dòng vị trí trang và nút xổ xuống tài khoản theo yêu cầu. Giữ hành động tìm kiếm, thông báo và đăng xuất.
- Đã bỏ khối avatar, tên và vai trò ở chân sidebar theo yêu cầu; giữ nút thu gọn thanh điều hướng.
- Đã bỏ mô tả phụ dưới tiêu đề trang trên toàn bộ header và các đoạn giải thích quanh bảng, khối báo cáo theo yêu cầu.
- Thống nhất chữ, khoảng cách, bo góc và bóng nhẹ cho thẻ KPI, biểu đồ, bảng, bộ lọc, phân trang và biểu mẫu. Giữ màu sắc thể hiện cảnh báo/lỗi.
- Modal dùng đầu/cuối cố định và vùng nội dung cuộn; trường cuối cùng và nút lưu/hủy truy cập được trên màn hình 375px. Trạng thái rỗng/đang tải rõ ràng; thẻ báo cáo giữ kích thước khi tải lại.
- Trang tổng quan của bốn vai trò dùng cùng hệ thống thị giác. Bán tại quầy chuyển thành các vùng xếp dọc trên màn hình nhỏ. Bộ lọc ngày đơn hàng và nút phiếu nhập tự xuống dòng khi thiếu chiều ngang.
- Nội dung trình bày được giữ bằng tiếng Việt. Các nhãn menu có sẵn `AI Models` và `AI Policy` giữ nguyên theo yêu cầu bảo toàn menu.

## Thành phần dùng lại

Tiếp tục dùng các thành phần sẵn có: `Button`, `Card`, `KpiCard`, `SearchInput`, `FilterSelect`, `StatusBadge`, `Pagination`, `EmptyTableRow`, `ConfirmModal` và hệ thống modal. Các thành phần nhận dữ liệu/callback hiện có qua props; không chuyển yêu cầu API hay chính sách nghiệp vụ vào lớp trình bày.

Các trang danh sách hưởng cùng quy tắc bảng, nút, trường nhập, focus và vùng cuộn từ `src/index.css`; các trang có cấu trúc riêng chỉ sửa lớp CSS cần thiết. Không tạo thêm mô-đun/menu.

## Danh sách tệp sửa

Khung và hệ thống thiết kế:

- `DESIGN.md`
- `src/index.css`
- `src/layouts/DashboardLayout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Topbar.tsx`

Thành phần trình bày:

- `src/components/ui/Button.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/ConfirmModal.tsx`
- `src/components/ui/EmptyTableRow.tsx`
- `src/components/ui/FilterSelect.tsx`
- `src/components/ui/KpiCard.tsx`
- `src/components/ui/Pagination.tsx`
- `src/components/ui/SearchInput.tsx`
- `src/components/ui/StatusBadge.tsx`
- `src/components/ui/modal.css`

Trang và biểu đồ:

- `src/features/admin/dashboard/DashboardPage.tsx`
- `src/features/agent/dashboard/DashboardPage.tsx`
- `src/features/agent/dashboard/components/LeadsBySourceChart.tsx`
- `src/features/agent/dashboard/components/NewLeadsChart.tsx`
- `src/features/agent/dashboard/components/ProposalsSentChart.tsx`
- `src/features/agent/dashboard/components/RevenueGrowthChart.tsx`
- `src/features/agent/purchases/GoodsReceiptsPage.tsx`
- `src/features/auth/LoginPage.tsx`
- `src/features/delivery/dashboard/DashboardPage.tsx`
- `src/features/orders/OrdersPage.tsx`
- `src/features/sales/counter-sales/CounterSalesPage.tsx`
- `src/features/sales/dashboard/DashboardPage.tsx`
- `src/features/sales/dashboard/components/DashboardListCard.tsx`
- `src/features/sales/dashboard/components/OrdersByDayChart.tsx`
- `src/features/sales/dashboard/components/PaymentMethodChart.tsx`
- `src/features/sales/dashboard/components/RevenueTrendChart.tsx`

Kiểm tra và tài liệu mới:

- `scripts/test-ui-presentation.mjs`
- `docs/UI_REDESIGN.md`
- Ảnh kiểm tra cục bộ trong `artifacts/ui-redesign/`.

## Bảo toàn tích hợp và hành vi

Đối chiếu với Git `HEAD` xác nhận không sửa `src/api`, `src/hooks`, xử lý xác thực/token, ngữ cảnh quyền, thành phần bảo vệ quyền, `src/router.tsx`, `src/utils`, dịch vụ và mô-đun dữ liệu. Khối `useNavConfig` cùng phép lọc `canAccessRoute` giữ nguyên; kiểm tra trình duyệt đối chiếu chính xác nhãn, routes và thứ tự cho Admin, chủ cửa hàng, nhân viên bán hàng, nhân viên giao hàng.

Kiểm tra tạo khách hàng trên mobile xác nhận cùng HTTP POST, Authorization và payload; truy vấn danh sách giữ nguyên tham số sắp xếp, phân trang. Bộ kiểm tra có sẵn xác nhận cấp/thu hồi quyền, đóng biểu mẫu khi mất quyền, xung đột phiên bản, lỗi API, hành động thông báo, tìm kiếm debounce, phản hồi cũ, báo cáo độc lập với phân trang và chỉ làm mới sau ghi thành công.

Không sửa backend, schema, migration, DTO, query keys, bộ nhớ đệm hoặc công thức KPI. Các dashboard vốn có dữ liệu mẫu trong mã nguồn vẫn dùng chính nguồn và phép tính ban đầu; đợt sửa giao diện không kết nối lại các phần đó. Không thêm dữ liệu mẫu vào ứng dụng.

## Kiểm chứng

Các bộ kiểm tra trình duyệt dùng phản hồi HTTP bị chặn trong ngữ cảnh kiểm tra và không đọc/ghi backend thật. Ảnh dashboard chờ hiệu ứng mở đầu của Recharts kết thúc trước khi chụp.

| Kiểm tra | Kết quả |
| --- | --- |
| `node node_modules/typescript/bin/tsc -b` | Thành công |
| `npm run build` | Thành công |
| `npm run lint` | Thành công; còn các cảnh báo có sẵn |
| `scripts/test-permissions.mjs` | 11/11 |
| `scripts/test-notifications.mjs` | 17/17 |
| `scripts/test-navigation-loading.mjs` | 8/8 |
| `scripts/test-ui-presentation.mjs` | 21/21 |

Bộ trình bày kiểm tra 1440, 1024, 768 và 375px: bốn dashboard, menu theo vai trò/quyền, thu gọn/mở rộng, tooltip, drawer, focus/Escape, tràn ngang, cuộn bảng, đầu vào và nút cuối modal, payload tạo khách hàng. Có thêm trang đơn hàng/phiếu nhập và modal phiếu nhập 375px.

Tổng cộng 57 kiểm tra trình duyệt thành công. Hai lỗi trình bày phát hiện trong quá trình kiểm tra (chú giải biểu đồ quản trị tràn 8px ở 1024px và thẻ báo cáo tăng chiều cao 4px khi hết tải) đã sửa và chạy lại thành công.

Chạy bộ trình bày khi Vite đang phục vụ trên `http://127.0.0.1:5173`:

```powershell
$env:UI_PLAYWRIGHT_MODULE = 'C:\Users\thinh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright\index.mjs'
$env:UI_BROWSER_CHANNEL = 'chrome'
$env:UI_SCREENSHOT_DIR = 'D:\Test\Management-Webs\artifacts\ui-redesign'
node scripts/test-ui-presentation.mjs
```

`UI_PLAYWRIGHT_MODULE`, `UI_BROWSER_CHANNEL`, `UI_TEST_URL` và `UI_SCREENSHOT_DIR` có thể thay theo máy. Nếu cài Playwright trực tiếp trong môi trường kiểm tra, có thể bỏ `UI_PLAYWRIGHT_MODULE`.

Giới hạn: các kiểm tra trên xác nhận giao diện và hợp đồng bằng phản hồi kiểm thử, chưa xác nhận độ trễ/khả dụng của backend triển khai thật. Phần demo tham chiếu sau đăng nhập được xác minh qua mã nguồn công khai như nêu trên.
