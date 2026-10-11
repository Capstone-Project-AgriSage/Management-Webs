# Giao diện AgriSage theo mẫu kính mờ

Áp dụng chung cho Management-Webs, gồm các vai trò quản trị, chủ cửa hàng, nhân viên bán hàng và giao hàng. Sidebar, thanh trên, bộ lọc, thẻ thống kê, bảng, menu thao tác, hộp thoại và các trang đăng nhập/khôi phục mật khẩu sử dụng cùng lớp thiết kế tại `src/styles/glass-theme.css`.

## Bố cục và dữ liệu

- Nền trơn chuyển nhẹ từ xanh nhạt sang vàng kem, các khối kính mờ và nút xanh. Bảng có từng hàng bo góc, trạng thái có màu và biểu tượng; chữ trạng thái vẫn được giữ nguyên.
- Bốn ô thống kê trên desktop; bố cục 2 × 2 trên điện thoại. Giá trị dài được xuống dòng trong ô; bảng rộng cuộn bên trong thay vì làm tràn toàn trang.
- Ô báo cáo dùng chung bố cục và khoảng cách: nhãn, số liệu và ghi chú có vị trí thống nhất, nội dung cân đối theo chiều dọc. Bỏ breadcrumb “Bảng điều khiển > …” và các nút xuất Excel/CSV chưa dùng.
- Các ô thống kê không hiển thị icon trang trí hoặc đường xu hướng; giữ tiêu đề, giá trị và ghi chú. Giá trị tổng hợp vẫn lấy từ `totals`. Số liệu không có quyền xem hoặc tải lỗi vẫn hiện trạng thái tương ứng.
- Bán tại quầy dùng nền pane chung, không chồng thêm nền riêng cho danh sách sản phẩm và đơn đang soạn. Thẻ sản phẩm dùng cùng màu nền với các hàng bảng; tab khách hàng được chọn dùng màu xanh chung.
- Giữ nguyên hợp đồng API, phân quyền, tìm kiếm, bộ lọc, phân trang và cache hoàn tiền đã có. Không thay đổi backend hoặc database/migration.

## Hiệu ứng và khả năng đọc

Chỉ các pane chính dùng `backdrop-filter`; từng ô bảng dùng màu nền trong suốt, không làm mờ riêng mỗi ô. Nền trơn dùng chung trên desktop và mobile. Hộp thoại có nền gần đặc để biểu mẫu rõ ràng; viền lỗi `aria-invalid` được giữ lại. Hệ thống tôn trọng `prefers-reduced-motion` và `prefers-reduced-transparency`.

## Nền trơn

- Nền CSS `linear-gradient(115deg, #cce1cf 0%, #e5e4ce 48%, #fae9cb 100%)` giữ tông xanh nhạt – vàng kem của ảnh tham chiếu và bỏ chi tiết phong cảnh theo yêu cầu.
- Không tải ảnh nền; gradient dùng chung cho tất cả trang quản lý và xác thực ở mọi kích thước màn hình.

## Kiểm tra và ảnh xem trước

### Điều chỉnh bộ lọc theo phản hồi

- Đơn hàng có nhãn “Từ ngày”, “Đến ngày” bên trong ô lịch. Bộ lọc kho dùng cùng ô lịch và bỏ các tiêu đề ngoài bị lặp.
- Ô nhà cung cấp dùng cùng chiều cao và khoảng cách nhãn/giá trị với các bộ lọc khác.
- Hoàn tiền có ba danh sách chọn: nguồn hoàn, trạng thái nguồn và phạm vi hoàn; công nợ dùng danh sách chọn tình trạng quá hạn. Thay đổi lựa chọn vẫn gửi tham số API hiện có và đưa danh sách về trang đầu.
- Biểu tượng menu chỉ xanh khi đường dẫn đang được chọn; Tổng quan trỏ về trang tổng quan của đúng vai trò. Thanh tab công nợ cuộn trong khung trên điện thoại.
- `test-summary-consistency.mjs` kiểm tra thêm nhãn ngày, khoảng cách ô nhà cung cấp, tham số API hoàn tiền/công nợ, màu menu và độ rộng trang ở 390 px. Ảnh xem trước bộ lọc nằm trong `artifacts/filter-corrections/`.

### Dropdown, thanh toán và bảng

- Toàn bộ ô chọn HTML và các bộ lọc dùng `FilterSelect` đã chuyển sang `Select` dùng chung. Nhãn của tất cả dropdown bộ lọc nằm bên trong ô, phía trên giá trị; ô nhà cung cấp cũng dùng bố cục này. Các bộ lọc danh mục, tồn kho, cảnh báo, lô hàng và phạm vi kiểm kê có nhãn rõ ràng. Danh sách mở có nền gần trắng, bo góc và mục được chọn xanh nhạt. Biểu mẫu vẫn giữ giá trị, validation, nhãn và sự kiện thay đổi của ô chọn HTML.
- Danh sách mở hỗ trợ chuột, phím mũi tên, Home/End, gõ chữ tìm mục, Enter, Escape và Tab. Danh sách được đưa ra ngoài khung cuộn để không bị cắt trong bảng/hộp thoại; vị trí theo ô chọn khi trang cuộn.
- “Theo đơn hàng” ở Thanh toán có trạng thái đơn hàng, nguồn đơn và khoảng ngày tạo đơn, gửi các tham số có sẵn của `/api/orders`. “Xóa lọc” xóa cả bốn lựa chọn và tìm kiếm, đồng thời về trang 1. Không thêm bộ lọc trạng thái thanh toán ở cấp toàn bộ đơn vì hợp đồng danh sách đơn chưa hỗ trợ tham số đó.
- Tab công nợ tự xuống hàng khi hẹp, không có thanh cuộn. Tab cấu hình nhóm khách hàng/hạng tín dụng được chọn dùng nền xanh, chữ trắng.
- Bộ lọc nâng cao nhật ký dùng nền kính chung. Tất cả bảng trong trang quản lý và hộp thoại dùng font ứng dụng, tiêu đề 12 px, nội dung 14 px và thông tin phụ 12 px; màu trạng thái và độ đậm vẫn giữ vai trò của từng cột.
- Kiểm thử thêm popup bằng chuột/bàn phím, đóng popup trong hộp thoại, tham số bộ lọc thanh toán, font bảng và màn hình 390 px. Ảnh cập nhật nằm trong `artifacts/dropdown-consistency/` (`dropdown-open-desktop.png`, `dropdown-open-mobile.png`, `corrected-payments-filter.png`, `corrected-audit-filter.png`). Backend và database không thay đổi.

Kiểm tra trình duyệt sử dụng API giả lập, không gọi backend cửa hàng thật. Ảnh chụp dùng dữ liệu kiểm thử, không phải số liệu kinh doanh.

- `test-summary-consistency.mjs`: 35 trang/đường dẫn và kiểm tra phạm vi số liệu, phân quyền, API lỗi; bốn ô trên các trang.
- `test-glass-theme.mjs`: các kiểm tra hiện tại xác nhận ô thống kê chỉ có chữ, dữ liệu trống/âm/phẳng, số request không tăng, nền trơn đồng bộ không tải ảnh, màu trạng thái, tìm kiếm/bộ lọc/phân trang, hộp thoại, viền lỗi, giảm hiệu ứng, desktop/tablet/phone 1440/1024/768/390 px, menu điện thoại và ba trang xác thực. Chưa chạy lại sau khi bỏ đường xu hướng và đồng bộ nền bán tại quầy, theo yêu cầu không test. Ảnh ở `artifacts/plain-background/` là ảnh của lần thay nền trước đó.
- `test-pagination-filters.mjs`: 32 kiểm tra; `test-staff-payments.mjs`: 9 nhóm; `test-auth-integration.mjs`: 7 kiểm tra.
- `test-refunds-performance.mjs`: 9 nhóm, gồm cache, chuyển trang nhanh, hủy request cũ và không đọc lại trang đã cache.
- `test-reports.mjs`: 13 kiểm tra tích hợp báo cáo và phân quyền.
- TypeScript, Vite build, Oxlint và `git diff --check` được chạy. Vite vẫn có cảnh báo chunk JavaScript chính lớn hơn 500 KB; bản thiết kế này không giải quyết toàn bộ việc tách bundle. Không suy ra độ trễ backend thực tế từ kiểm thử API giả lập.

Ảnh trong `artifacts/glass-theme/`:

- `dashboard-desktop.png`: tổng quan, thẻ và xu hướng từ fixture API.
- `orders-desktop.png`: bảng và trạng thái đơn hàng/thanh toán.
- `orders-390.png`: bốn ô 2 × 2 và bộ lọc trên điện thoại.
- `staff-modal-desktop.png`: hộp thoại nhập liệu.
- `login-mobile.png`: trang đăng nhập.

Để chạy kiểm tra bằng Edge với một Vite server cục bộ:

```powershell
$env:UI_BROWSER_CHANNEL = 'msedge'
$env:REPORT_BROWSER_CHANNEL = 'msedge'
# Khi Playwright không được cài trong dự án, đặt UI_PLAYWRIGHT_MODULE và
# REPORT_PLAYWRIGHT_MODULE tới index.mjs của Playwright đã có trên máy.
node scripts/run-browser-tests.mjs scripts/test-glass-theme.mjs scripts/test-summary-consistency.mjs scripts/test-pagination-filters.mjs scripts/test-staff-payments.mjs scripts/test-auth-integration.mjs scripts/test-refunds-performance.mjs scripts/test-reports.mjs
```
