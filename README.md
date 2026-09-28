# AgriSage Management System

Hệ thống quản trị hợp nhất (Unified Dashboard) của nền tảng AgriSage, bao gồm 4 phân hệ chính (Modules):
- **Admin**: Quản trị viên hệ thống
- **Agent**: Đại lý vật tư nông nghiệp
- **Sales Staff**: Nhân viên bán hàng
- **Delivery Staff**: Nhân viên giao hàng

## Kiến trúc dự án (Feature-Sliced Design)
Dự án được xây dựng trên nền tảng **React + Vite + Tailwind CSS** và cấu trúc theo hướng **Feature-Based**.
Mọi tính năng, dịch vụ và dữ liệu của mỗi phân hệ đều được đóng gói gọn gàng trong thư mục `src/features/<tên-phân-hệ>`.

## Hướng dẫn cài đặt & chạy dự án

1. Cài đặt thư viện:
```bash
npm install
```

2. Khởi chạy máy chủ phát triển:
```bash
npm run dev
```

3. Truy cập vào trang đăng nhập:
Hệ thống sử dụng một trang đăng nhập duy nhất cho tất cả các vai trò. Tại màn hình đăng nhập, bạn có thể chọn vai trò (Role) tương ứng để hệ thống tự động điền email test và điều hướng vào đúng module của vai trò đó.
