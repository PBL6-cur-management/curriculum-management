import { HttpStatus } from '@nestjs/common';

export const MAJOR_ERRORS = {
  MAJOR_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    code: 'MAJOR_NOT_FOUND',
    message: 'Không tìm thấy ngành đào tạo.',
  },
  MAJOR_CODE_TAKEN: {
    status: HttpStatus.CONFLICT,
    code: 'MAJOR_CODE_TAKEN',
    message: 'Mã ngành đã tồn tại trong hệ thống.',
  },
  FACULTY_INVALID: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: 'MAJOR_FACULTY_INVALID',
    message: 'Khoa quản lý không hợp lệ hoặc đã ngừng hoạt động.',
  },
  STATUS_UNCHANGED: {
    status: HttpStatus.CONFLICT,
    code: 'MAJOR_STATUS_UNCHANGED',
    message: 'Ngành đào tạo đang ở trạng thái này.',
  },
} as const;
