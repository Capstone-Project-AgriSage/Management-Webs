---
name: AgriSage Management
description: Tối giản, thực dụng và đáng tin cậy, tối ưu cho tốc độ xử lý dữ liệu.
colors:
  primary: "#16a34a"
  primary-dark: "#166534"
  secondary: "#0f766e"
  tertiary: "#4d7c0f"
  surface: "#ffffff"
  background: "#f8fafc"
  surface-dim: "#e2e8f0"
  on-surface: "#0f172a"
  on-surface-variant: "#64748b"
  outline: "#e2e8f0"
typography:
  display:
    fontFamily: "'Inter', sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: "44px"
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Inter', sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: "38px"
    letterSpacing: "-0.015em"
  body:
    fontFamily: "'Inter', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "'Inter', sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "0.01em"
rounded:
  sm: "0.125rem"
  base: "0.5rem"
  md: "0.625rem"
  lg: "0.75rem"
  full: "9999px"
spacing:
  sm: "0.5rem"
  md: "0.75rem"
  base: "1rem"
  lg: "1.25rem"
components:
  sidebar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label}"
  button-primary:
    backgroundColor: "{colors.primary-dark}"
    textColor: "#ffffff"
    rounded: "{rounded.base}"
    padding: "0.5rem 1rem"
---

# Design System: AgriSage Management

## Overview

**Định hướng: Bảng điều hành nông nghiệp rõ ràng, hiện đại**

Thiết kế tham khảo [Kisan Setu](https://github.com/Dragonarya/Kisan-Setu), dùng nền xám nhạt, thẻ trắng, viền mảnh và điểm nhấn xanh của AgriSage. Khoảng cách thoáng, chữ rõ và bóng nhẹ giúp phân cấp dữ liệu. Chỉ thay đổi lớp trình bày; hợp đồng API, menu, routes, phân quyền và nghiệp vụ được giữ nguyên.

**Key Characteristics:**
- **Thực dụng (Pragmatic):** Thiết kế phục vụ chức năng; không có trang trí dư thừa.
- **Dễ chịu (Organic):** Sử dụng các sắc xanh làm nền tảng giúp giảm mỏi mắt khi làm việc lâu.
- **Rõ ràng (Crisp):** Cấu trúc lưới và các đường viền rõ ràng.

## Colors

Bảng màu mang hơi hướng thiên nhiên, tĩnh lặng, sử dụng nhiều sắc độ của màu xanh lá (Green) và xanh ngọc (Teal) để phân cấp thông tin.

### Primary
- **Agri-Green** (#16a34a): Sử dụng cho các hành động chính (Primary buttons), các chỉ báo trạng thái tích cực và các điểm nhấn quan trọng nhất.

### Secondary
- **Deep Teal** (#0f766e): Sử dụng cho các thành phần mang tính bổ trợ nhưng cần sự chú ý, hoặc các thẻ thông tin phụ (Warning/Info).

### Tertiary
- **Olive Accent** (#4d7c0f): Sử dụng làm điểm nhấn đa dạng hoặc các trạng thái thứ cấp.

### Neutral
- **Nền** (#f8fafc): Khung nội dung và hàng tiêu đề bảng.
- **Bề mặt** (#ffffff): Thẻ, sidebar và biểu mẫu.
- **Chữ chính** (#0f172a), **chữ phụ** (#64748b): Phân cấp nội dung.
- **Viền** (#e2e8f0): Phân tách nhẹ giữa các vùng dữ liệu.
- **Xanh đậm** (#166534), **xanh nhạt** (#dcfce7): Menu đang chọn và trạng thái tích cực.

### Named Rules
**Quy tắc màu.** Màu xanh dành cho thương hiệu, hành động chính và trạng thái tích cực. Dùng màu slate cho chữ và nền để dữ liệu dễ đọc. Màu cảnh báo/lỗi giữ nguyên ý nghĩa trạng thái hiện có.

## Typography

**Display Font:** Inter
**Body Font:** Inter
**Label Font:** Inter

**Character:** Hiện đại, dễ đọc trên màn hình kỹ thuật số, các con số được hiển thị rõ ràng.

### Hierarchy
- **Display** (700, 36px, 44px): Dành cho các tiêu đề lớn nhất (Dashboard heroes).
- **Headline** (600, 30px, 38px): Dành cho tiêu đề các trang chính, phần tử phân tách khối.
- **Title** (600, 16px, 22px): Dành cho tiêu đề các thẻ (Cards), bảng (Tables).
- **Body** (400, 14px, 20px): Dành cho nội dung chính, văn bản dài, miêu tả.
- **Label** (500, 13px, 18px): Dành cho các nút bấm, thẻ badge, và menu điều hướng.

### Named Rules
**The Tabular Data Rule.** Tất cả các con số trong bảng biểu và báo cáo phải sử dụng tính năng `tabular-nums` để các chữ số được canh thẳng hàng hoàn hảo.

## Layout

Sidebar cố định 264px, thu gọn còn 80px từ 1024px. Dưới 1024px dùng drawer có khóa cuộn, hỗ trợ Tab/Escape và trả focus về nút mở. Header sticky cao tối thiểu 76px (64px trên mobile). Nội dung tối đa 1440px, padding desktop 24px, tablet 20px, mobile 12px ngang/16px dọc. Bảng cuộn ngang trong vùng riêng. Không thay đổi cấu hình menu theo vai trò.

## Elevation & Depth

Ưu tiên bề mặt trắng, viền rõ và bóng nhẹ. Dropdown/modal dùng bóng nổi hơn để dễ nhận biết.

### Named Rules
**Quy tắc độ nổi.** Thẻ dùng viền 1px và bóng nhẹ; không dùng chuyển động nặng. Tôn trọng `prefers-reduced-motion`.

## Shapes

Trường nhập và nút bo góc 8–10px, thẻ 12px, modal 12–16px. Badge trạng thái bo tròn. Các giá trị bo góc đặc thù của thành phần được khai báo tại thành phần.

## Components

### Buttons
- **Shape:** Bo góc 8–10px, kích thước thao tác rõ ràng.
- **Primary:** Nền xanh đậm (#166534), chữ trắng để đạt độ tương phản cho nhãn nhỏ. #16a34a dùng cho điểm nhấn thương hiệu và icon.
- **Hover / Focus:** Không sử dụng bóng đổ lớn, chỉ thay đổi sắc độ nền tối đi hoặc sáng lên.

### Cards / Containers
- **Corner Style:** Bo góc 12px.
- **Background:** Trắng (#ffffff) trên nền #f8fafc.
- **Shadow Strategy:** Viền #e2e8f0, bóng nhẹ.
- **Internal Padding:** 20px, linh hoạt trên mobile.

### Navigation (Sidebar)
- Sử dụng màu nền cực sáng (surface-container-lowest), điểm nhấn là các dải viền (border-left) hoặc icon đổi màu (màu Primary) khi được chọn (Active).

## Do's and Don'ts

### Do:
- **Do** sử dụng viền mỏng (border) để nhóm các dữ liệu có liên quan thay vì thả bóng đổ.
- **Do** sử dụng các biến CSS đã định nghĩa (`var(--color-...)`, `var(--spacing-...)`) thay vì hardcode giá trị hex.

### Don't:
- **Don't** dùng màu xanh cho toàn bộ chữ và bề mặt; giữ độ tương phản rõ giữa nội dung và điểm nhấn.
- **Don't** tạo ra các thẻ (cards) nổi quá cao so với nền (không dùng drop-shadow lớn), trừ khi đó là các thành phần nổi (Dropdown, Modal).
