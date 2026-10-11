# Đồng bộ API và giao diện quản lý — 11/10/2026

Kết quả rà soát toàn bộ HTTP action nằm trong [API_INTEGRATION_AUDIT.md](API_INTEGRATION_AUDIT.md), với chứng cứ endpoint/quyền/callsite trong [API_INTEGRATION_MATRIX.json](API_INTEGRATION_MATRIX.json). 251/290 API quản lý hoặc dùng chung có tham chiếu UI, 6 chỉ có wrapper, 33 chưa có wrapper. Không tính API riêng Farmer, webhook và công cụ mô phỏng thanh toán vào API cần hiển thị trên Management-Webs. Kiểm tra tĩnh chưa chứng minh server thật hoạt động đúng với mọi tài khoản.

## Giao diện đã sửa

- Trang danh sách và dashboard giữ một nhóm **4 ô**; bỏ nhóm báo cáo trùng trên tồn kho và công nợ. Kho theo sản phẩm giữ giá trị tồn, lô sắp hết hạn, lô hết hạn và sản phẩm sắp hết hàng. Xuất nhập tồn nằm ở trang biến động/báo cáo kho.
- Dùng `ListToolbar`, `FilterSelect`, `KpiCard` và lưới thống kê chung. Tìm kiếm hoặc đổi bộ lọc máy chủ đưa danh sách về trang 1; có nút xóa lọc.
- Menu thao tác được đo/clamp trong viewport, không bị vùng bảng cắt hoặc tự đóng khi khôi phục focus làm trang cuộn.
- Tổng số theo bộ lọc lấy từ `totalCount`. Chỉ số tính từ trang đang hiển thị ghi rõ phạm vi. Báo cáo theo kỳ giữ ngày bắt đầu/kết thúc và diễn giải phạm vi riêng.
- Thông báo và biến động kho có tìm trong trang hiện tại, vì backend không có Search. Không gửi query tự đặt hoặc đổi tổng phân trang thành số khớp cục bộ.
- Dashboard quản lý/bán hàng/giao hàng sử dụng API và kiểm tra quyền. Không đọc API báo cáo khi thiếu `REPORTS.READ`. Đếm chuyến của nhân viên giao hàng dùng tổng backend, không dùng số dòng trang đầu.
- Sửa catalog categories thành mảng cây đúng contract và đưa danh mục con vào bộ lọc. Sales Inventory sử dụng SKU/tên đã có trong DTO lô, bỏ lượt gọi catalog 100 sản phẩm dư.
- Accounts, Articles, ProductReviews vẫn ghi rõ dữ liệu mẫu vì chưa có API backend tương ứng. Trang cấu hình/quy trình/chi tiết chỉ hiện thông tin cần thao tác, không thêm 4 chỉ số vô nghĩa.

## API được nối bổ sung

- Nhân viên: xem, thêm, sửa, khóa, mở khóa, đặt lại mật khẩu và ghi nhận nghỉ việc; nút thao tác theo đúng permission.
- Thanh toán: sổ phiếu thực với tìm kiếm/lọc/phân trang; tạo liên kết payOS và đồng bộ trạng thái; hủy phiếu chờ hợp lệ; xác nhận/từ chối chuyển khoản trả công nợ. Tạo liên kết không đồng nghĩa đã thu tiền.
- Tài khoản: yêu cầu khôi phục, đặt lại/đổi mật khẩu, danh sách phiên, thu hồi phiên, đăng xuất toàn bộ và đăng xuất server. Sai mật khẩu hiện tại 401 được hiển thị tại form; response 202/204 rỗng được xử lý đúng.
- Giữ tối ưu hoàn tiền: cache 30 giây có giới hạn, hủy yêu cầu cũ, phân trang độc lập hai tab, tải phần còn thiếu và làm mới sau thao tác ghi.
- Tách thư viện biểu đồ của báo cáo công nợ/giao hàng để chỉ tải khi mở báo cáo chi tiết. Bundle JavaScript ban đầu giảm từ khoảng 404 KB xuống 288 KB gzip (29%); đây là kích thước build, không phải phép đo độ trễ API.

## Xác minh

TypeScript, Vite build và oxlint không báo lỗi. Vite còn cảnh báo bundle lớn (~1,14 MB trước gzip); chưa đo độ trễ server thật. Backend không thay đổi, không có migration.

Các kiểm thử trình duyệt dùng API giả lập hoàn toàn, không ghi dữ liệu cửa hàng:

- `test-summary-consistency.mjs`: 35 trang, 4 ô, danh mục con, cả hai tab báo cáo kho, tìm trong trang hiện tại, phân quyền, tổng vượt trang đầu và cảnh báo kho lỗi không bị biến thành số 0.
- `test-reports.mjs`: 13 kiểm tra, gồm đủ 15 API báo cáo, thay đổi ngày, hủy kết quả cũ, lỗi, kỳ rỗng và màn hình nhỏ.
- `test-pagination-filters.mjs`: 32 kiểm tra tìm kiếm/phân trang/bộ lọc và bản ghi thứ 121.
- `test-refunds-performance.mjs`: 9 kiểm tra lượt gọi, cache, hủy tải cũ, lỗi/thử lại và làm mới.
- `test-auth-integration.mjs`: 7 kiểm tra phiên đăng nhập, request mật khẩu, lỗi 401 và response rỗng.
- `test-staff-payments.mjs`: 9 nhóm kiểm tra request thực qua UI, phân quyền và lỗi server cho nhân viên/payOS/phiếu chuyển khoản, qua ở viewport 1280×720.

Chạy bằng runtime Playwright đã có trên máy:

```powershell
$env:UI_PLAYWRIGHT_MODULE = '<đường dẫn tới playwright/index.mjs>'
$env:REPORT_PLAYWRIGHT_MODULE = $env:UI_PLAYWRIGHT_MODULE
$env:UI_BROWSER_CHANNEL = 'msedge'
$env:REPORT_BROWSER_CHANNEL = 'msedge'
node scripts/run-browser-tests.mjs scripts/test-summary-consistency.mjs scripts/test-reports.mjs scripts/test-pagination-filters.mjs scripts/test-refunds-performance.mjs scripts/test-auth-integration.mjs scripts/test-staff-payments.mjs
```

Runner tự khởi động/dừng Vite ở cổng 5175; đổi bằng `UI_TEST_URL`. Ảnh kiểm tra nằm trong `artifacts/summary-consistency/` khi đặt `UI_SCREENSHOT_DIR`.
