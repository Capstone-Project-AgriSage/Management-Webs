# Quản lý danh mục sản phẩm và thương hiệu

Menu của Admin và Chủ cửa hàng có hai màn hình riêng:

| Màn hình | Admin | Chủ cửa hàng | Quyền xem |
| --- | --- | --- | --- |
| Danh mục sản phẩm | `/admin/products/categories` | `/agent/products/categories` | `CATEGORIES.READ` |
| Thương hiệu | `/admin/products/brands` | `/agent/products/brands` | `BRANDS.READ` |

Mỗi màn hình hỗ trợ tìm theo mã/tên, lọc trạng thái, phân trang từ API,
thêm, sửa, kích hoạt, ngừng hoạt động và xác nhận xóa. Các thao tác trên
bản ghi nằm trong menu `⋮`, theo các quyền `CREATE`, `UPDATE`, `ACTIVATE`,
`DEACTIVATE`, `DELETE` của từng nhóm. Quyền xem độc lập với `PRODUCTS.READ`.

- Danh mục dùng `/api/categories`: mã bắt buộc khi tạo và cố định sau khi tạo.
  Vị trí trên biểu mẫu là số bắt đầu từ 1; để trống sẽ xếp cuối. API lưu vị trí
  zero-based, tự chèn và dồn các danh mục phía sau. Kéo thả gọi
  `POST /api/categories/{id}/reorder`; xóa sẽ đánh lại vị trí các danh mục còn lại.
- Thương hiệu dùng `/api/brands`: mã không bắt buộc, mô tả có thể để trống.
  Logo dùng chung `POST /api/files/product-images` (JPG/PNG/WebP tối đa 3 MB),
  được lưu vào Supabase Storage và URL được lưu ở `brands.logo_url`.
- API từ chối xóa danh mục còn danh mục con/sản phẩm hoặc thương hiệu còn
  sản phẩm. Thông báo lỗi được hiển thị và hộp xác nhận vẫn mở để xử lý lại.
- Khi đang lưu, khóa các trường và nút của biểu mẫu, đồng thời chặn gửi lặp.

## Kiểm tra

```powershell
npx tsc -b --pretty false
npm run build
npm run lint
node scripts/run-browser-tests.mjs scripts/test-product-catalogs.mjs
```

Kiểm thử trình duyệt dùng API giả lập, không thay đổi dữ liệu thật. Nếu
Playwright nằm ngoài dự án, đặt `UI_PLAYWRIGHT_MODULE` tới `playwright/index.mjs`
và `UI_BROWSER_CHANNEL` tới trình duyệt đã cài, ví dụ `chrome`.

Có thể kiểm thử bản build mà không mở máy chủ HTTP:

```powershell
$env:UI_TEST_DIST = (Resolve-Path dist).Path
node scripts/test-product-catalogs.mjs
```

Đặt `UI_SCREENSHOT_DIR` để lưu ảnh danh sách và biểu mẫu trên màn hình 390px.
Các ca kiểm tra bao gồm thao tác CRUD, tìm kiếm/phân trang, bộ lọc, trạng thái
đang lưu, lỗi API/thử lại, quyền truy cập và bố cục trên điện thoại.
