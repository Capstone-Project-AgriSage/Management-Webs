---
name: AgriSage Management
description: Tối giản, thực dụng và đáng tin cậy, tối ưu cho tốc độ xử lý dữ liệu.
colors:
  primary: "#16a34a"
  secondary: "#0f766e"
  tertiary: "#4d7c0f"
  surface: "#f8fcf8"
  surface-dim: "#d7ecd7"
  on-surface: "#173318"
  outline: "#758a75"
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
  base: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
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
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.base}"
    padding: "0.5rem 1rem"
---

# Design System: AgriSage Management

## Overview

**Creative North Star: "The Organic Command Center"**

Thiết kế mang lại cảm giác tự nhiên, dễ chịu nhưng vẫn cực kỳ chuyên nghiệp (Tự nhiên nhờ tone màu xanh nông nghiệp, chuyên nghiệp qua bố cục chặt chẽ). Hệ thống được tối ưu hóa sự thực dụng và đáng tin cậy. Mọi chi tiết thừa đều bị loại bỏ để đảm bảo luồng công việc của Quản trị viên không bị phân tâm, giúp tốc độ xử lý dữ liệu đạt mức tối đa. Không có các khối bóng đổ lớn hay gradient màu mè, thiết kế dựa trên sự chính xác của không gian và đường nét.

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
- **Mint Paper** (#f8fcf8): Màu nền chủ đạo (background/surface), cực nhẹ, tạo cảm giác thư giãn nhưng đủ độ tương phản với chữ.
- **Pine Dark** (#173318): Màu chữ chính (on-surface), xanh rêu cực đậm, mềm mại hơn màu đen tuyền (#000) nhưng vẫn đảm bảo độ đọc (readability).

### Named Rules
**The Green Ink Rule.** Không sử dụng màu đen thuần (#000000) hoặc xám lạnh (cool gray) cho văn bản. Mọi màu trung tính đều phải được pha một chút sắc xanh lá (tinted green) để giữ nguyên DNA "Organic".

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

Hệ thống sử dụng lưới 100% chiều rộng với Sidebar cố định (256px / 16rem). Các phần viền margin ở mobile là 1rem, tablet là 1.5rem và desktop là 2rem. Khoảng cách (spacing) sử dụng các bội số của 0.25rem (4px) tạo nên nhịp điệu đều đặn.

## Elevation & Depth

Hệ thống theo đuổi triết lý "Phẳng và Rõ ràng" (Flat & Crisp). Rất hạn chế sử dụng bóng đổ. 

### Named Rules
**The Flat-By-Default Rule.** Các bề mặt (Surfaces) luôn phẳng ở trạng thái nghỉ. Việc phân lớp được thực hiện bằng cách thay đổi màu nền (tonal layering) hoặc sử dụng đường viền mỏng (1px border), thay vì bóng đổ (shadows).

## Shapes

Ngôn ngữ hình khối gọn gàng, các góc được bo nhẹ (0.25rem - 0.5rem) đủ để tạo cảm giác thân thiện nhưng vẫn giữ được sự nghiêm túc của một phần mềm quản trị (không bo tròn quá lố).

## Components

### Buttons
- **Shape:** Bo góc nhẹ (0.25rem).
- **Primary:** Màu nền Agri-Green (#16a34a), chữ trắng.
- **Hover / Focus:** Không sử dụng bóng đổ lớn, chỉ thay đổi sắc độ nền tối đi hoặc sáng lên.

### Cards / Containers
- **Corner Style:** Bo góc vừa (0.375rem / 6px hoặc 0.5rem / 8px).
- **Background:** Nền Mint Paper (#f8fcf8) hoặc trắng (#ffffff).
- **Shadow Strategy:** Không sử dụng bóng đổ, dùng đường viền (border) màu `#758a75` với độ mờ (opacity) thấp.
- **Internal Padding:** 1rem (16px) hoặc 1.25rem (20px).

### Navigation (Sidebar)
- Sử dụng màu nền cực sáng (surface-container-lowest), điểm nhấn là các dải viền (border-left) hoặc icon đổi màu (màu Primary) khi được chọn (Active).

## Do's and Don'ts

### Do:
- **Do** sử dụng viền mỏng (border) để nhóm các dữ liệu có liên quan thay vì thả bóng đổ.
- **Do** sử dụng các biến CSS đã định nghĩa (`var(--color-...)`, `var(--spacing-...)`) thay vì hardcode giá trị hex.

### Don't:
- **Don't** sử dụng màu thuần xám (pure gray) hoặc đen (pure black). Mọi màu trung tính đều phải thuộc dải xanh (green-tinted).
- **Don't** tạo ra các thẻ (cards) nổi quá cao so với nền (không dùng drop-shadow lớn), trừ khi đó là các thành phần nổi (Dropdown, Modal).
