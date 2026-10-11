# Rà soát kết nối Backend → Management-Webs

Ngày: **11/10/2026**. Nguồn HTTP: code hiện tại trong `D:/Test/Backend-Agrisage/src/AgriSage.Api`; nguồn frontend: `src/api` và callsite trong đồ thị import của `src/main.tsx`.

**Chưa tích hợp tất cả API backend vào trang quản lý.** Backend có 330 HTTP action trong 59 controller; 290 action dùng cho quản lý/nhân viên hoặc xác thực dùng chung. 38 action dành cho Farmer (kể cả đăng ký), 1 webhook của payOS và 1 action mô phỏng thanh toán trong Development được tách khỏi số API quản lý cần xét.

| Phạm vi quản lý/xác thực chung | Số HTTP action |
| --- | ---: |
| Có wrapper và tham chiếu từ UI đang được import | 251 |
| Có wrapper nhưng chưa thấy callsite UI | 6 |
| Chưa có wrapper | 33 |
| Tổng | 290 |

Có **0** wrapper lệch HTTP method/route so với controller. Cả 15 route `/api/reports/*` đều có tham chiếu từ UI. Đây là kiểm tra tĩnh theo method/route và tham chiếu code; chưa chứng minh request thành công trên server thật, đúng quyền của từng tài khoản, hoặc mọi trường DTO đều tương thích. Một wrapper được UI truyền vào callback cũng được tính là có callsite.

## Các phần còn thiếu cần phân biệt

- **Tính năng quản lý chưa có UI:** quản lý thương hiệu; chỉnh quy cách đóng gói của sản phẩm đã tồn tại và liên kết hoạt chất; SKU/mức tồn tối thiểu riêng của cửa hàng và gỡ sản phẩm khỏi cửa hàng; cấu hình bệnh và phác đồ điều trị; thêm dòng vào phiếu trả sau khi tạo. Xem danh sách route còn thiếu bên dưới để xác định phần vẫn chưa tích hợp ở checkout hiện tại.
- **Bảo mật tài khoản:** API refresh và xác minh email/điện thoại chỉ có backend khi chưa xuất hiện trong bảng callsite. Không đồng nghĩa với đăng nhập bị lỗi; hiện frontend có thể sử dụng access token và yêu cầu đăng nhập lại khi hết hạn.
- **API đọc thay thế:** một số route lấy riêng từng bản ghi chưa được gọi vì UI đã nhận dữ liệu từ danh sách hoặc DTO chi tiết cha. Ví dụ nợ theo khách có thể dùng `GET /api/debt-entries?FarmerProfileId=...`; lượt giao đã nằm trong chi tiết chuyến; reservation có thể đọc qua gợi ý FEFO. Không tạo request dư chỉ để tăng tỷ lệ bao phủ.
- **Dành cho ứng dụng Farmer:** `/api/me/cart`, profile/addresses, orders, deliveries, credit/debt, payments và diagnosis/returns của Farmer không được coi là thiếu của Management-Webs. `/api/me/notifications` và `/api/me/permissions` vẫn thuộc phạm vi dùng chung và đã tính trong quản lý.
- **Provider/Development:** payOS tự gọi webhook. `simulate-paid` chỉ dành cho môi trường Development, không cần nút tác vụ trên trang quản lý thật.

## Dữ liệu giao diện chưa đồng bộ server

Các file mock vẫn nằm trong đồ thị import của các màn hình hiện tại:

- `src/features/admin/data/mockAccounts.ts`
- `src/features/admin/data/mockContentAndSystem.ts`
- `src/features/agent/data/mockReviews.ts`

Trang Accounts, Articles và ProductReviews dùng dữ liệu mẫu nếu các nguồn tương ứng ở trên vẫn còn được import. Backend hiện không có controller quản trị tài khoản toàn hệ thống, bài viết hay đánh giá sản phẩm để thay thế trực tiếp các nguồn đó. Đây là thiếu chức năng/contract backend + frontend, khác với việc bỏ quên một API đã tồn tại. Các biểu đồ hoặc bảng của dashboard phải kiểm tra nguồn riêng, không suy từ việc đã có một nhóm thẻ báo cáo thật.

## Tìm kiếm, lọc và phân trang

`NotificationListRequest` chỉ hỗ trợ Status + pagination. `StockMovementListRequest` hỗ trợ Type, FromDate, ToDate, GoodsReceiptId + pagination. `AiModelListRequest` không có Search. Các trang này cần tìm kiếm client có phạm vi rõ ràng hoặc thay đổi contract được duyệt; gửi tham số Search tự đặt không làm server tìm kiếm. Dữ liệu tổng trên server và số đếm của trang đang mở cần có nhãn riêng.

`GET /api/catalog/categories` trả **mảng cây** CategoryTreeNode có Children, không trả Paged. Các ô chọn cần duyệt cả Children nếu muốn chọn danh mục con. `InventoryLotResponse` đã chứa Sku/ProductName; tải lại toàn bộ catalog chỉ để hiển thị tên lô sẽ tạo thêm request và có thể thiếu sản phẩm không còn bán.

## Route quản lý chưa có wrapper

| Method | Route | Nguồn backend |
| --- | --- | --- |
| POST | `/api/auth/refresh` | `src/AgriSage.Api/Features/Auth/AuthSecurityController.cs:17` |
| POST | `/api/auth/email-verification/request` | `src/AgriSage.Api/Features/Auth/AuthSecurityController.cs:40` |
| POST | `/api/auth/email-verification/confirm` | `src/AgriSage.Api/Features/Auth/AuthSecurityController.cs:44` |
| POST | `/api/auth/phone-verification/request` | `src/AgriSage.Api/Features/Auth/AuthSecurityController.cs:48` |
| POST | `/api/auth/phone-verification/confirm` | `src/AgriSage.Api/Features/Auth/AuthSecurityController.cs:52` |
| GET | `/api/customers/{farmerProfileId:guid}/debt/entries` | `src/AgriSage.Api/Features/Debt/DebtController.cs:22` |
| GET | `/api/deliveries/{id:guid}/attempts` | `src/AgriSage.Api/Features/Deliveries/DeliveryAttemptsController.cs:22` |
| GET | `/api/ai-models/{id:guid}` | `src/AgriSage.Api/Features/Diagnosis/AiModelsController.cs:19` |
| PUT | `/api/diseases/{id:guid}` | `src/AgriSage.Api/Features/Diagnosis/DiseasesController.cs:19` |
| POST | `/api/diseases/{id:guid}/treatments` | `src/AgriSage.Api/Features/Diagnosis/DiseasesController.cs:25` |
| PUT | `/api/disease-treatments/{id:guid}` | `src/AgriSage.Api/Features/Diagnosis/DiseasesController.cs:40` |
| POST | `/api/disease-treatments/{id:guid}/activate` | `src/AgriSage.Api/Features/Diagnosis/DiseasesController.cs:45` |
| DELETE | `/api/disease-treatments/{id:guid}` | `src/AgriSage.Api/Features/Diagnosis/DiseasesController.cs:50` |
| DELETE | `/api/files/delivery-proofs` | `src/AgriSage.Api/Features/Files/FilesController.cs:60` |
| GET | `/api/orders/{id:guid}/reservation` | `src/AgriSage.Api/Features/Orders/OrderConfirmationController.cs:32` |
| GET | `/api/price-lists/{id:guid}` | `src/AgriSage.Api/Features/Pricing/PriceListsController.cs:20` |
| GET | `/api/active-ingredients/{id:guid}` | `src/AgriSage.Api/Features/Products/ActiveIngredientsController.cs:21` |
| GET | `/api/brands/{id:guid}` | `src/AgriSage.Api/Features/Products/BrandsController.cs:21` |
| POST | `/api/brands` | `src/AgriSage.Api/Features/Products/BrandsController.cs:25` |
| PUT | `/api/brands/{id:guid}` | `src/AgriSage.Api/Features/Products/BrandsController.cs:35` |
| POST | `/api/brands/{id:guid}/activate` | `src/AgriSage.Api/Features/Products/BrandsController.cs:40` |
| POST | `/api/brands/{id:guid}/deactivate` | `src/AgriSage.Api/Features/Products/BrandsController.cs:49` |
| DELETE | `/api/brands/{id:guid}` | `src/AgriSage.Api/Features/Products/BrandsController.cs:59` |
| GET | `/api/catalog/brands` | `src/AgriSage.Api/Features/Products/CatalogController.cs:24` |
| GET | `/api/categories/tree` | `src/AgriSage.Api/Features/Products/CategoriesController.cs:22` |
| GET | `/api/categories/{id:guid}` | `src/AgriSage.Api/Features/Products/CategoriesController.cs:26` |
| POST | `/api/products/{id:guid}/packagings` | `src/AgriSage.Api/Features/Products/ProductsController.cs:58` |
| PUT | `/api/products/{id:guid}/packagings/{packagingId:guid}` | `src/AgriSage.Api/Features/Products/ProductsController.cs:64` |
| DELETE | `/api/products/{id:guid}/packagings/{packagingId:guid}` | `src/AgriSage.Api/Features/Products/ProductsController.cs:70` |
| PUT | `/api/products/{id:guid}/ingredients` | `src/AgriSage.Api/Features/Products/ProductsController.cs:77` |
| PUT | `/api/store-products/{id:guid}` | `src/AgriSage.Api/Features/Products/StoreProductsController.cs:36` |
| DELETE | `/api/store-products/{id:guid}` | `src/AgriSage.Api/Features/Products/StoreProductsController.cs:79` |
| POST | `/api/returns/{id:guid}/items` | `src/AgriSage.Api/Features/Returns/SalesReturnsController.cs:28` |

## Wrapper chưa thấy callsite UI

| Method | Route | Nguồn backend |
| --- | --- | --- |
| GET | `/api/credit-tiers/{id:guid}` | `src/AgriSage.Api/Features/Customers/CreditTiersController.cs:17` |
| GET | `/api/customer-groups/{id:guid}` | `src/AgriSage.Api/Features/Customers/CustomerGroupsController.cs:16` |
| GET | `/api/customers/{farmerProfileId:guid}/debts` | `src/AgriSage.Api/Features/Customers/CustomersController.cs:44` |
| GET | `/api/debt-entries/{id:guid}/payments` | `src/AgriSage.Api/Features/Debt/DebtController.cs:29` |
| GET | `/api/debt-entries/{id:guid}/ledger` | `src/AgriSage.Api/Features/Debt/DebtController.cs:31` |
| GET | `/api/suppliers/{id:guid}` | `src/AgriSage.Api/Features/Suppliers/SuppliersController.cs:20` |

## Ma trận toàn bộ HTTP action

| Method | Route backend | Tích hợp | Wrapper | Callsite UI |
| --- | --- | --- | --- | --- |
| GET | `/api/audit-logs` | Có UI gọi | `auditLogsApi.list` | `src/features/admin/system/AuditLogsPage.tsx:92`<br>`src/features/admin/system/AuditLogsPage.tsx:172` |
| GET | `/api/audit-logs/{id:guid}` | Có UI gọi | `auditLogsApi.get` | `src/features/admin/system/AuditLogsPage.tsx:115` |
| POST | `/api/auth/register` | Farmer | — | — |
| POST | `/api/auth/login` | Có UI gọi | `authApi.login` | `src/context/AuthContext.tsx:67` |
| POST | `/api/auth/change-password` | Có UI gọi | `authApi.changePassword` | `src/features/auth/AccountSettings.tsx:30` |
| GET | `/api/auth/me` | Có UI gọi | `authApi.me` | `src/context/AuthContext.tsx:44` |
| POST | `/api/auth/refresh` | Chưa có wrapper | — | — |
| POST | `/api/auth/logout` | Có UI gọi | `authApi.logout` | `src/context/AuthContext.tsx:87` |
| POST | `/api/auth/logout-all` | Có UI gọi | `authApi.logoutAll` | `src/features/auth/AccountSettings.tsx:47` |
| GET | `/api/auth/sessions` | Có UI gọi | `authApi.sessions` | `src/features/auth/AccountSettings.tsx:20` |
| DELETE | `/api/auth/sessions/{id:guid}` | Có UI gọi | `authApi.revokeSession` | `src/features/auth/AccountSettings.tsx:40` |
| POST | `/api/auth/forgot-password` | Có UI gọi | `authApi.forgotPassword` | `src/features/auth/ForgotPasswordPage.tsx:17` |
| POST | `/api/auth/reset-password` | Có UI gọi | `authApi.resetPassword` | `src/features/auth/ResetPasswordPage.tsx:19` |
| POST | `/api/auth/email-verification/request` | Chưa có wrapper | — | — |
| POST | `/api/auth/email-verification/confirm` | Chưa có wrapper | — | — |
| POST | `/api/auth/phone-verification/request` | Chưa có wrapper | — | — |
| POST | `/api/auth/phone-verification/confirm` | Chưa có wrapper | — | — |
| GET | `/api/me/cart` | Farmer | — | — |
| POST | `/api/me/cart/items` | Farmer | — | — |
| PUT | `/api/me/cart/items/{itemId:guid}` | Farmer | — | — |
| DELETE | `/api/me/cart/items/{itemId:guid}` | Farmer | — | — |
| DELETE | `/api/me/cart` | Farmer | — | — |
| POST | `/api/customers/{farmerProfileId:guid}/credit-eligibility` | Có UI gọi | `customerCreditApi.checkEligibility` | `src/features/customers/CreditPanel.tsx:152` |
| GET | `/api/credit-tiers` | Có UI gọi | `creditTiersApi.getCreditTiers` | `src/features/admin/credit-config/CreditConfigPage.tsx:99`<br>`src/features/admin/credit-config/CreditConfigPage.tsx:123`<br>`src/features/customers/CustomersPage.tsx:62`<br>`src/features/sales/counter-sales/CustomerSection.tsx:38` |
| GET | `/api/credit-tiers/{id:guid}` | Chỉ có wrapper | `creditTiersApi.getCreditTierById` | — |
| POST | `/api/credit-tiers` | Có UI gọi | `creditTiersApi.createCreditTier` | `src/features/admin/credit-config/CreditConfigPage.tsx:257` |
| PUT | `/api/credit-tiers/{id:guid}` | Có UI gọi | `creditTiersApi.updateCreditTier` | `src/features/admin/credit-config/CreditConfigPage.tsx:282` |
| POST | `/api/credit-tiers/{id:guid}/activate` | Có UI gọi | `creditTiersApi.activateCreditTier` | `src/features/admin/credit-config/CreditConfigPage.tsx:179` |
| POST | `/api/credit-tiers/{id:guid}/deactivate` | Có UI gọi | `creditTiersApi.deactivateCreditTier` | `src/features/admin/credit-config/CreditConfigPage.tsx:178` |
| GET | `/api/customers/{farmerProfileId:guid}/credit` | Có UI gọi | `customerCreditApi.getCredit` | `src/features/customers/CreditPanel.tsx:48`<br>`src/features/sales/counter-sales/CustomerSection.tsx:48` |
| POST | `/api/customers/{farmerProfileId:guid}/credit` | Có UI gọi | `customerCreditApi.createCredit` | `src/features/customers/CreditPanel.tsx:106` |
| PUT | `/api/customers/{farmerProfileId:guid}/credit/limit` | Có UI gọi | `customerCreditApi.changeLimit` | `src/features/customers/CreditPanel.tsx:123` |
| POST | `/api/customers/{farmerProfileId:guid}/credit/activate` | Có UI gọi | `customerCreditApi.activate` | `src/features/customers/CreditPanel.tsx:139` |
| POST | `/api/customers/{farmerProfileId:guid}/credit/suspend` | Có UI gọi | `customerCreditApi.suspend` | `src/features/customers/CreditPanel.tsx:139` |
| POST | `/api/customers/{farmerProfileId:guid}/credit/block` | Có UI gọi | `customerCreditApi.block` | `src/features/customers/CreditPanel.tsx:139` |
| GET | `/api/customers/{farmerProfileId:guid}/credit/history` | Có UI gọi | `customerCreditApi.getHistory` | `src/features/customers/CreditPanel.tsx:52` |
| GET | `/api/customers/{farmerProfileId:guid}/credit/reservations` | Có UI gọi | `customerCreditApi.getReservations` | `src/features/customers/CreditPanel.tsx:53` |
| GET | `/api/customer-groups` | Có UI gọi | `customerGroupsApi.getCustomerGroups` | `src/features/admin/credit-config/CreditConfigPage.tsx:100`<br>`src/features/admin/credit-config/CreditConfigPage.tsx:130`<br>`src/features/customers/CustomersPage.tsx:61`<br>`src/features/sales/counter-sales/CustomerSection.tsx:37` |
| GET | `/api/customer-groups/{id:guid}` | Chỉ có wrapper | `customerGroupsApi.getCustomerGroup` | — |
| POST | `/api/customer-groups` | Có UI gọi | `customerGroupsApi.createCustomerGroup` | `src/features/admin/credit-config/CreditConfigPage.tsx:207` |
| PUT | `/api/customer-groups/{id:guid}` | Có UI gọi | `customerGroupsApi.updateCustomerGroup` | `src/features/admin/credit-config/CreditConfigPage.tsx:216` |
| POST | `/api/customer-groups/{id:guid}/activate` | Có UI gọi | `customerGroupsApi.activate` | `src/features/admin/credit-config/CreditConfigPage.tsx:169` |
| POST | `/api/customer-groups/{id:guid}/deactivate` | Có UI gọi | `customerGroupsApi.deactivate` | `src/features/admin/credit-config/CreditConfigPage.tsx:168` |
| POST | `/api/customer-groups/{id:guid}/set-default` | Có UI gọi | `customerGroupsApi.setDefault` | `src/features/admin/credit-config/CreditConfigPage.tsx:163` |
| PUT | `/api/customer-groups/{id:guid}/credit-tier` | Có UI gọi | `customerGroupsApi.setGroupCreditTier` | `src/features/admin/credit-config/CreditConfigPage.tsx:246` |
| PUT | `/api/customer-groups/{id:guid}/price-list` | Có UI gọi | `customerGroupsApi.setGroupPriceList` | `src/features/admin/credit-config/CreditConfigPage.tsx:229` |
| GET | `/api/customer-groups/{id:guid}/price-lists` | Có UI gọi | `customerGroupsApi.getPriceListHistory` | `src/features/admin/credit-config/CreditConfigPage.tsx:151` |
| DELETE | `/api/customer-groups/{id:guid}` | Có UI gọi | `customerGroupsApi.deleteCustomerGroup` | `src/features/admin/credit-config/CreditConfigPage.tsx:171` |
| GET | `/api/customers` | Có UI gọi | `customersApi.getCustomers` | `src/features/customers/CustomersPage.tsx:71`<br>`src/features/sales/counter-sales/CustomerSection.tsx:148` |
| GET | `/api/customers/{farmerProfileId:guid}` | Có UI gọi | `customersApi.getCustomer` | `src/features/customers/CustomerDetailModal.tsx:91`<br>`src/features/debts/CustomerDebtPage.tsx:68` |
| POST | `/api/customers` | Có UI gọi | `customersApi.createCustomer` | `src/features/customers/CustomerFormModal.tsx:144` |
| PUT | `/api/customers/{farmerProfileId:guid}` | Có UI gọi | `customersApi.updateCustomer` | `src/features/customers/CustomerFormModal.tsx:158` |
| POST | `/api/customers/{farmerProfileId:guid}/status` | Có UI gọi | `customersApi.setStatus` | `src/features/customers/CustomerDetailModal.tsx:376` |
| PUT | `/api/customers/{farmerProfileId:guid}/group` | Có UI gọi | `customersApi.assignGroup` | `src/features/customers/CustomerDetailModal.tsx:355` |
| GET | `/api/customers/{farmerProfileId:guid}/group-history` | Có UI gọi | `customersApi.getGroupHistory` | `src/features/customers/CustomerDetailModal.tsx:113`<br>`src/features/customers/CustomerDetailModal.tsx:130` |
| GET | `/api/customers/{farmerProfileId:guid}/orders` | Có UI gọi | `customersApi.getOrders` | `src/features/customers/CustomerDetailModal.tsx:114` |
| GET | `/api/customers/{farmerProfileId:guid}/debts` | Chỉ có wrapper | `customersApi.getDebtSummary` | — |
| GET | `/api/customers/{farmerProfileId:guid}/payments` | Có UI gọi | `customersApi.getPayments` | `src/features/customers/CustomerDetailModal.tsx:115` |
| GET | `/api/customers/{farmerProfileId:guid}/addresses` | Có UI gọi | `customersApi.getAddresses` | `src/features/sales/counter-sales/CustomerSection.tsx:52` |
| GET | `/api/me/credit` | Farmer | — | — |
| GET | `/api/me/profile` | Farmer | — | — |
| PUT | `/api/me/profile` | Farmer | — | — |
| GET | `/api/me/addresses` | Farmer | — | — |
| POST | `/api/me/addresses` | Farmer | — | — |
| PUT | `/api/me/addresses/{id:guid}` | Farmer | — | — |
| DELETE | `/api/me/addresses/{id:guid}` | Farmer | — | — |
| POST | `/api/me/addresses/{id:guid}/set-default` | Farmer | — | — |
| GET | `/api/debt-entries` | Có UI gọi | `debtApi.getEntries` | `src/features/debts/CustomerDebtPage.tsx:86`<br>`src/features/debts/CustomerDebtPage.tsx:88`<br>`src/features/debts/DebtsPage.tsx:84` |
| GET | `/api/debt-entries/{id:guid}` | Có UI gọi | `debtApi.getEntry` | `src/features/debts/DebtEntryModal.tsx:44` |
| GET | `/api/debt-accounts` | Có UI gọi | `debtApi.getDebtAccounts` | `src/features/debts/DebtsPage.tsx:80` |
| GET | `/api/customers/{farmerProfileId:guid}/debt` | Có UI gọi | `debtApi.getCustomerDebt` | `src/features/debts/CustomerDebtPage.tsx:74` |
| GET | `/api/customers/{farmerProfileId:guid}/debt/entries` | Chưa có wrapper | — | — |
| GET | `/api/customers/{farmerProfileId:guid}/debt/transactions` | Có UI gọi | `debtApi.getTransactions` | `src/features/debts/CustomerDebtPage.tsx:101` |
| GET | `/api/customers/{farmerProfileId:guid}/debt/allocation-preview` | Có UI gọi | `debtApi.getAllocationPreview` | `src/features/debts/CollectCashModal.tsx:53` |
| GET | `/api/debt-entries/{id:guid}/payments` | Chỉ có wrapper | `debtApi.getEntryPayments` | — |
| GET | `/api/debt-entries/{id:guid}/ledger` | Chỉ có wrapper | `debtApi.getEntryLedger` | — |
| POST | `/api/debt-entries/{id:guid}/dispute` | Có UI gọi | `debtApi.dispute` | `src/features/debts/DebtEntryModal.tsx:69` |
| POST | `/api/debt-entries/{id:guid}/keep` | Có UI gọi | `debtApi.keep` | `src/features/debts/DebtEntryModal.tsx:76` |
| POST | `/api/debt-entries/{id:guid}/change-due-date` | Có UI gọi | `debtApi.changeDueDate` | `src/features/debts/DebtEntryModal.tsx:85` |
| POST | `/api/debt-entries/{id:guid}/adjust` | Có UI gọi | `debtApi.adjust` | `src/features/debts/DebtEntryModal.tsx:98` |
| POST | `/api/debt-entries/{id:guid}/cancel` | Có UI gọi | `debtApi.cancel` | `src/features/debts/DebtEntryModal.tsx:107` |
| POST | `/api/customers/{farmerProfileId:guid}/debt/manual-entries` | Có UI gọi | `debtApi.createManualEntry` | `src/features/debts/CustomerDebtPage.tsx:327` |
| GET | `/api/debt-entries/dashboard` | Có UI gọi | `debtApi.getDashboard` | `src/features/debts/DebtsPage.tsx:72` |
| GET | `/api/me/debt` | Farmer | — | — |
| GET | `/api/me/debt-entries` | Farmer | — | — |
| GET | `/api/me/debt-entries/{id:guid}` | Farmer | — | — |
| POST | `/api/me/debt-entries/{id:guid}/dispute` | Farmer | — | — |
| GET | `/api/me/debt/allocation-preview` | Farmer | — | — |
| POST | `/api/deliveries` | Có UI gọi | `deliveriesApi.create` | `src/features/orders/OrdersPage.tsx:343` |
| GET | `/api/deliveries` | Có UI gọi | `deliveriesApi.getDeliveries` | `src/features/agent/deliveries/DeliveriesPage.tsx:58`<br>`src/features/delivery/dashboard/DashboardPage.tsx:25`<br>`src/features/delivery/deliveries/DeliveriesPage.tsx:63`<br>`src/features/delivery/deliveries/DeliveriesPage.tsx:79` |
| GET | `/api/deliveries/{id:guid}` | Có UI gọi | `deliveriesApi.getDeliveryDetail` | `src/features/agent/deliveries/DeliveryDetailModal.tsx:77`<br>`src/features/delivery/deliveries/DeliveryDetailPage.tsx:61`<br>`src/features/orders/OrdersPage.tsx:311` |
| GET | `/api/orders/{id:guid}/deliveries` | Có UI gọi | `deliveriesApi.getOrderDeliveries` | `src/features/orders/OrdersPage.tsx:193`<br>`src/features/orders/OrdersPage.tsx:307`<br>`src/features/orders/OrdersPage.tsx:353`<br>`src/features/orders/OrdersPage.tsx:365` |
| POST | `/api/deliveries/{id:guid}/assign` | Có UI gọi | `deliveriesApi.assignDriver` | `src/features/agent/deliveries/DeliveryDetailModal.tsx:136` |
| PUT | `/api/deliveries/{id:guid}/items/{itemId:guid}/lots` | Có UI gọi | `deliveriesApi.updateDeliveryLots` | `src/features/agent/deliveries/EditDeliveryLotsModal.tsx:102` |
| POST | `/api/deliveries/{id:guid}/dispatch` | Có UI gọi | `deliveriesApi.dispatchDelivery` | `src/features/agent/deliveries/DeliveryDetailModal.tsx:142` |
| POST | `/api/deliveries/{id:guid}/cancel` | Có UI gọi | `deliveriesApi.cancelDelivery` | `src/features/agent/deliveries/DeliveryDetailModal.tsx:154` |
| POST | `/api/deliveries/{id:guid}/attempts` | Có UI gọi | `deliveriesApi.startAttempt` | `src/features/delivery/deliveries/DeliveryDetailPage.tsx:94` |
| GET | `/api/deliveries/{id:guid}/attempts` | Chưa có wrapper | — | — |
| POST | `/api/deliveries/{id:guid}/attempts/{attemptId:guid}/complete` | Có UI gọi | `deliveriesApi.completeAttempt` | `src/features/delivery/deliveries/DeliveryDetailPage.tsx:111` |
| POST | `/api/deliveries/{id:guid}/attempts/{attemptId:guid}/cancel` | Có UI gọi | `deliveriesApi.cancelAttempt` | `src/features/agent/deliveries/DeliveryDetailModal.tsx:149` |
| POST | `/api/deliveries/{id:guid}/incidents` | Có UI gọi | `deliveriesApi.reportIncident` | `src/features/delivery/deliveries/DeliveryDetailPage.tsx:134` |
| GET | `/api/deliveries/{id:guid}/incidents` | Có UI gọi | `deliveriesApi.getIncidents` | `src/features/agent/deliveries/DeliveryDetailModal.tsx:78`<br>`src/features/agent/deliveries/DeliveryDetailModal.tsx:113` |
| POST | `/api/deliveries/{id:guid}/incidents/{incidentId:guid}/resolve` | Có UI gọi | `deliveriesApi.resolveIncident` | `src/features/agent/deliveries/DeliveryDetailModal.tsx:168` |
| GET | `/api/me/orders/{id:guid}/deliveries` | Farmer | — | — |
| GET | `/api/ai-models` | Có UI gọi | `aiModelsApi.list` | `src/features/admin/ai-models/AiPolicyConfigsPage.tsx:32`<br>`src/features/admin/ai-models/AiModelsPage.tsx:28` |
| GET | `/api/ai-models/{id:guid}` | Chưa có wrapper | — | — |
| POST | `/api/ai-models` | Có UI gọi | `aiModelsApi.create` | `src/features/admin/ai-models/AiModelsPage.tsx:50` |
| POST | `/api/ai-models/{id:guid}/activate` | Có UI gọi | `aiModelsApi.activate` | `src/features/admin/ai-models/AiModelsPage.tsx:69` |
| POST | `/api/ai-models/{id:guid}/retire` | Có UI gọi | `aiModelsApi.retire` | `src/features/admin/ai-models/AiModelsPage.tsx:85` |
| GET | `/api/ai-models/{id:guid}/policies` | Có UI gọi | `aiModelsApi.policies` | `src/features/admin/ai-models/AiPolicyConfigsPage.tsx:40` |
| POST | `/api/ai-models/{id:guid}/policies` | Có UI gọi | `aiModelsApi.createPolicy` | `src/features/admin/ai-models/AiPolicyConfigsPage.tsx:56` |
| POST | `/api/ai-policies/{id:guid}/activate` | Có UI gọi | `aiModelsApi.setPolicyActive` | `src/features/admin/ai-models/AiPolicyConfigsPage.tsx:71` |
| POST | `/api/ai-policies/{id:guid}/deactivate` | Có UI gọi | `aiModelsApi.setPolicyActive` | `src/features/admin/ai-models/AiPolicyConfigsPage.tsx:71` |
| GET | `/api/diagnosis-cases` | Có UI gọi | `diagnosisApi.list` | `src/features/diagnosis/DiagnosisQueuePage.tsx:64` |
| GET | `/api/diagnosis-cases/{id:guid}` | Có UI gọi | `diagnosisApi.get` | `src/features/diagnosis/DiagnosisCasePage.tsx:82` |
| POST | `/api/diagnosis-cases/{id:guid}/start-review` | Có UI gọi | `diagnosisApi.startReview` | `src/features/diagnosis/DiagnosisCasePage.tsx:437` |
| POST | `/api/diagnosis-cases/{id:guid}/review` | Có UI gọi | `diagnosisApi.review` | `src/features/diagnosis/DiagnosisCasePage.tsx:165` |
| POST | `/api/diagnosis-cases/{id:guid}/rerun-ai` | Có UI gọi | `diagnosisApi.rerunAi` | `src/features/diagnosis/DiagnosisCasePage.tsx:448` |
| POST | `/api/diagnosis-cases/{id:guid}/recommendations` | Có UI gọi | `diagnosisApi.recommend` | `src/features/diagnosis/DiagnosisCasePage.tsx:189` |
| DELETE | `/api/diagnosis-cases/{id:guid}/recommendations/{recommendationId:guid}` | Có UI gọi | `diagnosisApi.unrecommend` | `src/features/diagnosis/DiagnosisCasePage.tsx:210` |
| GET | `/api/diseases` | Có UI gọi | `diseasesApi.list` | `src/features/diagnosis/DiagnosisCasePage.tsx:96` |
| PUT | `/api/diseases/{id:guid}` | Chưa có wrapper | — | — |
| POST | `/api/diseases/{id:guid}/treatments` | Chưa có wrapper | — | — |
| PUT | `/api/disease-treatments/{id:guid}` | Chưa có wrapper | — | — |
| POST | `/api/disease-treatments/{id:guid}/activate` | Chưa có wrapper | — | — |
| DELETE | `/api/disease-treatments/{id:guid}` | Chưa có wrapper | — | — |
| POST | `/api/me/diagnosis-cases` | Farmer | — | — |
| GET | `/api/me/diagnosis-cases` | Farmer | — | — |
| GET | `/api/me/diagnosis-cases/{id:guid}` | Farmer | — | — |
| POST | `/api/me/diagnosis-cases/{id:guid}/cancel` | Farmer | — | — |
| POST | `/api/files/product-images` | Có UI gọi | `productsApi.uploadImage` | `src/features/products/ImageUploader.tsx:37` |
| DELETE | `/api/files/product-images` | Có UI gọi | `productsApi.deleteImage` | `src/features/products/ProductFormModal.tsx:103`<br>`src/features/products/ProductFormModal.tsx:183` |
| POST | `/api/files/delivery-proofs` | Có UI gọi | `deliveriesApi.uploadProofPhoto`, `refundsApi.uploadProof` | `src/features/delivery/deliveries/DeliveryDetailPage.tsx:104`<br>`src/features/agent/refunds/RefundsPanel.tsx:231` |
| DELETE | `/api/files/delivery-proofs` | Chưa có wrapper | — | — |
| GET | `/api/goods-receipts/import-template` | Có UI gọi | `goodsReceiptsApi.downloadTemplate` | `src/features/agent/purchases/ReceiptImportPage.tsx:54` |
| POST | `/api/goods-receipts/import/preview` | Có UI gọi | `goodsReceiptsApi.previewImport` | `src/features/agent/purchases/ReceiptImportPage.tsx:95` |
| POST | `/api/goods-receipts/import` | Có UI gọi | `goodsReceiptsApi.importFile` | `src/features/agent/purchases/ReceiptImportPage.tsx:108` |
| GET | `/api/goods-receipts` | Có UI gọi | `goodsReceiptsApi.list` | `src/features/agent/purchases/GoodsReceiptsPage.tsx:49` |
| GET | `/api/goods-receipts/{id:guid}` | Có UI gọi | `goodsReceiptsApi.get` | `src/features/agent/purchases/GoodsReceiptDetailPage.tsx:46` |
| POST | `/api/goods-receipts` | Có UI gọi | `goodsReceiptsApi.create` | `src/features/agent/purchases/GoodsReceiptsPage.tsx:195` |
| PUT | `/api/goods-receipts/{id:guid}` | Có UI gọi | `goodsReceiptsApi.updateHeader` | `src/features/agent/purchases/GoodsReceiptDetailPage.tsx:385` |
| POST | `/api/goods-receipts/{id:guid}/items` | Có UI gọi | `goodsReceiptsApi.addItem` | `src/features/agent/purchases/ReceiptLineModal.tsx:105` |
| PUT | `/api/goods-receipts/{id:guid}/items/{itemId:guid}` | Có UI gọi | `goodsReceiptsApi.updateItem` | `src/features/agent/purchases/ReceiptLineModal.tsx:104` |
| DELETE | `/api/goods-receipts/{id:guid}/items/{itemId:guid}` | Có UI gọi | `goodsReceiptsApi.removeItem` | `src/features/agent/purchases/GoodsReceiptDetailPage.tsx:75` |
| POST | `/api/goods-receipts/{id:guid}/cancel` | Có UI gọi | `goodsReceiptsApi.cancel` | `src/features/agent/purchases/GoodsReceiptDetailPage.tsx:332` |
| DELETE | `/api/goods-receipts/{id:guid}` | Có UI gọi | `goodsReceiptsApi.remove` | `src/features/agent/purchases/GoodsReceiptDetailPage.tsx:356` |
| POST | `/api/goods-receipts/{id:guid}/confirm` | Có UI gọi | `goodsReceiptsApi.confirm` | `src/features/agent/purchases/GoodsReceiptDetailPage.tsx:311` |
| GET | `/api/inventory/stock-summary` | Có UI gọi | `stockApi.getSummary` | `src/features/agent/inventory/ProductPicker.tsx:36`<br>`src/features/agent/inventory/StockOverviewPage.tsx:108`<br>`src/features/agent/inventory/StockOverviewPage.tsx:208` |
| GET | `/api/inventory/alerts` | Có UI gọi | `stockApi.getAlerts` | `src/features/agent/inventory/StockOverviewPage.tsx:91`<br>`src/features/agent/inventory/StockOverviewPage.tsx:92`<br>`src/features/agent/inventory/StockOverviewPage.tsx:93`<br>`src/features/agent/inventory/StockOverviewPage.tsx:127` |
| POST | `/api/inventory/lots/expire-due` | Có UI gọi | `stockApi.expireDue` | `src/features/agent/inventory/StockOverviewPage.tsx:225` |
| GET | `/api/inventory/lots` | Có UI gọi | `inventoryApi.getLots`, `stockApi.getLots` | `src/features/agent/deliveries/EditDeliveryLotsModal.tsx:52`<br>`src/features/orders/PickupModal.tsx:101`<br>`src/features/sales/inventory/InventoryPage.tsx:40`<br>`src/features/agent/inventory/StockCardPage.tsx:58`<br>`src/features/agent/inventory/StockOverviewPage.tsx:147`<br>`src/features/agent/inventory/StockOverviewPage.tsx:148`<br>`src/features/agent/inventory/StockOverviewPage.tsx:207` |
| GET | `/api/inventory/lots/{id:guid}` | Có UI gọi | `stockApi.getLot` | `src/features/agent/returns/ReturnDetailPage.tsx:65` |
| POST | `/api/inventory/lots/{id:guid}/status` | Có UI gọi | `inventoryApi.updateLotStatus`, `stockApi.changeLotStatus` | `src/features/agent/inventory/StockOverviewPage.tsx:243` |
| GET | `/api/inventory/stock-movements` | Có UI gọi | `stockApi.getMovements` | `src/features/agent/inventory/StockMovementsPage.tsx:53` |
| GET | `/api/inventory/stock-movements/{id:guid}` | Có UI gọi | `stockApi.getMovement` | `src/features/agent/inventory/StockMovementsPage.tsx:75` |
| POST | `/api/inventory/adjustments` | Có UI gọi | `stockApi.createAdjustment` | `src/features/agent/inventory/StockAdjustmentModal.tsx:85` |
| GET | `/api/inventory/stock-card` | Có UI gọi | `stockApi.getStockCard` | `src/features/agent/inventory/StockCardPage.tsx:73` |
| GET | `/api/me/notifications` | Có UI gọi | `notificationsApi.list` | `src/hooks/useNotificationInbox.ts:29` |
| GET | `/api/me/notifications/unread-count` | Có UI gọi | `notificationsApi.unreadCount` | `src/context/NotificationsContext.tsx:21` |
| POST | `/api/me/notifications/{id:guid}/read` | Có UI gọi | `notificationsApi.markRead` | `src/hooks/useNotificationInbox.ts:58` |
| POST | `/api/me/notifications/read-all` | Có UI gọi | `notificationsApi.markAllRead` | `src/hooks/useNotificationInbox.ts:59` |
| DELETE | `/api/me/notifications/{id:guid}` | Có UI gọi | `notificationsApi.archive` | `src/hooks/useNotificationInbox.ts:60` |
| POST | `/api/counter-sales/preview` | Có UI gọi | `counterSalesApi.preview` | `src/features/sales/counter-sales/CounterSalesPage.tsx:56`<br>`src/features/sales/counter-sales/CounterSalesPage.tsx:140` |
| POST | `/api/counter-sales` | Có UI gọi | `counterSalesApi.sell` | `src/features/sales/counter-sales/CounterSalesPage.tsx:153` |
| POST | `/api/me/orders` | Farmer | — | — |
| GET | `/api/me/orders` | Farmer | — | — |
| GET | `/api/me/orders/{id:guid}` | Farmer | — | — |
| POST | `/api/me/orders/{id:guid}/cancel` | Farmer | — | — |
| POST | `/api/orders/{id:guid}/cancel` | Có UI gọi | `ordersApi.cancel` | `src/features/orders/OrdersPage.tsx:380` |
| GET | `/api/orders/{id:guid}/fefo-suggestions` | Có UI gọi | `ordersApi.getFefoSuggestions` | `src/features/orders/ConfirmOrderModal.tsx:34`<br>`src/features/orders/PickupModal.tsx:67` |
| POST | `/api/orders/{id:guid}/confirm` | Có UI gọi | `ordersApi.confirm` | `src/features/orders/ConfirmOrderModal.tsx:52` |
| POST | `/api/orders/{id:guid}/start-preparing` | Có UI gọi | `ordersApi.startPreparing` | `src/features/orders/OrdersPage.tsx:607` |
| POST | `/api/orders/{id:guid}/mark-ready` | Có UI gọi | `ordersApi.markReady` | `src/features/orders/OrdersPage.tsx:615` |
| GET | `/api/orders/{id:guid}/reservation` | Chưa có wrapper | — | — |
| POST | `/api/orders/{id:guid}/pickup` | Có UI gọi | `ordersApi.pickup` | `src/features/orders/PickupModal.tsx:122` |
| POST | `/api/orders/{id:guid}/items/{itemId:guid}/cancel-remaining` | Có UI gọi | `ordersApi.cancelRemainingItem` | `src/features/orders/OrdersPage.tsx:383` |
| POST | `/api/orders` | Có UI gọi | `ordersApi.create` | `src/features/sales/counter-sales/CounterSalesPage.tsx:125` |
| GET | `/api/orders` | Có UI gọi | `ordersApi.getOrders`, `refundsApi.getCancelledOrders`, `refundsApi.listCancelledOrders`, `returnsApi.searchOrders` | `src/features/agent/dashboard/OrderDashboard.tsx:36`<br>`src/features/orders/OrdersPage.tsx:145`<br>`src/features/payments/PaymentsPage.tsx:74`<br>`src/features/agent/refunds/RefundsPage.tsx:93`<br>`src/features/agent/returns/ReturnCreatePage.tsx:55` |
| GET | `/api/orders/{id:guid}` | Có UI gọi | `ordersApi.getById` | `src/features/agent/deliveries/DeliveryDetailModal.tsx:84`<br>`src/features/agent/returns/returnContext.ts:34`<br>`src/features/orders/OrdersPage.tsx:197`<br>`src/features/orders/OrdersPage.tsx:213`<br>`src/features/orders/OrdersPage.tsx:390` |
| PUT | `/api/orders/{id:guid}` | Có UI gọi | `ordersApi.updateNote` | `src/features/orders/OrderEditModal.tsx:64` |
| POST | `/api/orders/{id:guid}/items` | Có UI gọi | `ordersApi.addItem` | `src/features/orders/OrderEditModal.tsx:115` |
| PUT | `/api/orders/{id:guid}/items/{itemId:guid}` | Có UI gọi | `ordersApi.changeQuantity` | `src/features/orders/OrderEditModal.tsx:97` |
| PUT | `/api/orders/{id:guid}/items/{itemId:guid}/price` | Có UI gọi | `ordersApi.overridePrice` | `src/features/orders/OrderEditModal.tsx:98` |
| DELETE | `/api/orders/{id:guid}/items/{itemId:guid}/price` | Có UI gọi | `ordersApi.resetPrice` | `src/features/orders/OrderEditModal.tsx:99` |
| DELETE | `/api/orders/{id:guid}/items/{itemId:guid}` | Có UI gọi | `ordersApi.removeItem` | `src/features/orders/OrderEditModal.tsx:101` |
| POST | `/api/payments/bank-transfer` | Có UI gọi | `paymentsApi.createBankDebtPayment` | `src/features/debts/CustomerDebtPage.tsx:301` |
| POST | `/api/payments/{id:guid}/confirm` | Có UI gọi | `paymentsApi.confirmPayment` | `src/features/debts/DebtsPage.tsx:124`<br>`src/features/payments/PaymentDetailModal.tsx:34` |
| POST | `/api/payments/{id:guid}/reject` | Có UI gọi | `paymentsApi.rejectPayment` | `src/features/debts/DebtsPage.tsx:138`<br>`src/features/payments/PaymentDetailModal.tsx:35` |
| GET | `/api/me/payments` | Farmer | — | — |
| GET | `/api/me/payments/{id:guid}` | Farmer | — | — |
| GET | `/api/me/orders/{id:guid}/payments` | Farmer | — | — |
| POST | `/api/me/payments/payos` | Farmer | — | — |
| POST | `/api/me/payments/{id:guid}/cancel` | Farmer | — | — |
| POST | `/api/payments/cash` | Có UI gọi | `paymentsApi.createCashPayment` | `src/features/debts/CollectCashModal.tsx:71`<br>`src/features/orders/OrdersPage.tsx:254`<br>`src/features/payments/PaymentsPage.tsx:147` |
| GET | `/api/payments` | Có UI gọi | `paymentsApi.getPayments` | `src/features/debts/DebtsPage.tsx:95`<br>`src/features/payments/PaymentsLedger.tsx:33` |
| GET | `/api/payments/{id:guid}` | Có UI gọi | `paymentsApi.getPayment` | `src/features/payments/PaymentDetailModal.tsx:24` |
| GET | `/api/orders/{id:guid}/payments` | Có UI gọi | `paymentsApi.getOrderPayments` | `src/features/agent/refunds/RefundsPanel.tsx:305`<br>`src/features/orders/OrdersPage.tsx:158`<br>`src/features/orders/OrdersPage.tsx:198`<br>`src/features/orders/OrdersPage.tsx:263`<br>`src/features/orders/OrdersPage.tsx:275`<br>`src/features/orders/OrdersPage.tsx:391`<br>`src/features/orders/OrdersPage.tsx:979`<br>`src/features/payments/PaymentsPage.tsx:86`<br>`src/features/payments/PaymentsPage.tsx:152`<br>`src/features/payments/PaymentsPage.tsx:166` |
| POST | `/api/payments/{id:guid}/cancel` | Có UI gọi | `paymentsApi.cancelPayment` | `src/features/payments/PaymentDetailModal.tsx:36` |
| POST | `/api/payments/payos` | Có UI gọi | `paymentsApi.createPayOsPayment` | `src/features/payments/PaymentsPage.tsx:143` |
| POST | `/api/payments/{id:guid}/sync` | Có UI gọi | `paymentsApi.syncPayment` | `src/features/payments/PaymentDetailModal.tsx:33` |
| POST | `/api/payments/{id:guid}/simulate-paid` | Chỉ Development | — | — |
| POST | `/api/payments/payos/webhook` | Provider callback | — | — |
| GET | `/api/me/permissions` | Có UI gọi | `permissionsApi.current` | `src/context/PermissionContext.tsx:24` |
| GET | `/api/permissions` | Có UI gọi | `permissionsApi.catalog` | `src/features/admin/roles/RolesPage.tsx:22`<br>`src/features/agent/staff/MemberPermissionEditor.tsx:18` |
| GET | `/api/roles` | Có UI gọi | `permissionsApi.roles` | `src/features/admin/roles/RolesPage.tsx:22` |
| PUT | `/api/roles/{id:guid}/permissions` | Có UI gọi | `permissionsApi.setRole` | `src/features/admin/roles/RolesPage.tsx:30` |
| GET | `/api/staff/{userId:guid}/permissions` | Có UI gọi | `permissionsApi.member` | `src/features/agent/staff/MemberPermissionEditor.tsx:18` |
| PUT | `/api/staff/{userId:guid}/permissions` | Có UI gọi | `permissionsApi.setMember` | `src/features/agent/staff/MemberPermissionEditor.tsx:27` |
| GET | `/api/price-lists` | Có UI gọi | `priceListsApi.getPriceLists` | `src/features/admin/credit-config/CreditConfigPage.tsx:101`<br>`src/features/price-lists/PriceListsPage.tsx:66`<br>`src/features/price-lists/PriceListsPage.tsx:67` |
| GET | `/api/price-lists/{id:guid}` | Chưa có wrapper | — | — |
| POST | `/api/price-lists` | Có UI gọi | `priceListsApi.create` | `src/features/price-lists/PriceListsPage.tsx:118` |
| PUT | `/api/price-lists/{id:guid}` | Có UI gọi | `priceListsApi.update` | `src/features/price-lists/PriceListsPage.tsx:115` |
| POST | `/api/price-lists/{id:guid}/activate` | Có UI gọi | `priceListsApi.activate` | `src/features/price-lists/PriceListsPage.tsx:252` |
| POST | `/api/price-lists/{id:guid}/deactivate` | Có UI gọi | `priceListsApi.deactivate` | `src/features/price-lists/PriceListsPage.tsx:239` |
| DELETE | `/api/price-lists/{id:guid}` | Có UI gọi | `priceListsApi.delete` | `src/features/price-lists/PriceListsPage.tsx:265` |
| GET | `/api/price-lists/{id:guid}/items` | Có UI gọi | `priceListsApi.getItems` | `src/features/price-lists/PriceListItemsModal.tsx:63` |
| PUT | `/api/price-lists/{id:guid}/items` | Có UI gọi | `priceListsApi.updateItems` | `src/features/price-lists/PriceListItemsModal.tsx:131` |
| DELETE | `/api/price-lists/{id:guid}/items/{itemId:guid}` | Có UI gọi | `priceListsApi.deleteItem` | `src/features/price-lists/PriceListItemsModal.tsx:153` |
| GET | `/api/active-ingredients` | Có UI gọi | `adminCatalogApi.list` | `src/features/admin/products/AdminCatalogList.tsx:30` |
| GET | `/api/active-ingredients/{id:guid}` | Chưa có wrapper | — | — |
| POST | `/api/active-ingredients` | Có UI gọi | `adminCatalogApi.create` | `src/features/admin/products/AdminCatalogList.tsx:59` |
| PUT | `/api/active-ingredients/{id:guid}` | Có UI gọi | `adminCatalogApi.update` | `src/features/admin/products/AdminCatalogList.tsx:59` |
| POST | `/api/active-ingredients/{id:guid}/activate` | Có UI gọi | `adminCatalogApi.setActive` | `src/features/admin/products/AdminCatalogList.tsx:79` |
| POST | `/api/active-ingredients/{id:guid}/deactivate` | Có UI gọi | `adminCatalogApi.setActive` | `src/features/admin/products/AdminCatalogList.tsx:79` |
| DELETE | `/api/active-ingredients/{id:guid}` | Có UI gọi | `adminCatalogApi.remove` | `src/features/admin/products/AdminCatalogList.tsx:94` |
| GET | `/api/brands` | Có UI gọi | `productsApi.brands` | `src/features/products/ProductManagementPage.tsx:96` |
| GET | `/api/brands/{id:guid}` | Chưa có wrapper | — | — |
| POST | `/api/brands` | Chưa có wrapper | — | — |
| PUT | `/api/brands/{id:guid}` | Chưa có wrapper | — | — |
| POST | `/api/brands/{id:guid}/activate` | Chưa có wrapper | — | — |
| POST | `/api/brands/{id:guid}/deactivate` | Chưa có wrapper | — | — |
| DELETE | `/api/brands/{id:guid}` | Chưa có wrapper | — | — |
| GET | `/api/catalog/categories` | Có UI gọi | `catalogApi.getCategories` | `src/features/agent/inventory/InventoryReportsPage.tsx:62`<br>`src/features/sales/counter-sales/ProductSearchPanel.tsx:38` |
| GET | `/api/catalog/brands` | Chưa có wrapper | — | — |
| GET | `/api/catalog/products` | Có UI gọi | `catalogApi.getProducts` | `src/features/orders/OrderEditModal.tsx:245`<br>`src/features/sales/counter-sales/ProductSearchPanel.tsx:57`<br>`src/features/sales/products/ProductsPage.tsx:45` |
| GET | `/api/catalog/products/{id:guid}` | Có UI gọi | `catalogApi.getProductDetail` | `src/features/orders/OrderEditModal.tsx:257`<br>`src/features/sales/counter-sales/ProductSearchPanel.tsx:74`<br>`src/features/sales/products/ProductsPage.tsx:65` |
| GET | `/api/categories` | Có UI gọi | `adminCatalogApi.list`, `productsApi.categories` | `src/features/admin/products/AdminCatalogList.tsx:30`<br>`src/features/products/ProductManagementPage.tsx:96` |
| GET | `/api/categories/tree` | Chưa có wrapper | — | — |
| GET | `/api/categories/{id:guid}` | Chưa có wrapper | — | — |
| POST | `/api/categories` | Có UI gọi | `adminCatalogApi.create` | `src/features/admin/products/AdminCatalogList.tsx:59` |
| PUT | `/api/categories/{id:guid}` | Có UI gọi | `adminCatalogApi.update` | `src/features/admin/products/AdminCatalogList.tsx:59` |
| POST | `/api/categories/{id:guid}/activate` | Có UI gọi | `adminCatalogApi.setActive` | `src/features/admin/products/AdminCatalogList.tsx:79` |
| POST | `/api/categories/{id:guid}/deactivate` | Có UI gọi | `adminCatalogApi.setActive` | `src/features/admin/products/AdminCatalogList.tsx:79` |
| DELETE | `/api/categories/{id:guid}` | Có UI gọi | `adminCatalogApi.remove` | `src/features/admin/products/AdminCatalogList.tsx:94` |
| GET | `/api/products` | Có UI gọi | `productsApi.list` | `src/features/products/ProductManagementPage.tsx:118` |
| GET | `/api/products/{id:guid}` | Có UI gọi | `catalogApi.getProductPackagings`, `productLookupApi.getProduct`, `productsApi.get` | `src/features/price-lists/PriceListItemsModal.tsx:90`<br>`src/features/agent/purchases/ReceiptLineModal.tsx:43`<br>`src/features/agent/purchases/ReceiptLineModal.tsx:57`<br>`src/features/agent/returns/returnContext.ts:23`<br>`src/features/products/ProductManagementPage.tsx:152` |
| POST | `/api/products` | Có UI gọi | `productsApi.create` | `src/features/products/ProductFormModal.tsx:160` |
| PUT | `/api/products/{id:guid}` | Có UI gọi | `productsApi.update` | `src/features/products/ProductFormModal.tsx:178` |
| POST | `/api/products/{id:guid}/status` | Có UI gọi | `productsApi.changeStatus` | `src/features/products/ProductManagementPage.tsx:196`<br>`src/features/products/ProductManagementPage.tsx:198` |
| DELETE | `/api/products/{id:guid}` | Có UI gọi | `productsApi.discontinue` | `src/features/products/ProductManagementPage.tsx:298` |
| POST | `/api/products/{id:guid}/packagings` | Chưa có wrapper | — | — |
| PUT | `/api/products/{id:guid}/packagings/{packagingId:guid}` | Chưa có wrapper | — | — |
| DELETE | `/api/products/{id:guid}/packagings/{packagingId:guid}` | Chưa có wrapper | — | — |
| PUT | `/api/products/{id:guid}/ingredients` | Chưa có wrapper | — | — |
| GET | `/api/store-products` | Có UI gọi | `catalogApi.getStoreProducts`, `productLookupApi.searchStoreProducts`, `productsApi.storeProducts` | `src/features/price-lists/PriceListItemsModal.tsx:302`<br>`src/features/agent/purchases/StoreProductSearch.tsx:25`<br>`src/features/diagnosis/DiagnosisCasePage.tsx:115`<br>`src/features/products/ProductManagementPage.tsx:108` |
| GET | `/api/store-products/{id:guid}` | Có UI gọi | `productLookupApi.getStoreProduct` | `src/features/agent/purchases/ReceiptLineModal.tsx:55`<br>`src/features/agent/returns/returnContext.ts:22` |
| POST | `/api/store-products` | Có UI gọi | `productsApi.addToStore` | `src/features/products/ProductFormModal.tsx:170`<br>`src/features/products/ProductManagementPage.tsx:177` |
| PUT | `/api/store-products/{id:guid}` | Chưa có wrapper | — | — |
| POST | `/api/store-products/{id:guid}/mark-sellable` | Có UI gọi | `productsApi.setSellable` | `src/features/products/ProductFormModal.tsx:171`<br>`src/features/products/ProductManagementPage.tsx:179`<br>`src/features/products/ProductManagementPage.tsx:190` |
| POST | `/api/store-products/{id:guid}/mark-not-sellable` | Có UI gọi | `productsApi.setSellable` | `src/features/products/ProductFormModal.tsx:171`<br>`src/features/products/ProductManagementPage.tsx:179`<br>`src/features/products/ProductManagementPage.tsx:190` |
| POST | `/api/store-products/{id:guid}/activate` | Có UI gọi | `productsApi.setStoreActive` | `src/features/products/ProductManagementPage.tsx:178` |
| POST | `/api/store-products/{id:guid}/deactivate` | Có UI gọi | `productsApi.setStoreActive` | `src/features/products/ProductManagementPage.tsx:178` |
| DELETE | `/api/store-products/{id:guid}` | Chưa có wrapper | — | — |
| GET | `/api/units` | Có UI gọi | `productsApi.units` | `src/features/products/ProductManagementPage.tsx:96` |
| GET | `/api/reports/debt-aging` | Có UI gọi | `reportsApi.getDebtAging` | `src/features/agent/debts/DebtReportsPage.tsx:92`<br>`src/features/agent/reports/inlineReportConfig.ts:95` |
| GET | `/api/reports/debt-collections` | Có UI gọi | `reportsApi.getDebtCollections` | `src/features/agent/debts/DebtReportsPage.tsx:93`<br>`src/features/agent/reports/inlineReportConfig.ts:96` |
| GET | `/api/reports/debt-by-customer-group` | Có UI gọi | `reportsApi.getDebtByGroup` | `src/features/agent/debts/DebtReportsPage.tsx:94`<br>`src/features/agent/reports/inlineReportConfig.ts:97` |
| GET | `/api/reports/deliveries` | Có UI gọi | `reportsApi.getDeliveryReports` | `src/features/agent/deliveries/DeliveryReportsPage.tsx:38`<br>`src/features/agent/reports/inlineReportConfig.ts:86` |
| GET | `/api/reports/inventory-movement` | Có UI gọi | `inventoryReportsApi.getMovement` | `src/features/agent/inventory/InventoryReportsPage.tsx:75`<br>`src/features/agent/reports/inlineReportConfig.ts:70` |
| GET | `/api/reports/inventory-valuation` | Có UI gọi | `inventoryReportsApi.getValuation` | `src/features/agent/inventory/InventoryReportsPage.tsx:78`<br>`src/features/agent/inventory/StockOverviewPage.tsx:90`<br>`src/features/agent/reports/inlineReportConfig.ts:78` |
| GET | `/api/reports/sales` | Có UI gọi | `businessReportsApi.sales` | `src/features/agent/reports/inlineReportConfig.ts:59` |
| GET | `/api/reports/orders` | Có UI gọi | `businessReportsApi.orders` | `src/features/agent/reports/inlineReportConfig.ts:18` |
| GET | `/api/reports/payments` | Có UI gọi | `businessReportsApi.payments` | `src/features/agent/reports/inlineReportConfig.ts:26` |
| GET | `/api/reports/purchases` | Có UI gọi | `businessReportsApi.purchases` | `src/features/agent/reports/inlineReportConfig.ts:34` |
| GET | `/api/reports/returns` | Có UI gọi | `businessReportsApi.returns` | `src/features/agent/reports/inlineReportConfig.ts:42` |
| GET | `/api/reports/refunds` | Có UI gọi | `businessReportsApi.refunds` | `src/features/agent/reports/inlineReportConfig.ts:50` |
| GET | `/api/reports/credit-exposure` | Có UI gọi | `businessReportsApi.creditExposure` | `src/features/agent/reports/inlineReportConfig.ts:106` |
| GET | `/api/reports/revenue` | Có UI gọi | `businessReportsApi.revenue` | `src/features/agent/reports/inlineReportConfig.ts:60` |
| GET | `/api/reports/revenue-summary` | Có UI gọi | `businessReportsApi.revenueSummary` | `src/features/agent/reports/inlineReportConfig.ts:61` |
| GET | `/api/me/orders/{id:guid}/returnable` | Farmer | — | — |
| POST | `/api/me/returns` | Farmer | — | — |
| GET | `/api/me/returns` | Farmer | — | — |
| GET | `/api/me/returns/{id:guid}` | Farmer | — | — |
| POST | `/api/me/returns/{id:guid}/cancel` | Farmer | — | — |
| POST | `/api/returns/{id:guid}/refunds` | Có UI gọi | `refundsApi.requestForReturn` | `src/features/agent/refunds/RefundsPanel.tsx:330` |
| POST | `/api/returns/{id:guid}/refunds/{refundId:guid}/complete` | Có UI gọi | `refundsApi.completeForReturn` | `src/features/agent/refunds/RefundsPanel.tsx:245` |
| POST | `/api/returns/{id:guid}/refunds/{refundId:guid}/fail` | Có UI gọi | `refundsApi.failForReturn` | `src/features/agent/refunds/RefundsPanel.tsx:61` |
| POST | `/api/returns/{id:guid}/refunds/{refundId:guid}/cancel` | Có UI gọi | `refundsApi.cancelForReturn` | `src/features/agent/refunds/RefundsPanel.tsx:74` |
| GET | `/api/orders/{id:guid}/refunds` | Có UI gọi | `refundsApi.listForOrder` | `src/features/agent/refunds/RefundsPage.tsx:96` |
| POST | `/api/orders/{id:guid}/refunds` | Có UI gọi | `refundsApi.requestForOrder` | `src/features/agent/refunds/RefundsPanel.tsx:331` |
| POST | `/api/orders/{id:guid}/refunds/{refundId:guid}/complete` | Có UI gọi | `refundsApi.completeForOrder` | `src/features/agent/refunds/RefundsPanel.tsx:246` |
| POST | `/api/orders/{id:guid}/refunds/{refundId:guid}/fail` | Có UI gọi | `refundsApi.failForOrder` | `src/features/agent/refunds/RefundsPanel.tsx:62` |
| POST | `/api/orders/{id:guid}/refunds/{refundId:guid}/cancel` | Có UI gọi | `refundsApi.cancelForOrder` | `src/features/agent/refunds/RefundsPanel.tsx:75` |
| GET | `/api/orders/{id:guid}/returnable` | Có UI gọi | `returnsApi.getReturnable` | `src/features/agent/returns/ReturnCreatePage.tsx:73`<br>`src/features/agent/returns/ReturnDetailPage.tsx:57` |
| POST | `/api/returns` | Có UI gọi | `returnsApi.create` | `src/features/agent/returns/ReturnCreatePage.tsx:128` |
| GET | `/api/returns` | Có UI gọi | `returnsApi.list` | `src/features/agent/refunds/RefundsPage.tsx:120`<br>`src/features/agent/returns/ReturnsListPage.tsx:43` |
| GET | `/api/returns/{id:guid}` | Có UI gọi | `returnsApi.get` | `src/features/agent/refunds/RefundsPage.tsx:139`<br>`src/features/agent/returns/ReturnDetailPage.tsx:54` |
| POST | `/api/returns/{id:guid}/items` | Chưa có wrapper | — | — |
| DELETE | `/api/returns/{id:guid}/items/{itemId:guid}` | Có UI gọi | `returnsApi.removeItem` | `src/features/agent/returns/ReturnDetailPage.tsx:128` |
| POST | `/api/returns/{id:guid}/approve` | Có UI gọi | `returnsApi.approve` | `src/features/agent/returns/ReturnDetailPage.tsx:404` |
| POST | `/api/returns/{id:guid}/reject` | Có UI gọi | `returnsApi.reject` | `src/features/agent/returns/ReturnDetailPage.tsx:415` |
| POST | `/api/returns/{id:guid}/cancel` | Có UI gọi | `returnsApi.cancel` | `src/features/agent/returns/ReturnDetailPage.tsx:428` |
| POST | `/api/returns/{id:guid}/receive` | Có UI gọi | `returnsApi.receive` | `src/features/agent/returns/ReturnDetailPage.tsx:439` |
| PUT | `/api/returns/{id:guid}/items/{itemId:guid}/inspection` | Có UI gọi | `returnsApi.inspectItem` | `src/features/agent/returns/ReturnDetailPage.tsx:110` |
| POST | `/api/returns/{id:guid}/complete-inspection` | Có UI gọi | `returnsApi.completeInspection` | `src/features/agent/returns/ReturnDetailPage.tsx:455` |
| POST | `/api/staff` | Có UI gọi | `staffApi.create` | `src/features/agent/staff/StaffFormModal.tsx:58` |
| GET | `/api/staff` | Có UI gọi | `staffApi.getStaff` | `src/features/agent/deliveries/DeliveryDetailModal.tsx:64`<br>`src/features/agent/staff/StaffPage.tsx:92` |
| GET | `/api/staff/{id:guid}` | Có UI gọi | `staffApi.get` | `src/features/agent/staff/StaffFormModal.tsx:35` |
| PUT | `/api/staff/{id:guid}` | Có UI gọi | `staffApi.update` | `src/features/agent/staff/StaffFormModal.tsx:59` |
| POST | `/api/staff/{id:guid}/lock` | Có UI gọi | `staffApi.lock` | `src/features/agent/staff/StaffPage.tsx:54` |
| POST | `/api/staff/{id:guid}/unlock` | Có UI gọi | `staffApi.unlock` | `src/features/agent/staff/StaffPage.tsx:55` |
| POST | `/api/staff/{id:guid}/reset-password` | Có UI gọi | `staffApi.resetPassword` | `src/features/agent/staff/StaffFormModal.tsx:60` |
| PUT | `/api/staff/{id:guid}/ai-review` | Có UI gọi | `staffApi.setAiReview` | `src/features/agent/staff/StaffPage.tsx:81` |
| DELETE | `/api/staff/{id:guid}` | Có UI gọi | `staffApi.remove` | `src/features/agent/staff/StaffPage.tsx:56` |
| POST | `/api/stocktakes` | Có UI gọi | `stocktakeApi.create` | `src/features/agent/inventory/StocktakeListPage.tsx:185` |
| GET | `/api/stocktakes` | Có UI gọi | `stocktakeApi.list` | `src/features/agent/inventory/StocktakeListPage.tsx:49` |
| GET | `/api/stocktakes/{id:guid}` | Có UI gọi | `stocktakeApi.get` | `src/features/agent/inventory/StocktakeDetailPage.tsx:69` |
| POST | `/api/stocktakes/{id:guid}/start` | Có UI gọi | `stocktakeApi.start` | `src/features/agent/inventory/StocktakeDetailPage.tsx:513` |
| PUT | `/api/stocktakes/{id:guid}/counts` | Có UI gọi | `stocktakeApi.saveCounts` | `src/features/agent/inventory/StocktakeDetailPage.tsx:194` |
| POST | `/api/stocktakes/{id:guid}/refresh-stale` | Có UI gọi | `stocktakeApi.refreshStale` | `src/features/agent/inventory/StocktakeDetailPage.tsx:524` |
| POST | `/api/stocktakes/{id:guid}/complete` | Có UI gọi | `stocktakeApi.complete` | `src/features/agent/inventory/StocktakeDetailPage.tsx:564` |
| POST | `/api/stocktakes/{id:guid}/cancel` | Có UI gọi | `stocktakeApi.cancel` | `src/features/agent/inventory/StocktakeDetailPage.tsx:583` |
| DELETE | `/api/stocktakes/{id:guid}` | Có UI gọi | `stocktakeApi.remove` | `src/features/agent/inventory/StocktakeDetailPage.tsx:608` |
| GET | `/api/suppliers` | Có UI gọi | `suppliersApi.list` | `src/features/agent/purchases/SupplierSelect.tsx:25`<br>`src/features/agent/purchases/SuppliersPage.tsx:63` |
| GET | `/api/suppliers/{id:guid}` | Chỉ có wrapper | `suppliersApi.get` | — |
| POST | `/api/suppliers` | Có UI gọi | `suppliersApi.create` | `src/features/agent/purchases/SuppliersPage.tsx:267` |
| PUT | `/api/suppliers/{id:guid}` | Có UI gọi | `suppliersApi.update` | `src/features/agent/purchases/SuppliersPage.tsx:266` |
| POST | `/api/suppliers/{id:guid}/activate` | Có UI gọi | `suppliersApi.activate` | `src/features/agent/purchases/SuppliersPage.tsx:84` |
| POST | `/api/suppliers/{id:guid}/deactivate` | Có UI gọi | `suppliersApi.deactivate` | `src/features/agent/purchases/SuppliersPage.tsx:83` |
| DELETE | `/api/suppliers/{id:guid}` | Có UI gọi | `suppliersApi.remove` | `src/features/agent/purchases/SuppliersPage.tsx:96` |

## Tái tạo kết quả

Chạy `node scripts/audit-api-integration.mjs` từ Management-Webs; đường dẫn backend mặc định là repo Backend-Agrisage cùng cấp. Có thể truyền đường dẫn repo backend làm argument. Script chỉ đọc source code, không đọc cấu hình/secrets và không gọi mạng. Kết quả chi tiết gồm quyền controller/action, file/line, wrapper và callsite nằm trong [API_INTEGRATION_MATRIX.json](API_INTEGRATION_MATRIX.json). Inventory kiểm tra không có route rỗng hoặc trùng method/path. Không thay đổi backend, DB hoặc migration.
