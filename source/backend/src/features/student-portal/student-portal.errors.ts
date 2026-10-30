import { HttpStatus } from '@nestjs/common';

export const PORTAL_ERRORS = {
  // Same answer whether the account has no student record or asks for someone else's row: nothing leaks.
  NO_STUDENT: {
    status: HttpStatus.NOT_FOUND,
    code: 'PORTAL_NO_STUDENT',
    message:
      'Tài khoản chưa được liên kết với hồ sơ sinh viên. Liên hệ Phòng Đào tạo.',
  },
  ITEM_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'PORTAL_ITEM_NOT_FOUND',
    message: 'Học phần không thuộc chương trình áp dụng cho bạn.',
  },
  SYLLABUS_NOT_ISSUED: {
    status: HttpStatus.NOT_FOUND,
    code: 'PORTAL_SYLLABUS_NOT_ISSUED',
    message:
      'Học phần này chưa có đề cương đã ban hành trong chương trình của bạn.',
  },
  ATTACHMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'PORTAL_ATTACHMENT_NOT_FOUND',
    message: 'Không tìm thấy tệp đính kèm của đề cương này.',
  },
} as const;
