# Bài viết và liên hệ — 12/11/2026

Backend đã có entity/bảng nhưng chưa có API; màn bài viết trước đây chưa được route và dùng dữ liệu mẫu.
Hiện các màn sử dụng `src/api/contentApi.ts`, không dùng mock hoặc tự tạo số lượt xem/danh mục/trạng thái chờ duyệt.

| Màn hình | Quyền | API |
|---|---|---|
| `/admin/articles`, `/agent/articles` | ARTICLES.READ; ARTICLES.MANAGE để thay đổi | `/api/admin/articles` |
| Upload ảnh đại diện | ARTICLES.MANAGE | POST `/api/files/article-images`, multipart `file` |
| `/admin/contact-requests`, `/agent/contact-requests`, `/sales/contact-requests` | CONTACT_REQUESTS.READ; CONTACT_REQUESTS.MANAGE để phản hồi | `/api/contact-requests` |

Bài viết cần ảnh đại diện: JPG/PNG/WebP tối đa 3 MB, chọn/kéo từ máy, xem trước, đổi/xóa ảnh trước khi lưu.
Không thể lưu hoặc xuất bản bài thiếu ảnh. Nội dung là văn bản thuần giữ xuống dòng; ảnh thumbnail được hiển thị
ở danh sách quản lý, trang chủ Farmer, danh sách kiến thức và chi tiết bài viết.

Trạng thái bài: DRAFT / PUBLISHED / ARCHIVED. Chỉ PUBLISHED xuất hiện ở Farmer.
Liên hệ: OPEN / IN_PROGRESS / RESOLVED / CLOSED. RESOLVED yêu cầu phản hồi, Farmer đọc được phản hồi trong lịch sử.
Danh sách có tìm kiếm/lọc/phân trang server; tải lại sau thao tác, khi cửa sổ nhận focus và mỗi 30 giây khi trang hiện.

Contract đầy đủ: `Backend-Agrisage/docs/reference/api-flows/CONTENT_CONTACT.md`.
Migration bắt buộc: `20261112151319_ContentContactPermissions`, chỉ thêm quyền và quyền mặc định cho vai trò.
Không thay cấu trúc bảng articles/contact_requests, không cần bucket mới: dùng public image storage hiện có.

Kiểm tra:

```powershell
npx tsc -b --pretty false
npm run build
npm run lint
# Playwright có sẵn trong môi trường, hoặc trỏ UI_PLAYWRIGHT_MODULE tới playwright/index.mjs.
$env:UI_BROWSER_CHANNEL = 'chrome'
node scripts/test-content.mjs
```

Browser suite dùng production build và API giả lập: không ghi dữ liệu lên backend thật.
