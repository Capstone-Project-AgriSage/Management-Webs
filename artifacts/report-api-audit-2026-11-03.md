# Kiểm tra nguồn dữ liệu báo cáo — 03/11/2026

## Kết quả

Backend có 18 endpoint GET dưới `/api/reports/`. Sau khi bổ sung báo cáo bán hàng vào dashboard, đã quan sát frontend phát request cho đủ 18 endpoint qua các màn hình và nút xuất Excel, với tài khoản giả lập có quyền phù hợp. Các response được chặn và giả lập trong trình duyệt kiểm tra; đây là kiểm chứng luồng gọi và cách đọc dữ liệu, không phải đối soát số tiền trên database đang chạy. Backend và dữ liệu nghiệp vụ không thay đổi.

| Nhóm | Endpoint dưới `/api/reports/` đã quan sát |
| --- | --- |
| Đơn, thu/chi, nhập, trả, hoàn | `orders`, `payments`, `purchases`, `returns`, `refunds` |
| Giao hàng | `deliveries` |
| Công nợ, tín dụng | `debt-aging`, `debt-collections`, `debt-by-customer-group`, `credit-exposure` |
| Doanh thu dashboard | `revenue`, `revenue-summary` |
| Kho | `inventory-movement`, `inventory-valuation`, `inventory-turnover`, `inventory-movement/export` |
| Bán tại quầy | `counter-sales-today` |
| Lãi gộp và giá vốn trên dashboard | `sales` |

Đồng thời quan sát request `/api/inventory/expiry-risk` khi chọn tab Rủi ro hạn dùng; endpoint này nằm ngoài prefix reports.

## API còn thiếu đã được tích hợp

Trước khi sửa, `GET /api/reports/sales` chỉ có callsite trong cấu hình dự phòng không được dashboard có quyền báo cáo sử dụng. `DashboardCharts` hiện gọi API này qua hàng đợi tối đa ba request, cùng khoảng ngày trên bộ lọc. Ô Lãi gộp lấy `totals.grossProfit`, hiển thị thêm `totals.costOfGoods` và giải thích lãi trước trả hàng/chưa trừ chi phí vận hành. Các ô doanh thu và so sánh kỳ trước tiếp tục dùng revenue/revenue-summary.

Báo cáo sales được làm mới cùng dashboard; hủy kết quả cũ khi đổi kỳ; không gọi khi thiếu REPORTS.READ hoặc kỳ ngày không hợp lệ. Nếu sales lỗi, ô Lãi gộp hiển thị lỗi và dấu gạch, không thay bằng số từ summary. Kỳ trống hiển thị 0 thật. Luồng dùng chung cho Admin và Chủ cửa hàng.

## Bốn ô trong ảnh của người dùng

Nguồn: `src/features/products/ProductManagementPage.tsx:217`, `src/features/agent/reports/inlineReportConfig.ts:74`, `src/api/inventoryReportsApi.ts:63`.

| Ô | Nguồn |
| --- | --- |
| Đang kinh doanh trên trang | Đếm `data.items` có status ACTIVE từ trang API `/api/products` đang hiển thị |
| Kết quả tìm kiếm | `data.totalCount` từ cùng API danh sách sản phẩm |
| Giá trị tồn hiện tại | `totals.stockValue` từ `/api/reports/inventory-valuation` |
| Giá trị hàng hết hạn | `totals.expiredValue` từ `/api/reports/inventory-valuation` |

Đã kiểm tra đổi tìm kiếm sản phẩm làm đổi tổng kết quả nhưng không phát lại request định giá kho; hai ô định giá độc lập với bảng đang phân trang. Backend tính định giá từ InventoryLots/Balance, không nhận số tổng do frontend tự cộng.

## Các ô tổng hợp và dữ liệu mẫu khác

`ListReportCards` không tự gọi API báo cáo. Nó nhận `totalCount` và các chỉ số do màn hình tính từ response API danh sách; các chỉ số trang có ghi phạm vi trang đang hiển thị. Đây là dữ liệu API được tính tiếp ở frontend, không phải mock. Không dùng các chỉ số này thay cho tổng báo cáo toàn bộ dữ liệu.

Hai màn hình còn dùng dữ liệu mẫu đã xác nhận: quản lý bài viết (`contentService.ts`/`mockArticles`) và đánh giá sản phẩm (`mockReviews`); giao diện có thông báo dữ liệu mẫu.

## Giới hạn kiểm tra

`scripts/test-reports.mjs` đã được cập nhật theo dashboard và sidebar hiện tại, kiểm tra đủ 18 endpoint, xuất Excel, expiry risk, nguồn lãi gộp/giá vốn, đổi ngày/hủy request cũ, làm mới, lỗi riêng, kỳ trống, kỳ không hợp lệ, phân quyền, Admin và màn hình 390 px. Toàn bộ response là fixture kiểm thử. Chưa chạy gọi trực tiếp 18 endpoint trên backend thật và chưa xác nhận số 408.050.500 đồng với database.
