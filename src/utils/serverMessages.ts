/**
 * Vietnamese text for the business-rule messages the backend sends in English (HTTP 400/403/409/422 `detail`).
 * Only known messages are translated; anything else is returned unchanged, so a new server message still shows
 * (in English) instead of being hidden. The backend message is the source of truth - keep these in step with it.
 */

const EXACT: Record<string, string> = {
  // Credit
  'Order amount must be non-negative money with at most two decimal places.': 'Giá trị đơn phải là số tiền không âm, tối đa hai chữ số thập phân.',
  'Invalid credit status.': 'Trạng thái tín dụng không hợp lệ.',
  'Credit tier code already exists.': 'Mã hạng tín dụng đã tồn tại.',
  'Unlink this tier from customer groups before deactivating it.': 'Hãy gỡ hạng này khỏi các nhóm khách hàng trước khi ngừng sử dụng.',
  'Credit tier or customer credit profile already exists.': 'Hạng tín dụng hoặc hồ sơ tín dụng của khách đã tồn tại.',
  'This customer already has a credit profile.': 'Khách hàng này đã có hồ sơ tín dụng.',
  'Choose a credit tier for this customer.': 'Hãy chọn hạng tín dụng cho khách hàng này.',
  'Credit tier must be active and belong to the active store.': 'Hạng tín dụng phải đang hoạt động và thuộc cửa hàng hiện tại.',
  'A reason is required for a credit change.': 'Cần nhập lý do khi thay đổi tín dụng.',
  'Walk-in customers cannot buy on credit.': 'Khách vãng lai không thể mua chịu.',
  'A walk-in customer cannot buy on credit.': 'Khách vãng lai không thể mua chịu.',
  'The order already has a credit reservation.': 'Đơn này đã được giữ hạn mức tín dụng.',
  'Payment does not cover the order total.': 'Số tiền thanh toán chưa đủ cho tổng giá trị đơn.',
  'Not enough sellable stock for the credit order.': 'Không đủ tồn kho có thể bán cho đơn chịu.',

  // Crop seasons
  'The crop season changed. Reload it before closing.': 'Vụ mùa vừa được thay đổi. Hãy tải lại rồi đóng vụ.',
  'The crop season changed. Reload it before saving.': 'Vụ mùa vừa được thay đổi. Hãy tải lại rồi lưu.',
  'Limit suggestions are only given for a closed season.': 'Chỉ có gợi ý hạn mức cho vụ đã đóng.',
  'The first season needs the date its order window opens (orderWindowStart).': 'Vụ đầu tiên cần ngày bắt đầu nhận đơn.',
  'A new season is added after the last one: its harvest must start after its order window opens.': 'Vụ mới được thêm sau vụ cuối: ngày bắt đầu thu hoạch phải sau ngày bắt đầu nhận đơn.',
  'Recorded debt can only be given a later due date, never an earlier one.': 'Khoản nợ đã ghi chỉ được dời sang hạn muộn hơn, không được sớm hơn.',
  'The linked seasonal rule does not belong to this store.': 'Quy tắc theo mùa đã chọn không thuộc cửa hàng này.',
  'The seasonal rule changed. Reload it before saving.': 'Quy tắc theo mùa vừa được thay đổi. Hãy tải lại rồi lưu.',
  'Every seasonal product must belong to the current store.': 'Mọi sản phẩm theo mùa phải thuộc cửa hàng hiện tại.',
  'The season does not exist in this store.': 'Vụ mùa không tồn tại trong cửa hàng này.',

  // Debt policy
  'The debt policy changed. Reload it before saving.': 'Chính sách công nợ vừa được thay đổi. Hãy tải lại rồi lưu.',

  // Rollover
  'A rollover needs a hardship reason code: MAT_MUA, THIEN_TAI, KHO_KHAN or KHAC.': 'Gia hạn cần mã lý do: Mất mùa, Thiên tai, Kinh tế khó khăn hoặc Khác.',
  'Unknown reason code. Use MAT_MUA, THIEN_TAI, KHO_KHAN, TRI_AN, SAI_SOT, KHONG_THU_HOI or KHAC.': 'Mã lý do không hợp lệ.',
  'A rollover needs a note.': 'Gia hạn cần có ghi chú.',
  'The target season does not exist in this store.': 'Vụ đích không tồn tại trong cửa hàng này.',
  'Debt can only move to a later season.': 'Khoản nợ chỉ có thể chuyển sang một vụ sau.',
  'No open season has a later due date; add the next season first.': 'Chưa có vụ nào còn mở với hạn trả muộn hơn. Hãy thêm vụ kế tiếp trước.',

  // Debt entries, repayments, returns
  'Amount must be positive money with at most two decimal places.': 'Số tiền phải lớn hơn 0, tối đa hai chữ số thập phân.',
  'Debt actions require a reason.': 'Cần nhập lý do cho thao tác này.',
  'The new due date cannot be in the past.': 'Hạn trả mới không được ở trong quá khứ.',
  'Unknown debt action.': 'Thao tác công nợ không hợp lệ.',
  'Manual debt requires a reason.': 'Ghi nợ thủ công cần có lý do.',
  'A due date is required without a season.': 'Cần nhập hạn trả khi không chọn vụ mùa.',
  'A paid debt repayment must name its customer.': 'Khoản trả nợ phải chỉ rõ khách hàng.',
  'The customer has no debt account in this store.': 'Khách hàng chưa có sổ nợ tại cửa hàng này.',
  'Allocations must uniquely target open debts and cover the entire payment.': 'Phân bổ phải nhắm vào các khoản nợ đang mở (mỗi khoản một lần) và bao phủ toàn bộ số tiền trả.',
  "Debt allocation exceeds the customer's current outstanding debt.": 'Số tiền phân bổ vượt quá dư nợ hiện tại của khách.',
  'Debt adjustment requires a received return and cannot exceed its value.': 'Chỉ điều chỉnh nợ cho phiếu trả hàng đã nhận và không vượt quá giá trị phiếu.',
  'A DEBT_REPAYMENT needs a farmerProfileId.': 'Thanh toán nợ cần chỉ rõ khách hàng.',
  'Payment date cannot be in the future.': 'Ngày thanh toán không được ở tương lai.',
  'Payment must be positive and within current outstanding debt.': 'Số tiền trả phải lớn hơn 0 và không vượt quá dư nợ hiện tại.',
  'Rejection requires a reason.': 'Từ chối cần có lý do.',
  'Only bank debt receipts use manual confirmation or rejection.': 'Chỉ biên nhận trả nợ bằng chuyển khoản mới cần xác nhận hoặc từ chối thủ công.',
  'Only pending payments can be reviewed.': 'Chỉ duyệt được các khoản thanh toán đang chờ.',
}

const CLOSING_REASONS: Record<string, string> = {
  ALREADY_CLOSED: 'vụ đã đóng',
  HARVEST_NOT_ENDED: 'vụ chưa hết thu hoạch',
  OPEN_ENTRIES: 'còn khoản nợ đang thu',
  OPEN_CREDIT_ORDERS: 'còn đơn chịu chưa xong',
}

/** Messages that carry a value (season code, number, date); the pattern captures it into the Vietnamese sentence. */
const PATTERNS: [RegExp, (...m: string[]) => string][] = [
  [/^Season '(.+)' is closed; debt cannot move into it\.$/, (_, c) => `Vụ '${c}' đã đóng, không thể chuyển nợ vào.`],
  [/^Season '(.+)' is closed; debt cannot be recorded in it\.$/, (_, c) => `Vụ '${c}' đã đóng, không thể ghi nợ vào.`],
  [/^Season '(.+)' is closed and can no longer change\.$/, (_, c) => `Vụ '${c}' đã đóng, không thể chỉnh sửa nữa.`],
  [/^Season code '(.+)' already exists in this store\.$/, (_, c) => `Mã vụ '${c}' đã tồn tại trong cửa hàng này.`],
  [/^The due date of season '(.+)' has passed; give a dueDate\.$/, (_, c) => `Hạn trả của vụ '${c}' đã qua, hãy nhập hạn trả cụ thể.`],
  [/^The harvest must start before the next season '(.+)' starts its harvest\.$/, (_, c) => `Ngày bắt đầu thu hoạch phải trước ngày bắt đầu thu hoạch của vụ kế tiếp '${c}'.`],
  [/^Season '(.+)' cannot be closed yet: (.+)\.$/, (_, c, r) => `Chưa thể đóng vụ '${c}': ${r.split(', ').map((x) => CLOSING_REASONS[x] ?? x).join('; ')}.`],
  [/^A new season opens its order window on (\d{4}-\d{2}-\d{2}), the harvest start of the last season \(no gap, no overlap\)\.$/, (_, d) => `Vụ mới bắt đầu nhận đơn vào ${d} (ngày bắt đầu thu hoạch của vụ cuối), không để hở hoặc chồng nhau.`],
  [/^Debt entry '(.+)' was already extended (\d+) time\(s\); the store owner decides further extensions\.$/, (_, n, k) => `Khoản nợ ${n} đã được gia hạn ${k} lần. Việc gia hạn tiếp theo do Chủ cửa hàng quyết định.`],
  [/^The new due date is more than (\d+) days after the original due date; confirm the override to go past the limit\.$/, (_, d) => `Hạn mới muộn hơn hạn gốc quá ${d} ngày. Hãy xác nhận cho phép vượt giới hạn để tiếp tục.`],
  [/^The new due date is more than (\d+) days after the original due date; only the store owner can extend further\.$/, (_, d) => `Hạn mới muộn hơn hạn gốc quá ${d} ngày. Chỉ Chủ cửa hàng mới được gia hạn thêm.`],
  [/^The season has (\d+) open entries; roll over at most (\d+) per call by listing entryIds\.$/, (_, n, m) => `Vụ có ${n} khoản nợ đang mở; mỗi lần chỉ gia hạn tối đa ${m} khoản. Hãy chọn bớt khoản.`],
]

export function translateServerMessage(message: string): string
export function translateServerMessage(message: string | undefined): string | undefined
export function translateServerMessage(message: string | undefined): string | undefined {
  if (!message) return message
  const text = message.trim()
  const exact = EXACT[text]
  if (exact) return exact
  for (const [pattern, build] of PATTERNS) {
    const m = pattern.exec(text)
    if (m) return build(...m)
  }
  return message
}
