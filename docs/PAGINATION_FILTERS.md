# Phân trang và bộ lọc danh sách

## Quy ước giao diện

- `LIST_PAGE_SIZE = 10` cho các danh sách chính và bảng báo cáo.
- `ListToolbar`: ô tìm kiếm bên trái, các bộ lọc tiếp theo, nút **Xóa lọc**, rồi các thao tác tạo/xuất được cấp quyền. Các điều khiển xuống hàng trên màn hình nhỏ.
- Tìm kiếm/lọc trả về trang 1; tìm kiếm dùng tham số API khi endpoint hỗ trợ. Không thêm ô tìm kiếm giả cho endpoint chỉ hỗ trợ trạng thái hoặc thời gian.
- Phân trang API sử dụng `page`, `pageSize`, `totalCount`, `totalPages`. Danh sách dữ liệu mẫu và báo cáo không có API phân trang dùng `usePagination`.

## Các nhóm đã cập nhật

- Bảng giá, chi tiết bảng giá, khách hàng, sản phẩm, sản phẩm tại quầy, nhà cung cấp, nhập hàng, trả hàng, kiểm kê, nhân sự, đơn hàng, thanh toán, công nợ, cấu hình tín dụng, nhật ký, thông báo, hàng đợi AI và giao hàng.
- Tồn kho tổng hợp, cảnh báo, danh sách lô mở rộng, lịch sử biến động kho; thẻ kho và các bảng báo cáo kho/công nợ chia 10 dòng dữ liệu mỗi trang. Dòng tổng và biểu đồ vẫn dùng toàn bộ kết quả báo cáo.
- Danh mục và hoạt chất Admin dùng API phân trang `/api/categories`, `/api/active-ingredients`, cùng các endpoint tạo/sửa/kích hoạt/ngừng/xóa đã có. Mã danh mục không đổi khi sửa; giữ nguyên danh mục cha và thứ tự hiện tại. Các trường dữ liệu mẫu không thuộc hợp đồng API được thay bằng dữ liệu thực.
- Mô hình AI dùng `/api/ai-models`, đăng ký manifest, kích hoạt/ngừng theo hợp đồng backend. Chính sách AI lấy từ `/api/ai-models/{id}/policies`, phân trang 10 dòng ở giao diện và thao tác qua endpoint đã có. Quyền ghi được kiểm tra theo từng hành động.
- Tài khoản Admin, bài viết và đánh giá sản phẩm vẫn dùng dịch vụ dữ liệu mẫu: backend chưa có endpoint tương ứng cho các danh sách này. Chúng được chia 10 dòng/trang tại giao diện. Menu thông báo Admin dùng API thông báo cá nhân như các vai trò khác.

## Giới hạn hợp đồng API

- Báo cáo kho, công nợ, thẻ kho chưa có `page/pageSize` ở backend; frontend chia dữ liệu trả về thành 10 dòng/trang. Báo cáo giao hàng chỉ hiển thị biểu đồ.
- API mô hình AI chỉ hỗ trợ `Status`. Khi tìm kiếm, frontend đọc các trang API 10 phần tử tới hết rồi lọc tên/ID/phiên bản, không giới hạn 100 dòng đầu. Chính sách AI là mảng theo mô hình; lựa chọn mô hình cũng đọc API từng trang 10 phần tử.
- Hoàn tiền chưa có endpoint danh sách chung. Các nguồn đơn hủy/trả hàng được gọi từng trang 10 phần tử rồi hợp nhất theo thứ tự backend. Để tạo trang N đúng thứ tự, có thể phải đọc đến trang N của mỗi nguồn. Tổng phân trang ở tab đơn hủy là số đơn nguồn; bộ lọc trạng thái khoản hoàn có thể khiến trang hiển thị dưới 10 dòng. Các KPI của tab này ghi rõ phạm vi trang.
- Truy vấn lựa chọn trong biểu mẫu, xuất CSV, tính toán công nợ và số đếm KPI giữ giới hạn riêng (ví dụ 100 hoặc 1); đây không phải danh sách chính đang phân trang.
- Không thay đổi schema, migration hay hợp đồng backend. Các màn hình Admin vừa nối dữ liệu thực cũng gọi đúng endpoint ghi của backend, không trộn thao tác dữ liệu mẫu với bản ghi thực.

## Xác minh

- TypeScript: `npx tsc --noEmit -p tsconfig.app.json`.
- Build: `npm run build` thành công; Vite còn cảnh báo kích thước bundle.
- Lint: không có lỗi, 77 cảnh báo trong toàn bộ `src`.
- `scripts/test-pagination-filters.mjs`: 32 trường hợp về danh sách/API/bố cục, hợp nhất nguồn, báo cáo và hợp đồng tạo/sửa danh mục. API được giả lập hoàn toàn, không đọc hoặc ghi dữ liệu cửa hàng thực.
- Kiểm tra bản ghi thứ 121 để phát hiện giới hạn lấy 100 dòng đầu; trang 2, tìm kiếm, xóa lọc, trang cuối, danh sách rỗng và màn hình 1024/768/375px.
- Ảnh kiểm tra: `artifacts/pagination-filters/toolbar-1440.png`, `price-lists-375.png`.

Chạy toàn bộ bộ kiểm tra mới khi Vite đang chạy ở `127.0.0.1:5173`:

```powershell
$env:UI_PLAYWRIGHT_MODULE = '<đường dẫn tới playwright/index.mjs>'
$env:UI_BROWSER_CHANNEL = 'msedge'
node scripts/test-pagination-filters.mjs
```

Đặt `UI_REPORT_ONLY=1` để chỉ chạy báo cáo, hoặc `UI_ADMIN_ONLY=1` để kiểm tra riêng API Admin. Thuật toán hợp nhất chạy trong cả hai chế độ.
