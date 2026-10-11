# Giao diện AgriSage theo mẫu kính mờ

Áp dụng chung cho Management-Webs, gồm các vai trò quản trị, chủ cửa hàng, nhân viên bán hàng và giao hàng. Sidebar, thanh trên, bộ lọc, thẻ thống kê, bảng, menu thao tác, hộp thoại và các trang đăng nhập/khôi phục mật khẩu sử dụng cùng lớp thiết kế tại `src/styles/glass-theme.css`.

## Bố cục và dữ liệu

- Nền ruộng lúa xanh, ánh sáng kem, các khối kính mờ và nút xanh. Bảng có từng hàng bo góc, trạng thái có màu và biểu tượng; chữ trạng thái vẫn được giữ nguyên.
- Bốn ô thống kê trên desktop; bố cục 2 × 2 trên điện thoại. Giá trị dài được xuống dòng trong ô; bảng rộng cuộn bên trong thay vì làm tràn toàn trang.
- Đường xu hướng là SVG nhẹ, lấy các dòng báo cáo đã trả về từ API hiện có. Không thêm thư viện biểu đồ, không thêm lượt gọi API cho xu hướng.
- Dòng báo cáo được hiển thị theo thứ tự API. Các báo cáo ngày về bán hàng, đơn hàng, nhập hàng, thanh toán, trả hàng và hoàn tiền trả về thứ tự ngày tăng dần. Một số báo cáo chỉ chứa ngày có phát sinh; các đường nhỏ mô tả chuỗi quan sát đó, không thay thế biểu đồ có trục ngày.
- Khi ít hơn hai điểm hoặc có giá trị không hữu hạn, không vẽ đường. Giá trị tổng hợp vẫn lấy từ `totals`. Không vẽ xu hướng giá trị đơn trung bình nếu API doanh thu mới trả một phần các ngày trong kỳ.
- Không thêm xu hướng cho chỉ số API chỉ cung cấp tổng. Số liệu không có quyền xem hoặc tải lỗi vẫn hiện trạng thái tương ứng.
- Giữ nguyên hợp đồng API, phân quyền, tìm kiếm, bộ lọc, phân trang và cache hoàn tiền đã có. Không thay đổi backend hoặc database/migration.

## Hiệu ứng và khả năng đọc

Chỉ các pane chính dùng `backdrop-filter`; từng ô bảng dùng màu nền trong suốt, không làm mờ riêng mỗi ô. Mobile tăng độ phủ sáng của ảnh nền để ghi chú ngoài thẻ vẫn đọc được. Hộp thoại có nền gần đặc để biểu mẫu rõ ràng; viền lỗi `aria-invalid` được giữ lại. Hệ thống tôn trọng `prefers-reduced-motion` và `prefers-reduced-transparency`.

## Ảnh nền và prompt cuối

- Công cụ: **Imagegen tích hợp** (`image_gen.imagegen`), tạo ảnh mới; không dùng CLI fallback.
- Tệp dùng trong web: `public/images/farmland-dawn-v1.jpg`, 1672 × 940, **116.644 byte**, JPEG chất lượng 78. Chỉ chuyển định dạng/nén từ bản PNG gốc, không sửa nội dung ảnh sau khi sinh.
- PNG gốc: `C:/Users/thinh/.codex/generated_images/01a12973-38e4-7843-a431-b6fd8f384c5e/exec-dcb09760-e084-4694-8f7d-8e1171d3de8b.png`.

Prompt đã gửi nguyên văn:

```text
Use case: photorealistic-natural. Asset type: wide background photograph for an agricultural management web application, not a UI mockup. Create a cinematic 16:9 landscape of lush green Vietnamese rice fields with neat cultivated rows at warm early morning golden light. A softly out-of-focus tall wind turbine stands at the far right edge and faint smaller turbines in the distant horizon. Composition leaves the left half and upper center very calm, pale mint-green atmospheric haze, with warm cream sunlight on the upper right and green fields visible mainly lower right. Low contrast, soft focus and natural shallow depth of field suitable behind translucent glass interface cards, refined quiet photographic look. No text, no interface, no cards, no logos, no people, no watermark. Landscape format.
```

## Kiểm tra và ảnh xem trước

### Điều chỉnh bộ lọc theo phản hồi

- Đơn hàng có nhãn “Từ ngày”, “Đến ngày” bên trong ô lịch. Bộ lọc kho dùng cùng ô lịch và bỏ các tiêu đề ngoài bị lặp.
- Ô nhà cung cấp dùng cùng chiều cao và khoảng cách nhãn/giá trị với các bộ lọc khác.
- Hoàn tiền có ba danh sách chọn: nguồn hoàn, trạng thái nguồn và phạm vi hoàn; công nợ dùng danh sách chọn tình trạng quá hạn. Thay đổi lựa chọn vẫn gửi tham số API hiện có và đưa danh sách về trang đầu.
- Biểu tượng menu chỉ xanh khi đường dẫn đang được chọn; Tổng quan trỏ về trang tổng quan của đúng vai trò. Thanh tab công nợ cuộn trong khung trên điện thoại.
- `test-summary-consistency.mjs` kiểm tra thêm nhãn ngày, khoảng cách ô nhà cung cấp, tham số API hoàn tiền/công nợ, màu menu và độ rộng trang ở 390 px. Ảnh xem trước bộ lọc nằm trong `artifacts/filter-corrections/`.

Kiểm tra trình duyệt sử dụng API giả lập, không gọi backend cửa hàng thật. Ảnh chụp dùng dữ liệu kiểm thử, không phải số liệu kinh doanh.

- `test-summary-consistency.mjs`: 35 trang/đường dẫn và kiểm tra phạm vi số liệu, phân quyền, API lỗi; bốn ô trên các trang.
- `test-glass-theme.mjs`: 9 nhóm gồm số điểm SVG chính xác, dữ liệu trống/âm/phẳng, không vẽ chuỗi bị phân trang, số request không tăng, ảnh dưới 150 KB, màu trạng thái, tìm kiếm/bộ lọc/phân trang, hộp thoại, viền lỗi, giảm hiệu ứng, desktop/tablet/phone 1440/1024/768/390 px, menu điện thoại và ba trang xác thực.
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
