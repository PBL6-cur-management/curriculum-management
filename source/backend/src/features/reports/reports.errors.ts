import { HttpStatus } from '@nestjs/common';

export const REPORT_ERRORS = {
  VERSION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'REPORT_VERSION_NOT_FOUND',
    message: 'Không tìm thấy phiên bản chương trình để lập báo cáo.',
  },
  SAME_PROGRAM: {
    status: HttpStatus.BAD_REQUEST,
    code: 'REPORT_SAME_PROGRAM',
    message: 'Chọn hai phiên bản của hai chương trình khác nhau để so sánh.',
  },
  NOT_ISSUED: {
    status: HttpStatus.CONFLICT,
    code: 'REPORT_VERSION_NOT_ISSUED',
    message:
      'Hồ sơ kiểm định chỉ lập cho phiên bản đã ban hành (chờ hiệu lực, đang hiệu lực hoặc lịch sử).',
  },
  GRADING_UNAVAILABLE: {
    status: HttpStatus.CONFLICT,
    code: 'REPORT_GRADING_UNAVAILABLE',
    message:
      'Chưa đủ dữ liệu đánh giá: có học phần chưa có đề cương ban hành hoặc chưa khai báo thành phần đánh giá. Hồ sơ không được lập thiếu.',
  },
  INTERVAL_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    code: 'REPORT_INTERVAL_INVALID',
    message:
      'Khoảng thời gian không hợp lệ (từ ngày phải trước hoặc bằng đến ngày).',
  },
} as const;
