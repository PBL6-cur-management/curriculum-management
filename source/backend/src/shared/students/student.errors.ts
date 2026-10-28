import { HttpStatus } from '@nestjs/common';

export const STUDENT_ERRORS = {
  STUDENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'STUDENT_NOT_FOUND',
    message: 'Không tìm thấy sinh viên.',
  },
  ENROLLMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'ENROLLMENT_NOT_FOUND',
    message:
      'Sinh viên chưa có quá trình theo học chương trình này tại học kỳ được hỏi.',
  },
  ENROLLMENT_AMBIGUOUS: {
    status: HttpStatus.CONFLICT,
    code: 'ENROLLMENT_AMBIGUOUS',
    message:
      'Có nhiều quá trình theo học trùng khoảng thời gian; cần Phòng Đào tạo rà soát.',
  },
  APPLIED_VERSION_UNRESOLVED: {
    status: HttpStatus.CONFLICT,
    code: 'APPLIED_VERSION_UNRESOLVED',
    message:
      'Chưa xác định được phiên bản chương trình áp dụng cho sinh viên tại học kỳ này.',
  },
  ENROLLMENT_COMMAND_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    code: 'ENROLLMENT_COMMAND_INVALID',
    message:
      'Yêu cầu theo học thiếu hoặc thừa thông tin so với thao tác đã chọn.',
  },
  PROGRAM_CONTEXT_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    code: 'PROGRAM_CONTEXT_REQUIRED',
    message: 'Cần chọn chương trình để xem hồ sơ sinh viên này.',
  },
  ENROLLMENT_STATE_CHANGED: {
    status: HttpStatus.CONFLICT,
    code: 'ENROLLMENT_STATE_CHANGED',
    message: 'Hồ sơ đã thay đổi; tải lại trang rồi thao tác lại.',
  },
  INVALID_ENROLLMENT_INTERVAL: {
    status: HttpStatus.CONFLICT,
    code: 'INVALID_ENROLLMENT_INTERVAL',
    message: 'Thao tác này không hợp lệ với quá trình theo học hiện tại.',
  },
  ACCOUNT_IDENTITY_CONFLICT: {
    status: HttpStatus.CONFLICT,
    code: 'ACCOUNT_IDENTITY_CONFLICT',
    message: 'Tài khoản trùng mã sinh viên thuộc một người dùng khác.',
  },
  STUDENT_CREDENTIALS_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'STUDENT_CREDENTIALS_UNAVAILABLE',
    message: 'Chưa cấu hình khóa bảo vệ mật khẩu ban đầu.',
  },
  CREDENTIALS_UNREADABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'CREDENTIALS_UNREADABLE',
    message:
      'Không giải mã được tệp mật khẩu ban đầu bằng khóa hiện tại; tệp chưa bị tiêu hủy.',
  },
  CREDENTIALS_EXPIRED: {
    status: HttpStatus.GONE,
    code: 'CREDENTIALS_EXPIRED',
    message: 'Tệp mật khẩu ban đầu đã hết hạn.',
  },
  CREDENTIALS_ALREADY_DOWNLOADED: {
    status: HttpStatus.GONE,
    code: 'CREDENTIALS_ALREADY_DOWNLOADED',
    message: 'Tệp mật khẩu ban đầu đã được tải xuống và không thể tải lại.',
  },
} as const;
