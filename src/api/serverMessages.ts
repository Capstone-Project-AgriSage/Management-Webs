// The API words its server-side failures in English ("An unexpected error occurred."); staff read Vietnamese, so
// the generic ones are put into Vietnamese here. Any other detail (a specific business rule, the photo storage being
// down, ...) is the server's own explanation and is left exactly as it came.

export const SERVER_BUSY_MESSAGE = 'Hệ thống đang bận, vui lòng thử lại sau ít giây.'
export const SERVER_ERROR_MESSAGE = 'Máy chủ đang gặp sự cố, vui lòng thử lại sau.'

// What the API sends when the database has no free connection (GlobalExceptionHandler, status 503).
const BUSY_DETAIL = 'The system is busy. Please try again in a moment.'
const UNEXPECTED_DETAIL = 'An unexpected error occurred.'

export function friendlyServerDetail(status: number, detail: string | undefined): string | undefined {
  if (detail === BUSY_DETAIL) return SERVER_BUSY_MESSAGE
  if (status >= 500 && (!detail || detail === UNEXPECTED_DETAIL)) return SERVER_ERROR_MESSAGE
  return detail
}
